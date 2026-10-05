"use client";

import React from "react";
import { X } from "lucide-react";
import type { PreflightReport } from "@/lib/structure";
import { ROLE_LABEL, fixLabel, sentence } from "./roleLabels";

/**
 * Export stopped by the preflight (phase 2C-4F-4): what is wrong, where, why and how to fix it. The
 * print file is never produced from here; "Corriger" applies the recommended positions (an explicit
 * action), the user then downloads again.
 */
export function PreflightDialog({ report, canFix, onFix, onClose }: { report: PreflightReport | null; canFix: boolean; onFix: () => void; onClose: () => void }) {
  if (!report || report.status !== "blocking") return null;
  const blocking = report.issues.filter((i) => i.blocking);
  const warnings = report.issues.filter((i) => !i.blocking);
  const title = `⛔ Impression bloquée : ${blocking.length} problème${blocking.length > 1 ? "s" : ""} bloquant${blocking.length > 1 ? "s" : ""}`;
  return (
    <div className="st-paywall-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lp st-paywall" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="st-paywall-close" onClick={onClose} aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        <h2>{title}</h2>
        <p>Le fichier d&apos;impression n&apos;a pas été créé : un élément obligatoire serait coupé, illisible ou mal placé sur le pot.</p>
        <ul className="mt-3 space-y-2 text-left text-sm">
          {blocking.map((i) => (
            <li key={i.elementId}>
              <strong>{ROLE_LABEL[i.role]}</strong> — {sentence(i.message)}
              <br />
              <span className="text-slate-500">{fixLabel(i)}</span>
            </li>
          ))}
        </ul>
        {warnings.length ? <p className="mt-3 text-sm text-slate-500">Et {warnings.length} avertissement{warnings.length > 1 ? "s" : ""} non bloquant{warnings.length > 1 ? "s" : ""}.</p> : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {canFix ? (
            <button type="button" className="lp-btn lp-btn-magenta" onClick={onFix}>
              Corriger avec la mise en page intelligente
            </button>
          ) : null}
          <button type="button" className="lp-btn lp-btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
