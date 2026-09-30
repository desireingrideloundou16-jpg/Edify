/**
 * The AI Gateway (phase 1) is observability only: it must return/rethrow exactly what the
 * wrapped call does, record one ai_usage row per call, and never fail because of recording.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordAiUsage } = vi.hoisted(() => ({ recordAiUsage: vi.fn(async (..._args: unknown[]) => {}) }));
vi.mock("@/lib/ai/usage", () => ({ recordAiUsage }));

import { geminiTokens, trackAiCall } from "@/lib/ai/gateway";

const lastRecord = () => recordAiUsage.mock.calls.at(-1)?.[0] as Record<string, unknown>;

describe("trackAiCall", () => {
  beforeEach(() => recordAiUsage.mockClear());

  it("succès : renvoie exactement le résultat et enregistre tokens, modèle réel et coût estimé", async () => {
    const result = { spec: "unchanged" };
    const out = await trackAiCall({ operation: "design.generate", provider: "gemini", model: "gemini-flash-latest", userId: "u1" }, async (t) => {
      t.model("gemini-2.5-flash");
      t.tokens({ input: 10_000, output: 1_000 });
      return result;
    });
    expect(out).toBe(result);
    expect(recordAiUsage).toHaveBeenCalledTimes(1);
    expect(lastRecord()).toMatchObject({
      userId: "u1", operation: "design.generate", provider: "gemini", model: "gemini-2.5-flash", status: "success",
      inputTokens: 10_000, outputTokens: 1_000, totalTokens: 11_000, estimatedCostUsdMicros: 5500, errorCode: null,
    });
    expect(typeof lastRecord().latencyMs).toBe("number");
  });

  it("exception : la relance à l'identique et enregistre une erreur avec le code HTTP", async () => {
    const err = Object.assign(new Error("quota dépassé"), { status: 429 });
    await expect(trackAiCall({ operation: "voice.generate", provider: "gemini", model: "gemini-2.5-flash" }, async () => { throw err; })).rejects.toBe(err);
    expect(lastRecord()).toMatchObject({ status: "error", errorCode: "429", errorMessage: "quota dépassé", estimatedCostUsdMicros: null });
  });

  it("échec signalé sans exception (repli) : résultat inchangé, statut erreur", async () => {
    const out = await trackAiCall({ operation: "suggest.generate", provider: "gemini", model: "gemini-flash-lite-latest" }, async (t) => {
      t.fail(503);
      return null;
    });
    expect(out).toBeNull();
    expect(lastRecord()).toMatchObject({ status: "error", errorCode: "503" });
  });

  it("images : compte l'image et chiffre le rendu FLUX", async () => {
    await trackAiCall({ operation: "image.scene", provider: "cloudflare", model: "@cf/black-forest-labs/flux-1-schnell", userId: "u1" }, async (t) => {
      t.images(1, { width: 1024, height: 1024, steps: 8 });
      return "img";
    });
    expect(lastRecord()).toMatchObject({ status: "success", imagesGenerated: 1, estimatedCostUsdMicros: 1056 });
  });

  it("une panne de l'enregistrement ne casse jamais l'appel", async () => {
    recordAiUsage.mockImplementationOnce(() => { throw new Error("db down"); });
    await expect(trackAiCall({ operation: "design.generate", provider: "gemini", model: "x" }, async () => 42)).resolves.toBe(42);
  });
});

describe("geminiTokens", () => {
  it("lit usageMetadata (réflexion comptée en sortie, audio isolé)", () => {
    expect(
      geminiTokens({
        usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 100, thoughtsTokenCount: 50, totalTokenCount: 1050, promptTokensDetails: [{ modality: "AUDIO", tokenCount: 600 }, { modality: "TEXT", tokenCount: 300 }] },
      })
    ).toEqual({ input: 900, output: 150, total: 1050, audioInput: 600 });
    expect(geminiTokens({})).toBeNull();
  });
});

describe("trackAiCall — statuts, repli et latence", () => {
  beforeEach(() => recordAiUsage.mockClear());

  it("délai dépassé (TimeoutError) → statut timeout, erreur d'origine relancée", async () => {
    const err = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    await expect(trackAiCall({ operation: "voice.generate", provider: "gemini", model: "m" }, async () => { throw err; })).rejects.toBe(err);
    expect(lastRecord()).toMatchObject({ status: "timeout", errorCode: "timeout" });
  });

  it("délai converti en autre erreur par le client (timedOut) → statut timeout", async () => {
    const err = Object.assign(new Error("trop lent"), { status: 503 });
    await expect(trackAiCall({ operation: "design.generate", provider: "gemini", model: "m" }, async (t) => { t.timedOut(); throw err; })).rejects.toBe(err);
    expect(lastRecord()).toMatchObject({ status: "timeout" });
  });

  it("requête annulée (AbortError) → statut cancelled", async () => {
    const err = Object.assign(new Error("aborted"), { name: "AbortError" });
    await expect(trackAiCall({ operation: "design.generate", provider: "gemini", model: "m" }, async () => { throw err; })).rejects.toBe(err);
    expect(lastRecord()).toMatchObject({ status: "cancelled", errorCode: "aborted" });
  });

  it("enregistre le fournisseur précédent de la chaîne de repli et une latence mesurée", async () => {
    await trackAiCall({ operation: "design.generate", provider: "gemini", model: "gemini-flash-latest", fallbackFrom: "gemini:gemini-3.8-flash" }, async () => {
      await new Promise((r) => setTimeout(r, 15));
      return "ok";
    });
    const rec = lastRecord();
    expect((rec.metadata as Record<string, unknown>).fallbackFrom).toBe("gemini:gemini-3.8-flash");
    expect(rec.latencyMs as number).toBeGreaterThanOrEqual(10);
    expect(rec.userId).toBeNull(); // no user id → null, never a guess
  });
});

describe("recordAiFallback", () => {
  it("trace le repli déterministe d'Edify (sans appel fournisseur, coût 0)", async () => {
    const { recordAiFallback } = await import("@/lib/ai/gateway");
    recordAiUsage.mockClear();
    recordAiFallback({ operation: "design.generate", userId: "u1", reason: "providers_failed" });
    expect(lastRecord()).toMatchObject({ provider: "edify", status: "fallback", estimatedCostUsdMicros: 0, userId: "u1" });
  });
});

describe("claudeTokens", () => {
  it("additionne les tokens de cache à l'entrée ; usage absent → null", async () => {
    const { claudeTokens } = await import("@/lib/ai/gateway");
    expect(claudeTokens({ input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 })).toEqual({ input: 1000, output: 40 });
    expect(claudeTokens(undefined)).toBeNull();
  });
});
