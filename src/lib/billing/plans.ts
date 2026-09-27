/**
 * Edify plans, priced in FCFA (XAF, identical to XOF). Prepaid periods: Mobile Money has no
 * card-style automatic renewal, so customers pay 1, 3 or 12 months upfront.
 * Server-safe: the payment route computes amounts from here, never from the client.
 */
export type PlanId = "essentiel" | "pro" | "entreprise";

export const PLANS: Record<PlanId, { monthly: number; credits: number }> = {
  essentiel: { monthly: 3000, credits: 20 },
  pro: { monthly: 9750, credits: 80 },
  entreprise: { monthly: 29999, credits: 300 },
};

export const PERIODS = [
  { months: 1, discount: 0 },
  { months: 3, discount: 0.1 },
  { months: 12, discount: 0.2 },
] as const;

export type Months = (typeof PERIODS)[number]["months"];

/** Features reserved to Pro and Business (the studio and the API both check it). */
export const PRO_FEATURES = ["ar", "zip", "aiDecor"] as const;
export const hasProFeatures = (plan: string | null | undefined) => plan === "pro" || plan === "entreprise";

export const isPlan = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
export const isMonths = (v: unknown): v is Months => PERIODS.some((p) => p.months === v);

/** Total in whole FCFA (Mobile Money amounts have no decimals). */
export function priceFor(plan: PlanId, months: Months) {
  const discount = PERIODS.find((p) => p.months === months)?.discount ?? 0;
  return Math.round(PLANS[plan].monthly * months * (1 - discount));
}

/** AI designs granted for the whole prepaid period. */
export const creditsFor = (plan: PlanId, months: Months) => PLANS[plan].credits * months;
