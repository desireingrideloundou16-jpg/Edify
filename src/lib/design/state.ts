import type { VisualStylePreset } from "@/components/workspace/Modals";
import type { PackagingDesign } from "@/lib/artwork/draw";
import { PACKAGING_FONTS } from "@/lib/catalog/fonts";
import { isLayout, isMotif } from "@/lib/artwork/compose";

/** Everything the user (or the AI) can change about the packaging. */
export interface DesignContent {
  projectName: string;
  brandName: string;
  productName: string;
  tagline: string;
  volume: string;
  details: string;
  /** Label information, drawn on the back panel with bilingual headings. */
  ingredients?: string;
  usage?: string;
  barcode?: string;
  expiry?: string;
  production?: string;
  price?: string;
  extra?: string;
}

export const LABEL_FIELDS = ["ingredients", "usage", "barcode", "expiry", "production", "price", "extra"] as const;

export interface DesignSelection {
  shapeId: string;
  styleId: string;
  /** Palette produced by the AI designer; overrides the style palette. */
  customPalette: string[] | null;
  headingFont: string | null;
  bodyFont: string | null;
  /** Front composition and motif (null = classic, no motif). */
  layout?: string | null;
  motif?: string | null;
}

const BY_KEY: Record<string, [string, string]> = {
  sans: ["Montserrat", "Montserrat"],
  serif: ["Playfair Display", "Lato"],
  display: ["Bebas Neue", "Poppins"],
  mono: ["Space Mono", "IBM Plex Mono"],
  script: ["Pacifico", "Quicksand"],
};

const BY_STYLE: Record<string, [string, string]> = {
  "luxury-obsidian-gold": ["Cormorant Garamond", "Montserrat"],
  "champagne-gold": ["Cormorant Garamond", "Montserrat"],
  "emerald-gold": ["Cinzel", "Lato"],
  "navy-silver": ["Bodoni Moda", "Lato"],
  "art-deco": ["Cinzel", "Josefin Sans"],
  "victorian": ["Cinzel", "EB Garamond"],
  "retro-apothecary-1920": ["Cinzel", "EB Garamond"],
  "retro-70s": ["Shrikhand", "Work Sans"],
  "y2k": ["Bagel Fat One", "DM Sans"],
  "psychedelic": ["Monoton", "Poppins"],
  "memphis": ["Righteous", "Poppins"],
  "neon-night": ["Bungee", "Space Grotesk"],
  "street-graffiti": ["Rubik Mono One", "Space Grotesk"],
  "kids-rainbow": ["Fredoka", "Nunito"],
  "candy-pop": ["Chewy", "Nunito"],
  "cartoon-mascot": ["Fredoka", "Nunito"],
  "pet-friendly": ["Baloo 2", "Nunito"],
  "juicy-fruit": ["Fredoka", "Nunito"],
  "japanese-wabi-sabi": ["Cormorant Garamond", "Manrope"],
  "japanese-minimal": ["Cormorant Garamond", "Manrope"],
  "swiss-grid": ["Inter", "Inter"],
  "clinical-purity-white": ["Manrope", "Inter"],
  "pharma-blue": ["Manrope", "Inter"],
  "cyber-neon-modern": ["Syne", "Space Grotesk"],
  "dark-tech": ["Space Grotesk", "IBM Plex Mono"],
  "artisan-bakery": ["Pacifico", "Quicksand"],
  "coffee-roast": ["Fraunces", "DM Sans"],
  "chocolatier": ["Playfair Display", "Montserrat"],
  "doodle": ["Caveat", "Quicksand"],
  "diner-50s": ["Pacifico", "Oswald"],
};

export function defaultFonts(style: VisualStylePreset): [string, string] {
  return BY_STYLE[style.id] ?? BY_KEY[style.fontFamily] ?? BY_KEY.sans;
}

export function isInstalledFont(family: string | null | undefined): family is string {
  return !!family && PACKAGING_FONTS.some((f) => f.family === family);
}

export function toPackagingDesign(content: DesignContent, style: VisualStylePreset, sel: DesignSelection): Omit<PackagingDesign, "logo"> {
  const [h, b] = defaultFonts(style);
  return {
    brandName: content.brandName,
    productName: content.productName,
    tagline: content.tagline,
    volume: content.volume,
    details: content.details,
    ingredients: content.ingredients,
    usage: content.usage,
    barcode: content.barcode,
    expiry: content.expiry,
    production: content.production,
    price: content.price,
    extra: content.extra,
    palette: sel.customPalette ?? style.palette,
    headingFont: isInstalledFont(sel.headingFont) ? sel.headingFont : h,
    bodyFont: isInstalledFont(sel.bodyFont) ? sel.bodyFont : b,
    finishing: style.finishing,
    layout: isLayout(sel.layout) ? sel.layout : "classic",
    motif: isMotif(sel.motif) ? sel.motif : "none",
  };
}

// ─── Share links (#d=…) ─────────────────────────────────────────────────────

export type SharedDesign = DesignContent & DesignSelection;

export function encodeShare(d: SharedDesign): string {
  const json = JSON.stringify(d);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(hash: string): SharedDesign | null {
  const m = hash.match(/[#&]d=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64)))) as SharedDesign;
  } catch {
    return null;
  }
}
