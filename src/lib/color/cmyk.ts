// ─── RGB ↔ CMYK Color Conversion ─────────────────────────────────────────────
// Pure math utilities for CMYK color space conversions.
// Used in Canvas2D color profile toggle and PDF export pipeline.

export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface CMYKColor {
  c: number; // 0-100
  m: number; // 0-100
  y: number; // 0-100
  k: number; // 0-100
}

/**
 * Convert sRGB to CMYK (no ICC profile — mathematical approximation).
 * For production use, ICC profiles should be applied server-side via pdf-lib.
 */
export function rgbToCmyk({ r, g, b }: RGBColor): CMYKColor {
  const rp = r / 255;
  const gp = g / 255;
  const bp = b / 255;

  const k = 1 - Math.max(rp, gp, bp);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }; // pure black

  const c = (1 - rp - k) / (1 - k);
  const m = (1 - gp - k) / (1 - k);
  const y = (1 - bp - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  };
}

/**
 * Convert CMYK back to sRGB.
 */
export function cmykToRgb({ c, m, y, k }: CMYKColor): RGBColor {
  const cp = c / 100;
  const mp = m / 100;
  const yp = y / 100;
  const kp = k / 100;

  return {
    r: Math.round(255 * (1 - cp) * (1 - kp)),
    g: Math.round(255 * (1 - mp) * (1 - kp)),
    b: Math.round(255 * (1 - yp) * (1 - kp)),
  };
}

/**
 * Parse a CSS hex color string (#RRGGBB or #RGB) to RGBColor.
 */
export function hexToRgb(hex: string): RGBColor {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Convert RGB to hex string.
 */
export function rgbToHex({ r, g, b }: RGBColor): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert hex color through CMYK round-trip (simulates ink-on-paper gamut compression).
 * Used to preview CMYK appearance on screen.
 */
export function hexToCmykPreview(hex: string): string {
  const rgb = hexToRgb(hex);
  const cmyk = rgbToCmyk(rgb);
  const backRgb = cmykToRgb(cmyk);
  return rgbToHex(backRgb);
}

/**
 * CSS filter string that simulates CMYK ink gamut on an RGB monitor.
 * Applied to the Canvas2D wrapper when colorProfile === 'cmyk'.
 */
export const CMYK_PREVIEW_FILTER =
  'saturate(0.82) contrast(1.04) brightness(0.97)';

/**
 * Spot color definitions for PDF dieline export.
 * These become named spot color channels in the output PDF.
 */
export const SPOT_COLORS = {
  CutContour: { c: 0, m: 100, y: 0, k: 0 },    // Magenta spot for die-cut
  Crease: { c: 100, m: 0, y: 0, k: 0 },          // Cyan spot for score/crease
  Bleed: { c: 0, m: 0, y: 100, k: 0 },           // Yellow spot for bleed guide
} as const;

/**
 * Format a CMYK value as a display string: "C:45 M:12 Y:0 K:8"
 */
export function formatCmyk({ c, m, y, k }: CMYKColor): string {
  return `C:${c} M:${m} Y:${y} K:${k}`;
}
