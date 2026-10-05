/**
 * Design spec produced from a user's brief — by Claude (api/design) or, when
 * no API key is configured, by the local rule-based designer below.
 * Server-safe: no React / DOM imports.
 */
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { PRODUCT_INTENTS, type ProductIntent } from "@/lib/catalog/productIntents";
import { isSupportedShape, resolvePackaging, supportedShapeIds } from "@/lib/catalog/packagingResolver";
import { ALL_CATALOG_STYLES } from "@/lib/catalog/styles";
import { PACKAGING_FONTS } from "@/lib/catalog/fonts";
import { LAYOUTS, MOTIFS, isLayout, isMotif } from "@/lib/artwork/compose";

export interface DesignSpec {
  shapeId: string;
  styleId: string;
  headingFont: string;
  bodyFont: string;
  palette: { background: string; ink: string; accent: string; extra: string };
  /** Front composition and background motif (see lib/artwork/compose). */
  layout: string;
  motif: string;
  /** Custom illustration: style and subject (in English, for the image model). */
  artStyle: string;
  artSubject: string;
  /** Detail layer: seal text and origin line (facts from the brief only). */
  badge: string;
  origin: string;
  /** Colour of the product seen through glass or clear plastic, "" when opaque. */
  contentColor: string;
  /** Advertising copy for the ad visual. */
  adHeadline: string;
  adCta: string;
  projectName: string;
  brandName: string;
  productName: string;
  tagline: string;
  volume: string;
  details: string;
  /** Ingredient list / INCI, and directions: proposed by the AI when the user gave none. */
  ingredients: string;
  usage: string;
  rationale: string;
}

export interface CurrentDesign {
  shapeId: string;
  styleId: string;
  /** Label information already entered by the user (kept as is on the pack). */
  ingredients?: string;
  usage?: string;
  barcode?: string;
  expiry?: string;
  production?: string;
  price?: string;
  extra?: string;
  tagline?: string;
  details?: string;
  brandName: string;
  productName: string;
  volume: string;
}

/** Every catalog id (history: saved projects, tests, look-ups). */
export const SHAPE_IDS = SHAPE_ROWS.map((r) => r[0]);
/**
 * The ids a NEW decision may use (phase 3C): only formats the engine supports. The AI chooses among
 * these, the local designer and the sanitizer never return anything else.
 */
export const ADMISSIBLE_SHAPE_IDS = SHAPE_IDS.filter((id) => supportedShapeIds().has(id));
/** Last-resort supported format (the studio's default folding box). */
export const DEFAULT_SHAPE_ID = "folding-box-standard";

/** A supported id for a new decision: the candidate, else the current format, else the default box. */
export function admissibleShapeId(candidate: string | null | undefined, current: string | null | undefined): string {
  if (isSupportedShape(candidate)) return candidate!;
  if (isSupportedShape(current)) return current!;
  return DEFAULT_SHAPE_ID;
}
export const STYLE_IDS = ALL_CATALOG_STYLES.map((s) => s.id);
export const FONT_FAMILIES = PACKAGING_FONTS.map((f) => f.family);
export const LAYOUT_IDS = [...LAYOUTS];
export const MOTIF_IDS = [...MOTIFS];
export const ART_STYLES = ["none", "engraving", "flat", "watercolor", "linocut", "photo", "papercut", "mascot", "lineart"] as const;

/** Illustration subject for the offline designer (English, for the image model). */
const ART_SUBJECTS: [RegExp, string, string][] = [
  [/bissap|hibiscus|foler/, "fresh deep red hibiscus flowers and mint leaves", "#8e1b3a"],
  [/gingembre|ginger/, "fresh ginger roots and lemon slices", "#e8b04a"],
  [/cafe|coffee|arabica|robusta/, "coffee cherries on a branch and roasted coffee beans", ""],
  [/cacao|chocolat|cocoa/, "an open cocoa pod with cocoa beans and leaves", ""],
  [/miel|honey/, "honeycomb, bees and wild flowers", "#d89a1c"],
  [/poivre|penja|pepper/, "pepper vine with green and black peppercorns", ""],
  [/piment|chili/, "red chili peppers and leaves", "#b3261e"],
  [/karite|shea/, "shea nuts and shea tree leaves", ""],
  [/plantain|banane/, "ripe plantains and banana leaves", ""],
  [/arachide|peanut|cacahu/, "peanuts in their shells and peanut plant leaves", "#b07a3c"],
  [/huile de palme|palm oil/, "oil palm fruit bunch and palm leaves", "#c2410c"],
  [/mangue|mango/, "ripe mangoes and mango leaves", "#f59e0b"],
  [/ananas|pineapple/, "a pineapple with leaves", "#f2c14e"],
  [/orange|agrume|citron/, "fresh oranges and lemons with leaves", "#f28c28"],
  [/the |tea|infusion|kinkeliba|moringa|citronnelle/, "fresh tea leaves and herbs", "#b98a3e"],
  [/savon|soap/, "botanical herbs, shea butter and flowers", ""],
  [/jus|juice|smoothie/, "fresh tropical fruits sliced", "#f28c28"],
  [/vin|wine|biere|beer/, "grape vines and leaves", "#5a1a2b"],
  [/lait|yaourt|yogurt/, "a milk splash and fresh fruits", "#fbfbf8"],
];

/** Ad headline for the offline designer, by category. */
function localHeadline(t: string) {
  if (/jus|juice|bissap|gingembre|boisson|soda/.test(t)) return "Frais, vrai, d'ici";
  if (/cafe|coffee/.test(t)) return "Réveillez vos matins";
  if (/miel|honey/.test(t)) return "La douceur à l'état pur";
  if (/creme|serum|karite|savon|huile|cosmet|lotion|shampo/.test(t)) return "Votre peau dit merci";
  if (/chips|snack|biscuit|plantain/.test(t)) return "Impossible de s'arrêter";
  if (/epice|poivre|piment|sauce/.test(t)) return "Le goût qui réveille";
  return "Fait avec passion";
}

export function localArt(text: string): { artStyle: string; artSubject: string; contentColor: string } {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const hit = ART_SUBJECTS.find(([re]) => re.test(t));
  if (!hit) return { artStyle: "none", artSubject: "", contentColor: "" };
  const style = /cafe|coffee|miel|honey|poivre|cacao|the |tea|savon/.test(t) ? "engraving" : "flat";
  return { artStyle: style, artSubject: hit[1], contentColor: hit[2] };
}

/** Art direction by category, used when the model gives nothing usable and by the offline designer. */
export function defaultArtDirection(text: string, seed: number): { layout: string; motif: string } {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pick = <T,>(list: T[]) => list[seed % list.length];
  if (/miel|honey|epice|poivre|penja|biscuit|chocolat|cacao|vin|rhum|whisky/.test(t)) return { layout: pick(["label", "arch", "frame", "illustrated"]), motif: pick(["geometric", "wax", "none", "botanical"]) };
  if (/cafe|coffee|the |tea|infusion|moringa/.test(t)) return { layout: pick(["illustrated", "label", "poster", "arch"]), motif: pick(["botanical", "geometric", "none"]) };
  if (/serum|creme|karite|shea|parfum|cosmet|savon|huile|lotion/.test(t)) return { layout: pick(["arch", "minimal", "vertical", "illustrated"]), motif: pick(["none", "botanical", "waves"]) };
  if (/chips|snack|plantain|bonbon|enfant|kids|jus|juice|bissap|soda|canette|energy/.test(t)) return { layout: pick(["illustrated", "vertical", "poster", "arch"]), motif: pick(["dots", "stripes", "sunburst", "wax"]) };
  return { layout: pick(["illustrated", "band", "split", "window", "vertical"]), motif: pick(["geometric", "dots", "none", "waves"]) };
}

/** Compact catalog description given to the model. */
export function catalogForPrompt() {
  // Only the formats a new design may use (phase 3C): never a refused one.
  const shapes = SHAPE_ROWS.filter(([id]) => isSupportedShape(id)).map(([id, name, , , l, w, h, mat]) => `${id}: ${name} (${l}×${w}×${h} mm, ${mat})`).join("\n");
  const styles = ALL_CATALOG_STYLES.map((s) => `${s.id}: ${s.label ?? s.name} — ${s.hint ?? s.subtitle} [${s.palette.join(" ")}] finition ${s.finishing}`).join("\n");
  const fonts = PACKAGING_FONTS.map((f) => `${f.family} (${f.category})`).join(", ");
  return { shapes, styles, fonts };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Catalogue id for what the model wrote ("juice-bottle-30cl", "Bouteille de jus 30 cl"…), or null. */
export function closestShapeId(raw: string | undefined): string | null {
  if (!raw) return null;
  if (SHAPE_IDS.includes(raw)) return raw;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = norm(raw).split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  let best: string | null = null;
  let score = 0;
  for (const [id, name, , , , , , , keywords] of SHAPE_ROWS) {
    const hay = norm(`${id} ${name} ${keywords}`).split(/[^a-z0-9]+/);
    const s = words.filter((w) => hay.includes(w)).length / Math.max(1, words.length);
    if (s > score) {
      score = s;
      best = id;
    }
  }
  return score >= 0.5 ? best : null;
}

/** Clamp a spec to known ids and valid colours. */
export function sanitizeSpec(raw: DesignSpec, current: CurrentDesign, lockShapeId: string | null = null): DesignSpec {
  // Models sometimes write accents as combining marks ("i" + "̂"): fonts then draw them apart.
  const spec = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v.normalize("NFC") : v])) as unknown as DesignSpec;
  const style = ALL_CATALOG_STYLES.find((s) => s.id === spec.styleId) ?? ALL_CATALOG_STYLES[0];
  const pal = spec.palette ?? ({} as DesignSpec["palette"]);
  const fix = (c: string | undefined, i: number) => (c && HEX.test(c) ? c : style.palette[i]);
  return {
    ...spec,
    // The format Edify's resolver already chose is kept; otherwise only a supported format is accepted.
    shapeId: isSupportedShape(lockShapeId) ? lockShapeId! : admissibleShapeId(closestShapeId(spec.shapeId), current.shapeId),
    styleId: style.id,
    headingFont: FONT_FAMILIES.includes(spec.headingFont) ? spec.headingFont : "",
    bodyFont: FONT_FAMILIES.includes(spec.bodyFont) ? spec.bodyFont : "",
    ...(() => {
      const fallback = defaultArtDirection(`${spec.productName} ${spec.projectName} ${spec.shapeId}`, spec.brandName?.length ?? 0);
      return { layout: isLayout(spec.layout) ? spec.layout : fallback.layout, motif: isMotif(spec.motif) ? spec.motif : fallback.motif };
    })(),
    palette: { background: fix(pal.background, 0), ink: fix(pal.ink, 1), accent: fix(pal.accent, 2), extra: fix(pal.extra, 3) },
    artStyle: (ART_STYLES as readonly string[]).includes(spec.artStyle) ? spec.artStyle : "none",
    artSubject: (spec.artSubject || "").slice(0, 240),
    badge: (spec.badge || "").slice(0, 26),
    origin: (spec.origin || "").slice(0, 40),
    contentColor: spec.contentColor && HEX.test(spec.contentColor) ? spec.contentColor : "",
    adHeadline: (spec.adHeadline || "").slice(0, 60),
    adCta: (spec.adCta || "").slice(0, 30),
    brandName: (spec.brandName || current.brandName).slice(0, 40),
    productName: (spec.productName || current.productName).slice(0, 60),
    tagline: (spec.tagline || "").slice(0, 80),
    volume: (spec.volume || current.volume).slice(0, 40),
    details: (spec.details || "").slice(0, 600),
    ingredients: (spec.ingredients || "").slice(0, 600),
    usage: (spec.usage || "").slice(0, 300),
    projectName: (spec.projectName || spec.productName || "Nouveau projet").slice(0, 60),
  };
}

// ─── Local rule-based designer (offline fallback) ────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const INTENTS = PRODUCT_INTENTS;
type Intent = ProductIntent;

const STYLE_WORDS: [string[], string][] = [
  [["luxe", "premium", "prestige", "haut de gamme", "dore", "dorure"], "luxury-obsidian-gold"],
  [["bio", "naturel", "nature", "ecolo", "vegan", "botanique"], "botanical-natural"],
  [["kraft", "artisanal", "fait main"], "kraft-stamp"],
  [["minimal", "epure", "sobre", "simple", "clean"], "nordic-white"],
  [["enfant", "kids", "ludique", "fun"], "kids-rainbow"],
  [["vintage", "retro", "ancien"], "old-label"],
  [["neon", "cyber", "futur", "gaming"], "neon-night"],
  [["pharma", "medical", "clinique", "dermato"], "pharma-blue"],
  [["pastel", "doux", "tendre"], "pastel-scandi-zen"],
  [["japon", "zen"], "japanese-minimal"],
  [["maroc", "oriental"], "moroccan"],
  [["afrique", "africain", "wax"], "african-wax"],
  [["mexique", "fiesta"], "mexican-fiesta"],
  [["inde", "epice"], "indian-spice"],
  [["art deco", "gatsby"], "art-deco"],
  [["colore", "pop", "vif"], "color-block"],
];

const COLORS: [string[], string][] = [
  [["noir", "black"], "#111111"], [["blanc", "white"], "#fafafa"], [["creme", "ivoire", "beige"], "#f4ecdc"],
  [["or", "dore", "gold"], "#c9a24a"], [["argent", "silver"], "#b8c2d6"], [["rose", "pink"], "#f4a7bb"],
  [["rouge", "red"], "#c8102e"], [["bordeaux"], "#6b1a2e"], [["orange"], "#ff8a1f"], [["jaune", "yellow"], "#ffd23f"],
  [["vert", "green", "sauge"], "#2f5d3a"], [["bleu", "blue", "marine"], "#1b3a6b"], [["violet", "lavande", "purple"], "#6b4fa0"],
  [["marron", "brun", "chocolat"], "#5a3526"], [["turquoise"], "#2ec4b6"],
];

function has(text: string, w: string) {
  return new RegExp(`(^|[^a-z])${w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
}

function pickBrand(prompt: string): string | null {
  const quoted = prompt.match(/["«“]\s*([^"»”]{2,30})\s*["»”]/);
  if (quoted) return quoted[1].trim();
  const named = prompt.match(/(?:marque|appel[ée]e?s?|nomm[ée]e?s?|brand|nom)\s*:?\s+([A-ZÀ-Ý0-9][\wÀ-ÿ'&-]*(?:\s+[A-ZÀ-Ý0-9][\wÀ-ÿ'&-]*)?)/);
  return named ? named[1].trim() : null;
}

const BRAND_POOL = ["AURELLE", "NOVA", "TERRA", "MAISON LUNE", "OKKO", "SOLÈNE", "VERDANT", "KAÏA", "ALBA", "ORÉE", "NÉO", "SILVA"];

export function localDesign(prompt: string, current: CurrentDesign): DesignSpec {
  const text = ` ${norm(prompt)} `;
  // Product = the intent mentioned first (packaging-only intents like "coffret" don't count as the product).
  const PACKAGING_ONLY = new Set(["luxury-rigid-box", "subscription-box"]);
  const firstPos = (i: Intent) =>
    Math.min(...i.words.map((w) => {
      const m = new RegExp(`(^|[^a-z])${norm(w).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(text);
      return m ? m.index : Infinity;
    }));
  const ranked = INTENTS.map((i) => ({ i, p: firstPos(i) })).filter((x) => x.p < Infinity).sort((a, b) => a.p - b.p);
  const intent = (ranked.find((x) => !PACKAGING_ONLY.has(x.i.shape)) ?? ranked[0])?.i;

  // Shape: a container word in the brief ("canette", "flacon", "coffret"…) beats the product's usual pack.
  let shapeId = intent?.shape ?? current.shapeId;
  let best = intent ? 3 : 0;
  for (const [id, name, , , , , , , keywords] of SHAPE_ROWS) {
    const tokens = norm(name).split(/\s+/);
    const score = (tokens[0].length > 2 && has(text, tokens[0]) ? 4 : 0)
      + tokens.slice(1).filter((t) => t.length > 3 && has(text, t)).length
      + keywords.split(" ").filter((t) => t.length > 3 && has(text, norm(t))).length
      + (id === intent?.shape ? 3 : 0);
    if (score > best) {
      best = score;
      shapeId = id;
    }
  }

  // "style X" / "ambiance X" wins; otherwise the first style word found in the brief.
  const asked = text.match(/(?:style|ambiance|esprit|look)\s+(?:tres\s+|plutot\s+)?([a-z-]+)/)?.[1];
  const askedHit = asked ? STYLE_WORDS.find(([words]) => words.some((w) => norm(w).startsWith(asked.slice(0, 5)))) : undefined;
  const labelHit = asked ? ALL_CATALOG_STYLES.find((s) => norm(s.label ?? s.name).startsWith(asked.slice(0, 5))) : undefined;
  const lastPos = (words: string[]) => Math.max(-1, ...words.map((w) => text.lastIndexOf(norm(w))));
  const styleHit = askedHit ?? STYLE_WORDS.filter(([words]) => words.some((w) => has(text, w))).sort((a, b) => lastPos(b[0]) - lastPos(a[0]))[0];
  const styleId = labelHit?.id ?? styleHit?.[1] ?? intent?.style ?? current.styleId;
  const style = ALL_CATALOG_STYLES.find((s) => s.id === styleId) ?? ALL_CATALOG_STYLES[0];

  // Colours explicitly asked for override the style palette.
  const palette = [...style.palette];
  const bgMatch = text.match(/fond\s+(?:de\s+couleur\s+)?([a-z]+)/);
  const mentioned = COLORS.filter(([words]) => words.some((w) => has(text, w)));
  if (bgMatch) {
    const c = COLORS.find(([words]) => words.includes(bgMatch[1]));
    if (c) palette[0] = c[1];
  }
  const isBlack = (hex: string) => hex === "#111111";
  if (!bgMatch && mentioned.some(([, hex]) => isBlack(hex))) {
    palette[0] = "#111111";
    palette[1] = "#f5f1e8";
  }
  const others = mentioned.filter(([, hex]) => hex !== palette[0]);
  if (others[0]) palette[2] = others[0][1];

  const brand = pickBrand(prompt) ?? (intent ? BRAND_POOL[prompt.length % BRAND_POOL.length] : current.brandName);
  const vol = prompt.match(/(\d+(?:[.,]\d+)?)\s?(ml|cl|l|g|kg|gélules|gelules|capsules|sachets|pièces|pieces)\b/i);
  const qualifiers = ["bio", "premium", "vegan", "artisanal", "naturel", "intense", "doux", "vitamine C", "sans sucre", "rechargeable"]
    .filter((q) => has(text, norm(q)));
  // Keep the user's own wording when the brief says "miel de lavande", "thé à la menthe"…
  const word = intent?.words.map((w) => w.trim()).find((w) => has(text, norm(w)));
  const phrase = word
    ? prompt.match(new RegExp(`(${word}\\p{L}*\\s+(?:de|du|des|d'|à la|au|aux)\\s*\\p{L}+)`, "iu"))?.[1]
    : undefined;
  const productName = phrase
    ? phrase.charAt(0).toUpperCase() + phrase.slice(1)
    : intent?.product ?? (current.productName || "Produit signature");
  const tagline = qualifiers.map((q) => q.charAt(0).toUpperCase() + q.slice(1)).join(" · ");

  return {
    shapeId: isSupportedShape(shapeId) ? shapeId : admissibleShapeId(resolvePackaging(prompt).shapeId, current.shapeId),
    styleId: style.id,
    headingFont: "",
    bodyFont: "",
    palette: { background: palette[0], ink: palette[1], accent: palette[2], extra: palette[3] },
    projectName: `${productName} ${brand}`.trim(),
    brandName: brand,
    productName,
    tagline,
    volume: vol ? `${vol[1]} ${vol[2]}` : intent?.volume ?? current.volume,
    details: intent?.details ?? "",
    ...(() => {
      // With an illustration, always a layout that shows it.
      const dir = defaultArtDirection(prompt, prompt.length);
      const art = localArt(prompt);
      const artLayouts = ["illustrated", "arch", "vertical", "label", "poster"];
      return { ...dir, ...art, layout: art.artStyle !== "none" && !artLayouts.includes(dir.layout) ? "illustrated" : dir.layout };
    })(),
    badge: "",
    origin: /cameroun|cameroon/.test(text) ? "Fait au Cameroun" : "",
    adHeadline: tagline || localHeadline(text),
    adCta: "Disponible maintenant",
    ingredients: "",
    usage: "",
    rationale: `Contenant et style choisis à partir des mots-clés de votre brief (${[intent?.product, style.label].filter(Boolean).join(", ")}).`,
  };
}
