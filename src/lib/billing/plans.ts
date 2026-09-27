/**
 * Edify plans, priced in FCFA (XAF, identical to XOF). Prepaid periods: Mobile Money has no
 * card-style automatic renewal, so customers pay 1, 3 or 12 months upfront.
 * Server-safe: the payment route computes amounts from here, never from the client.
 */
export type PlanId = "essentiel" | "pro" | "entreprise";

/**
 * packagings = complete packagings per month (AI design + 3D mockup + ad visual + print files).
 * A packaging is counted the first time the AI designs it or it is downloaded; after that its
 * edits, exports and AI regenerations (up to AI_REGEN_PER_PACKAGING) are included.
 */
export const PLANS: Record<PlanId, { monthly: number; packagings: number }> = {
  essentiel: { monthly: 3000, packagings: 1 },
  pro: { monthly: 9750, packagings: 5 },
  entreprise: { monthly: 29999, packagings: 18 },
};

/** Fair use: AI regenerations allowed on one packaging. */
export const AI_REGEN_PER_PACKAGING = 15;

export const PERIODS = [
  { months: 1, discount: 0 },
  { months: 3, discount: 0.1 },
  { months: 12, discount: 0.2 },
] as const;

export type Months = (typeof PERIODS)[number]["months"];

/** Every plan includes every feature; plans differ by the number of packagings. */
export const hasProFeatures = (plan: string | null | undefined) => !!plan && plan !== "none";

export const isPlan = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
export const isMonths = (v: unknown): v is Months => PERIODS.some((p) => p.months === v);

/** Total in whole FCFA (Mobile Money amounts have no decimals). */
export function priceFor(plan: PlanId, months: Months) {
  const discount = PERIODS.find((p) => p.months === months)?.discount ?? 0;
  return Math.round(PLANS[plan].monthly * months * (1 - discount));
}

/** Packagings granted for the whole prepaid period (stored in profiles.credits). */
export const creditsFor = (plan: PlanId, months: Months) => PLANS[plan].packagings * months;
