import { drawFace, drawWrap, resolveColors, type PackagingDesign } from "@/lib/artwork/draw";
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
    if (p.flip) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    if (p.kind === "wrap") drawWrap(ctx, x, y, w, h, design, p.frontFraction ?? 0.3);
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

  ctx.setLineDash([]);
  ctx.strokeStyle = "#e6007e";
  ctx.lineWidth = Math.max(1.2, k * 0.25);
  ctx.beginPath();
  layout.cut.forEach((pt, i) => {
    const [x, y] = P(pt);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = "#0084ff";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = Math.max(1, k * 0.2);
  for (const [a, b] of layout.creases) {
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
