"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, Download, RefreshCw, Loader2, Megaphone, ImageIcon } from "lucide-react";
import { AD_FORMATS, AD_SCENES, renderAd, type AdFormat, type AdScene } from "@/lib/three/adRender";
import type { PackagingSpec } from "@/lib/three/packagingModels";
import type { PackagingDesign } from "@/lib/artwork/draw";
import { slugify } from "@/lib/print/exportPrintPdf";

interface AdStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  spec: PackagingSpec;
  design: PackagingDesign;
  projectName: string;
  onToast: (msg: string) => void;
}

const DECORS = [
  "Table en bois clair, cuisine lumineuse",
  "Marché africain coloré, arrière-plan flou",
  "Marbre blanc et feuilles tropicales",
  "Tissu wax aux couleurs vives",
  "Plage et palmiers au coucher du soleil",
  "Studio béton, lumière douce de fin de journée",
];

export function AdStudioModal({ isOpen, onClose, spec, design, projectName, onToast }: AdStudioModalProps) {
  const [scene, setScene] = useState<AdScene>("podium");
  const [format, setFormat] = useState<AdFormat>("portrait");
  const [withCopy, setWithCopy] = useState(true);
  const [seed, setSeed] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** AI photo backdrop (Cloudflare Workers AI · FLUX). */
  const [decor, setDecor] = useState(DECORS[0]);
  const [photoBg, setPhotoBg] = useState<string | null>(null);
  const [decorBusy, setDecorBusy] = useState(false);

  const generateDecor = async () => {
    setDecorBusy(true);
    try {
      const res = await fetch("/api/ai-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: decor, format }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.image) {
        setPhotoBg(json.image);
        return;
      }
      onToast(
        res.status === 503
          ? "Le décor photo IA s'active dès que Cloudflare Workers AI est configuré."
          : res.status === 402
            ? "Un abonnement actif est nécessaire pour le décor photo IA."
            : res.status === 403
              ? "Les décors photo IA sont inclus à partir du plan Pro."
            : "Le décor n'a pas pu être généré. Réessayez."
      );
    } catch {
      onToast("Le décor n'a pas pu être généré. Vérifiez votre connexion.");
    } finally {
      setDecorBusy(false);
    }
  };

  const generate = useCallback(async () => {
    setBusy(true);
    try {
      // Let the spinner paint before the heavy render.
      await new Promise((r) => setTimeout(r, 30));
      setImage(await renderAd({ spec, design, scene, format, withCopy, seed, backgroundUrl: photoBg }));
    } catch (e) {
      console.error(e);
      onToast("Impossible de générer le visuel sur cet appareil (WebGL indisponible).");
    } finally {
      setBusy(false);
    }
  }, [spec, design, scene, format, withCopy, seed, photoBg, onToast]);

  useEffect(() => {
    if (isOpen) generate();
    // Regenerate whenever an option changes while open.
  }, [isOpen, generate]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = `${slugify(projectName) || "edify"}-pub-${format}.png`;
    a.click();
  };

  const fmt = AD_FORMATS.find((f) => f.id === format)!;

  return (
    <div className="edify-modal-backdrop" onClick={onClose}>
      <div className="edify-modal-content max-w-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Visuel publicitaire">
        <div className="edify-sheet-drag-handle md:hidden" />
        <div className="edify-modal-header">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Visuel publicitaire</h3>
              <p className="text-[11px] text-slate-500">Votre packaging mis en scène en studio, prêt pour les réseaux sociaux</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="edify-modal-body">
          <div className="grid md:grid-cols-[1fr_220px] gap-4">
            <div
              className="relative w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center"
              style={{ aspectRatio: `${fmt.w} / ${fmt.h}`, maxHeight: "62vh" }}
            >
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="Visuel publicitaire généré" className={`w-full h-full object-contain transition-opacity ${busy ? "opacity-40" : ""}`} />
              )}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-semibold">Rendu haute définition…</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700" htmlFor="ad-scene">Mise en scène</label>
                <select id="ad-scene" value={scene} onChange={(e) => setScene(e.target.value as AdScene)} className="edify-select">
                  {AD_SCENES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700" htmlFor="ad-format">Format</label>
                <select id="ad-format" value={format} onChange={(e) => setFormat(e.target.value as AdFormat)} className="edify-select">
                  {AD_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} — {f.w}×{f.h}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700" htmlFor="ad-decor">Décor photo IA</label>
                <select id="ad-decor" value={decor} onChange={(e) => setDecor(e.target.value)} className="edify-select">
                  {DECORS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={generateDecor} disabled={decorBusy || busy} className="edify-secondary-btn flex-1 justify-center">
                    {decorBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} {photoBg ? "Autre décor" : "Générer le décor"}
                  </button>
                  {photoBg && (
                    <button type="button" onClick={() => setPhotoBg(null)} className="edify-secondary-btn justify-center" aria-label="Revenir au studio">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={withCopy} onChange={(e) => setWithCopy(e.target.checked)} className="w-4 h-4 accent-slate-900" />
                Ajouter le texte publicitaire
              </label>
              <button type="button" onClick={() => setSeed((s) => s + 1)} disabled={busy} className="edify-secondary-btn w-full justify-center">
                <RefreshCw className="w-3.5 h-3.5" /> Nouvelle variante
              </button>
              <button type="button" onClick={download} disabled={!image || busy} className="edify-primary-download-btn w-full">
                <Download className="w-4 h-4" /> Télécharger (PNG)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
