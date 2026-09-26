"use client";

import React, { useState } from "react";
import {
  Check,
  Zap,
  Sparkles,
  Shield,
  Clock,
  Printer,
  Boxes,
  PenTool,
  HelpCircle,
  X
} from "lucide-react";
import { PLANS, MOCK_SUBSCRIPTION, Plan } from "@/types/subscription";
import { QuotaBar } from "@/components/layout/QuotaBar";

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState<Plan | null>(null);
  const [upgradedPlanId, setUpgradedPlanId] = useState<string>("starter");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleConfirmUpgrade = () => {
    if (selectedPlanModal) {
      setUpgradedPlanId(selectedPlanModal.id);
      setSelectedPlanModal(null);
      showToast(`✓ Félicitations ! Votre compte est désormais sur le plan ${selectedPlanModal.name}.`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-studio-950 text-slate-100 font-sans p-6 sm:p-10">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-2xl border border-emerald-400/40 animate-bounce">
          {successToast}
        </div>
      )}

      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold mb-3">
          <Zap className="w-3.5 h-3.5" />
          <span>Plans d'abonnement flexibles</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
          Donnez vie à vos packagings avec une précision d'imprimerie
        </h1>
        <p className="text-sm text-studio-400 max-w-xl mx-auto">
          Du prototype 3D instantané jusqu'au BAT PDF certifié ISO 12647 et fichiers DXF pour tables Kongsberg & Zünd.
        </p>

        {/* Billing Switcher */}
        <div className="mt-6 inline-flex items-center bg-studio-900 border border-studio-800 rounded-xl p-1 gap-2">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              !annual ? "bg-studio-800 text-white shadow-sm" : "text-studio-500 hover:text-slate-300"
            }`}
          >
            Facturation Mensuelle
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              annual ? "bg-brand-600 text-white shadow-sm" : "text-studio-500 hover:text-slate-300"
            }`}
          >
            <span>Facturation Annuelle</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {PLANS.map((plan) => {
          const isCurrent = upgradedPlanId === plan.id;
          const price = annual ? plan.price_annual_usd : plan.price_usd;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 border ${
                plan.highlight
                  ? "bg-gradient-to-b from-brand-950/40 via-studio-900 to-studio-900 border-brand-500/50 shadow-2xl shadow-brand-500/10 scale-[1.02]"
                  : "bg-studio-900/60 border-studio-800 hover:border-studio-700"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                  {plan.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                      Plan Actif
                    </span>
                  )}
                </div>
                <p className="text-xs text-studio-400 mb-6">{plan.tagline}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl sm:text-4xl font-black text-white">
                    {price === 0 ? "0 €" : `${price} €`}
                  </span>
                  <span className="text-xs text-studio-500">/ mois</span>
                  {annual && price > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold ml-2">
                      (facturé annuellement)
                    </span>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 pt-6 border-t border-studio-800/80 mb-8">
                  {plan.features.map((feat) => (
                    <div key={feat.label} className="flex items-start gap-2.5 text-xs">
                      {feat.included ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-studio-800 text-studio-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <span className={feat.included ? "text-slate-200" : "text-studio-500 line-through"}>
                        {feat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  if (!isCurrent) {
                    setSelectedPlanModal(plan);
                  }
                }}
                disabled={isCurrent}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-studio-800 text-studio-500 cursor-default"
                    : plan.highlight
                    ? "bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/25 active:scale-98"
                    : "bg-studio-800 hover:bg-studio-700 text-white border border-studio-700 active:scale-98"
                }`}
              >
                {isCurrent ? "Votre plan actuel" : `Passer à ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Quota Overview Card */}
      <div className="max-w-4xl mx-auto rounded-2xl bg-studio-900 border border-studio-800 p-6 mb-12">
        <h3 className="text-sm font-bold text-white mb-1">
          Votre Consommation de Quotas
        </h3>
        <p className="text-xs text-studio-500 mb-4">
          Statistiques de votre forfait actuel ({upgradedPlanId.toUpperCase()})
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-studio-850 border border-studio-750">
            <div className="text-[11px] text-studio-400 mb-1">Projets actifs</div>
            <div className="text-xl font-bold text-white">
              {upgradedPlanId === "starter" ? "1 / 1" : upgradedPlanId === "pro" ? "4 / 10" : "4 / Illimité"}
            </div>
            <div className="w-full bg-studio-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-brand-500 h-full rounded-full"
                style={{ width: upgradedPlanId === "starter" ? "100%" : "40%" }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-studio-850 border border-studio-750">
            <div className="text-[11px] text-studio-400 mb-1">Exports BAT & DXF ce mois</div>
            <div className="text-xl font-bold text-white">
              {upgradedPlanId === "starter" ? "1 / 3" : upgradedPlanId === "pro" ? "12 / 50" : "12 / Illimité"}
            </div>
            <div className="w-full bg-studio-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-pink-500 h-full rounded-full"
                style={{ width: upgradedPlanId === "starter" ? "33%" : "24%" }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-studio-850 border border-studio-750">
            <div className="text-[11px] text-studio-400 mb-1">Crédits IA Logo / Badge</div>
            <div className="text-xl font-bold text-white">
              {upgradedPlanId === "starter" ? "2 / 5" : upgradedPlanId === "pro" ? "14 / 50" : "14 / 200"}
            </div>
            <div className="w-full bg-studio-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-violet-500 h-full rounded-full"
                style={{ width: upgradedPlanId === "starter" ? "40%" : "28%" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal Simulation */}
      {selectedPlanModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setSelectedPlanModal(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-md bg-studio-900 border border-studio-700 rounded-2xl shadow-2xl p-6 pointer-events-auto animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Passer au plan {selectedPlanModal.name}
                    </h4>
                    <p className="text-[11px] text-studio-500">
                      {annual ? "Facturé annuellement" : "Facturation mensuelle sans engagement"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlanModal(null)}
                  className="text-studio-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-studio-850 border border-studio-750 mb-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-studio-400">Montant :</span>
                  <span className="text-white font-bold">
                    {annual ? `${selectedPlanModal.price_annual_usd * 12} € / an` : `${selectedPlanModal.price_usd} € / mois`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-studio-400">Activation :</span>
                  <span className="text-emerald-400 font-semibold">Immédiate</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-studio-400">BAT PDF CMJN 300 DPI :</span>
                  <span className="text-slate-200">Inclus ✓</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedPlanModal(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-studio-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmUpgrade}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/25 transition-all"
                >
                  Confirmer et Activer
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
