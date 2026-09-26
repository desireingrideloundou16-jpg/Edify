"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Download,
  RotateCw,
  Smartphone,
  Share2,
  FileDown,
  Camera,
  Loader2,
} from "lucide-react";
import { PackagingShape, VisualStylePreset } from "./Modals";
import type { ViewPreset, LightingPreset } from "./Packaging3DViewer";

// WebGL only runs in the browser.
const Packaging3DViewer = dynamic(() => import("./Packaging3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
});

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "Face" },
  { id: "threeQuarter", label: "3/4" },
  { id: "top", label: "Dessus" },
];

const LIGHTS: { id: LightingPreset; label: string }[] = [
  { id: "studio", label: "Studio" },
  { id: "soft", label: "Doux" },
  { id: "warm", label: "Chaud" },
];

const STAGES = [
  { id: "grey", label: "Gris studio", css: "radial-gradient(120% 90% at 50% 30%, #ffffff 0%, #e9ecf1 70%)", swatch: "#e9ecf1" },
  { id: "white", label: "Blanc", css: "#ffffff", swatch: "#ffffff" },
  { id: "sand", label: "Sable", css: "radial-gradient(120% 90% at 50% 30%, #fbf7f1 0%, #eadfce 75%)", swatch: "#eadfce" },
  { id: "sage", label: "Sauge", css: "radial-gradient(120% 90% at 50% 30%, #f3f6f1 0%, #d5dfd0 75%)", swatch: "#d5dfd0" },
  { id: "night", label: "Nuit", css: "radial-gradient(120% 90% at 50% 30%, #3a3f4b 0%, #16181d 75%)", swatch: "#1d2027" },
];

interface RightSidebarProps {
  selectedShape: PackagingShape;
  selectedStyle: VisualStylePreset;
  brandName: string;
  productName: string;
  volume: string;
  uploadedLogo: string | null;
  credits: number;
  onAddCredits: () => void;
  onDownloadPdf: () => void;
  onDownloadZip: () => void;
  onOpenArModal: () => void;
  onShare: () => void;
  className?: string;
}

export function RightSidebar({
  selectedShape,
  selectedStyle,
  brandName,
  productName,
  volume,
  uploadedLogo,
  credits,
  onAddCredits,
  onDownloadPdf,
  onDownloadZip,
  onOpenArModal,
  onShare,
  className = "",
}: RightSidebarProps) {
  const [view, setView] = useState<ViewPreset>("threeQuarter");
  const [lighting, setLighting] = useState<LightingPreset>("studio");
  const [autoRotate, setAutoRotate] = useState(false);
  const [stageId, setStageId] = useState("grey");
  const [hintVisible, setHintVisible] = useState(true);
  const captureRef = useRef<(() => string) | null>(null);
  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[0];

  const spec = useMemo(
    () => ({
      model: selectedShape.model ?? "box",
      lengthMm: selectedShape.lengthMm,
      widthMm: selectedShape.widthMm,
      heightMm: selectedShape.heightMm,
      material: selectedShape.material,
    }),
    [selectedShape]
  );

  const design = useMemo(
    () => ({
      brandName,
      productName,
      volume,
      palette: selectedStyle.palette,
      fontFamily: selectedStyle.fontFamily,
      finishing: selectedStyle.finishing,
    }),
    [brandName, productName, volume, selectedStyle]
  );

  const onCaptureReady = useCallback((fn: () => string) => {
    captureRef.current = fn;
  }, []);

  const handleCapture = () => {
    const url = captureRef.current?.();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `edify-${selectedShape.id}-3d.png`;
    a.click();
  };

  return (
    <aside className={`edify-right-column ${className}`} data-purpose="right-sidebar">
      <div className="edify-right-header">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Aperçu 3D</span>
        </div>

        <div className="flex items-center space-x-2">
          <button type="button" onClick={onAddCredits} className="edify-credits-pill" title="Recharger des crédits">
            <span className="text-amber-500 text-[10px]">✨</span>
            <span>{credits} crédits</span>
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-brand-600 transition"
            title="Télécharger le BAT Imprimeur (PDF 300 DPI)"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="edify-right-scrollable" data-purpose="3d-preview-container">
        <div className="space-y-3">
          {/* Live WebGL stage */}
          <div
            className="edify-3d-mockup-frame"
            style={{ background: stage.css }}
            onPointerDown={() => setHintVisible(false)}
            onWheel={() => setHintVisible(false)}
          >
            <Packaging3DViewer
              spec={spec}
              design={design}
              logoUrl={uploadedLogo}
              view={view}
              lighting={lighting}
              autoRotate={autoRotate}
              onCaptureReady={onCaptureReady}
            />

            <div className="absolute top-3 right-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className={`edify-lighting-btn ${autoRotate ? "active" : ""}`}
                title="Rotation automatique"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button type="button" onClick={handleCapture} className="edify-lighting-btn" title="Enregistrer l'image (PNG)">
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {hintVisible && (
              <div className="edify-360-badge">
              <RotateCw className="w-3.5 h-3.5 text-brand-400" />
              <span>Glissez pour tourner · molette pour zoomer</span>
              </div>
            )}
          </div>

          {/* Camera & light presets */}
          <div className="edify-segmented" role="group" aria-label="Angle de vue">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className={view === v.id ? "active" : ""} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="edify-segmented" role="group" aria-label="Éclairage">
            {LIGHTS.map((l) => (
              <button key={l.id} type="button" className={lighting === l.id ? "active" : ""} onClick={() => setLighting(l.id)}>
                {l.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600">Fond</span>
            <div className="flex items-center gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  title={s.label}
                  aria-label={`Fond ${s.label}`}
                  onClick={() => setStageId(s.id)}
                  className={`edify-stage-swatch ${stageId === s.id ? "active" : ""}`}
                  style={{ background: s.swatch }}
                />
              ))}
            </div>
          </div>

          <div className="edify-specs-card">
            <div className="edify-specs-row">
              <span>Contenant</span>
              <span className="font-semibold text-slate-800">{selectedShape.name}</span>
            </div>
            <div className="edify-specs-row">
              <span>Matériau</span>
              <span className="font-semibold text-slate-800">{selectedShape.material}</span>
            </div>
            <div className="edify-specs-row">
              <span>Finition</span>
              <span className="font-semibold text-brand-600">{selectedStyle.finishing}</span>
            </div>
          </div>
        </div>

        <div className="edify-export-actions" data-purpose="export-actions">
          <button type="button" onClick={onDownloadZip} className="edify-primary-download-btn">
            <Download className="w-4 h-4 text-brand-400" />
            <span>Télécharger la 3D et Visuels (.ZIP)</span>
          </button>
          <div className="edify-secondary-btn-grid">
            <button type="button" onClick={onOpenArModal} className="edify-secondary-btn">
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>Vue AR Mobile</span>
            </button>
            <button type="button" onClick={onShare} className="edify-secondary-btn">
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Lien de partage</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
