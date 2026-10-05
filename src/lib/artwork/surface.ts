/**
 * What is drawn on a print surface (phase 2C-3), shared by the print sheet (print/artwork.ts) and
 * the 3D textures (three/packagingModels.ts). The two engines differ (PDF canvas vs WebGL
 * texture); what they draw on a surface is decided here, once, from the PrintSurface contract.
 */
import { drawFace, drawWrap, resolveColors, type PackagingDesign } from "./draw";
import type { PrintSurface } from "@/lib/structure";

/**
 * Paint `surface` into the pixel rectangle (x, y, w, h), upright. Areas outside `printArea`
 * (heat seals…) keep the background colour only. `grain` is the paper look of the 3D textures.
 */
export function drawSurface(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  design: PackagingDesign, surface: PrintSurface, opts: { grain?: boolean } = {}
) {
  const a = surface.printArea;
  let ax = x, ay = y, aw = w, ah = h;
  if (a) {
    ctx.fillStyle = resolveColors(design.palette).bg;
    ctx.fillRect(x, y, w, h);
    const kx = w / surface.wMm, ky = h / surface.hMm;
    ax = x + a.x * kx;
    ay = y + a.y * ky;
    aw = a.w * kx;
    ah = a.h * ky;
  }
  const shape = surface.shape;
  if (shape) {
    // Non-rectangular surface (developed cone…): background everywhere, artwork only inside its printed outline.
    if (!a) {
      ctx.fillStyle = resolveColors(design.palette).bg;
      ctx.fillRect(x, y, w, h);
    }
    ctx.save();
    ctx.beginPath();
    shape.printOutline.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + (px * w) / surface.wMm, y + (py * h) / surface.hMm));
    ctx.closePath();
    ctx.clip();
  }
  if (surface.draw.kind === "wrap") drawWrap(ctx, ax, ay, aw, ah, design, surface.draw.frontFraction ?? 0.3, opts);
  else drawFace(ctx, ax, ay, aw, ah, design, surface.draw.kind, opts);
  if (shape) ctx.restore();
}
