"use client";

import React, { useState } from "react";
import { X, Box, ChevronRight, LayoutTemplate } from "lucide-react";
import { TEMPLATES } from "@/lib/constants";
import { PackagingTemplate, BoxDimensions } from "@/types/packaging";
import { clsx } from "clsx";

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, template: PackagingTemplate, dimensions: BoxDimensions) => void;
  isQuotaFull?: boolean;
}

type Step = "name" | "template" | "dimensions";

const TEMPLATE_ICONS: Record<string, { emoji: string; color: string }> = {
  "reverse-tuck": { emoji: "📦", color: "from-violet-600/30 to-purple-900/20 border-violet-500/30" },
  "mailer-box":   { emoji: "📬", color: "from-blue-600/30 to-blue-900/20 border-blue-500/30" },
  "sleeve-tray":  { emoji: "🎁", color: "from-emerald-600/30 to-teal-900/20 border-emerald-500/30" },
  "crash-lock":   { emoji: "⚡", color: "from-amber-600/30 to-orange-900/20 border-amber-500/30" },
};

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  onClose,
  onCreate,
  isQuotaFull = false,
}) => {
  const [step, setStep] = useState<Step>("name");
  const [projectName, setProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PackagingTemplate>(TEMPLATES[0]);
  const [dimensions, setDimensions] = useState<BoxDimensions>(TEMPLATES[0].defaultDimensions);

  const canAdvanceFromName = projectName.trim().length >= 2;

  const handleTemplateSelect = (tpl: PackagingTemplate) => {
    setSelectedTemplate(tpl);
    setDimensions(tpl.defaultDimensions);
  };

  const handleCreate = () => {
    if (canAdvanceFromName) {
      onCreate(projectName.trim(), selectedTemplate, dimensions);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-2xl bg-studio-900 border border-studio-700 rounded-2xl shadow-2xl pointer-events-auto animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-studio-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
                <Box className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Nouveau Projet Packaging</h2>
                <p className="text-[11px] text-studio-500">
                  {step === "name" && "Étape 1 : Nom du projet"}
                  {step === "template" && "Étape 2 : Gabarit de dépouille"}
                  {step === "dimensions" && "Étape 3 : Dimensions personnalisées"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-studio-800 text-studio-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="px-6 pt-4 flex items-center gap-2">
            {(["name", "template", "dimensions"] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={clsx(
                    "flex items-center gap-1.5 text-[11px] font-medium transition-colors",
                    step === s ? "text-brand-400" : (
                      (step === "template" && i === 0) ||
                      (step === "dimensions" && i <= 1)
                        ? "text-emerald-400"
                        : "text-studio-500"
                    )
                  )}
                >
                  <div
                    className={clsx(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      step === s
                        ? "bg-brand-600 text-white"
                        : (
                          (step === "template" && i === 0) ||
                          (step === "dimensions" && i <= 1)
                            ? "bg-emerald-600 text-white"
                            : "bg-studio-800 text-studio-500"
                        )
                    )}
                  >
                    {i + 1}
                  </div>
                  <span className="hidden sm:inline">
                    {s === "name" && "Nom"}
                    {s === "template" && "Gabarit"}
                    {s === "dimensions" && "Dimensions"}
                  </span>
                </div>
                {i < 2 && (
                  <div className="flex-1 h-px bg-studio-800" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* ── STEP 1: Name ──────────────────────────────────────── */}
          {step === "name" && (
            <div className="px-6 py-5 space-y-4">
              {isQuotaFull ? (
                <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-4 text-center">
                  <p className="text-sm font-semibold text-red-400 mb-1">
                    Quota de projets atteint
                  </p>
                  <p className="text-xs text-studio-400">
                    Votre plan Starter est limité à 1 projet. Passez au plan Pro pour en créer davantage.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nom du projet *
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && canAdvanceFromName && setStep("template")}
                      placeholder="ex: Sérum Éclat Luxe — Coffret Premium"
                      className="input-base"
                    />
                    <p className="mt-1 text-[10px] text-studio-500">
                      Minimum 2 caractères · Ce nom sera visible dans votre dashboard
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-studio-850 border border-studio-700">
                    <div className="flex items-center gap-2 text-xs text-studio-400">
                      <LayoutTemplate className="w-3.5 h-3.5 text-brand-400" />
                      <span>
                        Après création, vous choisirez votre gabarit (ECMA / FEFCO) et pourrez
                        personnaliser les dimensions au millimètre.
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 2: Template ──────────────────────────────────── */}
          {step === "template" && (
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((tpl) => {
                  const meta = TEMPLATE_ICONS[tpl.id];
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => handleTemplateSelect(tpl)}
                      className={clsx(
                        "text-left p-4 rounded-xl border transition-all duration-150",
                        selectedTemplate.id === tpl.id
                          ? `bg-gradient-to-br ${meta.color} shadow-md scale-[1.02]`
                          : "bg-studio-850 border-studio-700 hover:bg-studio-800 hover:border-studio-600"
                      )}
                    >
                      <div className="text-2xl mb-2">{meta.emoji}</div>
                      <div className="text-xs font-bold text-white mb-0.5 line-clamp-1">
                        {tpl.name}
                      </div>
                      <div className="text-[10px] font-mono text-studio-400 mb-1.5">
                        {tpl.code}
                      </div>
                      <div className="text-[11px] text-studio-500 line-clamp-2">
                        {tpl.description}
                      </div>
                      {selectedTemplate.id === tpl.id && (
                        <div className="mt-2 text-[10px] text-brand-400 font-semibold">
                          ✓ Sélectionné
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: Dimensions ───────────────────────────────── */}
          {step === "dimensions" && (
            <div className="px-6 py-5">
              <div className="mb-3 p-2.5 rounded-lg bg-studio-850 border border-studio-700 flex items-center gap-2 text-[11px] text-studio-400">
                <span className="text-lg">{TEMPLATE_ICONS[selectedTemplate.id]?.emoji}</span>
                <span>Gabarit : <strong className="text-white">{selectedTemplate.name}</strong> ({selectedTemplate.code})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["length", "width", "height", "bleed", "safetyMargin", "tuckFlap"] as (keyof BoxDimensions)[]).map(
                  (key) => {
                    const labels: Record<string, string> = {
                      length: "Longueur L (mm)",
                      width: "Largeur W (mm)",
                      height: "Hauteur H (mm)",
                      bleed: "Fond perdu (mm)",
                      safetyMargin: "Zone tranquille (mm)",
                      tuckFlap: "Rabat rentrant (mm)",
                    };
                    return (
                      <div key={key}>
                        <label className="block text-[11px] font-medium text-studio-400 mb-1">
                          {labels[key]}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          value={dimensions[key]}
                          onChange={(e) =>
                            setDimensions((prev) => ({
                              ...prev,
                              [key]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="input-base font-mono"
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-studio-800 bg-studio-950/30">
            <button
              onClick={() => {
                if (step === "template") setStep("name");
                else if (step === "dimensions") setStep("template");
                else onClose();
              }}
              className="text-xs text-studio-400 hover:text-slate-200 transition-colors"
            >
              {step === "name" ? "Annuler" : "← Retour"}
            </button>

            <div className="flex items-center gap-2">
              {step !== "dimensions" ? (
                <button
                  onClick={() => {
                    if (step === "name" && canAdvanceFromName) setStep("template");
                    else if (step === "template") setStep("dimensions");
                  }}
                  disabled={step === "name" && !canAdvanceFromName}
                  className={clsx(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                    step === "name" && !canAdvanceFromName
                      ? "bg-studio-800 text-studio-500 cursor-not-allowed"
                      : "bg-brand-600 hover:bg-brand-500 text-white active:scale-95"
                  )}
                >
                  Suivant
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition-all active:scale-95 shadow-lg shadow-brand-600/25"
                >
                  ✓ Créer le projet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
