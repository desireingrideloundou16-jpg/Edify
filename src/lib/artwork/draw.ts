/**
 * Packaging artwork drawn on a 2D canvas. Shared by the 3D textures, the flat
 * die-line preview and the print PDF so all three always show the same design.
 */
import { PACKAGING_FONTS } from "@/lib/catalog/fonts";
import { ean13Modules, isGuardModule, normalizeEan } from "@/lib/print/ean13";
import { drawLayout, drawMotif, type LayoutId, type MotifId } from "./compose";
import { ASPECT_TOLERANCE, placeElement, textBox, withPlacementSession, type RecordedElement, type WrapPlacement } from "./placement";

export interface PackagingDesign {
  brandName: string;
  productName: string;
  tagline?: string;
  volume: string;
  /** Back-panel copy: description, storage, manufacturer, other mentions. */
  details?: string;
  /** Label information (drawn on the back with bilingual FR/EN headings, as required in Cameroon). */
  ingredients?: string;
  usage?: string;
  /** EAN-13 / UPC-A digits; drawn as a real barcode when the check digit is valid. */
  barcode?: string;
  expiry?: string;
  production?: string;
  price?: string;
  extra?: string;
  /** [background, ink, accent, extra] */
  palette: string[];
  /** CSS font families (installed fonts, see lib/catalog/fonts). */
  headingFont: string;
  bodyFont: string;
  finishing: string;
  logo?: HTMLImageElement | null;
  /** Front composition and background motif chosen by the AI designer (see compose.ts). */
  layout?: LayoutId;
  motif?: MotifId;
  /** Variation seed (angles, motif placement). */
  seed?: number;
  /** Custom illustration made for this pack by the AI (FLUX), and its style (see compose.drawArt). */
  art?: HTMLImageElement | null;
  artStyle?: string;
  artSubject?: string;
  /** Short seal text ("100 % naturel") and origin line ("Ouest Cameroun"): the premium detail layer. */
  badge?: string;
  origin?: string;
  /** Colour of the product seen through glass or clear plastic ("" = opaque pack). */
  contentColor?: string;
  /** Advertising copy written by the AI designer. */
  adHeadline?: string;
  adCta?: string;
  /** Smart layout applied to the wrap (phase 2C-4F-3): offsets of the moved elements (see artwork/placement.ts). */
  wrapPlacement?: WrapPlacement;
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

export function isScript(family: string) {
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

export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: (s: number) => string) {
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

function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, code?: string) {
  const ean = normalizeEan(code);
  // White box with the GS1 quiet zones (11 modules left, 7 right) so scanners read it on any background.
  const unit = w / 95;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - unit * 11, y - h * 0.08, w + unit * 18, h * 1.32);
  ctx.fillStyle = "#111111";
  if (!ean.ok) {
    // Placeholder: evenly spaced thin bars, clearly not a real code.
    for (let px = 0; px < w; px += unit * 3) ctx.fillRect(x + px, y, unit, h);
    return;
  }
  const modules = ean13Modules(ean.digits);
  const digitsH = h * 0.2;
  for (let i = 0; i < 95; i++) {
    if (modules[i] !== "1") continue;
    ctx.fillRect(x + i * unit, y, unit + 0.15, isGuardModule(i) ? h : h - digitsH);
  }
  ctx.font = `500 ${digitsH * 0.95}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(ean.digits[0], x - unit * 6, y + h + digitsH * 0.1);
  ctx.fillText(ean.digits.slice(1, 7).split("").join(" "), x + unit * 24, y + h + digitsH * 0.1);
  ctx.fillText(ean.digits.slice(7).split("").join(" "), x + unit * 70, y + h + digitsH * 0.1);
}

/** "2027-03-01" → "01/03/2027"; anything else is kept as typed. */
function formatDate(v: string) {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v.trim();
}

/** Back-panel sections with bilingual headings (French / English). */
function backSections(d: PackagingDesign): { label: string; text: string }[] {
  const rows: { label: string; text: string }[] = [];
  if (d.ingredients?.trim()) rows.push({ label: "Ingrédients / Ingredients", text: d.ingredients.trim() });
  if (d.usage?.trim()) rows.push({ label: "Mode d'emploi / Directions", text: d.usage.trim() });
  if (d.details?.trim()) rows.push({ label: "", text: d.details.trim() });
  if (d.extra?.trim()) rows.push({ label: "", text: d.extra.trim() });
  return rows;
}

/** Main front artwork inside the rectangle (x, y, w, h). */
export function drawFront(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: PackagingDesign) {
  if (d.layout && d.layout !== "classic") {
    drawLayout(ctx, x, y, w, h, d);
    return;
  }
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
  const logo = d.logo;
  if (logo && logo.complete && logo.naturalWidth > 0) {
    const r = logo.naturalWidth / logo.naturalHeight;
    const lw = r >= 1 ? logoSize : logoSize * r;
    const lh = r >= 1 ? logoSize / r : logoSize;
    placeElement(ctx, "logo", () => [cx - lw / 2, cursor - lh / 2, lw, lh], () => ctx.drawImage(logo, cx - lw / 2, cursor - lh / 2, lw, lh));
  } else {
    const lr = logoSize * 0.42;
    placeElement(ctx, "logo", () => [cx - lr, cursor - lr, lr * 2, lr * 2], () => {
      ctx.beginPath();
      ctx.arc(cx, cursor, logoSize * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.fillStyle = resolveColors([accent]).ink;
      ctx.font = `${hw} ${logoSize * 0.42}px ${head}`;
      ctx.fillText((d.brandName || "E").trim().charAt(0).toUpperCase(), cx, cursor + logoSize * 0.02);
    });
  }

  // Brand
  ctx.fillStyle = ink;
  cursor = y + h * 0.45;
  const brand = isScript(d.headingFont) ? d.brandName || "Brand" : (d.brandName || "BRAND").toUpperCase();
  const bs = fitText(ctx, brand, maxText, unit * 0.17, (s) => `${hw} ${s}px ${head}`);
  placeElement(ctx, "brand", () => textBox(ctx, brand, cx, cursor, bs, "center", "middle"), () => ctx.fillText(brand, cx, cursor));

  // Accent rule
  cursor += bs * 0.8;
  ctx.fillStyle = accent;
  const rule = Math.max(1.5, unit * 0.012);
  placeElement(ctx, "decorative", () => [cx - unit * 0.08, cursor, unit * 0.16, rule], () => ctx.fillRect(cx - unit * 0.08, cursor, unit * 0.16, rule));

  // Product name
  cursor += unit * 0.085;
  ctx.fillStyle = ink;
  const pw = fontWeight(d.bodyFont, 700);
  const ps = fitText(ctx, d.productName || "", maxText, unit * 0.075, (s) => `${pw} ${s}px ${body}`);
  placeElement(ctx, "productName", () => (d.productName ? textBox(ctx, d.productName, cx, cursor, ps, "center", "middle") : null), () => ctx.fillText(d.productName || "", cx, cursor));

  // Tagline
  if (d.tagline) {
    cursor += unit * 0.075;
    ctx.globalAlpha = 0.85;
    const tagline = d.tagline;
    const ts = fitText(ctx, tagline, maxText, unit * 0.05, (s) => `${fontWeight(d.bodyFont, 400)} ${s}px ${body}`);
    placeElement(ctx, "subtitle", () => textBox(ctx, tagline, cx, cursor, ts, "center", "middle"), () => ctx.fillText(tagline, cx, cursor));
    ctx.globalAlpha = 1;
  }

  // Volume
  if (d.volume) {
    ctx.globalAlpha = 0.85;
    const volume = d.volume;
    const vs = fitText(ctx, volume, maxText, unit * 0.055, (s) => `${fontWeight(d.bodyFont, 700)} ${s}px ${body}`);
    placeElement(ctx, "netContent", () => textBox(ctx, volume, cx, y + h - pad * 1.6, vs, "center", "middle"), () => ctx.fillText(volume, cx, y + h - pad * 1.6));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: PackagingDesign) {
  const { ink, accent } = resolveColors(d.palette);
  const body = fontCss(d.bodyFont);
  const regular = fontWeight(d.bodyFont, 400);
  const bold = fontWeight(d.bodyFont, 700);
  const pad = Math.min(w, h) * 0.09;
  const textW = w - pad * 2;
  // Barcode at the bottom (right-aligned on wide panels, centred on narrow ones).
  const bw = Math.min(textW * 0.62, h * 0.4, w * 0.5);
  const bh = Math.min(h * 0.12, bw * 0.5);
  const barTop = y + h - pad - bh * 1.2;
  const barX = w > h * 0.8 ? x + w - pad - bw : x + (w - bw) / 2;

  const sections = backSections(d);
  const facts: string[] = [];
  if (d.volume) facts.push(`Contenu net / Net content : ${d.volume}`);
  if (d.production?.trim()) facts.push(`Fabriqué le / Produced : ${formatDate(d.production)}`);
  if (d.expiry?.trim()) facts.push(`À consommer avant / Best before : ${formatDate(d.expiry)}`);
  if (d.price?.trim()) facts.push(`Prix / Price : ${/^\d[\d\s.]*$/.test(d.price.trim()) ? `${d.price.trim()} FCFA` : d.price.trim()}`);

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const titleSize = Math.max(4, Math.min(w, h) * 0.05);
  const top = y + pad + titleSize * 1.7;
  const room = barTop - pad * 0.4 - top;

  // Largest size where every section plus the facts block fits above the barcode.
  let size = Math.max(4, Math.min(w, h) * 0.042);
  type Line = { text: string; bold: boolean; accent: boolean; gap: number };
  let lines: Line[] = [];
  for (let tries = 0; tries < 16; tries++) {
    lines = [];
    ctx.font = `${regular} ${size}px ${body}`;
    for (const sec of sections) {
      if (sec.label) lines.push({ text: sec.label, bold: true, accent: true, gap: size * 0.3 });
      wrapLines(ctx, sec.text, textW).forEach((l, i, all) => lines.push({ text: l, bold: false, accent: false, gap: i === all.length - 1 ? size * 0.55 : 0 }));
    }
    ctx.font = `${bold} ${size}px ${body}`;
    facts.forEach((f, i) => wrapLines(ctx, f, textW).forEach((l, k, all) => lines.push({ text: l, bold: true, accent: false, gap: k === all.length - 1 && i === facts.length - 1 ? 0 : 0 })));
    const needed = lines.reduce((a, l) => a + size * 1.3 + l.gap, 0);
    if (needed <= room || size < 3) break;
    size *= 0.9;
  }

  ctx.fillStyle = accent;
  ctx.font = `${bold} ${titleSize}px ${body}`;
  const title = (d.productName || "").toUpperCase();
  placeElement(ctx, "secondary", () => (title ? textBox(ctx, title, x + pad, y + pad, titleSize, "left", "top", textW) : null), () => ctx.fillText(title, x + pad, y + pad, textW));

  // Sections from the top; facts block sits right above the barcode.
  const factLines = lines.filter((l) => l.bold && !l.accent);
  const bodyLines = lines.slice(0, lines.length - factLines.length);
  // Label copy (one block), then the facts block (net content, dates, price), then the barcode.
  const blockBox = (rows: { text: string; bold: boolean }[], y0: number, y1: number): [number, number, number, number] | null => {
    if (!rows.length) return null;
    let wMax = 0;
    for (const l of rows) {
      ctx.font = `${l.bold ? bold : regular} ${size}px ${body}`;
      wMax = Math.max(wMax, Math.min(ctx.measureText(l.text).width, textW));
    }
    return [x + pad, y0, wMax, y1 - y0];
  };
  let cy = top;
  const bodyEnd = top + bodyLines.reduce((a, l) => a + size * 1.3 + l.gap, 0);
  placeElement(ctx, "regulatory", () => blockBox(bodyLines, top, bodyEnd - size * 0.3), () => {
    for (const l of bodyLines) {
      ctx.font = `${l.bold ? bold : regular} ${size}px ${body}`;
      ctx.fillStyle = l.accent ? accent : ink;
      ctx.fillText(l.text, x + pad, cy, textW);
      cy += size * 1.3 + l.gap;
    }
  });
  cy = bodyEnd;
  let fy = Math.max(cy + size * 0.4, barTop - pad * 0.4 - factLines.length * size * 1.3);
  const fy0 = fy;
  placeElement(ctx, d.volume ? "netContent" : "regulatory", () => blockBox(factLines, fy0, fy0 + factLines.length * size * 1.3 - size * 0.3), () => {
    ctx.fillStyle = ink;
    ctx.font = `${bold} ${size}px ${body}`;
    for (const l of factLines) {
      ctx.fillText(l.text, x + pad, fy, textW);
      fy += size * 1.3;
    }
  });
  ctx.restore();

  // The barcode's box includes its white plate with the GS1 quiet zones (see drawBarcode).
  const qz = bw / 95;
  placeElement(ctx, "barcode", () => [barX - qz * 11, barTop - bh * 0.08, bw + qz * 18, bh * 1.32], () => drawBarcode(ctx, barX, barTop, bw, bh, d.barcode));
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
  // The motif dresses every panel except the back, which stays plain for legibility.
  if (opts.background !== false && kind !== "back" && kind !== "plain") drawMotif(ctx, x, y, w, h, d, kind === "front" ? 1 : 0.8);
  if (kind === "front" || kind === "top") drawFront(ctx, x, y, w, h, d);
  else if (kind === "side" || kind === "strip") drawSide(ctx, x, y, w, h, d, kind);
  else if (kind === "back") drawBack(ctx, x, y, w, h, d);
}

/**
 * Cylindrical wrap label: front artwork centred on `frontFraction` of the width. With `record`, the
 * drawn elements are reported (smart layout, artwork/smartLayout.ts); with a design's wrapPlacement,
 * the moved elements are drawn at their planned position (artwork/placement.ts). Otherwise unchanged.
 */
export function drawWrap(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  d: PackagingDesign, frontFraction: number, opts: { grain?: boolean; record?: (elements: RecordedElement[]) => void } = {}
) {
  const plan = d.wrapPlacement;
  const placed = !!plan && Math.abs(w / h / plan.aspect - 1) <= ASPECT_TOLERANCE;
  if (opts.record || placed) {
    const recorded = withPlacementSession(ctx, { mode: opts.record ? "record" : "apply", frame: { x, y, w, h }, design: d, offsets: plan?.offsets }, () => paintWrap(ctx, x, y, w, h, d, frontFraction, opts));
    opts.record?.(recorded);
    return;
  }
  paintWrap(ctx, x, y, w, h, d, frontFraction, opts);
}

function paintWrap(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  d: PackagingDesign, frontFraction: number, opts: { grain?: boolean }
) {
  const { bg, accent } = resolveColors(d.palette);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  if (opts.grain) paperGrain(ctx, x, y, w, h, luminance(bg) < 0.3);
  drawMotif(ctx, x, y, w, h, d);
  ctx.fillStyle = accent;
  ctx.fillRect(x, y, w, h * 0.035);
  ctx.fillRect(x, y + h * 0.965, w, h * 0.035);
  const fw = w * frontFraction;
  drawFront(ctx, x + (w - fw) / 2, y + h * 0.035, fw, h * 0.93, d);
  // Legal copy on the left-hand side of the wrap (reads when the pack is turned).
  const side = (w - fw) / 2;
  if (side > h * 0.35) {
    // Plain panel behind the label copy so it stays readable over a motif.
    if (d.motif && d.motif !== "none") {
      ctx.fillStyle = bg;
      ctx.fillRect(x + side * 0.03, y + h * 0.05, side * 0.94, h * 0.9);
    }
    drawBack(ctx, x + side * 0.05, y + h * 0.06, side * 0.9, h * 0.88, d);
  }
}
