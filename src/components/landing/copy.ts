/** Landing copy for a language, with the plans (prices from lib/billing/plans). */
import { fcfa, fmt, type Lang } from "@/lib/i18n/config";
import { localize, type Messages } from "@/lib/i18n/localize";
import { PLANS, type PlanId } from "@/lib/billing/plans";

export function landingCopy(lang: Lang, messages?: Messages) {
  const t = localize("landing", lang, messages);
  const plans = (Object.keys(PLANS) as PlanId[]).map((id) => {
    const p = t.pricing.plans[id];
    return {
      id,
      name: p.name,
      desc: p.desc,
      features: p.features.map((f) => fmt(f, { credits: PLANS[id].credits })),
      price: fcfa(PLANS[id].monthly, lang),
      featured: id === "pro",
    };
  });
  return { ...t, pricing: { ...t.pricing, plans }, examples: localize("showcase", lang, messages).prompts };
}

export type LandingCopy = ReturnType<typeof landingCopy>;
