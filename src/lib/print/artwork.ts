import { drawFace, drawWrap, resolveColors, type PackagingDesign } from "@/lib/artwork/draw";
import { drawSurface } from "@/lib/artwork/surface";
import { BLEED_MM, type FlatLayout } from "./layout";

/** Flat artwork (bleed included) at `pxPerMm`. */
export function renderFlatArtwork(layout: FlatLayout, design: PackagingDesign, pxPerMm: number) {
  const k = pxPerMm;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((layout.width + BLEED_MM * 2) * k);
  canvas.height = Math.round((layout.height + BLEED_MM * 2) * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = resolveColors(design.palette).bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of layout.panels) {
    const x = (p.x + BLEED_MM) * k;
    const y = (p.y + BLEED_MM) * k;
    const w = p.w * k;
    const h = p.h * k;
    ctx.save();
    const turn = p.flip ? 180 : p.quarterTurn ?? 0;
    if (turn) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((turn * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    if (turn === 90 || turn === 270) {
      // The surface is drawn upright (wMm × hMm) in the rotated frame, centred on the panel.
      const sw = h, sh = w;
      const sx = x + (w - sw) / 2, sy = y + (h - sh) / 2;
      if (p.surface) drawSurface(ctx, sx, sy, sw, sh, design, p.surface);
      else drawFace(ctx, sx, sy, sw, sh, design, p.kind === "wrap" ? "plain" : p.kind);
      ctx.restore();
      continue;
    }
    // Same drawing as the 3D texture of this surface (artwork/surface.ts).
    const sw = p.surface ? p.surface.wMm * k : w;
    if (p.surface && (p.surfaceOffsetMm || Math.abs(sw - w) > 1e-6)) {
      // Window on a surface: it starts surfaceOffsetMm into the panel (wrapping around a closed tube),
      // or the panel shows only a part of it (one surface over several panels).
      const dx = (p.surfaceOffsetMm ?? 0) * k;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      drawSurface(ctx, x - dx, y, sw, h, design, p.surface);
      if (x - dx + sw < x + w - 1e-6) drawSurface(ctx, x - dx + sw, y, sw, h, design, p.surface);
    } else if (p.surface) drawSurface(ctx, x, y, w, h, design, p.surface);
    else if (p.kind === "wrap") drawWrap(ctx, x, y, w, h, design, p.frontFraction ?? 0.3);
    else drawFace(ctx, x, y, w, h, design, p.kind);
    ctx.restore();
  }
  return canvas;
}

/** Cut (solid magenta) and crease (dashed cyan) lines over an artwork canvas. */
export function drawDieline(ctx: CanvasRenderingContext2D, layout: FlatLayout, pxPerMm: number, offsetMm = BLEED_MM) {
  const k = pxPerMm;
  const P = ([x, y]: [number, number]) => [(x + offsetMm) * k, (y + offsetMm) * k] as const;
  ctx.save();
  ctx.lineJoin = "round";

  // Bleed limit
  ctx.strokeStyle = "rgba(16,185,129,0.8)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, (layout.width + offsetMm * 2) * k - 1, (layout.height + offsetMm * 2) * k - 1);

  // Glue areas: hatched slate (UI slate-400), under the cut and crease lines.
  for (const zone of layout.glueZones ?? []) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    zone.forEach((pt, i) => (i ? ctx.lineTo(...P(pt)) : ctx.moveTo(...P(pt))));
    ctx.closePath();
    ctx.fillStyle = "rgba(148,163,184,0.28)";
    ctx.fill();
    ctx.clip();
    const xs = zone.map((p) => P(p)[0]), ys = zone.map((p) => P(p)[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const step = Math.max(4, k * 2);
    ctx.strokeStyle = "rgba(100,116,139,0.8)";
    ctx.lineWidth = Math.max(0.75, k * 0.12);
    ctx.beginPath();
    for (let d = -(y1 - y0); d < x1 - x0; d += step) {
      ctx.moveTo(x0 + d, y1);
      ctx.lineTo(x0 + d + (y1 - y0), y0);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Technical zones (keep critical artwork out): light emerald — the guide colour of the bleed — dotted.
  for (const { polygon: zone } of layout.technicalZones ?? []) {
    ctx.save();
    ctx.beginPath();
    zone.forEach((pt, i) => (i ? ctx.lineTo(...P(pt)) : ctx.moveTo(...P(pt))));
    ctx.closePath();
    ctx.fillStyle = "rgba(16,185,129,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(16,185,129,0.9)";
    ctx.lineWidth = Math.max(0.75, k * 0.12);
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.restore();
  }

  // Weld / seam areas: the same slate as glue, cross-hatched; dashed outline when sealed after filling.
  for (const zone of layout.sealZones ?? []) {
    ctx.save();
    ctx.beginPath();
    zone.polygon.forEach((pt, i) => (i ? ctx.lineTo(...P(pt)) : ctx.moveTo(...P(pt))));
    ctx.closePath();
    ctx.fillStyle = "rgba(148,163,184,0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100,116,139,0.9)";
    ctx.lineWidth = Math.max(0.75, k * 0.12);
    ctx.setLineDash(zone.afterFilling ? [5, 3] : []);
    ctx.stroke();
    ctx.clip();
    const xs = zone.polygon.map((p) => P(p)[0]), ys = zone.polygon.map((p) => P(p)[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const step = Math.max(4, k * 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(100,116,139,0.55)";
    ctx.beginPath();
    for (let d = -(y1 - y0); d < x1 - x0; d += step) {
      ctx.moveTo(x0 + d, y1);
      ctx.lineTo(x0 + d + (y1 - y0), y0);
      ctx.moveTo(x0 + d, y0);
      ctx.lineTo(x0 + d + (y1 - y0), y1);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Composition guides (preview only — exportPrintPdf never draws them): emerald, the guide colour, thin.
  const GUIDE_DASH: Record<string, number[]> = { safe: [4, 3], primary: [8, 3, 2, 3], text: [2, 2], logo: [2, 2] };
  for (const g of layout.guides ?? []) {
    ctx.save();
    ctx.strokeStyle = "rgba(5,150,105,0.85)";
    ctx.lineWidth = Math.max(0.75, k * 0.1);
    ctx.setLineDash(GUIDE_DASH[g.kind] ?? [3, 3]);
    ctx.beginPath();
    g.polygon.forEach((pt, i) => (i ? ctx.lineTo(...P(pt)) : ctx.moveTo(...P(pt))));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = "#e6007e";
  ctx.lineWidth = Math.max(1.2, k * 0.25);
  for (const contour of [layout.cut, ...(layout.extraCuts ?? [])]) {
    ctx.beginPath();
    contour.forEach((pt, i) => {
      const [x, y] = P(pt);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  for (const [a, b] of layout.slits ?? []) {
    ctx.beginPath();
    ctx.moveTo(...P(a));
    ctx.lineTo(...P(b));
    ctx.stroke();
  }

  ctx.strokeStyle = "#0084ff";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = Math.max(1, k * 0.2);
  for (const [a, b] of layout.creases) {
    ctx.beginPath();
    ctx.moveTo(...P(a));
    ctx.lineTo(...P(b));
    ctx.stroke();
  }
  // Formed folds (film): same blue, dotted — not a scored crease.
  ctx.setLineDash([1.5, 3]);
  for (const [a, b] of layout.formedFolds ?? []) {
    ctx.beginPath();
    ctx.moveTo(...P(a));
    ctx.lineTo(...P(b));
    ctx.stroke();
  }
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality)
  );
}

/**
 * Smart layout advice over the preview (phase 2C-4F-3) — preview only, exportPrintPdf never calls it.
 * RECOMMEND: each element to move, dashed amber where it is and solid amber where it should go;
 * invalid elements in red. APPLY: the moved elements already sit at their place: only the invalid
 * ones are outlined. Rectangles are in the surface's mm, on the panel that carries the surface.
 */
export function drawLayoutAdvice(
  ctx: CanvasRenderingContext2D, layout: FlatLayout, surfaceId: string,
  plan: { status: string; rect: { x: number; y: number; w: number; h: number }; original: { x: number; y: number; w: number; h: number } }[],
  pxPerMm: number, applied: boolean, offsetMm = BLEED_MM
) {
  const panel = layout.panels.find((p) => p.surfaceId === surfaceId);
  if (!panel) return;
  const k = pxPerMm;
  const R = (r: { x: number; y: number; w: number; h: number }) => [(panel.x + r.x + offsetMm) * k, (panel.y + r.y + offsetMm) * k, r.w * k, r.h * k] as const;
  ctx.save();
  ctx.lineWidth = Math.max(1, k * 0.25);
  for (const p of plan) {
    if (p.status === "invalid") {
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(220,38,38,0.9)";
      ctx.strokeRect(...R(p.original));
    } else if (p.status === "moved" && !applied) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(217,119,6,0.75)";
      ctx.strokeRect(...R(p.original));
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(217,119,6,0.95)";
      ctx.strokeRect(...R(p.rect));
      const [ax, ay, aw, ah] = R(p.original), [bx, by, bw, bh] = R(p.rect);
      ctx.beginPath();
      ctx.moveTo(ax + aw / 2, ay + ah / 2);
      ctx.lineTo(bx + bw / 2, by + bh / 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
