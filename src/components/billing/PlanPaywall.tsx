"use client";

import React from "react";
import { Smartphone, X } from "lucide-react";
import { useCopy, useLang } from "@/components/i18n/LangProvider";
import { landingCopy } from "@/components/landing/copy";

export type PaywallReason = "generate" | "export" | "credits" | "upgrade";

/** Shown in the studio when an action needs an active plan (AI design, downloads) or a higher one. */
export function PlanPaywall({ open, reason, onClose }: { open: boolean; reason: PaywallReason; onClose: () => void }) {
  const { lang, messages } = useLang();
  const t = useCopy("site").paywall;
  if (!open) return null;
  const plans = landingCopy(lang, messages).pricing.plans.filter((p) => reason !== "upgrade" || p.id !== "essentiel");
  const title = t[reason];
  const sub = t.sub;
  return (
    <div className="st-paywall-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lp st-paywall" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="st-paywall-close" onClick={onClose} aria-label={t.close}>
          <X className="w-5 h-5" />
        </button>
        <h2>{title}</h2>
        <p>{sub}</p>
        <div className="st-paywall-plans">
          {plans.map((p) => (
            <a key={p.id} href={`/abonnement?plan=${p.id}`} className={`st-paywall-plan ${p.featured ? "is-featured" : ""}`}>
              <strong>{p.name}</strong>
              <span>{p.price}<small>{t.perMonth}</small></span>
              <em>{p.features[0]}</em>
            </a>
          ))}
        </div>
        <a href="/abonnement?plan=pro" className="lp-btn lp-btn-magenta lp-btn-xl st-paywall-cta">
          <Smartphone className="w-5 h-5" /> {t.cta}
        </a>
      </div>
    </div>
  );
}
