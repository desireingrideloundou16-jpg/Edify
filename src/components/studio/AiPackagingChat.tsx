"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowUp,
  Image as ImageIcon,
  RotateCw,
  SlidersHorizontal,
  Wand2,
  CheckCircle2,
  Package,
  Layers,
  HelpCircle,
  Lightbulb,
  Palette
} from "lucide-react";
import { PackagingDesignState, PackagingType } from "./LivePackaging3D";

interface AiPackagingChatProps {
  onGenerate: (design: PackagingDesignState) => void;
  isGenerating: boolean;
  currentDesign: PackagingDesignState;
}

const IDEA_SUGGESTIONS = [
  "Bocal de confiture artisanale fraise & basilic avec étiquette kraft dorée",
  "Sérum éclat luxe à l'acide hyaluronique, flacon verre et typographie or mat",
  "Canette de soda pétillant citron vert givré entourée de fraîcheur",
  "Boîte de parfum haut de gamme noir ébène et gaufrage géométrique",
];

export const AiPackagingChat: React.FC<AiPackagingChatProps> = ({
  onGenerate,
  isGenerating,
  currentDesign,
}) => {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"chat" | "guided">("chat");

  // Guided Mode Fields
  const [guidedType, setGuidedType] = useState<PackagingType>(currentDesign.type);
  const [brandName, setBrandName] = useState(currentDesign.brandName);
  const [productName, setProductName] = useState(currentDesign.productName);
  const [tagline, setTagline] = useState(currentDesign.tagline);
  const [selectedStyle, setSelectedStyle] = useState(currentDesign.style || "luxe");
  const [selectedPalette, setSelectedPalette] = useState("amber-gold");

  const PALETTES: Record<string, { primary: string; accent: string; text: string; label: string }> = {
    "amber-gold": { primary: "#1E1B4B", accent: "#F59E0B", text: "#FFFFFF", label: "Bleu Nuit & Or Mat" },
    "emerald-nature": { primary: "#064E3B", accent: "#34D399", text: "#FFFFFF", label: "Vert Forêt & Menthe Bio" },
    "rose-luxe": { primary: "#881337", accent: "#FDA4AF", text: "#FFFFFF", label: "Bordeaux & Or Rosé" },
    "lime-fresh": { primary: "#14532D", accent: "#A3E635", text: "#FFFFFF", label: "Citron Vert Énergique" },
    "clean-minimal": { primary: "#F8FAFC", accent: "#475569", text: "#0F172A", label: "Blanc Épuré & Graphite" },
  };

  const handlePromptSubmit = (customPrompt?: string) => {
    const textToUse = customPrompt || prompt;
    if (!textToUse.trim()) return;

    // Detect packaging type and palette from user prompt
    let detectedType: PackagingType = currentDesign.type;
    let primary = "#1E1B4B";
    let accent = "#F59E0B";
    let textColor = "#FFFFFF";
    let bName = "MAISON ÉCLAT";
    let pName = "Création d'Exception";
    let tagl = "100% ARTISANAL";

    const lower = textToUse.toLowerCase();

    if (lower.includes("bocal") || lower.includes("confiture") || lower.includes("miel") || lower.includes("pot")) {
      detectedType = "jar";
      primary = "#831843"; // Rich berry pink/red
      accent = "#FDE047";  // Warm gold
      textColor = "#FFFFFF";
      bName = "CONFITURE ROYALE";
      pName = "Fraise & Basilic Frais";
      tagl = "FRUITS DE SAISON";
    } else if (lower.includes("soda") || lower.includes("canette") || lower.includes("boisson") || lower.includes("citron")) {
      detectedType = "can";
      primary = "#15803D"; // Vibrant lime green
      accent = "#BEF264";  // Electric lime
      textColor = "#FFFFFF";
      bName = "LIME SPARKLING";
      pName = "Citron Vert Givré";
      tagl = "PÉTILLANT NATUREL";
    } else if (lower.includes("sérum") || lower.includes("flacon") || lower.includes("bouteille") || lower.includes("huile")) {
      detectedType = "bottle";
      primary = "#0F172A";
      accent = "#F59E0B";
      textColor = "#FFFFFF";
      bName = "L'ÉLIXIR PUR";
      pName = "Sérum Botanique Précieux";
      tagl = "SOIN HAUTE PERFORMANCE";
    } else if (lower.includes("boîte") || lower.includes("coffret") || lower.includes("parfum") || lower.includes("thé")) {
      detectedType = "box";
      primary = "#1E1B4B";
      accent = "#E0E7FF";
      textColor = "#FFFFFF";
      bName = "NOIR CÉLESTE";
      pName = "Parfum Absolu Paris";
      tagl = "ÉDITION PRIVÉE";
    }

    onGenerate({
      type: detectedType,
      brandName: bName,
      productName: pName,
      tagline: tagl,
      primaryColor: primary,
      accentColor: accent,
      textColor: textColor,
      style: "luxe",
      keywords: ["IA packaging", "haute définition", "prêt pour impression"],
      volumeOrWeight: detectedType === "can" ? "330 ml" : detectedType === "bottle" ? "50 ml" : "250g",
      finish: "gloss",
    });

    setPrompt("");
  };

  const handleGuidedSubmit = () => {
    const pal = PALETTES[selectedPalette] || PALETTES["amber-gold"];
    onGenerate({
      type: guidedType,
      brandName: brandName.toUpperCase() || "MAISON ÉDIFY",
      productName: productName || "Formule Unique",
      tagline: tagline || "QUALITÉ SUPÉRIEURE",
      primaryColor: pal.primary,
      accentColor: pal.accent,
      textColor: pal.text,
      style: selectedStyle,
      keywords: [selectedStyle, "design IA"],
      volumeOrWeight: guidedType === "can" ? "330 ml" : guidedType === "bottle" ? "50 ml" : "250g",
      finish: "matte",
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6 sm:p-10 overflow-y-auto bg-mesh-multicolor relative">
      {/* ── Mode Toggle (Conversation libre vs Questions guidées) ───── */}
      <div className="w-full max-w-xl flex justify-end mb-2">
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs">
          <button
            onClick={() => setMode("chat")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all ${
              mode === "chat" ? "bg-white text-purple-700 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Prompt Libre
          </button>
          <button
            onClick={() => setMode("guided")}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              mode === "guided" ? "bg-white text-purple-700 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            Questions Guidées
          </button>
        </div>
      </div>

      {/* ── MODE 1: Conversationnel (Exactement comme la capture Packify) ── */}
      {mode === "chat" ? (
        <div className="w-full max-w-xl my-auto flex flex-col items-center text-center animate-fade-in">
          {/* Luminous Animated AI Orb */}
          <div className="mb-6 relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 via-indigo-500 to-pink-400 flex items-center justify-center text-white shadow-xl ai-orb-glow">
              <Sparkles className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>

          {/* Main Question */}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-display mb-8">
            Que souhaitez-vous concevoir ?
          </h1>

          {/* Modern Input Bar */}
          <div className="w-full relative mb-10">
            <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-2.5 flex items-center gap-3 packify-input-shadow hover:border-purple-300 transition-all focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-100">
              {/* Image upload button */}
              <button
                type="button"
                className="p-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                title="Ajouter une image de référence"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePromptSubmit()}
                placeholder="Saisissez vos besoins d'emballage..."
                className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />

              {/* Submit Button */}
              <button
                type="button"
                onClick={() => handlePromptSubmit()}
                disabled={isGenerating || !prompt.trim()}
                className="w-9 h-9 rounded-xl bg-slate-300 disabled:opacity-40 hover:bg-purple-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ideas Suggestions Section (comme dans la capture) */}
          <div className="w-full text-left space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span>Besoin d'idées ?</span>
              <RotateCw className="w-3 h-3 text-slate-400 cursor-pointer hover:rotate-180 transition-transform" />
            </div>

            <div className="space-y-2">
              {IDEA_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handlePromptSubmit(suggestion)}
                  className="w-full p-3 rounded-2xl bg-white/90 hover:bg-purple-50/70 border border-slate-200/70 hover:border-purple-200 text-left text-xs font-medium text-slate-700 transition-all duration-150 flex items-center gap-2.5 shadow-sm hover:shadow group"
                >
                  <span className="text-purple-500 flex-shrink-0 group-hover:scale-110 transition-transform">
                    💡
                  </span>
                  <span className="truncate">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── MODE 2: Questionnaire Guidé Pas-à-Pas (Zéro connaissance requise) ── */
        <div className="w-full max-w-xl my-auto bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 packify-card-shadow animate-fade-in space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
              ✦
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Assistant Guidé Packaging IA
              </h2>
              <p className="text-xs text-slate-500">
                Répondez à ces 4 questions simples pour générer votre emballage
              </p>
            </div>
          </div>

          {/* Question 1: Type de contenant */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              1. Quel est votre type d'emballage ?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "jar", label: "Bocal ou Pot (Étiquette)", emoji: "🍯", sub: "Miel, confiture, crème" },
                { id: "bottle", label: "Flacon ou Bouteille", emoji: "🧴", sub: "Sérum, huile, parfum" },
                { id: "box", label: "Boîte pliante / Coffret", emoji: "📦", sub: "Cosmétique, thé, chocolat" },
                { id: "can", label: "Canette boisson", emoji: "🥫", sub: "Soda, jus, bière" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setGuidedType(item.id as PackagingType)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    guidedType === item.id
                      ? "bg-purple-50 border-purple-400 text-purple-900 font-bold shadow-sm"
                      : "bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-lg mb-1">{item.emoji}</div>
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[10px] text-slate-400">{item.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Question 2: Nom de la marque */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                2. Nom de la marque
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="ex: L'Élixir Doré"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Produit ou Recette
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="ex: Confiture de Fraises Sauvages"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Question 3: Palette de couleurs & Ambiance */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              3. Ambiance de couleurs souhaitée
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PALETTES).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPalette(key)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    selectedPalette === key
                      ? "bg-purple-50 border-purple-400 shadow-sm"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex -space-x-1">
                    <div className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: item.primary }} />
                    <div className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: item.accent }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA Generate */}
          <button
            onClick={handleGuidedSubmit}
            disabled={isGenerating}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            <span>Générer et afficher en 3D</span>
          </button>
        </div>
      )}

      {/* ── Footer / Trust Badge ───────────────────────────────────── */}
      <div className="w-full max-w-xl text-center mt-6 text-[11px] text-slate-400 flex items-center justify-center gap-4">
        <span>✦ Rendu 3D temps réel</span>
        <span>·</span>
        <span>Prêt pour l'impression</span>
        <span>·</span>
        <span>Sans compétences techniques</span>
      </div>
    </div>
  );
};
