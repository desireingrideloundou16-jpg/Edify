"use client";

import React from "react";
import { Smartphone, X } from "lucide-react";
import { useLang } from "@/components/i18n/LangProvider";
import { landingCopy } from "@/components/landing/copy";

/** Shown in the studio when an action needs an active plan (AI design, downloads). */
export function PlanPaywall({ open, reason, onClose }: { open: boolean; reason: "generate" | "export" | "credits"; onClose: () => void }) {
  const { lang } = useLang();
  if (!open) return null;
  const fr = lang === "fr";
  const plans = landingCopy(lang).pricing.plans;
  const title = {
    generate: fr ? "Activez votre abonnement pour lancer l'IA" : "Activate your plan to run the AI",
    export: fr ? "Un abonnement est nécessaire pour télécharger" : "A plan is needed to download",
    credits: fr ? "Vous avez utilisé toutes vos créations IA" : "You've used all your AI designs",
  }[reason];
  const sub = fr
    ? "Votre brief est gardé : il sera généré dès que votre abonnement est actif. Paiement par MTN MoMo ou Orange Money."
    : "Your brief is saved: it will be generated as soon as your plan is active. Pay with MTN MoMo or Orange Money.";
  return (
    <div className="st-paywall-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lp st-paywall" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="st-paywall-close" onClick={onClose} aria-label={fr ? "Fermer" : "Close"}>
          <X className="w-5 h-5" />
        </button>
        <h2>{title}</h2>
        <p>{sub}</p>
        <div className="st-paywall-plans">
          {plans.map((p) => (
            <a key={p.id} href={`/abonnement?plan=${p.id}`} className={`st-paywall-plan ${p.featured ? "is-featured" : ""}`}>
              <strong>{p.name}</strong>
              <span>{p.price}<small>{fr ? " / mois" : " / month"}</small></span>
              <em>{p.features[0]}</em>
            </a>
          ))}
        </div>
        <a href="/abonnement?plan=pro" className="lp-btn lp-btn-magenta lp-btn-xl st-paywall-cta">
          <Smartphone className="w-5 h-5" /> {fr ? "Choisir mon abonnement" : "Choose my plan"}
        </a>
      </div>
    </div>
  );
}
