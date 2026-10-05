"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Minus, Plus, Loader2, RotateCw, Box, LayoutTemplate } from "lucide-react";
import type { PackagingShape } from "@/components/workspace/Modals";
import type { PackagingDesign } from "@/lib/artwork/draw";
import { loadDesignFonts } from "@/lib/artwork/draw";
import { resolveFlatLayout, BLEED_MM, type FlatLayout } from "@/lib/print/layout";
import { renderFlatArtwork, drawDieline, drawLayoutAdvice } from "@/lib/print/artwork";
import type { SmartLayoutResult } from "@/lib/artwork/smartLayout";
import type { PreflightReport } from "@/lib/structure";
import { ROLE_LABEL, fixLabel } from "./roleLabels";
import type { PackagingSpec } from "@/lib/three/packagingModels";
import type { ViewPreset } from "@/components/workspace/Packaging3DViewer";

const Packaging3DViewer = dynamic(() => import("@/components/workspace/Packaging3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
});

/** Smart layout state handed to the preview (developed conical tubs only). */
export interface SmartLayoutView {
  result: SmartLayoutResult;
  /** An applied layout is part of the design: saved with the project, restored on reload. */
  applied: boolean;
  onApply: (applied: boolean) => void;
  /** Preflight of the packaging as it will be printed. */
  preflight: PreflightReport;
}

/** Preflight summary: ready, warnings, or blocking (with what, where, why and how to fix). */
function PreflightSummary({ report }: { report: PreflightReport }) {
  const blocking = report.issues.filter((i) => i.blocking), warnings = report.issues.filter((i) => !i.blocking);
  const head = blocking.length
    ? `⛔ ${blocking.length} problème${blocking.length > 1 ? "s" : ""} bloquant${blocking.length > 1 ? "s" : ""} — le PDF d'impression ne sera pas créé`
    : warnings.length
      ? `⚠ ${warnings.length} avertissement${warnings.length > 1 ? "s" : ""} — impression possible`
      : "✓ Packaging prêt à imprimer";
  return (
    <div className="mt-1.5 border-t border-slate-200 pt-1.5" aria-label="Vérification avant impression">
      <p className={`font-semibold ${blocking.length ? "text-red-600" : warnings.length ? "text-amber-700" : "text-emerald-700"}`}>{head}</p>
      {report.issues.length ? (
        <ul className="mt-0.5 space-y-0.5">
          {report.issues.map((i) => (
            <li key={i.elementId} className="flex flex-wrap gap-x-1.5">
              <span className={i.blocking ? "text-red-600" : "text-amber-600"}>{i.blocking ? "⛔" : "⚠"}</span>
              <span className="font-medium text-slate-700">{ROLE_LABEL[i.role]}</span>
              <span>{i.message}.</span>
              <span className="text-slate-500">{fixLabel(i)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** RECOMMEND / APPLY panel: what the smart layout would move, what it cannot place, and why. */
function SmartLayoutPanel({ smart }: { smart: SmartLayoutView }) {
  const { result, applied, onApply } = smart;
  // Declared decorative pieces (rules) simply follow their column: not listed.
  const issues = result.plan.filter((p) => p.role !== "decorative" && (p.status === "moved" || p.status === "invalid"));
  const moved = issues.filter((p) => p.status === "moved").length, invalid = issues.length - moved;
  return (
    <div className="mt-3 mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[11px] text-slate-600" aria-label="Mise en page intelligente">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-800">Mise en page intelligente</span>
        <span>
          {applied
            ? "Corrections appliquées — enregistrées avec le projet."
            : moved === 0 && invalid === 0 ? "Tous les éléments importants sont dans la zone sûre." : `${moved} élément${moved > 1 ? "s" : ""} à repositionner${invalid ? `, ${invalid} impossible${invalid > 1 ? "s" : ""} à placer` : ""} (recommandation).`}
        </span>
        {moved > 0 || applied ? (
          <button type="button" className="ml-auto rounded-md border border-slate-300 px-2 py-0.5 font-medium text-slate-800 hover:bg-slate-50" aria-pressed={applied} onClick={() => onApply(!applied)}>
            {applied ? "Revenir à la mise en page d'origine" : "Appliquer les positions recommandées"}
          </button>
        ) : null}
      </div>
      {issues.length ? (
        <ul className="mt-1 space-y-0.5">
          {issues.map((p) => (
            <li key={p.id} className="flex gap-1.5">
              <span className={p.status === "invalid" ? "text-red-600" : "text-amber-600"}>{p.status === "invalid" ? "✕" : applied ? "✓" : "→"}</span>
              <span className="font-medium text-slate-700">{ROLE_LABEL[p.role]}</span>
              <span>{p.status === "moved" && applied ? p.reason.replace("déplacé", "repositionné") : p.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <PreflightSummary report={smart.preflight} />
    </div>
  );
}

/** Flat die-line of the selected format, or a clear notice when no valid template exists yet. */
function DielinePreview({ shape, design, zoom, smart }: { shape: PackagingShape; design: PackagingDesign; zoom: number; smart?: SmartLayoutView | null }) {
  const result = useMemo(
    () => resolveFlatLayout({ model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material }),
    [shape]
  );
  if (!result.supported) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-2 py-16 px-6 text-center text-sm text-slate-600" role="status">
        <LayoutTemplate className="w-6 h-6 text-slate-400" />
        <p className="max-w-md">{result.message}</p>
        <p className="max-w-md text-xs text-slate-400">La vue 3D et les autres exports restent disponibles.</p>
      </div>
    );
  }
  return <DielineCanvas layout={result.layout} design={design} zoom={zoom} smart={smart} />;
}

function DielineCanvas({ layout, design, zoom, smart }: { layout: FlatLayout; design: PackagingDesign; zoom: number; smart?: SmartLayoutView | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(600);

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
      if (smart) drawLayoutAdvice(ctx, layout, smart.result.surfaceId, smart.result.plan, k, smart.applied);
    }, 80);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [layout, design, width, zoom, smart]);

  return (
    <div ref={wrapRef} className="w-full">
      <div className="w-full overflow-auto flex justify-center">
        <canvas ref={canvasRef} className="shadow-sm rounded-sm bg-white" aria-label={`Patron à plat : ${layout.kindLabel}`} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-slate-600 font-medium">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#e6007e]" /> Découpe</span>
        {layout.creases.length ? <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[#0084ff]" /> Pli</span> : null}
        {layout.formedFolds?.length ? <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-[#0084ff]" /> Pli formé</span> : null}
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-emerald-500" /> Fond perdu {BLEED_MM} mm</span>
        {layout.glueZones?.length ? <span className="flex items-center gap-1.5"><span className="w-4 h-2 bg-slate-400/40 border border-slate-500" /> Colle</span> : null}
        {layout.sealZones?.length ? <span className="flex items-center gap-1.5"><span className="w-4 h-2 bg-slate-400/25 border border-slate-500" /> Soudure</span> : null}
        {layout.technicalZones?.some((z) => z.kind === "seam") ? <span className="flex items-center gap-1.5"><span className="w-4 h-2 bg-emerald-500/15 border border-dotted border-emerald-500" /> Zone technique — couture dorsale</span> : null}
        {layout.guides?.some((g) => g.kind === "safe") ? <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-emerald-600" /> Zone sûre</span> : null}
        {layout.guides?.some((g) => g.kind === "primary") ? <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-emerald-600" /> Zone principale (face), titre et logo conseillés</span> : null}
        {layout.technicalZones?.some((z) => z.kind === "covered") ? <span className="flex items-center gap-1.5"><span className="w-4 h-2 bg-emerald-500/15 border border-dotted border-emerald-500" /> Zone sous le couvercle (non imprimée)</span> : null}
        {layout.sealZones?.some((z) => z.afterFilling) ? <span className="flex items-center gap-1.5"><span className="w-4 h-2 bg-slate-400/25 border border-dashed border-slate-500" /> Soudure après remplissage</span> : null}
        {smart && !smart.applied && smart.result.counts.moved ? <span className="flex items-center gap-1.5"><span className="w-4 h-2 border border-amber-600" /> Position recommandée</span> : null}
        {smart?.result.counts.invalid ? <span className="flex items-center gap-1.5"><span className="w-4 h-2 border border-red-600" /> Impossible à placer</span> : null}
        <span className="text-slate-400">{layout.kindLabel} · à plat {layout.width.toFixed(0)} × {layout.height.toFixed(0)} mm</span>
      </div>
      {smart ? <SmartLayoutPanel smart={smart} /> : null}
    </div>
  );
}


export type PreviewMode = "flat" | "3d";

/** Small live 3D view shown next to the flat die-line; redrawn shortly after each edit. */
function LiveMini3D({ shape, design, onOpen }: { shape: PackagingShape; design: PackagingDesign; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const { renderShowcase } = await import("@/lib/three/thumbnails");
      const img = await renderShowcase(shape, design, 440, -0.55).catch(() => null);
      if (alive) {
        if (img) setUrl(img);
        setBusy(false);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [shape, design]);
  return (
    <button type="button" className="st-mini3d" onClick={onOpen} title="Ouvrir la vue 3D">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Aperçu 3D en direct" />
      ) : (
        <span className="st-mini3d-wait"><Loader2 className="w-5 h-5 animate-spin" /></span>
      )}
      <span className="st-mini3d-label">{busy && url ? <Loader2 className="w-3 h-3 animate-spin" /> : <Box className="w-3 h-3" />} 3D en direct</span>
    </button>
  );
}

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: "front", label: "Face" },
  { id: "threeQuarter", label: "¾" },
  { id: "back", label: "Dos" },
  { id: "bottom", label: "Dessous" },
];

interface PreviewStageProps {
  mode: PreviewMode;
  onMode: (m: PreviewMode) => void;
  shape: PackagingShape;
  spec: PackagingSpec;
  design: PackagingDesign;
  baseDesign: Omit<PackagingDesign, "logo">;
  logoUrl: string | null;
  onCaptureReady: (capture: () => string) => void;
  onViewChange?: (view: ViewPreset) => void;
  /** Smart layout of developed conical tubs (RECOMMEND / APPLY), null elsewhere. */
  smart?: SmartLayoutView | null;
}

export function PreviewStage({ mode, onMode, shape, spec, design, baseDesign, logoUrl, onCaptureReady, onViewChange, smart }: PreviewStageProps) {
  const [zoom, setZoom] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewKey, setViewKey] = useState(0);
  const [view, setView] = useState<ViewPreset>("threeQuarter");

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
          <div className="st-zoom st-views" role="group" aria-label="Angle de vue">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={view === v.id && !autoRotate ? "is-on" : ""}
                aria-pressed={view === v.id && !autoRotate}
                onClick={() => {
                  setAutoRotate(false);
                  setView(v.id);
                  onViewChange?.(v.id);
                  setViewKey((k) => k + 1);
                }}
              >
                {v.label}
              </button>
            ))}
            <button type="button" onClick={() => setAutoRotate((v) => !v)} aria-pressed={autoRotate} title="Rotation automatique" className={autoRotate ? "is-on" : ""}>
              <RotateCw className="w-4 h-4" />
            </button>
            <button type="button" className="st-zoom-value" onClick={() => setViewKey((k) => k + 1)} title="Recentrer la vue">Recentrer</button>
          </div>
        )}
      </div>

      <div className="st-stage-body">
        {mode === "flat" ? (
          <div className="st-flat-wrap">
            <div className="st-flat">
              <DielinePreview shape={shape} design={design} zoom={zoom} smart={smart} />
            </div>
            <LiveMini3D shape={shape} design={design} onOpen={() => onMode("3d")} />
          </div>
        ) : (
          <div className="st-3d" key={viewKey}>
            <Packaging3DViewer
              spec={spec}
              design={baseDesign}
              logoUrl={logoUrl}
              view={view}
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
