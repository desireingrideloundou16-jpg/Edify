/**
 * Minimal structured server logs: one JSON line per event, with a stable code
 * (e.g. AI_USAGE_RECORD_FAILED) so logs can be searched and alerted on in Vercel.
 * Never pass secrets, prompts, AI answers or user files in `fields`.
 */
export type LogCode =
  | "AI_USAGE_RECORD_FAILED"
  | "AI_PROVIDER_ERROR"
  | "AI_COST_CALCULATION_ERROR"
  | "AI_FALLBACK_USED"
  | "PACKAGING_SHADOW"
  | "DESIGN_GRAMMAR_SHADOW"
  | "CATEGORY_KNOWLEDGE_SHADOW"
  | "REFERENCE_SHADOW"
  | "MASTER_DESIGN_INTENT_SHADOW";

export function logEvent(level: "info" | "warn" | "error", code: LogCode, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, code, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
