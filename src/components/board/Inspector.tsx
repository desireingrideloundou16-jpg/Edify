"use client";

import React, { useState } from "react";
import { 
  BoxDimensions, 
  MaterialOption, 
  LayerVisibility, 
  Unit 
} from "@/types/packaging";
import { MATERIALS } from "@/lib/constants";
import { 
  Sliders, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  Info, 
  Eye, 
  EyeOff, 
  Scale, 
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface InspectorProps {
  dimensions: BoxDimensions;
  onChangeDimensions: (dims: BoxDimensions) => void;
  material: MaterialOption;
  onSelectMaterial: (mat: MaterialOption) => void;
  layers: LayerVisibility;
  onToggleLayer: (layerKey: keyof LayerVisibility) => void;
  unit: Unit;
}

export const Inspector: React.FC<InspectorProps> = ({
  dimensions,
  onChangeDimensions,
  material,
  onSelectMaterial,
  layers,
  onToggleLayer,
  unit,
}) => {
  const [activeTab, setActiveTab] = useState<"dimensions" | "materials" | "layers" | "preflight">("dimensions");

  const updateDim = (key: keyof BoxDimensions, value: number) => {
    onChangeDimensions({
      ...dimensions,
      [key]: Math.max(0, value),
    });
  };

  const { length: L, width: W, height: H, glueFlap: G, caliper: C } = dimensions;

  // Engineering calculations
  const developedWidthMm = Math.round(L * 2 + W * 2 + G);
  const developedHeightMm = Math.round(H + W * 2 + dimensions.tuckFlap * 2);
  const sheetAreaM2 = ((developedWidthMm + dimensions.bleed * 2) * (developedHeightMm + dimensions.bleed * 2)) / 1_000_000;
  const estimatedWeightGrams = Math.round(sheetAreaM2 * material.grammage);
  const volumeCm3 = Math.round((L * W * H) / 1000);

  return (
    <aside className="w-80 bg-studio-900 border-l border-studio-800 flex flex-col h-full z-20 select-none overflow-hidden">
      {/* Inspector Tabs */}
      <div className="grid grid-cols-4 border-b border-studio-800 bg-studio-950 p-1 gap-1 text-xs">
        <button
          onClick={() => setActiveTab("dimensions")}
          className={`py-1.5 px-2 rounded-md font-medium transition-all flex items-center justify-center gap-1 ${
            activeTab === "dimensions"
              ? "bg-studio-800 text-white shadow-sm border border-studio-700/60"
              : "text-studio-500 hover:text-slate-300"
          }`}
          title="Dimensions Paramétriques"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="truncate">Dims</span>
        </button>

        <button
          onClick={() => setActiveTab("materials")}
          className={`py-1.5 px-2 rounded-md font-medium transition-all flex items-center justify-center gap-1 ${
            activeTab === "materials"
              ? "bg-studio-800 text-white shadow-sm border border-studio-700/60"
              : "text-studio-500 hover:text-slate-300"
          }`}
          title="Matière & Finition"
        >
          <Scale className="w-3.5 h-3.5" />
          <span className="truncate">Matière</span>
        </button>

        <button
          onClick={() => setActiveTab("layers")}
          className={`py-1.5 px-2 rounded-md font-medium transition-all flex items-center justify-center gap-1 ${
            activeTab === "layers"
              ? "bg-studio-800 text-white shadow-sm border border-studio-700/60"
              : "text-studio-500 hover:text-slate-300"
          }`}
          title="Calques & Visibilité"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="truncate">Calques</span>
        </button>

        <button
          onClick={() => setActiveTab("preflight")}
          className={`py-1.5 px-2 rounded-md font-medium transition-all flex items-center justify-center gap-1 ${
            activeTab === "preflight"
              ? "bg-studio-800 text-white shadow-sm border border-studio-700/60"
              : "text-studio-500 hover:text-slate-300"
          }`}
          title="Contrôle Normes & Usinabilité"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="truncate">Audit</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: DIMENSIONS */}
        {activeTab === "dimensions" && (
          <div className="space-y-4">
            <div>
              <span className="text-[11px] uppercase font-semibold text-studio-500 tracking-wider">
                Dimensions Principales ({unit})
              </span>
              <p className="text-[11px] text-studio-500 mb-3">Cotes intérieures nominales</p>

              <div className="space-y-3">
                {/* Longueur L */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Longueur (L)</span>
                    <span className="font-mono text-brand-400">{dimensions.length} mm</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="400"
                    value={dimensions.length}
                    onChange={(e) => updateDim("length", Number(e.target.value))}
                    className="w-full accent-brand-500 h-1.5 bg-studio-800 rounded cursor-pointer"
                  />
                </div>

                {/* Largeur W */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Largeur / Face latérale (W)</span>
                    <span className="font-mono text-brand-400">{dimensions.width} mm</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="300"
                    value={dimensions.width}
                    onChange={(e) => updateDim("width", Number(e.target.value))}
                    className="w-full accent-brand-500 h-1.5 bg-studio-800 rounded cursor-pointer"
                  />
                </div>

                {/* Hauteur H */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Hauteur / Profondeur (H)</span>
                    <span className="font-mono text-brand-400">{dimensions.height} mm</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="500"
                    value={dimensions.height}
                    onChange={(e) => updateDim("height", Number(e.target.value))}
                    className="w-full accent-brand-500 h-1.5 bg-studio-800 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-studio-800">
              <span className="text-[11px] uppercase font-semibold text-studio-500 tracking-wider">
                Rabats & Tolérances CAD
              </span>
              <div className="mt-3 space-y-2.5">
                {/* Patte de collage */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Patte de collage (G)</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      value={dimensions.glueFlap}
                      onChange={(e) => updateDim("glueFlap", Number(e.target.value))}
                      className="w-16 bg-studio-950 border border-studio-700/80 rounded px-2 py-1 text-right text-xs text-slate-200"
                    />
                    <span className="text-studio-500 text-[10px]">mm</span>
                  </div>
                </div>

                {/* Profondeur languette rentrante */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Languette rentrante</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      value={dimensions.tuckFlap}
                      onChange={(e) => updateDim("tuckFlap", Number(e.target.value))}
                      className="w-16 bg-studio-950 border border-studio-700/80 rounded px-2 py-1 text-right text-xs text-slate-200"
                    />
                    <span className="text-studio-500 text-[10px]">mm</span>
                  </div>
                </div>

                {/* Fond perdu */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Fond perdu (Bleed)</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      value={dimensions.bleed}
                      onChange={(e) => updateDim("bleed", Number(e.target.value))}
                      className="w-16 bg-studio-950 border border-studio-700/80 rounded px-2 py-1 text-right text-xs text-slate-200"
                    />
                    <span className="text-studio-500 text-[10px]">mm</span>
                  </div>
                </div>

                {/* Zone tranquille */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Zone de sécurité</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      value={dimensions.safetyMargin}
                      onChange={(e) => updateDim("safetyMargin", Number(e.target.value))}
                      className="w-16 bg-studio-950 border border-studio-700/80 rounded px-2 py-1 text-right text-xs text-slate-200"
                    />
                    <span className="text-studio-500 text-[10px]">mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metrics Summary */}
            <div className="bg-studio-950/80 rounded-lg p-3 border border-studio-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Surface brute :</span>
                <span className="text-slate-200">{(sheetAreaM2 * 10000).toFixed(1)} cm²</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Volume utile :</span>
                <span className="text-slate-200">{volumeCm3} cm³ ({((volumeCm3) / 1000).toFixed(2)} L)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Poids théorique :</span>
                <span className="text-brand-400 font-bold">{estimatedWeightGrams} g</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MATERIALS */}
        {activeTab === "materials" && (
          <div className="space-y-3">
            <span className="text-[11px] uppercase font-semibold text-studio-500 tracking-wider">
              Substrats & Cartons Normés
            </span>

            <div className="space-y-2">
              {MATERIALS.map((mat) => {
                const isSelected = mat.id === material.id;
                return (
                  <button
                    key={mat.id}
                    onClick={() => onSelectMaterial(mat)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-brand-500/10 border-brand-500 text-white shadow-sm"
                        : "bg-studio-850 border-studio-800 hover:border-studio-700 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs">{mat.name}</span>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: mat.color }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-studio-500 font-mono">
                      <span>{mat.family}</span>
                      <span>•</span>
                      <span>{mat.grammage} g/m²</span>
                      <span>•</span>
                      <span>{mat.caliperMm} mm</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="bg-studio-950 p-3 rounded-lg border border-studio-800 mt-4 space-y-2 text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-brand-400" />
                Compensation de Pliage
              </span>
              <p className="text-[11px] text-studio-500 leading-relaxed">
                Facteur de perte au pli calculé à{" "}
                <span className="text-brand-400 font-mono font-medium">
                  {material.foldLossFactor} × épaisseur ({material.caliperMm} mm)
                </span>
                . La géométrie CAD ajuste automatiquement le retrait des rainures.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: LAYERS */}
        {activeTab === "layers" && (
          <div className="space-y-3">
            <span className="text-[11px] uppercase font-semibold text-studio-500 tracking-wider">
              Calques Techniques d'Impression
            </span>

            <div className="space-y-1.5">
              {[
                {
                  key: "cut" as const,
                  name: "Découpe Traversante (ThruCut)",
                  color: "#E6007E",
                  desc: "Lignes de découpe pleine Kongsberg / Zünd",
                },
                {
                  key: "crease" as const,
                  name: "Rainage / Rainurage (Crease)",
                  color: "#0084FF",
                  desc: "Filets raineurs pour pliage précis",
                },
                {
                  key: "bleed" as const,
                  name: "Fond Perdu (Bleed)",
                  color: "#00BA38",
                  desc: "Marge d'impression extérieure 3mm",
                },
                {
                  key: "safety" as const,
                  name: "Zone Tranquille (Safety)",
                  color: "#FF9900",
                  desc: "Marge de sécurité intérieure des textes",
                },
                {
                  key: "dimensions" as const,
                  name: "Cotations & Cotes CAD",
                  color: "#60A5FA",
                  desc: "Flèches et mesures millimétriques",
                },
                {
                  key: "labels" as const,
                  name: "Typologie des Panneaux",
                  color: "#94A3B8",
                  desc: "Noms des faces et des rabats",
                },
              ].map((l) => {
                const isVisible = layers[l.key];
                return (
                  <div
                    key={l.key}
                    onClick={() => onToggleLayer(l.key)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-studio-850 hover:bg-studio-800 border border-studio-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: l.color }}
                      />
                      <div>
                        <div className="text-xs font-medium text-slate-200">{l.name}</div>
                        <div className="text-[10px] text-studio-500">{l.desc}</div>
                      </div>
                    </div>

                    <button
                      className={`p-1 rounded ${
                        isVisible ? "text-slate-300" : "text-studio-600"
                      }`}
                    >
                      {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: PREFLIGHT & AUDIT */}
        {activeTab === "preflight" && (
          <div className="space-y-3">
            <span className="text-[11px] uppercase font-semibold text-studio-500 tracking-wider">
              Contrôle Pré-presse & Normes ISO
            </span>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-emerald-300">Angles de dépouille valides</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Patte de collage biseautée à 15° pour éviter les bourrages en plieuse-colleuse.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-emerald-300">Format compatible presse B1</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Le format développé ({developedWidthMm} × {developedHeightMm} mm) s'intègre sur feuille 70×100 cm.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-emerald-300">Compensation Rainage OK</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Épaisseur {material.caliperMm}mm appliquée pour empêcher l'éclatement des fibres carton.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Specs Card */}
      <div className="p-3 border-t border-studio-800 bg-studio-950/90 text-[11px] font-mono text-studio-500 flex items-center justify-between">
        <span>Norme: ECMA Standard</span>
        <span className="text-brand-400 font-semibold">100% Usinable</span>
      </div>
    </aside>
  );
};
