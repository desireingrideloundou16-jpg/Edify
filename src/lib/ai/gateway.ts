/**
 * AI Gateway — Phase 1: OBSERVABILITY ONLY (shadow mode).
 *
 *   route → trackAiCall → provider call → result
 *                ↓
 *            ai_usage
 *
 * Wraps one provider call, measures it and records it in `ai_usage`. It is transparent:
 * it returns exactly what the wrapped function returns, rethrows exactly what it throws,
 * and never changes responses, credits, quotas or access. Recording failures are swallowed.
 *
 * This is the single entry point that will later host quotas, credits, feature flags,
 * kill switches, fallback policy, retries, caching and cost controls — none active now.
 */
import { performance } from "node:perf_hooks";
import { calculateAiCost, type AiCost } from "./costs";
import { recordAiUsage, type AiOperation, type AiUsageStatus } from "./usage";
import { logEvent } from "@/lib/log";

export type AiProviderName = "gemini" | "claude" | "cloudflare";

export interface AiCallContext {
  operation: AiOperation;
  provider: AiProviderName;
  model: string | null;
  userId?: string | null;
  /** Provider/model tried just before this one in the same request (fallback chain). */
  fallbackFrom?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AiTokens {
  input?: number | null;
  output?: number | null;
  total?: number | null;
  /** Part of `input` that is audio (priced separately by some Gemini models). */
  audioInput?: number | null;
}

/** Handle given to the wrapped call to report what happened (all optional). */
export interface AiCallTracker {
  /** Exact model reported by the provider (e.g. Gemini `modelVersion` behind an alias). */
  model(model: string | null | undefined): void;
  tokens(t: AiTokens): void;
  images(n: number, image?: { width: number; height: number; steps: number }): void;
  meta(m: Record<string, unknown>): void;
  /** Marks the call as failed without throwing (e.g. HTTP error handled by a fallback loop). */
  fail(code: string | number, message?: string): void;
  /** Marks the (upcoming) failure as a timeout — for wrappers that convert timeouts into other errors. */
  timedOut(): void;
}

// ─── Provider usage parsers (only fields the providers really return) ─────────

/** Gemini REST `usageMetadata` → tokens (thinking tokens are billed as output). */
export function geminiTokens(json: unknown): AiTokens | null {
  const u = (json as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!u) return null;
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const details = Array.isArray(u.promptTokensDetails) ? (u.promptTokensDetails as { modality?: string; tokenCount?: number }[]) : [];
  return {
    input: num(u.promptTokenCount),
    output: num(u.candidatesTokenCount) + num(u.thoughtsTokenCount),
    total: num(u.totalTokenCount) || undefined,
    audioInput: details.filter((d) => d.modality === "AUDIO").reduce((a, d) => a + (d.tokenCount ?? 0), 0),
  };
}

/** Anthropic SDK `message.usage` → tokens (cache reads/writes are input tokens). */
export function claudeTokens(usage: unknown): AiTokens | null {
  const u = usage as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null;
  if (!u || typeof u.input_tokens !== "number") return null;
  return { input: u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), output: u.output_tokens ?? 0 };
}

function classify(e: unknown, timedOut: boolean): { status: AiUsageStatus; code: string; message: string } {
  const name = e instanceof Error ? e.name : "";
  const message = e instanceof Error ? e.message : String(e);
  const httpStatus = (e as { status?: unknown })?.status;
  if (timedOut || name === "TimeoutError") return { status: "timeout", code: "timeout", message };
  if (name === "AbortError") return { status: "cancelled", code: "aborted", message };
  return { status: "error", code: typeof httpStatus === "number" ? String(httpStatus) : name || "error", message };
}

export async function trackAiCall<T>(ctx: AiCallContext, fn: (t: AiCallTracker) => Promise<T>): Promise<T> {
  const started = performance.now();
  let model = ctx.model;
  let tokens: AiTokens = {};
  let images = 0;
  let image: { width: number; height: number; steps: number } | undefined;
  let meta: Record<string, unknown> = { ...(ctx.metadata ?? {}), ...(ctx.fallbackFrom ? { fallbackFrom: ctx.fallbackFrom } : {}) };
  let failure: { code: string; message: string | null } | null = null;
  let timedOut = false;

  const tracker: AiCallTracker = {
    model: (m) => { if (m) model = m; },
    tokens: (t) => { tokens = { ...tokens, ...t }; },
    images: (n, img) => { images = n; image = img ?? image; },
    meta: (m) => { meta = { ...meta, ...m }; },
    fail: (code, message) => { failure = { code: String(code), message: message ?? null }; },
    timedOut: () => { timedOut = true; },
  };

  const finish = (status: AiUsageStatus, err?: { code: string; message: string | null }) => {
    try {
      let cost: AiCost = { estimatedCostUsdMicros: null, basis: "unknown" };
      try {
        cost = calculateAiCost({
          provider: ctx.provider,
          model,
          inputTokens: tokens.input ?? null,
          audioInputTokens: tokens.audioInput ?? null,
          outputTokens: tokens.output ?? null,
          imagesGenerated: images,
          image,
        });
      } catch (e) {
        logEvent("warn", "AI_COST_CALCULATION_ERROR", { operation: ctx.operation, provider: ctx.provider, model, reason: e instanceof Error ? e.message : String(e) });
      }
      if (status !== "success") {
        logEvent("warn", "AI_PROVIDER_ERROR", { operation: ctx.operation, provider: ctx.provider, model, status, code: err?.code ?? null });
      }
      const total = tokens.total ?? (tokens.input != null || tokens.output != null ? (tokens.input ?? 0) + (tokens.output ?? 0) : null);
      void recordAiUsage({
        userId: ctx.userId ?? null,
        operation: ctx.operation,
        provider: ctx.provider,
        model,
        status,
        inputTokens: tokens.input ?? null,
        outputTokens: tokens.output ?? null,
        totalTokens: total,
        imagesGenerated: images,
        estimatedCostUsdMicros: cost.estimatedCostUsdMicros,
        latencyMs: Math.round(performance.now() - started),
        errorCode: err?.code ?? null,
        errorMessage: err?.message ?? null,
        metadata: { ...meta, costBasis: cost.basis },
      });
    } catch {
      // observability must never affect the call
    }
  };

  try {
    const result = await fn(tracker);
    const f = failure as { code: string; message: string | null } | null;
    if (f) finish(timedOut ? "timeout" : "error", f);
    else finish("success");
    return result;
  } catch (e) {
    const c = classify(e, timedOut);
    finish(c.status, { code: c.code, message: c.message });
    throw e;
  }
}

/**
 * The customer received Edify's deterministic fallback instead of an AI answer (offline
 * designer, local suggestions). No provider call, no cost — recorded to measure degradation.
 */
export function recordAiFallback(input: { operation: AiOperation; userId?: string | null; reason: string; fallbackFrom?: string | null }) {
  try {
    logEvent("info", "AI_FALLBACK_USED", { operation: input.operation, reason: input.reason });
    void recordAiUsage({
      userId: input.userId ?? null,
      operation: input.operation,
      provider: "edify",
      model: "deterministic",
      status: "fallback",
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      imagesGenerated: 0,
      estimatedCostUsdMicros: 0,
      latencyMs: 0,
      errorCode: null,
      errorMessage: null,
      metadata: { reason: input.reason, ...(input.fallbackFrom ? { fallbackFrom: input.fallbackFrom } : {}) },
    });
  } catch {
    // never affects the response
  }
}
