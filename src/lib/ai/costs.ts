/**
 * Central, documented AI price list → ESTIMATED cost of one provider call.
 *
 * - Every rate below is copied from the provider's public pricing page (see `source`) on the
 *   date in `checkedAt`. Edit this file when prices change; nothing else hard-codes a price.
 * - Results are list-price ESTIMATES in integer micro-dollars (1 USD = 1 000 000 µ$). They are
 *   never accounting data: free tiers, discounts, caching and currency are ignored.
 * - Unknown provider/model → `null` (never a guess presented as real).
 */

export type AiProvider = "gemini" | "claude" | "cloudflare";

export const PRICING_SOURCES = {
  gemini: { url: "https://ai.google.dev/gemini-api/docs/pricing", checkedAt: "2026-09-30" },
  cloudflare: { url: "https://developers.cloudflare.com/workers-ai/platform/pricing/", checkedAt: "2026-09-30" },
} as const;

/** Paid-tier USD per 1M tokens. `audioInput` when the provider prices audio input separately. */
interface TokenRate {
  model: string;
  input: number;
  audioInput?: number;
  output: number;
  /** Inclusive ISO date range where this rate applies (open-ended when omitted). */
  from?: string;
  until?: string;
}

export const GEMINI_RATES: TokenRate[] = [
  { model: "gemini-3.8-flash", input: 0.75, output: 3.75, until: "2026-12-31" },
  { model: "gemini-3.8-flash", input: 1.5, output: 7.5, from: "2027-01-01" },
  { model: "gemini-3.7-flash", input: 0.75, output: 3.75, until: "2026-12-31" },
  { model: "gemini-3.7-flash", input: 1.5, output: 7.5, from: "2027-01-01" },
  { model: "gemini-3.6-flash", input: 0.75, output: 3.75, until: "2026-12-31" },
  { model: "gemini-3.6-flash", input: 1.5, output: 7.5, from: "2027-01-01" },
  { model: "gemini-3.5-flash-lite", input: 0.3, output: 2.5 },
  { model: "gemini-3.5-flash", input: 1.5, output: 9.0 },
  { model: "gemini-3.1-flash-lite", input: 0.25, audioInput: 0.5, output: 1.5 },
  { model: "gemini-2.5-flash-lite", input: 0.1, audioInput: 0.3, output: 0.4 },
  { model: "gemini-2.5-flash", input: 0.3, audioInput: 1.0, output: 2.5 },
];

/** Cloudflare Workers AI, FLUX.1 [schnell]: USD per 512×512 tile and per diffusion step. */
export const FLUX_SCHNELL = { model: "@cf/black-forest-labs/flux-1-schnell", perTile: 0.0000528, perStep: 0.0001056 };

export interface AiCostInput {
  provider: string;
  model?: string | null;
  inputTokens?: number | null;
  /** Part of inputTokens that is audio (priced separately by some Gemini models). */
  audioInputTokens?: number | null;
  outputTokens?: number | null;
  imagesGenerated?: number | null;
  image?: { width: number; height: number; steps: number };
  at?: Date;
}

export interface AiCost {
  estimatedCostUsdMicros: number | null;
  /** "list_price_estimate" when a documented rate was found, "unknown" otherwise. */
  basis: "list_price_estimate" | "unknown";
}

const UNKNOWN: AiCost = { estimatedCostUsdMicros: null, basis: "unknown" };

/**
 * Exact model id → rate. Provider answers may carry a version suffix
 * ("gemini-2.5-flash-001", "models/gemini-3.8-flash"): the longest known prefix wins.
 * Aliases such as "gemini-flash-latest" are NOT resolved here (unknown → null).
 */
export function findGeminiRate(model: string, at: Date = new Date()): TokenRate | null {
  const id = model.replace(/^models\//, "").toLowerCase();
  const day = at.toISOString().slice(0, 10);
  const candidates = GEMINI_RATES.filter(
    (r) => (id === r.model || id.startsWith(r.model + "-")) && (!r.from || day >= r.from) && (!r.until || day <= r.until)
  );
  return candidates.sort((a, b) => b.model.length - a.model.length)[0] ?? null;
}

export function calculateAiCost(input: AiCostInput): AiCost {
  const at = input.at ?? new Date();
  if (input.provider === "gemini") {
    if (!input.model || input.inputTokens == null || input.outputTokens == null) return UNKNOWN;
    const rate = findGeminiRate(input.model, at);
    if (!rate) return UNKNOWN;
    const audio = Math.max(0, Math.min(input.audioInputTokens ?? 0, input.inputTokens));
    const text = input.inputTokens - audio;
    // USD per 1M tokens = micro-dollars per token.
    const micros = text * rate.input + audio * (rate.audioInput ?? rate.input) + input.outputTokens * rate.output;
    return { estimatedCostUsdMicros: Math.round(micros), basis: "list_price_estimate" };
  }
  if (input.provider === "cloudflare") {
    if (input.model !== FLUX_SCHNELL.model || !input.image) return UNKNOWN;
    if (!input.imagesGenerated) return { estimatedCostUsdMicros: 0, basis: "list_price_estimate" };
    const tiles = Math.ceil(input.image.width / 512) * Math.ceil(input.image.height / 512);
    const usd = input.imagesGenerated * (tiles * FLUX_SCHNELL.perTile + input.image.steps * FLUX_SCHNELL.perStep);
    return { estimatedCostUsdMicros: Math.round(usd * 1_000_000), basis: "list_price_estimate" };
  }
  // Claude and any other provider: no verified public rate recorded yet.
  return UNKNOWN;
}
