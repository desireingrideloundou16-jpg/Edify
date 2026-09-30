import { describe, expect, it } from "vitest";
import { calculateAiCost, findGeminiRate } from "@/lib/ai/costs";

describe("calculateAiCost", () => {
  it("Gemini : tokens × tarif public documenté, en micro-dollars entiers", () => {
    // gemini-2.5-flash: $0.30 / 1M input, $2.50 / 1M output
    const c = calculateAiCost({ provider: "gemini", model: "gemini-2.5-flash", inputTokens: 10_000, outputTokens: 1_000 });
    expect(c).toEqual({ estimatedCostUsdMicros: 3000 + 2500, basis: "list_price_estimate" });
    expect(Number.isInteger(c.estimatedCostUsdMicros)).toBe(true);
  });

  it("Gemini : l'audio est facturé au tarif audio quand il existe", () => {
    // gemini-2.5-flash: audio input $1.00 / 1M
    const c = calculateAiCost({ provider: "gemini", model: "gemini-2.5-flash", inputTokens: 1_000, audioInputTokens: 800, outputTokens: 0 });
    expect(c.estimatedCostUsdMicros).toBe(200 * 0.3 + 800 * 1.0);
  });

  it("Gemini : version datée du modèle et changement de tarif au 1er janvier 2027", () => {
    expect(findGeminiRate("models/gemini-3.8-flash-preview-09-2026", new Date("2026-10-01"))?.input).toBe(0.75);
    expect(findGeminiRate("gemini-3.8-flash", new Date("2027-01-02"))?.input).toBe(1.5);
    // flash-lite must not be priced as flash
    expect(findGeminiRate("gemini-3.5-flash-lite")?.input).toBe(0.3);
  });

  it("modèle inconnu, alias non résolu ou tokens absents → null (jamais un tarif inventé)", () => {
    expect(calculateAiCost({ provider: "gemini", model: "gemini-flash-latest", inputTokens: 10, outputTokens: 10 })).toEqual({ estimatedCostUsdMicros: null, basis: "unknown" });
    expect(calculateAiCost({ provider: "gemini", model: "gemini-2.5-flash", inputTokens: null, outputTokens: 10 }).estimatedCostUsdMicros).toBeNull();
    expect(calculateAiCost({ provider: "claude", model: "claude-opus-5", inputTokens: 10, outputTokens: 10 }).estimatedCostUsdMicros).toBeNull();
  });

  it("Cloudflare FLUX schnell : tuiles 512×512 + pas de diffusion", () => {
    // 1024×1024 = 4 tiles × $0.0000528 + 8 steps × $0.0001056 = $0.001056
    const c = calculateAiCost({ provider: "cloudflare", model: "@cf/black-forest-labs/flux-1-schnell", imagesGenerated: 1, image: { width: 1024, height: 1024, steps: 8 } });
    expect(c.estimatedCostUsdMicros).toBe(1056);
    expect(calculateAiCost({ provider: "cloudflare", model: "@cf/black-forest-labs/flux-1-schnell", imagesGenerated: 0, image: { width: 1024, height: 1024, steps: 8 } }).estimatedCostUsdMicros).toBe(0);
  });
});
