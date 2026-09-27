/**
 * Packaging artwork drawn on a 2D canvas. Shared by the 3D textures, the flat
 * die-line preview and the print PDF so all three always show the same design.
 */
import { PACKAGING_FONTS } from "@/lib/catalog/fonts";

export interface PackagingDesign {
  brandName: string;
  productName: string;
  tagline?: string;
  volume: string;
  /** Back-panel copy: ingredients, composition, usage… */
  details?: string;
  /** [background, ink, accent, extra] */
  palette: string[];
  /** CSS font families (installed fonts, see lib/catalog/fonts). */
  headingFont: string;
  bodyFont: string;
  finishing: string;
  logo?: HTMLImageElement | null;
}

export type FaceKind = "front" | "back" | "side" | "top" | "plain" | "strip";

// ─── Colour helpers ──────────────────────────────────────────────────────────

export function luminance(hex: string): number {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return 1;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Resolve background / ink / accent so text is always readable. */
export function resolveColors(palette: string[]) {
  const bg = palette[0] ?? "#ffffff";
  const candidates = [palette[1], palette[2], palette[3], "#111111", "#ffffff"].filter(Boolean) as string[];
  const ink = candidates.find((c) => contrast(c, bg) >= 4.5) ?? (luminance(bg) > 0.4 ? "#111111" : "#ffffff");
  const accent = palette[2] ?? ink;
  const extra = palette[3] ?? accent;
  return { bg, ink, accent, extra };
}

// ─── Fonts ───────────────────────────────────────────────────────────────────

const FONT_INDEX = new Map(PACKAGING_FONTS.map((f) => [f.family, f]));

export function fontCss(family: string) {
  const cat = FONT_INDEX.get(family)?.category;
  const fallback = cat === "serif" ? "Georgia, serif" : cat === "mono" ? "monospace" : cat === "script" ? "cursive" : "Arial, sans-serif";
  return `"${family}", ${fallback}`;
}

/** Heaviest installed weight up to `wanted`, so the canvas never fakes bold. */
export function fontWeight(family: string, wanted: number) {
  const weights = FONT_INDEX.get(family)?.weights ?? [400, 700];
  return weights.filter((w) => w <= wanted).pop() ?? weights[0];
}

function isScript(family: string) {
  return FONT_INDEX.get(family)?.category === "script";
}

/** Make sure the design's fonts are ready before drawing on a canvas. */
export async function loadDesignFonts(d: Pick<PackagingDesign, "headingFont" | "bodyFont">) {
  if (typeof document === "undefined" || !document.fonts) return;
  const loads = [
    `${fontWeight(d.headingFont, 700)} 32px ${fontCss(d.headingFont)}`,
    `${fontWeight(d.bodyFont, 400)} 32px ${fontCss(d.bodyFont)}`,
    `${fontWeight(d.bodyFont, 700)} 32px ${fontCss(d.bodyFont)}`,
  ];
  await Promise.all(loads.map((f) => document.fonts.load(f).catch(() => [])));
}

// ─── Drawing primitives ──────────────────────────────────────────────────────

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: (s: number) => string) {
  let s = size;
  do {
    ctx.font = font(s);
    if (ctx.measureText(text).width <= maxW) break;
    s *= 0.92;
  } while (s > 4);
  return s;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function paperGrain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: boolean) {
  const n = Math.min(4000, Math.round((w * h) / 350));
  ctx.fillStyle = dark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.035)";
  for (let i = 0; i < n; i++) ctx.fillRect(x + Math.random() * w, y + Math.random() * h, 1.5, 1.5);
}

function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - w * 0.06, y - h * 0.08, w * 1.12, h * 1.35);
  ctx.fillStyle = "#111111";
  const unit = w / 95;
  for (let i = 0, px = 0; px < w; i++) {
    const bar = unit * (1 + ((i * 7) % 3));
    ctx.fillRect(x + px, y, bar, h);
    px += bar + unit * (1 + ((i * 5) % 2));
  }
}

/** Main front artwork inside the rectangle (x, y, w, h). */
export function drawFront(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: PackagingDesign) {
  const { ink, accent } = resolveColors(d.palette);
  const head = fontCss(d.headingFont);
  const body = fontCss(d.bodyFont);
  const hw = fontWeight(d.headingFont, 800);
  const pad = Math.min(w, h) * 0.09;
  const cx = x + w / 2;
  const unit = Math.min(w, h * 0.7);
  const maxText = w - pad * 2.4;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Fine frame
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, unit * 0.006);
  ctx.strokeRect(x + pad * 0.55, y + pad * 0.55, w - pad * 1.1, h - pad * 1.1);
  ctx.globalAlpha = 1;

  // Logo or monogram
  const logoSize = unit * 0.26;
  let cursor = y + h * 0.2;
  if (d.logo && d.logo.complete && d.logo.naturalWidth > 0) {
    const r = d.logo.naturalWidth / d.logo.naturalHeight;
    const lw = r >= 1 ? logoSize : logoSize * r;
    const lh = r >= 1 ? logoSize / r : logoSize;
    ctx.drawImage(d.logo, cx - lw / 2, cursor - lh / 2, lw, lh);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cursor, logoSize * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.fillStyle = resolveColors([accent]).ink;
    ctx.font = `${hw} ${logoSize * 0.42}px ${head}`;
    ctx.fillText((d.brandName || "E").trim().charAt(0).toUpperCase(), cx, cursor + logoSize * 0.02);
  }

  // Brand
  ctx.fillStyle = ink;
  cursor = y + h * 0.45;
  const brand = isScript(d.headingFont) ? d.brandName || "Brand" : (d.brandName || "BRAND").toUpperCase();
  const bs = fitText(ctx, brand, maxText, unit * 0.17, (s) => `${hw} ${s}px ${head}`);
  ctx.fillText(brand, cx, cursor);

  // Accent rule
  cursor += bs * 0.8;
  ctx.fillStyle = accent;
  ctx.fillRect(cx - unit * 0.08, cursor, unit * 0.16, Math.max(1.5, unit * 0.012));

  // Product name
  cursor += unit * 0.085;
  ctx.fillStyle = ink;
  const pw = fontWeight(d.bodyFont, 700);
  fitText(ctx, d.productName || "", maxText, unit * 0.075, (s) => `${pw} ${s}px ${body}`);
  ctx.fillText(d.productName || "", cx, cursor);

  // Tagline
  if (d.tagline) {
    cursor += unit * 0.075;
    ctx.globalAlpha = 0.85;
    fitText(ctx, d.tagline, maxText, unit * 0.05, (s) => `${fontWeight(d.bodyFont, 400)} ${s}px ${body}`);
    ctx.fillText(d.tagline, cx, cursor);
    ctx.globalAlpha = 1;
  }

  // Volume
  if (d.volume) {
    ctx.globalAlpha = 0.85;
    fitText(ctx, d.volume, maxText, unit * 0.055, (s) => `${fontWeight(d.bodyFont, 700)} ${s}px ${body}`);
    ctx.fillText(d.volume, cx, y + h - pad * 1.6);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: PackagingDesign) {
  const { ink, accent } = resolveColors(d.palette);
  const body = fontCss(d.bodyFont);
  const pad = Math.min(w, h) * 0.1;
  const size = Math.max(4, Math.min(w, h) * 0.045);
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = accent;
  ctx.font = `${fontWeight(d.bodyFont, 700)} ${size * 1.15}px ${body}`;
  ctx.fillText((d.productName || "").toUpperCase(), x + pad, y + pad, w - pad * 2);
  ctx.fillStyle = ink;
  ctx.font = `${fontWeight(d.bodyFont, 400)} ${size}px ${body}`;
  const lines = wrapLines(ctx, d.details || "", w - pad * 2);
  const maxLines = Math.max(1, Math.floor((h * 0.5) / (size * 1.35)));
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x + pad, y + pad + size * 2 + i * size * 1.35, w - pad * 2));
  if (d.volume) {
    ctx.font = `${fontWeight(d.bodyFont, 700)} ${size}px ${body}`;
    ctx.fillText(d.volume, x + pad, y + h * 0.68, w - pad * 2);
  }
  ctx.restore();
  const bw = Math.min(w * 0.5, h * 0.45);
  drawBarcode(ctx, x + (w - bw) / 2, y + h * 0.76, bw, Math.min(h * 0.12, bw * 0.45));
}

function drawSide(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: PackagingDesign, kind: FaceKind) {
  const { ink, accent } = resolveColors(d.palette);
  const head = fontCss(d.headingFont);
  ctx.save();
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const vertical = kind === "side" && h > w;
  ctx.translate(x + w / 2, y + h / 2);
  if (vertical) ctx.rotate(-Math.PI / 2);
  const len = vertical ? h : w;
  const thick = vertical ? w : h;
  const brand = isScript(d.headingFont) ? d.brandName : (d.brandName || "").toUpperCase();
  const hw = fontWeight(d.headingFont, 800);
  fitText(ctx, brand, len * 0.55, thick * 0.22, (s) => `${hw} ${s}px ${head}`);
  ctx.fillText(brand, 0, 0);
  ctx.restore();
  ctx.fillStyle = accent;
  ctx.fillRect(x, y + h - h * 0.04, w, h * 0.04);
}

/** Paint one face (background included) into (x, y, w, h). */
export function drawFace(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  d: PackagingDesign, kind: FaceKind, opts: { grain?: boolean; background?: boolean } = {}
) {
  const { bg } = resolveColors(d.palette);
  if (opts.background !== false) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
  }
  if (opts.grain) paperGrain(ctx, x, y, w, h, luminance(bg) < 0.3);
  if (kind === "front" || kind === "top") drawFront(ctx, x, y, w, h, d);
  else if (kind === "side" || kind === "strip") drawSide(ctx, x, y, w, h, d, kind);
  else if (kind === "back") drawBack(ctx, x, y, w, h, d);
}

/** Cylindrical wrap label: front artwork centred on `frontFraction` of the width. */
export function drawWrap(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  d: PackagingDesign, frontFraction: number, opts: { grain?: boolean } = {}
) {
  const { bg, accent } = resolveColors(d.palette);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  if (opts.grain) paperGrain(ctx, x, y, w, h, luminance(bg) < 0.3);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, h * 0.035);
  ctx.fillRect(x, y + h * 0.965, w, h * 0.035);
  const fw = w * frontFraction;
  drawFront(ctx, x + (w - fw) / 2, y + h * 0.035, fw, h * 0.93, d);
  // Legal copy on the left-hand side of the wrap (reads when the pack is turned).
  const side = (w - fw) / 2;
  if (side > h * 0.35) drawBack(ctx, x + side * 0.05, y + h * 0.06, side * 0.9, h * 0.88, d);
}
