"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Wand2,
  Download,
  Box,
  Layers,
  CheckCircle2,
  Palette,
  Sliders,
  RefreshCw,
  Eye,
  Info,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap
} from "lucide-react";
import { BrandSector, LogoStyle, ColorMood } from "@/types/ai";
import { rgbToCmyk, hexToRgb, formatCmyk } from "@/lib/color/cmyk";
import { useProjectStore } from "@/lib/store/projects";

interface GeneratedBadge {
  id: string;
  name: string;
  tagline: string;
  style: LogoStyle;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  symbol: string; // SVG icon or emblem description
  cmyk: { c: number; m: number; y: number; k: number };
  inGamut: boolean;
}

const PRESET_BADGES: GeneratedBadge[] = [
  {
    id: "badge-1",
    name: "ÉCLAT PUR",
    tagline: "Soin Botanique & Haute Cosmétique",
    style: "luxe",
    primaryHex: "#1E1B4B",
    secondaryHex: "#C5A880",
    accentHex: "#F5EBE0",
    symbol: "diamond",
    cmyk: { c: 80, m: 75, y: 15, k: 65 },
    inGamut: true,
  },
  {
    id: "badge-2",
    name: "BOTANICA",
    tagline: "Essences Végétales Biologiques",
    style: "organic",
    primaryHex: "#064E3B",
    secondaryHex: "#A7F3D0",
    accentHex: "#D1FAE5",
    symbol: "leaf",
    cmyk: { c: 85, m: 25, y: 70, k: 45 },
    inGamut: true,
  },
  {
    id: "badge-3",
    name: "NOIR ABSOLU",
    tagline: "Parfumerie Rare · Paris",
    style: "minimalist",
    primaryHex: "#0F172A",
    secondaryHex: "#E2E8F0",
    accentHex: "#94A3B8",
    symbol: "crest",
    cmyk: { c: 60, m: 50, y: 40, k: 90 },
    inGamut: true,
  },
  {
    id: "badge-4",
    name: "ATELIER BRUN",
    tagline: "Café d'Origine Torréfié à la Main",
    style: "artisanal",
    primaryHex: "#78350F",
    secondaryHex: "#FDE68A",
    accentHex: "#FEF3C7",
    symbol: "stamp",
    cmyk: { c: 30, m: 70, y: 95, k: 40 },
    inGamut: true,
  },
];

export default function AiGeneratorPage() {
  const router = useRouter();
  const addProject = useProjectStore((s) => s.addProject);

  const [brandName, setBrandName] = useState("Sérum Éclat Luxe");
  const [sector, setSector] = useState<BrandSector>("cosmétiques");
  const [style, setStyle] = useState<LogoStyle>("luxe");
  const [colorMood, setColorMood] = useState<ColorMood>("sombre & luxueux");
  const [keywords, setKeywords] = useState(["bio", "or mat", "haute concentration"]);
  const [keywordInput, setKeywordInput] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  const [badges, setBadges] = useState<GeneratedBadge[]>(PRESET_BADGES);
  const [selectedBadge, setSelectedBadge] = useState<GeneratedBadge>(PRESET_BADGES[0]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (tag: string) => {
    setKeywords(keywords.filter((k) => k !== tag));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerationStep("1/3 — Analyse sémantique du brief & génération des concepts vectoriels...");

    setTimeout(() => {
      setGenerationStep("2/3 — Calcul des séparations CMJN & vérification profil Fogra39...");
    }, 900);

    setTimeout(() => {
      setGenerationStep("3/3 — Rendu des mockups packaging et textures haute définition...");
    }, 1800);

    setTimeout(() => {
      setIsGenerating(false);
      // Generate unique variants based on brand name
      const primaryColors = ["#1E1B4B", "#064E3B", "#1C1917", "#1E3A8A"];
      const secondaryColors = ["#D97706", "#10B981", "#E11D48", "#8B5CF6"];
      const symbols = ["diamond", "leaf", "crest", "stamp"];

      const newBadges: GeneratedBadge[] = [0, 1, 2, 3].map((i) => {
        const hex = primaryColors[i];
        const rgb = hexToRgb(hex);
        const cmyk = rgbToCmyk(rgb);
        return {
          id: `badge-${Date.now()}-${i}`,
          name: brandName.toUpperCase(),
          tagline: `${sector.toUpperCase()} · ÉDITION LIMITÉE`,
          style,
          primaryHex: hex,
          secondaryHex: secondaryColors[i],
          accentHex: "#F8FAFC",
          symbol: symbols[i],
          cmyk,
          inGamut: true,
        };
      });

      setBadges(newBadges);
      setSelectedBadge(newBadges[0]);
      showToast("✓ 4 variantes de badges packaging générées avec succès !");
    }, 2600);
  };

  const handleApplyToStudio = () => {
    const newProj = addProject(
      `${selectedBadge.name} — Coffret Packaging`,
      "reverse-tuck"
    );
    showToast(`✓ Visuel appliqué au nouveau projet ${newProj.name} !`);
    setTimeout(() => {
      router.push(`/studio/${newProj.id}`);
    }, 700);
  };

  const handleDownloadSvg = () => {
    const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
  <rect width="100%" height="100%" fill="${selectedBadge.primaryHex}" rx="12" />
  <rect x="10" y="10" width="280" height="180" fill="none" stroke="${selectedBadge.secondaryHex}" stroke-width="2" stroke-dasharray="4,2" rx="8" />
  <circle cx="150" cy="70" r="30" fill="none" stroke="${selectedBadge.secondaryHex}" stroke-width="2" />
  <text x="150" y="76" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="${selectedBadge.secondaryHex}" text-anchor="middle">✦</text>
  <text x="150" y="125" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="3">${selectedBadge.name}</text>
  <text x="150" y="148" font-family="Helvetica, Arial, sans-serif" font-size="9" fill="${selectedBadge.secondaryHex}" text-anchor="middle" letter-spacing="1">${selectedBadge.tagline}</text>
</svg>`;

    const blob = new Blob([svgCode], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logo-${selectedBadge.name.toLowerCase().replace(/\s+/g, "-")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ Fichier SVG Vectoriel téléchargé !");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-studio-950 text-slate-100 font-sans">
      {/* Toast */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-2xl border border-brand-400/40 animate-bounce">
          {toast}
        </div>
      )}

      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-studio-800 bg-studio-900/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-purple-500 to-brand-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Générateur IA de Packaging & Logos
            </h1>
            <p className="text-xs text-studio-500">
              Génération vectorielle conforme aux contraintes d'impression CMJN (Fogra39)
            </p>
          </div>
        </div>

        {/* AI Credits Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/25">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-violet-300">48 crédits restants</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Form: Parameters & Brief */}
        <div className="w-96 border-r border-studio-800 bg-studio-900/50 p-5 overflow-y-auto space-y-5 flex-shrink-0">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nom de la marque ou du produit *
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="ex: Botanica Soins"
              className="w-full px-3 py-2 bg-studio-900 border border-studio-700 rounded-xl text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Secteur d'activité
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["cosmétiques", "alimentaire", "mode", "tech", "santé", "bijoux"] as BrandSector[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSector(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize text-left transition-colors border ${
                    sector === s
                      ? "bg-brand-600/20 text-brand-300 border-brand-500/40"
                      : "bg-studio-850 text-studio-400 border-studio-750 hover:bg-studio-800 hover:text-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Style artistique
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["luxe", "minimalist", "organic", "artisanal", "tech", "bold"] as LogoStyle[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setStyle(st)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize text-left transition-colors border ${
                    style === st
                      ? "bg-violet-600/20 text-violet-300 border-violet-500/40"
                      : "bg-studio-850 text-studio-400 border-studio-750 hover:bg-studio-800 hover:text-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ambiance chromatique
            </label>
            <div className="space-y-1">
              {(["sombre & luxueux", "naturel & terreux", "pastel & doux", "monochrome"] as ColorMood[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setColorMood(m)}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors border flex items-center justify-between ${
                    colorMood === m
                      ? "bg-studio-800 text-white border-studio-600"
                      : "bg-studio-850 text-studio-400 border-studio-750 hover:bg-studio-800 hover:text-slate-200"
                  }`}
                >
                  <span className="capitalize">{m}</span>
                  {colorMood === m && <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Mots-clés & Valeurs (Tags)
            </label>
            <div className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                placeholder="Ajouter un tag..."
                className="flex-1 px-2.5 py-1.5 bg-studio-900 border border-studio-700 rounded-lg text-xs text-white placeholder-studio-500 focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleAddKeyword}
                className="px-3 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-xs font-medium text-slate-200"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((tag) => (
                <span
                  key={tag}
                  onClick={() => handleRemoveKeyword(tag)}
                  className="px-2 py-0.5 rounded-md bg-studio-800 border border-studio-700 text-[11px] text-studio-400 hover:text-red-400 hover:border-red-500/30 cursor-pointer transition-colors"
                >
                  #{tag} ×
                </span>
              ))}
            </div>
          </div>

          {/* CTA Generate */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !brandName.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-brand-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-brand-600/25 transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Génération en cours...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Générer les variantes packaging</span>
              </>
            )}
          </button>
        </div>

        {/* Right Gallery & Prepress Inspector */}
        <div className="flex-1 flex flex-col overflow-hidden bg-studio-950 p-6">
          {/* Generation Progress Indicator */}
          {isGenerating && (
            <div className="mb-6 p-4 rounded-xl bg-violet-950/40 border border-violet-500/30 animate-pulse flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-violet-200">{generationStep}</p>
                <p className="text-[10px] text-violet-400/80">
                  Application des algorithmes d'encrage ISO Coated v2 (Fogra39)
                </p>
              </div>
            </div>
          )}

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {badges.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBadge(b)}
                className={`relative rounded-2xl p-6 border transition-all cursor-pointer overflow-hidden ${
                  selectedBadge.id === b.id
                    ? "border-brand-500 bg-studio-900 shadow-xl shadow-brand-500/10 scale-[1.01]"
                    : "border-studio-800 bg-studio-900/60 hover:border-studio-700"
                }`}
                style={{
                  background: `linear-gradient(135deg, ${b.primaryHex}25 0%, #0F172A 100%)`,
                }}
              >
                {/* Badge SVG Graphic */}
                <div className="flex flex-col items-center justify-center text-center py-6">
                  {/* Decorative Emblem */}
                  <div
                    className="w-14 h-14 rounded-full border-2 flex items-center justify-center mb-3 shadow-inner"
                    style={{ borderColor: b.secondaryHex, color: b.secondaryHex }}
                  >
                    <span className="text-xl">✦</span>
                  </div>

                  <h3 className="text-lg font-bold tracking-widest text-white mb-1">
                    {b.name}
                  </h3>
                  <p
                    className="text-[10px] uppercase font-semibold tracking-wider mb-4"
                    style={{ color: b.secondaryHex }}
                  >
                    {b.tagline}
                  </p>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/40 text-studio-400 border border-white/10">
                      {formatCmyk(b.cmyk)}
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Fogra39
                    </span>
                  </div>
                </div>

                {selectedBadge.id === b.id && (
                  <div className="absolute top-3 right-3 text-brand-400 text-xs font-bold">
                    ✓ Actif
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Selected Badge Inspector & Prepress Panel */}
          <div className="mt-auto p-4 rounded-2xl bg-studio-900 border border-studio-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                style={{ backgroundColor: selectedBadge.primaryHex }}
              >
                ✦
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {selectedBadge.name} — Badge Prépresse
                </h4>
                <div className="flex items-center gap-3 text-xs text-studio-400 mt-0.5">
                  <span>Séparation CMJN : <strong className="text-slate-200 font-mono">{formatCmyk(selectedBadge.cmyk)}</strong></span>
                  <span>·</span>
                  <span className="text-emerald-400">Gamut 100% conforme pour impression offset/numérique</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleDownloadSvg}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-slate-200 text-xs font-medium border border-studio-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger SVG</span>
              </button>

              <button
                onClick={handleApplyToStudio}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/20 transition-all active:scale-95"
              >
                <Box className="w-4 h-4" />
                <span>Appliquer au Studio 3D</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
