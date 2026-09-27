/**
 * Edify plans, priced in FCFA (XAF, identical to XOF). Prepaid periods: Mobile Money has no
 * card-style automatic renewal, so customers pay 1, 3 or 12 months upfront.
 * Server-safe: the payment route computes amounts from here, never from the client.
 */
export type PlanId = "essentiel" | "pro" | "entreprise";

export const PLANS: Record<PlanId, { monthly: number; credits: number }> = {
  essentiel: { monthly: 3000, credits: 15 },
  pro: { monthly: 10000, credits: 60 },
  entreprise: { monthly: 30000, credits: 250 },
};

export const PERIODS = [
  { months: 1, discount: 0 },
  { months: 3, discount: 0.1 },
  { months: 12, discount: 0.2 },
] as const;

export type Months = (typeof PERIODS)[number]["months"];

export const isPlan = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
export const isMonths = (v: unknown): v is Months => PERIODS.some((p) => p.months === v);

/** Total in FCFA, rounded to the nearest 100 (Mobile Money amounts are whole francs). */
export function priceFor(plan: PlanId, months: Months) {
  const discount = PERIODS.find((p) => p.months === months)?.discount ?? 0;
  return Math.round((PLANS[plan].monthly * months * (1 - discount)) / 100) * 100;
}

/** AI designs granted for the whole prepaid period. */
export const creditsFor = (plan: PlanId, months: Months) => PLANS[plan].credits * months;
