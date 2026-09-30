/**
 * AI Usage Service (server only): writes one `ai_usage` row per provider call.
 * Best effort by design — it never throws, never blocks the response (the insert runs after the
 * response when Next's `after()` is available) and never stores prompts, answers, files or secrets.
 */
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AiOperation = "suggest.generate" | "design.generate" | "image.illustration" | "image.scene" | "voice.generate";

export interface AiUsageRecord {
  userId: string | null;
  operation: AiOperation;
  provider: string;
  model: string | null;
  status: "success" | "error";
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  imagesGenerated: number;
  estimatedCostUsdMicros: number | null;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

/** Removes anything that looks like a credential from free text, then truncates. */
export function scrubSecrets(text: string, max = 300) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(sk|pk|rk|whsec|sk-ant|hf)_[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, "[redacted]")
    .replace(/([?&](key|api_key|token|access_token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]")
    .slice(0, max);
}

/** Keeps metadata small and flat: scalars only, short strings, no nested payloads. */
function safeMetadata(meta: Record<string, unknown>) {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta).slice(0, 20)) {
    if (v === null || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = scrubSecrets(v, 120);
  }
  return out;
}

export function toRow(r: AiUsageRecord) {
  const int = (n: number | null) => (n == null || !Number.isFinite(n) ? null : Math.max(0, Math.round(n)));
  return {
    user_id: r.userId,
    operation: r.operation,
    provider: r.provider.slice(0, 40),
    model: r.model ? r.model.slice(0, 120) : null,
    status: r.status,
    input_tokens: int(r.inputTokens),
    output_tokens: int(r.outputTokens),
    total_tokens: int(r.totalTokens),
    images_generated: int(r.imagesGenerated) ?? 0,
    estimated_cost_usd_micros: int(r.estimatedCostUsdMicros),
    latency_ms: int(r.latencyMs),
    error_code: r.errorCode ? r.errorCode.slice(0, 60) : null,
    error_message: r.errorMessage ? scrubSecrets(r.errorMessage) : null,
    metadata: safeMetadata(r.metadata),
  };
}

async function insert(row: ReturnType<typeof toRow>) {
  try {
    const { error } = await createAdminClient().from("ai_usage").insert(row);
    if (error) console.warn("[ai-usage] insert", error.message);
  } catch (e) {
    console.warn("[ai-usage] insert", e instanceof Error ? e.message : e);
  }
}

/** Never throws. Runs after the response when possible, otherwise in the background. */
export function recordAiUsage(record: AiUsageRecord): Promise<void> {
  let row: ReturnType<typeof toRow>;
  try {
    row = toRow(record);
  } catch {
    return Promise.resolve();
  }
  try {
    after(() => insert(row));
    return Promise.resolve();
  } catch {
    // Outside a request scope (scripts, tests): write directly.
    return insert(row);
  }
}
