"use client";

import React, { useState, useRef } from "react";
import { 
  Sparkles, 
  Plus, 
  Image as ImageIcon, 
  Paperclip, 
  Loader2, 
  CheckCircle2,
  Lightbulb
} from "lucide-react";

const QUICK_IDEAS = [
  "Créer un concept de café premium bio",
  "Appliquer mon visuel sur coffret cadeau luxe",
  "Typographie dorée & fond crème",
  "Sérum éclat vitamine C pure & néroli",
  "Flacon apothicaire ambré minimaliste",
];

interface AiPromptDockProps {
  onGenerate: (prompt: string) => Promise<void> | void;
  isGenerating: boolean;
  onAttachReference?: () => void;
}

export function AiPromptDock({
  onGenerate,
  isGenerating,
  onAttachReference,
}: AiPromptDockProps) {
  const [prompt, setPrompt] = useState("");
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectIdea = (idea: string) => {
    setPrompt(idea);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
    }
  };

  return (
    <footer className="edify-ai-dock select-none" data-purpose="ai-prompt-dock">
      {/* Hidden file input for attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.svg"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="edify-ai-dock-inner">
        {/* Suggestion Action Pills Carousel */}
        <div className="edify-pills-row">
          <span className="edify-pill-label">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            Idées rapides :
          </span>
          {QUICK_IDEAS.map((idea, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectIdea(idea)}
              className="edify-quick-pill"
            >
              <span className="text-brand-500 font-bold">✦</span>
              <span>{idea}</span>
            </button>
          ))}
        </div>

        {/* Main Input Field Bar */}
        <form onSubmit={handleSubmit} className="edify-prompt-input-bar">
          {/* Reference button */}
          <button
            type="button"
            onClick={() => {
              if (onAttachReference) {
                onAttachReference();
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="edify-reference-btn"
            title="Ajouter une référence visuelle ou charte graphique"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Référence</span>
          </button>

          {/* Reference pill tag if attached */}
          {attachedFileName && (
            <span className="hidden md:flex items-center gap-1 bg-brand-50 border border-brand-200 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full mx-1">
              <CheckCircle2 className="w-3 h-3 text-brand-500" />
              {attachedFileName}
            </span>
          )}

          {/* Text input */}
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder="Décrivez votre produit, marque ou style (ex: Cosmétique botanique épuré avec dorure)..."
            className="edify-prompt-field"
          />

          {/* Media Attachments & Submit */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 pr-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              title="Ajouter une image d'inspiration"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              title="Joindre un fichier PDF ou SVG"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Generate Button with Sparkles */}
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="edify-generate-btn"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-400" />
                  <span>Génération...</span>
                </>
              ) : (
                <>
                  <span className="text-brand-400">✨</span>
                  <span className="hidden xs:inline">Générer avec l'IA</span>
                  <span className="xs:hidden">Générer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </footer>
  );
}
