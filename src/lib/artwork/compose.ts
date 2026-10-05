/**
 * Front-panel compositions and graphic motifs. The AI designer picks one layout and one motif
 * per pack (see lib/ai/packagingKnowledge), so two products never share the same composition.
 * Every layout follows the same hierarchy: brand block → product → benefit → net quantity.
 */
import { fitText, fontCss, fontWeight, isScript, luminance, resolveColors, type PackagingDesign } from "./draw";
import { elementId, placeElement, textBox, textRole } from "./placement";

export const LAYOUTS = ["classic", "bold", "band", "split", "emblem", "minimal", "frame", "pop", "window", "illustrated", "arch", "vertical", "label", "poster"] as const;
export type LayoutId = (typeof LAYOUTS)[number];
export const MOTIFS = ["none", "dots", "stripes", "waves", "geometric", "botanical", "sunburst", "wax"] as const;
export type MotifId = (typeof MOTIFS)[number];

/** Labels shown in the studio (French UI). */
export const LAYOUT_LABELS: Record<LayoutId, string> = {
  classic: "Classique centré",
  bold: "Typographie XXL",
  band: "Bandeau de couleur",
  split: "Deux tons",
  emblem: "Emblème / sceau",
  minimal: "Minimal luxe",
  frame: "Étiquette encadrée (vintage)",
  pop: "Pop et sticker",
  window: "Fenêtre sur motif",
  illustrated: "Illustration pleine page",
  arch: "Arche illustrée",
  vertical: "Marque verticale XXL",
  label: "Étiquette ronde découpée",
  poster: "Affiche typographique",
};
export const MOTIF_LABELS: Record<MotifId, string> = {
  none: "Aucun",
  dots: "Points (trame)",
  stripes: "Rayures",
  waves: "Vagues",
  geometric: "Géométrique (kente, ndop)",
  botanical: "Botanique (feuilles)",
  sunburst: "Rayons de soleil",
  wax: "Wax (cercles)",
};

export const isLayout = (v: unknown): v is LayoutId => typeof v === "string" && (LAYOUTS as readonly string[]).includes(v);
export const isMotif = (v: unknown): v is MotifId => typeof v === "string" && (MOTIFS as readonly string[]).includes(v);

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Small deterministic random generator so a design always renders the same way. */
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seedOf(d: PackagingDesign) {
  if (typeof d.seed === "number") return d.seed;
  let h = 7;
  for (const c of `${d.brandName}|${d.productName}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

const brandText = (d: PackagingDesign, upper = true) => (isScript(d.headingFont) || !upper ? d.brandName || "Brand" : (d.brandName || "BRAND").toUpperCase());

function withAlpha(hex: string, a: number) {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawLogo(ctx: CanvasRenderingContext2D, d: PackagingDesign, cx: number, cy: number, size: number, fill: string, inkOnFill: string) {
  const logo = d.logo;
  if (logo && logo.complete && logo.naturalWidth > 0) {
    const r = logo.naturalWidth / logo.naturalHeight;
    const lw = r >= 1 ? size : size * r;
    const lh = r >= 1 ? size / r : size;
    placeElement(ctx, "logo", () => [cx - lw / 2, cy - lh / 2, lw, lh], () => ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh));
    return;
  }
  const lr = size * 0.42;
  placeElement(ctx, "logo", () => [cx - lr, cy - lr, lr * 2, lr * 2], () => drawMonogram(ctx, d, cx, cy, size, fill, inkOnFill));
}

function drawMonogram(ctx: CanvasRenderingContext2D, d: PackagingDesign, cx: number, cy: number, size: number, fill: string, inkOnFill: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = inkOnFill;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${fontWeight(d.headingFont, 800)} ${size * 0.42}px ${fontCss(d.headingFont)}`;
  ctx.fillText((d.brandName || "E").trim().charAt(0).toUpperCase(), cx, cy + size * 0.02);
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, size: number, font: (s: number) => string, color: string, align: CanvasTextAlign = "center", alpha = 1) {
  if (!s) return 0;
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const used = fitText(ctx, s, maxW, size, font);
  placeElement(ctx, textRole(ctx, s), () => textBox(ctx, s, x, y, used, align, "middle"), () => ctx.fillText(s, x, y));
  ctx.restore();
  return used;
}

// ─── motifs ──────────────────────────────────────────────────────────────────

/** Background motif over a panel, in the accent colours at low contrast. */
export function drawMotif(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: PackagingDesign, strength = 1) {
  const motif = d.motif ?? "none";
  if (motif === "none") return;
  const { bg, accent, extra } = resolveColors(d.palette);
  const dark = luminance(bg) < 0.3;
  const a = (dark ? 0.16 : 0.13) * strength;
  const c1 = withAlpha(accent, a);
  const c2 = withAlpha(extra, a * 0.9);
  const u = Math.min(w, h);
  const r = rng(seedOf(d));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  switch (motif) {
    case "dots": {
      const step = u * 0.06;
      for (let yy = y; yy < y + h + step; yy += step)
        for (let xx = x + ((yy - y) / step) % 2 * step * 0.5; xx < x + w + step; xx += step) {
          ctx.fillStyle = c1;
          ctx.beginPath();
          ctx.arc(xx, yy, step * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
      break;
    }
    case "stripes": {
      ctx.strokeStyle = c1;
      ctx.lineWidth = u * 0.03;
      const step = u * 0.09;
      for (let k = -h; k < w + h; k += step) {
        ctx.beginPath();
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + k + h, y + h);
        ctx.stroke();
      }
      break;
    }
    case "waves": {
      ctx.lineWidth = u * 0.012;
      const step = u * 0.07;
      for (let yy = y, i = 0; yy < y + h + step; yy += step, i++) {
        ctx.strokeStyle = i % 2 ? c1 : c2;
        ctx.beginPath();
        for (let xx = x; xx <= x + w + 4; xx += 4) ctx.lineTo(xx, yy + Math.sin((xx - x) / (u * 0.08)) * step * 0.28);
        ctx.stroke();
      }
      break;
    }
    case "geometric": {
      // Kente / ndop inspired grid of diamonds and bars
      const s = u * 0.12;
      for (let yy = y, row = 0; yy < y + h + s; yy += s, row++)
        for (let xx = x, col = 0; xx < x + w + s; xx += s, col++) {
          ctx.fillStyle = (row + col) % 2 ? c1 : c2;
          if ((row + col) % 3 === 0) ctx.fillRect(xx, yy + s * 0.42, s, s * 0.16);
          ctx.beginPath();
          ctx.moveTo(xx + s / 2, yy + s * 0.12);
          ctx.lineTo(xx + s * 0.88, yy + s / 2);
          ctx.lineTo(xx + s / 2, yy + s * 0.88);
          ctx.lineTo(xx + s * 0.12, yy + s / 2);
          ctx.closePath();
          ctx.fill();
        }
      break;
    }
    case "botanical": {
      const leaves = 26;
      for (let i = 0; i < leaves; i++) {
        const lx = x + r() * w, ly = y + r() * h;
        const size = u * (0.05 + r() * 0.08);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(r() * Math.PI * 2);
        ctx.fillStyle = i % 2 ? c1 : c2;
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(dark ? "#ffffff" : "#000000", a * 0.6);
        ctx.lineWidth = Math.max(1, size * 0.05);
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case "sunburst": {
      const cx = x + w / 2, cy = y + h * 0.42, rays = 36, R = Math.hypot(w, h);
      for (let i = 0; i < rays; i++) {
        if (i % 2) continue;
        const a0 = (i / rays) * Math.PI * 2, a1 = ((i + 1) / rays) * Math.PI * 2;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
        ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "wax": {
      // Wax-print inspired concentric circles and half moons
      const s = u * 0.2;
      for (let yy = y, row = 0; yy < y + h + s; yy += s * 0.9, row++)
        for (let xx = x + (row % 2) * s * 0.5; xx < x + w + s; xx += s) {
          for (let k = 3; k > 0; k--) {
            ctx.strokeStyle = k % 2 ? c1 : c2;
            ctx.lineWidth = s * 0.06;
            ctx.beginPath();
            ctx.arc(xx, yy, (s * 0.42 * k) / 3, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = c2;
          ctx.beginPath();
          ctx.arc(xx + s * 0.5, yy + s * 0.45, s * 0.12, Math.PI, 0);
          ctx.fill();
        }
      break;
    }
  }
  ctx.restore();
}

// ─── illustration and detail layer ───────────────────────────────────────────

/**
 * How the AI illustration melts into the pack: illustrations are generated on white (light
 * packs → multiply) or on black (dark packs → screen), so their background disappears and only
 * the drawing remains, as if printed on the label. Photos are feathered in normally.
 */
export function artBlend(d: PackagingDesign): GlobalCompositeOperation {
  if (d.artStyle === "photo") return "source-over";
  return luminance(resolveColors(d.palette).bg) > 0.45 ? "multiply" : "screen";
}

/** Draws the pack's illustration in (x, y, w, h). Returns false when there is none. */
export function drawArt(
  ctx: CanvasRenderingContext2D, d: PackagingDesign, x: number, y: number, w: number, h: number,
  opts: { fit?: "cover" | "contain"; fade?: "bottom" | "edges" | "none"; alpha?: number } = {}
) {
  const img = d.art;
  if (!img || !img.complete || !img.naturalWidth || w < 4 || h < 4) return false;
  const cw = Math.max(4, Math.round(w)), ch = Math.max(4, Math.round(h));
  const off = document.createElement("canvas");
  off.width = cw;
  off.height = ch;
  const o = off.getContext("2d")!;
  // Image models sometimes sign their pictures in a corner: crop a thin margin all around.
  const inset = 0.05;
  const sx = img.naturalWidth * inset, sy = img.naturalHeight * inset;
  const sw = img.naturalWidth - sx * 2, sh = img.naturalHeight - sy * 2;
  const ir = sw / sh, br = cw / ch;
  const cover = (opts.fit ?? "cover") === "cover";
  const k = cover ? (ir > br ? ch / sh : cw / sw) : (ir > br ? cw / sw : ch / sh);
  const dw = sw * k, dh = sh * k;
  o.drawImage(img, sx, sy, sw, sh, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  const blend = artBlend(d);
  const fade = opts.fade ?? "none";
  // Blended illustrations: fade the edges to the blend's neutral colour (white for multiply,
  // black for screen) so a drawing that touches the border dissolves into the label.
  if (blend !== "source-over" && fade !== "none") {
    const n = blend === "multiply" ? "255,255,255" : "0,0,0";
    // Visible part of the picture inside the box.
    const ix = Math.max(0, (cw - dw) / 2), iy = Math.max(0, (ch - dh) / 2);
    const iw = Math.min(cw, dw), ih = Math.min(ch, dh);
    const band = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const g = o.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(${n},1)`);
      g.addColorStop(1, `rgba(${n},0)`);
      o.fillStyle = g;
      o.fillRect(rx, ry, rw, rh);
    };
    if (fade === "bottom") {
      band(0, iy + ih, 0, iy + ih * 0.7, ix, iy + ih * 0.7, iw, ih * 0.3);
    } else {
      const bx = iw * 0.14, by = ih * 0.14;
      band(ix, 0, ix + bx, 0, ix, iy, bx, ih);
      band(ix + iw, 0, ix + iw - bx, 0, ix + iw - bx, iy, bx, ih);
      band(0, iy, 0, iy + by, ix, iy, iw, by);
      band(0, iy + ih, 0, iy + ih - by, ix, iy + ih - by, iw, by);
    }
  }
  // Photos: alpha mask.
  if (blend === "source-over" && fade !== "none") {
    o.globalCompositeOperation = "destination-in";
    if (fade === "bottom") {
      const g = o.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.72, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g;
    } else {
      const g = o.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.28, cw / 2, ch / 2, Math.max(cw, ch) * 0.56);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g;
    }
    o.fillRect(0, 0, cw, ch);
  }
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.drawImage(off, x, y, w, h);
  ctx.restore();
  return true;
}

/** Small letter-spaced capitals ("ORIGINE · OUEST CAMEROUN"), the micro-typography of premium labels. */
function microLine(ctx: CanvasRenderingContext2D, d: PackagingDesign, s: string, x: number, y: number, maxW: number, size: number, color: string, align: CanvasTextAlign = "center") {
  if (!s) return;
  ctx.save();
  ctx.letterSpacing = `${size * 0.22}px`;
  text(ctx, s.toUpperCase(), x, y, maxW, size, (z) => `${fontWeight(d.bodyFont, 700)} ${z}px ${fontCss(d.bodyFont)}`, color, align, 0.9);
  ctx.restore();
}

/** Text running around a circle, centred on the top (or bottom) of the ring. */
function arcText(ctx: CanvasRenderingContext2D, s: string, cx: number, cy: number, r: number, size: number, font: string, color: string, bottom = false) {
  if (!s) return;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const spacing = size * 0.12;
  const widths = [...s].map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let angle = (bottom ? Math.PI / 2 : -Math.PI / 2) + ((bottom ? 1 : -1) * total) / (2 * r);
  [...s].forEach((c, i) => {
    const half = widths[i] / 2 / r;
    angle += bottom ? -half : half;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.rotate(bottom ? angle - Math.PI / 2 : angle + Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    angle += bottom ? -half : half;
  });
  ctx.restore();
}

/** Round stamp carrying the badge (e.g. "100 % naturel"), text all around the ring. */
function drawSeal(ctx: CanvasRenderingContext2D, d: PackagingDesign, cx: number, cy: number, R: number, rot = -0.18) {
  const badge = (d.badge ?? "").trim();
  if (!badge || R < 6) return;
  placeElement(ctx, "badge", () => [cx - R, cy - R, R * 2, R * 2], () => paintSeal(ctx, d, badge, cx, cy, R, rot));
}

function paintSeal(ctx: CanvasRenderingContext2D, d: PackagingDesign, badge: string, cx: number, cy: number, R: number, rot: number) {
  const { bg, extra, accent } = resolveColors(d.palette);
  const fill = contrastOk(extra, bg) ? extra : accent;
  const sealInk = resolveColors([fill, "#ffffff", "#111111"]).ink;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = sealInk;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, R * 0.025);
  ctx.setLineDash([R * 0.05, R * 0.05]);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  const ring = `${badge.toUpperCase()} • `;
  const size = R * 0.2;
  const font = `${fontWeight(d.bodyFont, 700)} ${size}px ${fontCss(d.bodyFont)}`;
  // Repeat the badge until it fills the ring.
  ctx.font = font;
  const per = ctx.measureText(ring).width + ring.length * size * 0.12;
  const reps = Math.max(1, Math.floor((2 * Math.PI * R * 0.8) / per));
  const full = ring.repeat(reps);
  arcText(ctx, full, 0, 0, R * 0.8, size, font, sealInk);
  ctx.fillStyle = sealInk;
  ctx.font = `${fontWeight(d.headingFont, 800)} ${R * 0.42}px ${fontCss(d.headingFont)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✦", 0, R * 0.02);
  ctx.restore();
}

function contrastOk(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05) > 1.6;
}

/** Arch path (flat bottom, round top). */
function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// ─── layouts ─────────────────────────────────────────────────────────────────

/** Draws the front panel with the design's layout (classic is handled by draw.ts). */
export function drawLayout(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, d: PackagingDesign) {
  const { bg, ink, accent, extra } = resolveColors(d.palette);
  const accentInk = resolveColors([accent, bg, ink, "#111111", "#ffffff"]).ink;
  const head = fontCss(d.headingFont);
  const body = fontCss(d.bodyFont);
  const hw = fontWeight(d.headingFont, 800);
  const bw = fontWeight(d.bodyFont, 700);
  const br = fontWeight(d.bodyFont, 400);
  const H = (s: number) => `${hw} ${s}px ${head}`;
  const B = (s: number) => `${bw} ${s}px ${body}`;
  const Br = (s: number) => `${br} ${s}px ${body}`;
  const pad = Math.min(w, h) * 0.09;
  const cx = x + w / 2;
  const unit = Math.min(w, h * 0.7);
  const maxText = w - pad * 2.4;
  const r = rng(seedOf(d));

  switch (d.layout) {
    case "bold": {
      // Oversized brand, stacked words, left aligned — challenger brands, drinks, snacks
      const words = brandText(d).split(/\s+/).filter(Boolean).slice(0, 3);
      let yy = y + pad * 1.5;
      const left = x + pad * 1.1;
      for (const word of words) {
        const s = text(ctx, word, left, yy + unit * 0.13, w - pad * 2.2, unit * 0.36, H, ink, "left");
        yy += s * 0.92;
      }
      ctx.fillStyle = accent;
      ctx.fillRect(left, yy + unit * 0.05, unit * 0.22, Math.max(2, unit * 0.022));
      const py = y + h - pad * 3.2;
      text(ctx, d.productName, left, py, w - pad * 2.2, unit * 0.085, B, ink, "left");
      if (d.tagline) text(ctx, d.tagline, left, py + unit * 0.085, w - pad * 2.2, unit * 0.05, Br, ink, "left", 0.85);
      text(ctx, d.volume, x + w - pad * 1.1, y + h - pad * 1.4, w * 0.4, unit * 0.055, B, ink, "right", 0.9);
      if (d.logo) drawLogo(ctx, d, x + w - pad * 1.9, y + pad * 1.9, unit * 0.2, accent, accentInk);
      return;
    }
    case "band": {
      // Solid colour band carrying the brand — strong shelf blocking
      const top = y + h * 0.37, bh = h * 0.24;
      ctx.fillStyle = accent;
      ctx.fillRect(x, top, w, bh);
      drawLogo(ctx, d, cx, y + h * 0.2, unit * 0.24, accent, accentInk);
      text(ctx, brandText(d), cx, top + bh / 2, maxText, Math.min(bh * 0.55, unit * 0.2), H, accentInk);
      text(ctx, d.productName, cx, top + bh + unit * 0.1, maxText, unit * 0.08, B, ink);
      if (d.tagline) text(ctx, d.tagline, cx, top + bh + unit * 0.18, maxText, unit * 0.05, Br, ink, "center", 0.85);
      text(ctx, d.volume, cx, y + h - pad * 1.5, maxText, unit * 0.055, B, ink, "center", 0.9);
      return;
    }
    case "split": {
      // Two-tone panel (straight or diagonal) — modern, graphic
      const diag = r() > 0.5;
      const cut = y + h * 0.5;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, diag ? cut - h * 0.1 : cut);
      ctx.lineTo(x, diag ? cut + h * 0.1 : cut);
      ctx.closePath();
      ctx.fill();
      drawLogo(ctx, d, cx, y + h * 0.15, unit * 0.2, bg, ink);
      text(ctx, brandText(d), cx, y + h * 0.33, maxText, unit * 0.19, H, accentInk);
      text(ctx, d.productName, cx, y + h * 0.66, maxText, unit * 0.085, B, ink);
      if (d.tagline) text(ctx, d.tagline, cx, y + h * 0.66 + unit * 0.085, maxText, unit * 0.05, Br, ink, "center", 0.85);
      text(ctx, d.volume, cx, y + h - pad * 1.5, maxText, unit * 0.055, B, ink, "center", 0.9);
      return;
    }
    case "emblem": {
      // Circular seal — honey, coffee, heritage, cooperatives
      const cy = y + h * 0.4, R = unit * 0.36;
      // The emblem rings and its rule are linked to the brand they frame (they follow it, phase 2C-4F-4).
      placeElement(ctx, "decorative", () => [cx - R, cy - R, R * 2, R * 2], () => {
        ctx.save();
        ctx.fillStyle = withAlpha(accent, 0.12);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1.5, unit * 0.014);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = Math.max(1, unit * 0.005);
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        // Dotted ring
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95, unit * 0.004, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }, elementId(ctx, "brand", "next"));
      drawLogo(ctx, d, cx, cy - R * 0.45, unit * 0.14, accent, accentInk);
      text(ctx, brandText(d), cx, cy + R * 0.02, R * 1.5, unit * 0.15, H, ink);
      ctx.fillStyle = accent;
      const ruleH = Math.max(1.5, unit * 0.01);
      placeElement(ctx, "decorative", () => [cx - R * 0.25, cy + R * 0.25, R * 0.5, ruleH], () => ctx.fillRect(cx - R * 0.25, cy + R * 0.25, R * 0.5, ruleH), elementId(ctx, "brand", "last"));
      if (d.tagline) text(ctx, d.tagline, cx, cy + R * 0.45, R * 1.3, unit * 0.042, Br, ink, "center", 0.85);
      text(ctx, d.productName, cx, cy + R + unit * 0.1, maxText, unit * 0.08, B, ink);
      text(ctx, d.volume, cx, y + h - pad * 1.5, maxText, unit * 0.055, B, ink, "center", 0.9);
      return;
    }
    case "minimal": {
      // Restraint and white space — premium cosmetics, tea, luxury
      ctx.save();
      ctx.letterSpacing = `${unit * 0.02}px`;
      text(ctx, brandText(d), cx, y + pad * 2.2, maxText, unit * 0.075, H, ink);
      ctx.restore();
      ctx.fillStyle = accent;
      ctx.fillRect(cx - unit * 0.03, y + pad * 2.2 + unit * 0.08, unit * 0.06, Math.max(1, unit * 0.006));
      text(ctx, d.productName, cx, y + h * 0.52, maxText, unit * 0.12, (sz) => `${fontWeight(d.headingFont, 400)} ${sz}px ${head}`, ink);
      if (d.tagline) text(ctx, d.tagline, cx, y + h * 0.52 + unit * 0.11, maxText, unit * 0.045, Br, ink, "center", 0.75);
      text(ctx, d.volume, x + pad * 1.2, y + h - pad * 1.4, w * 0.45, unit * 0.045, Br, ink, "left", 0.8);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + w - pad * 1.3, y + h - pad * 1.4, unit * 0.018, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "frame": {
      // Vintage label: double frame, corner ornaments, dividers — honey, spirits, bakery, spices
      const fx = x + pad * 0.7, fy = y + pad * 0.7, fw = w - pad * 1.4, fh = h - pad * 1.4;
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, unit * 0.012);
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.lineWidth = Math.max(1, unit * 0.004);
      ctx.strokeRect(fx + unit * 0.025, fy + unit * 0.025, fw - unit * 0.05, fh - unit * 0.05);
      const orn = unit * 0.03;
      for (const [ox, oy] of [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]]) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(ox, oy - orn);
        ctx.lineTo(ox + orn, oy);
        ctx.lineTo(ox, oy + orn);
        ctx.lineTo(ox - orn, oy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      const divider = (yy: number) => {
        ctx.fillStyle = accent;
        ctx.fillRect(cx - unit * 0.18, yy, unit * 0.13, Math.max(1, unit * 0.005));
        ctx.fillRect(cx + unit * 0.05, yy, unit * 0.13, Math.max(1, unit * 0.005));
        ctx.beginPath();
        ctx.moveTo(cx, yy - unit * 0.015);
        ctx.lineTo(cx + unit * 0.015, yy);
        ctx.lineTo(cx, yy + unit * 0.015);
        ctx.lineTo(cx - unit * 0.015, yy);
        ctx.closePath();
        ctx.fill();
      };
      drawLogo(ctx, d, cx, y + h * 0.2, unit * 0.2, accent, accentInk);
      divider(y + h * 0.32);
      text(ctx, brandText(d), cx, y + h * 0.42, maxText * 0.95, unit * 0.16, H, ink);
      divider(y + h * 0.52);
      text(ctx, d.productName, cx, y + h * 0.6, maxText * 0.9, unit * 0.075, B, ink);
      if (d.tagline) text(ctx, d.tagline, cx, y + h * 0.6 + unit * 0.075, maxText * 0.9, unit * 0.045, Br, ink, "center", 0.85);
      text(ctx, d.volume, cx, y + h - pad * 1.9, maxText * 0.8, unit * 0.05, B, ink, "center", 0.9);
      return;
    }
    case "pop": {
      // Playful: colour blob behind the brand, tilted brand, sticker — kids, snacks, soft drinks
      ctx.save();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(cx + unit * 0.04, y + h * 0.42, unit * 0.48, unit * 0.3, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(cx, y + h * 0.42);
      ctx.rotate(-0.07);
      text(ctx, brandText(d), 0, 0, unit * 0.85, unit * 0.22, H, accentInk);
      ctx.restore();
      // Sticker
      const sx = x + w - pad * 2.4, sy = y + pad * 2.4, sr = unit * 0.15;
      ctx.save();
      ctx.fillStyle = extra;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, rr = i % 2 ? sr : sr * 0.86;
        ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.translate(sx, sy);
      ctx.rotate(0.2);
      text(ctx, d.volume || "NEW", 0, 0, sr * 1.4, sr * 0.45, B, resolveColors([extra, bg, ink, "#111111", "#ffffff"]).ink);
      ctx.restore();
      if (d.logo) drawLogo(ctx, d, x + pad * 2.2, y + pad * 2.2, unit * 0.18, accent, accentInk);
      text(ctx, d.productName, cx, y + h * 0.72, maxText, unit * 0.09, B, ink);
      if (d.tagline) text(ctx, d.tagline, cx, y + h * 0.72 + unit * 0.09, maxText, unit * 0.05, Br, ink, "center", 0.85);
      return;
    }
    case "window": {
      // Clean label panel floating over a patterned background (motif or illustration around it)
      drawArt(ctx, d, x, y, w, h, { fit: "cover" });
      const pw = w * 0.74, ph = h * 0.66, px = cx - pw / 2, py = y + h * 0.15;
      const panel = luminance(bg) > 0.55 ? "#ffffff" : "#fbf7ef";
      const panelInk = resolveColors([panel, ink, accent, "#141414"]).ink;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.12)";
      ctx.shadowBlur = unit * 0.03;
      ctx.fillStyle = panel;
      const rr = unit * 0.05;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, rr);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, unit * 0.006);
      ctx.beginPath();
      ctx.roundRect(px + unit * 0.02, py + unit * 0.02, pw - unit * 0.04, ph - unit * 0.04, rr * 0.7);
      ctx.stroke();
      drawLogo(ctx, d, cx, py + ph * 0.2, unit * 0.18, accent, accentInk);
      text(ctx, brandText(d), cx, py + ph * 0.43, pw * 0.85, unit * 0.14, H, panelInk);
      ctx.fillStyle = accent;
      ctx.fillRect(cx - unit * 0.06, py + ph * 0.54, unit * 0.12, Math.max(1.5, unit * 0.01));
      text(ctx, d.productName, cx, py + ph * 0.66, pw * 0.85, unit * 0.07, B, panelInk);
      if (d.tagline) text(ctx, d.tagline, cx, py + ph * 0.78, pw * 0.85, unit * 0.042, Br, panelInk, "center", 0.85);
      text(ctx, d.volume, cx, y + h - pad * 1.3, maxText, unit * 0.055, B, ink, "center", 0.95);
      drawSeal(ctx, d, px + pw - unit * 0.03, py + unit * 0.03, unit * 0.1);
      return;
    }
    case "illustrated": {
      // Full-bleed illustration on the top 60 %, brand and product below — premium food, drinks, cosmetics
      const artH = h * 0.62;
      if (!drawArt(ctx, d, x, y, w, artH, { fit: "cover", fade: "bottom" })) {
        ctx.fillStyle = withAlpha(accent, 0.16);
        ctx.beginPath();
        ctx.arc(cx, y + artH * 0.5, unit * 0.36, 0, Math.PI * 2);
        ctx.fill();
        drawLogo(ctx, d, cx, y + artH * 0.5, unit * 0.34, accent, accentInk);
      } else if (d.logo) drawLogo(ctx, d, x + pad * 1.6, y + pad * 1.6, unit * 0.16, accent, accentInk);
      const by = y + h * 0.71;
      const bs = text(ctx, brandText(d), cx, by, maxText, unit * 0.2, H, ink);
      microLine(ctx, d, d.origin ?? "", cx, by - bs * 0.72, maxText, unit * 0.032, ink);
      ctx.fillStyle = accent;
      ctx.fillRect(cx - unit * 0.06, by + bs * 0.62, unit * 0.12, Math.max(1.5, unit * 0.01));
      text(ctx, d.productName, cx, by + bs * 0.62 + unit * 0.075, maxText, unit * 0.075, B, ink);
      if (d.tagline) text(ctx, d.tagline, cx, by + bs * 0.62 + unit * 0.14, maxText, unit * 0.045, Br, ink, "center", 0.85);
      text(ctx, d.volume, cx, y + h - pad * 0.95, maxText, unit * 0.045, B, ink, "center", 0.9);
      drawSeal(ctx, d, x + w - pad * 1.9, y + pad * 1.9, unit * 0.13);
      return;
    }
    case "arch": {
      // Arched window framing the illustration — skincare, honey, tea, bakery
      const aw = Math.min(w * 0.66, h * 0.5), ah = h * 0.47, ax = cx - aw / 2, ay = y + h * 0.13;
      ctx.save();
      archPath(ctx, ax, ay, aw, ah);
      ctx.fillStyle = withAlpha(accent, d.art ? 0.07 : 0.22);
      ctx.fill();
      ctx.clip();
      if (!drawArt(ctx, d, ax, ay, aw, ah, { fit: "cover" })) {
        ctx.fillStyle = accent;
        ctx.fillRect(ax, ay, aw, ah);
        drawMotif(ctx, ax, ay, aw, ah, { ...d, motif: d.motif && d.motif !== "none" ? d.motif : "botanical", palette: [accent, accentInk, accentInk, bg] }, 1.6);
        drawLogo(ctx, d, cx, ay + ah * 0.55, unit * 0.24, bg, ink);
      }
      ctx.restore();
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.5, unit * 0.009);
      archPath(ctx, ax, ay, aw, ah);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, unit * 0.004);
      archPath(ctx, ax - unit * 0.022, ay - unit * 0.022, aw + unit * 0.044, ah + unit * 0.022);
      ctx.stroke();
      microLine(ctx, d, d.origin ?? "", cx, y + h * 0.065, maxText, unit * 0.034, ink);
      const by = ay + ah + unit * 0.13;
      const bs = text(ctx, brandText(d), cx, by, maxText, unit * 0.17, H, ink);
      text(ctx, d.productName, cx, by + bs * 0.55 + unit * 0.06, maxText, unit * 0.07, B, ink);
      if (d.tagline) text(ctx, d.tagline, cx, by + bs * 0.55 + unit * 0.125, maxText, unit * 0.043, Br, ink, "center", 0.85);
      text(ctx, d.volume, cx, y + h - pad * 1.0, maxText, unit * 0.045, B, ink, "center", 0.9);
      drawSeal(ctx, d, ax + aw - unit * 0.02, ay + ah - unit * 0.04, unit * 0.11);
      return;
    }
    case "vertical": {
      // Giant brand running up the side in a colour column (KOSA, ZESTIQ…) — drinks, cosmetics, supplements
      const col = w * 0.34;
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, col, h);
      ctx.save();
      ctx.translate(x + col / 2, y + h / 2);
      ctx.rotate(-Math.PI / 2);
      text(ctx, brandText(d), 0, 0, h - pad * 1.4, col * 0.86, H, accentInk);
      ctx.restore();
      const rx = x + col, rw = w - col, rpad = rw * 0.1;
      if (!drawArt(ctx, d, rx + rpad * 0.5, y + pad * 0.8, rw - rpad, h * 0.46, { fit: "contain", fade: "edges" })) {
        drawLogo(ctx, d, rx + rw / 2, y + h * 0.26, Math.min(rw * 0.55, unit * 0.3), accent, accentInk);
      } else if (d.logo) drawLogo(ctx, d, rx + rw - rpad * 1.4, y + pad * 1.2, unit * 0.12, accent, accentInk);
      const lx = rx + rpad;
      microLine(ctx, d, d.origin ?? "", lx, y + h * 0.58, rw - rpad * 2, unit * 0.03, ink, "left");
      text(ctx, d.productName, lx, y + h * 0.645, rw - rpad * 2, unit * 0.085, B, ink, "left");
      ctx.fillStyle = accent;
      ctx.fillRect(lx, y + h * 0.69, unit * 0.1, Math.max(1.5, unit * 0.01));
      if (d.tagline) text(ctx, d.tagline, lx, y + h * 0.735, rw - rpad * 2, unit * 0.045, Br, ink, "left", 0.85);
      text(ctx, d.volume, lx, y + h - pad * 1.1, rw - rpad * 2, unit * 0.05, B, ink, "left", 0.9);
      drawSeal(ctx, d, x + w - rpad * 1.6, y + h - pad * 1.9, Math.min(unit * 0.11, rw * 0.2));
      return;
    }
    case "label": {
      // Die-cut round label over a full-bleed illustration or pattern — honey, spirits, coffee, spices
      drawArt(ctx, d, x, y, w, h, { fit: "cover" });
      const R = Math.min(w * 0.4, h * 0.3), ly = y + h * 0.47;
      const panel = luminance(bg) > 0.5 ? "#fffdf8" : mixHex(bg, "#ffffff", 0.9);
      const pInk = resolveColors([panel, ink, accent, "#1a1a1a"]).ink;
      // The medallion (panel, rings and ring texts) is linked to the brand it carries (phase 2C-4F-4).
      placeElement(ctx, "decorative", () => [cx - R, ly - R, R * 2, R * 2], () => {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = unit * 0.04;
        ctx.shadowOffsetY = unit * 0.01;
        ctx.fillStyle = panel;
        ctx.beginPath();
        ctx.arc(cx, ly, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1.5, R * 0.03);
        ctx.beginPath();
        ctx.arc(cx, ly, R * 0.93, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = Math.max(1, R * 0.01);
        ctx.beginPath();
        ctx.arc(cx, ly, R * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        const ringSize = R * 0.09;
        const ringFont = `${fontWeight(d.bodyFont, 700)} ${ringSize}px ${fontCss(d.bodyFont)}`;
        arcText(ctx, (d.origin || d.tagline || d.productName || "").toUpperCase().slice(0, 34), cx, ly, R * 0.815, ringSize, ringFont, pInk);
        arcText(ctx, (d.volume || "").toUpperCase(), cx, ly, R * 0.815, ringSize, ringFont, pInk, true);
      }, elementId(ctx, "brand", "next"));
      drawLogo(ctx, d, cx, ly - R * 0.4, R * 0.26, accent, accentInk);
      const bs = text(ctx, brandText(d), cx, ly - R * 0.02, R * 1.2, R * 0.3, H, pInk);
      ctx.fillStyle = accent;
      ctx.fillRect(cx - R * 0.14, ly + bs * 0.5, R * 0.28, Math.max(1, R * 0.018));
      text(ctx, d.productName, cx, ly + bs * 0.5 + R * 0.16, R * 1.15, R * 0.13, B, pInk);
      const below = ly + R + (y + h - ly - R) / 2;
      if (d.tagline && d.origin) {
        ctx.save();
        ctx.font = B(unit * 0.042);
        const tw = Math.min(maxText, ctx.measureText(d.tagline).width) + unit * 0.09;
        ctx.fillStyle = panel;
        ctx.beginPath();
        ctx.roundRect(cx - tw / 2, below - unit * 0.045, tw, unit * 0.09, unit * 0.045);
        ctx.fill();
        ctx.restore();
        text(ctx, d.tagline, cx, below, maxText, unit * 0.042, B, pInk);
      }
      drawSeal(ctx, d, cx + R * 0.82, ly - R * 0.78, R * 0.3);
      return;
    }
    case "poster": {
      // Oversized, cropped brand lettering + illustration — challenger brands, snacks, coffee
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const words = brandText(d).split(/\s+/).filter(Boolean);
      const half = Math.ceil(words.length / 2);
      const lines = words.length > 1 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : words;
      let yy = y + pad * 0.4;
      for (const line of lines) {
        // Fill the width, allowing a slight bleed on the right like a cropped poster.
        const size = Math.min(h * (lines.length > 1 ? 0.2 : 0.3), fitText(ctx, line, w * 1.06, unit * 0.9, H));
        ctx.font = H(size);
        ctx.fillStyle = accent;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(line, x + pad * 0.45, yy);
        yy += size * 0.9;
      }
      ctx.restore();
      if (!drawArt(ctx, d, x + w * 0.08, yy - h * 0.02, w * 0.84, y + h * 0.8 - yy, { fit: "contain", fade: "edges" })) {
        drawLogo(ctx, d, cx, (yy + y + h * 0.78) / 2, unit * 0.3, accent, accentInk);
      }
      ctx.fillStyle = ink;
      ctx.fillRect(x + pad, y + h * 0.8, w - pad * 2, Math.max(1, unit * 0.005));
      text(ctx, d.productName, x + pad, y + h * 0.85, w * 0.6, unit * 0.07, B, ink, "left");
      if (d.tagline) text(ctx, d.tagline, x + pad, y + h * 0.905, w * (d.origin ? 0.5 : 0.7), unit * 0.042, Br, ink, "left", 0.85);
      text(ctx, d.volume, x + w - pad, y + h * 0.85, w * 0.3, unit * 0.05, B, ink, "right", 0.9);
      microLine(ctx, d, d.origin ?? "", x + w - pad, y + h * 0.905, w * 0.28, unit * 0.026, ink, "right");
      drawSeal(ctx, d, x + w - pad * 2, y + h * 0.7, unit * 0.11);
      return;
    }
  }
}

function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => {
    const n = parseInt(h.replace("#", "").slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [A, B] = [p(a), p(b)];
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
