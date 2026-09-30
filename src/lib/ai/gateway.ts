/**
 * AI Gateway — Phase 1: OBSERVABILITY ONLY.
 *
 * Wraps one provider call, measures it and records it in `ai_usage`. It is transparent:
 * it returns exactly what the wrapped function returns, rethrows exactly what it throws,
 * and never changes responses, credits, quotas or access. Recording failures are swallowed.
 *
 * Designed to host later (not active now): quotas, credits, feature flags, kill switches,
 * fallback policy, retries, caching and cost controls — all behind this single entry point.
 */
import { calculateAiCost } from "./costs";
import { recordAiUsage, type AiOperation } from "./usage";

export interface AiCallContext {
  operation: AiOperation;
  provider: "gemini" | "claude" | "cloudflare";
  model: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Handle given to the wrapped call to report what happened (all optional). */
export interface AiCallTracker {
  /** Exact model reported by the provider (e.g. Gemini `modelVersion` behind an alias). */
  model(model: string | null | undefined): void;
  tokens(t: { input?: number | null; output?: number | null; total?: number | null; audioInput?: number | null }): void;
  images(n: number, image?: { width: number; height: number; steps: number }): void;
  meta(m: Record<string, unknown>): void;
  /** Marks the call as failed without throwing (e.g. HTTP error handled by a fallback loop). */
  fail(code: string | number, message?: string): void;
}

/** Gemini `usageMetadata` → tokens (thinking tokens are billed as output). */
export function geminiTokens(json: unknown) {
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

export async function trackAiCall<T>(ctx: AiCallContext, fn: (t: AiCallTracker) => Promise<T>): Promise<T> {
  const started = Date.now();
  let model = ctx.model;
  let tokens: { input?: number | null; output?: number | null; total?: number | null; audioInput?: number | null } = {};
  let images = 0;
  let image: { width: number; height: number; steps: number } | undefined;
  let meta: Record<string, unknown> = { ...(ctx.metadata ?? {}) };
  let failure: { code: string; message: string | null } | null = null;

  const tracker: AiCallTracker = {
    model: (m) => { if (m) model = m; },
    tokens: (t) => { tokens = { ...tokens, ...t }; },
    images: (n, img) => { images = n; image = img ?? image; },
    meta: (m) => { meta = { ...meta, ...m }; },
    fail: (code, message) => { failure = { code: String(code), message: message ?? null }; },
  };

  const finish = (status: "success" | "error", err?: { code: string; message: string | null }) => {
    try {
      const cost = calculateAiCost({
        provider: ctx.provider,
        model,
        inputTokens: tokens.input ?? null,
        audioInputTokens: tokens.audioInput ?? null,
        outputTokens: tokens.output ?? null,
        imagesGenerated: images,
        image,
      });
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
        latencyMs: Date.now() - started,
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
    if (f) finish("error", f);
    else finish("success");
    return result;
  } catch (e) {
    const status = (e as { status?: unknown })?.status;
    const code = typeof status === "number" ? String(status) : e instanceof Error ? e.name : "error";
    finish("error", { code, message: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
