"use client";

import React, { useRef, useState } from "react";
import { Sparkles, ImagePlus, Paperclip, Loader2, X, FileText } from "lucide-react";

const QUICK_IDEAS = [
  "Café de spécialité bio en grains, marque « Terra », style artisanal",
  "Sérum vitamine C pour peau lumineuse, flacon pipette, esprit clean beauty",
  "Coffret cadeau luxe pour bougie parfumée, noir et or",
  "Bière IPA artisanale en canette, graphique et coloré",
  "Miel de lavande de Provence, pot en verre, étiquette vintage",
  "Chips de légumes pour enfants, sachet fun et joyeux",
];

export interface ReferenceFile {
  name: string;
  mediaType: string;
  data: string; // base64 without the data: prefix
  preview?: string;
}

interface AiPromptDockProps {
  onGenerate: (prompt: string, reference: ReferenceFile | null) => Promise<boolean> | boolean;
  isGenerating: boolean;
  onToast: (msg: string) => void;
}

const MAX_BYTES = 8 * 1024 * 1024;

export function AiPromptDock({ onGenerate, isGenerating, onToast }: AiPromptDockProps) {
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<ReferenceFile | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    const ok = await onGenerate(prompt.trim(), reference);
    if (ok) setReference(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okType = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!okType) return onToast("Formats acceptés : image (PNG, JPG, WebP) ou PDF.");
    if (file.size > MAX_BYTES) return onToast("Fichier trop lourd (8 Mo maximum).");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setReference({
        name: file.name,
        mediaType: file.type,
        data: url.slice(url.indexOf(",") + 1),
        preview: file.type.startsWith("image/") ? url : undefined,
      });
      onToast(`✓ Référence « ${file.name} » ajoutée : l'IA s'en inspirera.`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <footer className="edify-ai-dock" data-purpose="ai-prompt-dock">
      <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
      <input ref={docRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />

      <div className="edify-ai-dock-inner">
        <div className="edify-pills-row">
          <span className="edify-pill-label">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            Idées :
          </span>
          {QUICK_IDEAS.map((idea) => (
            <button key={idea} type="button" onClick={() => setPrompt(idea)} className="edify-quick-pill" disabled={isGenerating}>
              <span className="text-brand-500 font-bold">✦</span>
              <span>{idea}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="edify-prompt-input-bar">
          {reference && (
            <span className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold pl-1 pr-1.5 py-0.5 rounded-full ml-1 max-w-[40%]">
              {reference.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reference.preview} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <FileText className="w-3.5 h-3.5 ml-1" />
              )}
              <span className="truncate">{reference.name}</span>
              <button type="button" onClick={() => setReference(null)} className="text-slate-400 hover:text-slate-800" aria-label="Retirer la référence">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder="Décrivez votre produit : type, marque, ambiance, couleurs…"
            className="edify-prompt-field"
            aria-label="Brief du packaging"
          />

          <div className="flex items-center space-x-0.5 sm:space-x-1 pr-1">
            <button type="button" onClick={() => imageRef.current?.click()} className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition" title="Ajouter une image d'inspiration ou votre charte" aria-label="Ajouter une image">
              <ImagePlus className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => docRef.current?.click()} className="hidden sm:inline-flex p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition" title="Joindre un brief ou une charte (PDF)" aria-label="Joindre un PDF">
              <Paperclip className="w-4 h-4" />
            </button>
            <button type="submit" disabled={isGenerating || !prompt.trim()} className="edify-generate-btn">
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                  <span>Design en cours…</span>
                </>
              ) : (
                <>
                  <span className="text-brand-400">✨</span>
                  <span>Générer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </footer>
  );
}
