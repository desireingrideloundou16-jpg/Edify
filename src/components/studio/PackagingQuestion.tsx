"use client";

import React from "react";
import { X } from "lucide-react";
import { CLARIFY_FAMILIES, CLARIFY_QUESTION, FAMILY_LABEL, type PackagingFamily } from "@/lib/catalog/packagingResolver";

export type PackagingAnswer = PackagingFamily | "unsure";

/**
 * The single question Edify asks when it cannot tell the packaging from the brief (phase 3C): human
 * families only, never a technical format. "Je ne sais pas" lets Edify recommend one.
 */
export function PackagingQuestion({ open, onAnswer, onCancel }: { open: boolean; onAnswer: (a: PackagingAnswer) => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="st-paywall-backdrop" role="dialog" aria-modal="true" aria-label={CLARIFY_QUESTION} onClick={onCancel}>
      <div className="lp st-paywall" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="st-paywall-close" onClick={onCancel} aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        <h2>{CLARIFY_QUESTION}</h2>
        <p>Votre description ne suffit pas pour choisir le contenant. Choisissez un type, Edify s&apos;occupe du reste.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {CLARIFY_FAMILIES.map((f) => (
            <button key={f} type="button" className="lp-btn lp-btn-ghost" onClick={() => onAnswer(f)}>
              {FAMILY_LABEL[f]}
            </button>
          ))}
          <button type="button" className="lp-btn lp-btn-magenta" onClick={() => onAnswer("unsure")}>
            Je ne sais pas
          </button>
        </div>
      </div>
    </div>
  );
}
