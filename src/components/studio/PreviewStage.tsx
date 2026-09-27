"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Minus, Plus, Loader2, RotateCw, Box, LayoutTemplate } from "lucide-react";
import type { PackagingShape } from "@/components/workspace/Modals";
import type { PackagingDesign } from "@/lib/artwork/draw";
import { loadDesignFonts } from "@/lib/artwork/draw";
import { flatLayout, BLEED_MM } from "@/lib/print/layout";
import { renderFlatArtwork, drawDieline } from "@/lib/print/artwork";
import type { PackagingSpec } from "@/lib/three/packagingModels";

const Packaging3DViewer = dynamic(() => import("@/components/workspace/Packaging3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
});

function DielinePreview({ shape, design, zoom }: { shape: PackagingShape; design: PackagingDesign; zoom: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(600);
  const layout = useMemo(
    () => flatLayout({ model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm }),
    [shape]
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      await loadDesignFonts(design);
      const canvas = canvasRef.current;
      if (!alive || !canvas) return;
      const totalW = layout.width + BLEED_MM * 2;
      const totalH = layout.height + BLEED_MM * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Fit width (and a sensible max height), then apply zoom.
      const fit = Math.min((width - 8) / totalW, 560 / totalH);
      const k = fit * zoom * dpr;
      const art = renderFlatArtwork(layout, design, k);
      canvas.width = art.width;
      canvas.height = art.height;
      canvas.style.width = `${art.width / dpr}px`;
      canvas.style.height = `${art.height / dpr}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(art, 0, 0);
      drawDieline(ctx, layout, k);
    }, 80);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [layout, design, width, zoom]);

  return (
    <div ref={wrapRef} className="w-full">
      <div className="w-full overflow-auto flex justify-center">
        <canvas ref={canvasRef} className="shadow-sm rounded-sm bg-white" aria-label={`Patron à plat : ${layout.kindLabel}`} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-slate-600 font-medium">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#e6007e]" /> Découpe</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#0084ff]" /> Pli</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-emerald-500" /> Fond perdu {BLEED_MM} mm</span>
        <span className="text-slate-400">{layout.kindLabel} · à plat {layout.width.toFixed(0)} × {layout.height.toFixed(0)} mm</span>
      </div>
    </div>
  );
}


export type PreviewMode = "flat" | "3d";

interface PreviewStageProps {
  mode: PreviewMode;
  onMode: (m: PreviewMode) => void;
  shape: PackagingShape;
  spec: PackagingSpec;
  design: PackagingDesign;
  baseDesign: Omit<PackagingDesign, "logo">;
  logoUrl: string | null;
  onCaptureReady: (capture: () => string) => void;
}

export function PreviewStage({ mode, onMode, shape, spec, design, baseDesign, logoUrl, onCaptureReady }: PreviewStageProps) {
  const [zoom, setZoom] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewKey, setViewKey] = useState(0);

  return (
    <section className="st-stage" aria-label="Aperçu du packaging">
      <div className="st-stage-bar">
        <div className="st-seg" role="tablist" aria-label="Type d'aperçu">
          <button type="button" role="tab" aria-selected={mode === "flat"} className={mode === "flat" ? "is-active" : ""} onClick={() => onMode("flat")}>
            <LayoutTemplate className="w-4 h-4" /> Patron à plat
          </button>
          <button type="button" role="tab" aria-selected={mode === "3d"} className={mode === "3d" ? "is-active" : ""} onClick={() => onMode("3d")}>
            <Box className="w-4 h-4" /> Vue 3D
          </button>
        </div>
        <p className="st-stage-meta">{shape.name} · {shape.dimensions}</p>
        {mode === "flat" ? (
          <div className="st-zoom">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Dézoomer"><Minus className="w-4 h-4" /></button>
            <button type="button" className="st-zoom-value" onClick={() => setZoom(1)} title="Ajuster à l'écran">{Math.round(zoom * 100)} %</button>
            <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoomer"><Plus className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="st-zoom">
            <button type="button" onClick={() => setAutoRotate((v) => !v)} aria-pressed={autoRotate} title="Rotation automatique" className={autoRotate ? "is-on" : ""}>
              <RotateCw className="w-4 h-4" />
            </button>
            <button type="button" className="st-zoom-value" onClick={() => setViewKey((k) => k + 1)} title="Recentrer la vue">Recentrer</button>
          </div>
        )}
      </div>

      <div className="st-stage-body">
        {mode === "flat" ? (
          <div className="st-flat">
            <DielinePreview shape={shape} design={design} zoom={zoom} />
          </div>
        ) : (
          <div className="st-3d" key={viewKey}>
            <Packaging3DViewer
              spec={spec}
              design={baseDesign}
              logoUrl={logoUrl}
              view="threeQuarter"
              lighting="studio"
              autoRotate={autoRotate}
              onCaptureReady={onCaptureReady}
            />
            <p className="st-3d-hint">Glissez pour tourner · molette pour zoomer</p>
          </div>
        )}
      </div>
    </section>
  );
}
