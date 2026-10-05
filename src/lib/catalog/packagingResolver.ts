/**
 * Packaging resolver (phase 3C): from what the user says about the product to ONE supported catalog
 * format, without asking the user to browse 119 technical structures. Pure, deterministic, local:
 * no network, no AI call.
 *
 *   product text → ProductPackagingIntent (known product, physical state, net content, container asked)
 *               → candidates = SUPPORTED formats only (resolveStructure decides support)
 *               → deterministic score → shape, confidence, reasons, alternatives
 *               → or ONE human question (Pot, Bouteille, Tube, Boîte, Sachet, Je ne sais pas)
 *
 * It reuses the catalog (SHAPE_ROWS and its keywords), the known products (PRODUCT_INTENTS), the product
 * categories of the start wizard (detectCategory) and the support decision of the frozen engine. It never
 * invents a geometry: a refused format is never returned for a new decision, a supported alternative of
 * the same family is proposed instead. Historical ids stay valid elsewhere (saved projects, tests).
 *
 * Not to be confused with structure/types `PackagingIntent` (an alias of the engine's StructureInput).
 */
import type { ShapeModel } from "@/components/workspace/Modals";
import { resolveStructure } from "@/lib/structure";
import { detectCategory } from "@/lib/ai/suggest";
import { SHAPE_ROWS, type ShapeRow } from "./shapeData";
import { PRODUCT_INTENTS, type ProductIntent } from "./productIntents";

// ─── Families (what a user calls a pack) ─────────────────────────────────────

export type PackagingFamily = "pot" | "bouteille" | "tube" | "boite" | "sachet" | "coffret" | "canette" | "boite-metal" | "brique";

export const FAMILY_LABEL: Record<PackagingFamily, string> = {
  pot: "Pot", bouteille: "Bouteille", tube: "Tube", boite: "Boîte", sachet: "Sachet", coffret: "Coffret",
  canette: "Canette", "boite-metal": "Boîte métal", brique: "Brique",
};

/** Every engine model belongs to one human family. */
const MODEL_FAMILY: Record<ShapeModel, PackagingFamily> = {
  jar: "pot", tub: "pot", papertub: "pot", cup: "pot",
  bottle: "bouteille", wine: "bouteille", dropper: "bouteille", pump: "bouteille", spray: "bouteille", jug: "bouteille",
  tube: "tube",
  box: "boite", mailer: "boite", tray: "boite", pillow: "boite", display: "boite", pizza: "boite", clamshell: "boite", moulded: "boite", papertube: "boite",
  rigid: "coffret",
  pouch: "sachet", flatpouch: "sachet", sachet: "sachet", bag: "sachet", paperbag: "sachet", shopper: "sachet",
  can: "canette", tin: "boite-metal", carton: "brique",
};

/** The single clarification question: the five usual families, plus "Je ne sais pas". */
export const CLARIFY_FAMILIES: PackagingFamily[] = ["pot", "bouteille", "tube", "boite", "sachet"];
export const CLARIFY_QUESTION = "Quel type de packaging préférez-vous ?";

// ─── Support (single source of truth: the frozen engine) ─────────────────────

let supportedCache: Set<string> | null = null;
/** Catalog ids whose structure is supported by the engine (resolveStructure decides; computed once). */
export function supportedShapeIds(): Set<string> {
  if (!supportedCache) {
    supportedCache = new Set(
      SHAPE_ROWS.filter((r) => resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }).dieline === "supported").map((r) => r[0])
    );
  }
  return supportedCache;
}
export const isSupportedShape = (id: string | null | undefined) => !!id && supportedShapeIds().has(id);

const ROW = new Map(SHAPE_ROWS.map((r, i) => [r[0], { row: r, index: i }]));
export const familyOfShape = (id: string): PackagingFamily | null => {
  const r = ROW.get(id)?.row;
  return r ? MODEL_FAMILY[r[3]] : null;
};
export const shapeName = (id: string) => ROW.get(id)?.row[1] ?? id;

/** Families that have at least one supported format (the ones a user can pick). */
export function availableFamilies(): PackagingFamily[] {
  const fams = new Set([...supportedShapeIds()].map((id) => familyOfShape(id)!));
  return (Object.keys(FAMILY_LABEL) as PackagingFamily[]).filter((f) => fams.has(f));
}

// ─── Intent ──────────────────────────────────────────────────────────────────

export type PhysicalState = "liquid" | "paste" | "powder" | "solid";

export interface ProductPackagingIntent {
  /** Normalised text the intent was read from. */
  text: string;
  /** Known product (PRODUCT_INTENTS), the one mentioned first. */
  product: ProductIntent | null;
  /** Product category of the start wizard (coffee, juice, cosmetic…, "generic"). */
  productCategory: string;
  physicalState: PhysicalState | null;
  /** "explicit": a word says it ("liquide", "en poudre"…); "unit": only the unit suggests it. */
  stateSource: "explicit" | "product" | "unit" | null;
  netContent: { value: number; unit: "ml" | "cl" | "l" | "g" | "kg"; ml?: number; g?: number } | null;
  /** Container the user asked for, as a family ("un pot", "en bouteille"…). */
  preferredFamily: PackagingFamily | null;
  /** What the product is for: from its usual pack when it is known, else from the words. */
  usage: ProductUsage | null;
}

const norm = (s: string) => ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ")} `;
const hasWord = (t: string, w: string) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t);

/** Container words → family (checked in this order: "boîte de conserve" before "boîte"). */
const CONTAINER_WORDS: [PackagingFamily, string[]][] = [
  ["boite-metal", ["boite de conserve", "boite metal", "conserve"]],
  ["coffret", ["coffret", "ecrin"]],
  ["canette", ["canette"]],
  ["brique", ["brique"]],
  ["bouteille", ["bouteille", "flacon", "fiole", "vaporisateur", "spray", "pompe", "pulverisateur"]],
  ["pot", ["pot ", "pots ", "bocal", "jarre"]],
  ["tube", ["tube "]],
  ["sachet", ["sachet", "pochette", "doypack", "sac "]],
  ["boite", ["boite", "etui", "caisse"]],
];

/** Words that state the physical form of the product. */
const STATE_WORDS: [PhysicalState, string[]][] = [
  ["liquid", ["liquide", "fluide"]],
  ["powder", ["en poudre", "poudre"]],
  ["paste", ["creme", "baume", "pommade", "beurre", "gel ", "pate", "onguent"]],
  ["solid", ["solide", "en grains", "pain de savon", "comprime"]],
];

/** What each family can hold (a liquid never goes in a carton box). */
const STATE_FAMILIES: Record<PhysicalState, PackagingFamily[]> = {
  liquid: ["bouteille", "canette", "brique", "sachet"],
  paste: ["pot", "tube", "bouteille"],
  powder: ["pot", "sachet", "boite", "boite-metal"],
  solid: ["boite", "sachet", "boite-metal", "pot", "coffret"],
};

/**
 * What a product is for (food, cosmetic…), read from the catalog's own words (name, keywords, material of
 * SHAPE_ROWS) and from the product's usual pack in PRODUCT_INTENTS: no parallel catalog. A pack made for
 * another use is a poor match even when its shape is close (an ice cream in a protein tub).
 */
export type ProductUsage = "supplement" | "pet" | "household" | "food" | "cosmetic";

/** Usage words (singular; a plural s / x also matches). Ties go to the first usage of this list. */
const USAGE_WORDS: [ProductUsage, string[]][] = [
  ["supplement", ["proteine", "whey", "complement", "gelule", "vitamine"]],
  ["pet", ["croquette", "animaux", "animal", "chien"]],
  ["household", ["bougie", "lessive", "detergent", "huile moteur", "menager", "nettoyant"]],
  ["food", ["alimentaire", "yaourt", "dessert", "traiteur", "salade", "confiture", "miel", "gateau", "patisserie", "chocolat", "cacao", "macaron",
    "confiserie", "bonbon", "biscuit", "cereale", "granola", "muesli", "riz", "farine", "epice", "poivre", "piment", "sauce", "ketchup", "tomate",
    "conserve", "lait", "oeuf", "œuf", "chips", "snack", "plantain", "gari", "manioc", "tapioca", "couscous", "arachide", "cacahuete", "cafe", "the",
    "infusion", "tisane", "sucre", "pizza", "burger", "frite", "nouille", "bebe", "jus", "boisson", "soda", "biere", "vin", "champagne", "cremant",
    "spiritueux", "gin", "rhum", "whisky", "sirop", "limonade", "bissap", "smoothie", "water", "glace", "glacee", "sorbet", "bouillon",
    "assaisonnement", "pastille", "condiment", "soya", "palme", "olive", "kossam", "mais"]],
  ["cosmetic", ["cosmetique", "creme", "baume", "serum", "parfum", "parfume", "parfumee", "lotion", "shampoing", "shampooing", "gel douche", "cheveux",
    "capillaire", "defrisant", "pommade", "levre", "deodorant", "vernis", "ongle", "masque", "karite", "gommage", "savon", "soin", "visage", "corps",
    "peau", "beaute", "maquillage", "musc", "brume", "dentifrice"]],
];
const wordRe = new Map<string, RegExp>();
const hasWhole = (t: string, w: string) => {
  let re = wordRe.get(w);
  if (!re) wordRe.set(w, (re = new RegExp(`(^|[^a-z0-9])${w}(s|x)?([^a-z0-9]|$)`)));
  return re.test(t);
};
/** The usage a text speaks of (the one with the most words), or null. */
export function usageOfText(text: string): ProductUsage | null {
  const t = norm(text);
  let best: ProductUsage | null = null, n = 0;
  for (const [u, words] of USAGE_WORDS) {
    const k = words.filter((w) => hasWhole(t, w)).length;
    if (k > n) { best = u; n = k; }
  }
  return best;
}
const usageCache = new Map<string, ProductUsage | null>();
/** The use a catalog format is made for (from its name, keywords and material), or null (a plain box). */
export function usageOfShape(id: string): ProductUsage | null {
  if (!usageCache.has(id)) {
    const r = ROW.get(id)?.row;
    usageCache.set(id, r ? usageOfText(`${r[1]} ${r[8]} ${r[7]}`) : null);
  }
  return usageCache.get(id)!;
}

function parseNetContent(t: string): ProductPackagingIntent["netContent"] {
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|cl|kg|g|l|litres?|grammes?)(?![a-z])/.exec(t);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  const u = m[2].startsWith("litre") ? "l" : m[2].startsWith("gramme") ? "g" : (m[2] as "ml" | "cl" | "l" | "g" | "kg");
  const ml = u === "ml" ? value : u === "cl" ? value * 10 : u === "l" ? value * 1000 : undefined;
  const g = u === "g" ? value : u === "kg" ? value * 1000 : undefined;
  return { value, unit: u, ...(ml !== undefined ? { ml } : {}), ...(g !== undefined ? { g } : {}) };
}

/** Product → its usual state (from the pack it is sold in: a juice bottle holds a liquid). */
const productState = (p: ProductIntent): PhysicalState | null => {
  const fam = familyOfShape(p.shape);
  if (fam === "bouteille" || fam === "canette" || fam === "brique") return "liquid";
  if (/creme|baume|beurre|pate|confiture|miel|sauce/.test(norm(p.product))) return "paste";
  if (/proteine|whey|farine|gari|lait en poudre|cafe/.test(norm(p.product + " " + p.words.join(" ")))) return /cafe/.test(norm(p.product)) ? "solid" : "powder";
  return null;
};

/** Packaging-only intents ("coffret") do not name the product (same rule as the local designer). */
const PACKAGING_ONLY = new Set(["luxury-rigid-box", "subscription-box"]);

export function inferPackagingIntent(text: string): ProductPackagingIntent {
  const t = norm(text);
  // First mention wins; at the same place the longer (more specific) words win: "crème glacée" > "crème".
  const ranked = PRODUCT_INTENTS.map((p) => {
    let pos = Infinity, len = 0;
    for (const w of p.words) {
      const k = norm(w).trim();
      const m = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).exec(t);
      if (m && (m.index < pos || (m.index === pos && k.length > len))) { pos = m.index; len = k.length; }
    }
    return { p, pos, len };
  })
    .filter((x) => x.pos < Infinity)
    .sort((a, b) => a.pos - b.pos || b.len - a.len);
  const product = (ranked.find((x) => !PACKAGING_ONLY.has(x.p.shape)) ?? ranked[0])?.p ?? null;
  const preferredFamily = CONTAINER_WORDS.find(([, words]) => words.some((w) => t.includes(` ${w}`) || hasWord(t, w.trim())))?.[0] ?? null;
  const explicit = STATE_WORDS.find(([, words]) => words.some((w) => t.includes(w)))?.[0] ?? null;
  const netContent = parseNetContent(t);
  const fromProduct = product ? productState(product) : null;
  const fromUnit: PhysicalState | null = netContent ? (netContent.ml !== undefined ? "liquid" : "solid") : null;
  // "liquide" / "en poudre" are decisive; a known product next; the unit only as a last hint
  const physicalState = explicit === "liquid" || explicit === "powder" || explicit === "solid" ? explicit : fromProduct ?? explicit ?? fromUnit;
  const stateSource = physicalState === null ? null : physicalState === explicit && (explicit !== "paste" || !fromProduct) ? "explicit" : physicalState === fromProduct ? "product" : "unit";
  const usage = (product ? usageOfShape(product.shape) : null) ?? usageOfText(text);
  return { text: t.trim(), product, productCategory: detectCategory(text).id, physicalState, stateSource, netContent, preferredFamily, usage };
}

/** What makes two intents the same packaging decision (small wording changes keep it). */
export const packagingSignature = (i: ProductPackagingIntent) => `${i.product?.product ?? "-"}|${i.physicalState ?? "-"}|${i.preferredFamily ?? "-"}`;

/** Does the text say anything about the packaging at all (a product, a form, a container)? */
export const isPackagingRelevant = (i: ProductPackagingIntent) => !!(i.product || i.preferredFamily || i.stateSource === "explicit");

// ─── Resolution ──────────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low";

export interface PackagingCandidate {
  shapeId: string;
  name: string;
  family: PackagingFamily;
  score: number;
}

export interface PackagingResolution {
  /** Supported catalog id, or null when Edify must ask (low confidence). */
  shapeId: string | null;
  family: PackagingFamily | null;
  /** 0..1, from the winning score. */
  confidence: number;
  level: ConfidenceLevel;
  needsClarification: boolean;
  question: { text: string; options: PackagingFamily[]; allowUnsure: true } | null;
  /** Why, in the user's words. */
  reasons: string[];
  /** Other supported formats worth proposing (best first). */
  alternatives: PackagingCandidate[];
  /** The usual pack of this product is not available yet (never returned as the decision). */
  refused: { shapeId: string; name: string } | null;
  intent: ProductPackagingIntent;
  signature: string;
}

/** Score weights (documented, tested): container asked > known product > family > state > content > words. */
export const SCORE = { asked: 100, askedMismatch: -60, product: 60, productFamily: 30, stateFitExplicit: 30, stateFit: 20, stateRank: 3, stateMismatch: -40, usage: 12, usageMismatch: -35, phrase: 7, category: 8, contentClose: 8, contentNear: 4, word: 5, wordCap: 15, sibling: 10 } as const;
const LEVEL = { high: 60, medium: 30 } as const;

/**
 * For a product whose usual pack is refused: the supported model of the same construction family gets a
 * small bonus. It only breaks ties: the product's family and its use (usage) come first, so an ice cream
 * goes to a food tub (not a protein tub), a pizza to a food box.
 */
const SIBLING: Partial<Record<ShapeModel, ShapeModel>> = { papertub: "tub", cup: "tub", pizza: "box", clamshell: "box", pillow: "box", display: "box", moulded: "tray", jug: "bottle", paperbag: "bag", shopper: "bag" };

/** Volumes written in a catalog name ("Bouteille de jus 30 cl", "Bidon 5 L"), in ml. */
function nameVolumeMl(r: ShapeRow): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/.exec(norm(r[1]));
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return m[2] === "ml" ? v : m[2] === "cl" ? v * 10 : v * 1000;
}

function scoreShape(r: ShapeRow, i: ProductPackagingIntent, honourProduct: boolean): { score: number; why: string[] } {
  const fam = MODEL_FAMILY[r[3]];
  let score = 0;
  const why: string[] = [];
  if (i.preferredFamily) {
    if (fam === i.preferredFamily) { score += SCORE.asked; why.push(`vous avez demandé : ${FAMILY_LABEL[fam].toLowerCase()}`); }
    else score += SCORE.askedMismatch;
  }
  if (i.product && honourProduct) {
    const pf = familyOfShape(i.product.shape);
    if (i.product.shape === r[0]) { score += SCORE.product; why.push(`emballage habituel pour : ${i.product.product.toLowerCase()}`); }
    else if (pf === fam) { score += SCORE.productFamily; why.push(`famille habituelle pour : ${i.product.product.toLowerCase()}`); }
    const usual = ROW.get(i.product.shape)?.row[3];
    if (usual && !isSupportedShape(i.product.shape)) {
      if (SIBLING[usual] === r[3]) score += SCORE.sibling;
      // same catalog category as the refused pack (SHAPE_CATEGORIES: "Alimentaire", "Pots"…)
      if (ROW.get(i.product.shape)!.row[2] === r[2]) score += SCORE.category;
    }
  }
  if (i.physicalState) {
    // the families that hold this form, the most usual first ("liquide" → a bottle before a can)
    const rank = STATE_FAMILIES[i.physicalState].indexOf(fam);
    if (rank >= 0) score += (i.stateSource === "explicit" ? SCORE.stateFitExplicit : SCORE.stateFit) - SCORE.stateRank * rank;
    else if (i.stateSource === "explicit") score += SCORE.stateMismatch;
  }
  // Same use before close shape: a food stays in a food pack, a cream in a cosmetic one.
  const use = usageOfShape(r[0]);
  if (i.usage && use) score += use === i.usage ? SCORE.usage : SCORE.usageMismatch;
  const v = nameVolumeMl(r);
  if (v && i.netContent?.ml) {
    const ratio = Math.max(v, i.netContent.ml) / Math.min(v, i.netContent.ml);
    if (ratio <= 1.25) { score += SCORE.contentClose; why.push("contenance proche"); }
    else if (ratio <= 2) score += SCORE.contentNear;
  }
  const hay = new Set(norm(`${r[1]} ${r[8]}`).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  // When the product's usual pack is refused, the words that named the product ("crème glacée") must not
  // pull an unrelated pack sharing one of them ("crème capillaire"): the alternative is chosen structurally.
  const named = i.product && !isSupportedShape(i.product.shape) ? new Set(i.product.words.flatMap((w) => norm(w).trim().split(/[^a-z0-9]+/))) : null;
  const words = [...new Set(i.text.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !named?.has(w)))];
  score += Math.min(SCORE.wordCap, words.filter((w) => hay.has(w)).length * SCORE.word);
  // A catalog phrase said as is ("lait en poudre", "huile d'olive") names what this pack is made for.
  const phrase = catalogPhrase(r, i.text, named);
  if (phrase) { score += SCORE.phrase; why.unshift(`fait pour : ${phrase}`); }
  return { score, why };
}

/** The longest run of 2-3 words of the text found as is in the format's name / keywords (2 real words at least). */
function catalogPhrase(r: ShapeRow, text: string, named: Set<string> | null): string | null {
  const hay = ` ${norm(`${r[1]} ${r[8]}`).trim()} `;
  const toks = text.split(" ").filter(Boolean);
  const bare = (w: string) => w.replace(/[^a-z0-9]/g, "");
  for (const n of [3, 2]) {
    for (let k = 0; k + n <= toks.length; k++) {
      const g = toks.slice(k, k + n);
      const real = g.filter((w) => bare(w).length > 3);
      if (real.length < 2 || real.some((w) => named?.has(bare(w)))) continue;
      if (hay.includes(` ${g.join(" ")} `)) return g.join(" ");
    }
  }
  return null;
}

const STATE_LABEL: Record<PhysicalState, string> = { liquid: "produit liquide", paste: "produit crémeux", powder: "produit en poudre", solid: "produit solide" };

/**
 * Resolve a product description to a supported format. `opts.family` forces the family (answer to the
 * clarification question, or "Changer" in the studio). Deterministic: same input → same output.
 */
export function resolvePackaging(text: string, opts: { family?: PackagingFamily } = {}): PackagingResolution {
  const base = inferPackagingIntent(text);
  const intent: ProductPackagingIntent = opts.family ? { ...base, preferredFamily: opts.family } : base;
  const supported = supportedShapeIds();
  // A known product whose form contradicts an explicit state ("savon liquide") is not followed.
  const honourProduct = !(intent.product && intent.physicalState && intent.stateSource === "explicit" && !STATE_FAMILIES[intent.physicalState].includes(familyOfShape(intent.product.shape)!));
  const refused = intent.product && honourProduct && !supported.has(intent.product.shape) ? { shapeId: intent.product.shape, name: shapeName(intent.product.shape) } : null;
  const scored = SHAPE_ROWS.filter((r) => supported.has(r[0]))
    .map((r) => ({ r, ...scoreShape(r, intent, honourProduct), index: ROW.get(r[0])!.index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = scored[0];
  const top = best?.score ?? 0;
  const level: ConfidenceLevel = top >= LEVEL.high ? "high" : top >= LEVEL.medium ? "medium" : "low";
  const confidence = Math.max(0, Math.min(1, top / (SCORE.asked + SCORE.product)));
  const chosen = level === "low" ? null : best;
  const reasons: string[] = [];
  if (chosen) {
    reasons.push(...chosen.why);
    if (intent.physicalState && !chosen.why.length) reasons.push(`adapté à un ${STATE_LABEL[intent.physicalState]}`);
    if (refused) reasons.push(`« ${refused.name} » n'est pas encore disponible : alternative supportée proposée pour le même usage`);
  }
  const alternatives = scored.filter((x) => x !== chosen).slice(0, 3).map((x) => ({ shapeId: x.r[0], name: x.r[1], family: MODEL_FAMILY[x.r[3]], score: x.score }));
  return {
    shapeId: chosen?.r[0] ?? null,
    family: chosen ? MODEL_FAMILY[chosen.r[3]] : null,
    confidence,
    level,
    needsClarification: level === "low",
    question: level === "low" ? { text: CLARIFY_QUESTION, options: CLARIFY_FAMILIES, allowUnsure: true } : null,
    reasons,
    alternatives,
    refused,
    intent,
    signature: packagingSignature(intent),
  };
}

/** "Je ne sais pas": Edify recommends a family from the product's form (a box when nothing is known). */
export function recommendWhenUnsure(text: string): PackagingResolution {
  const i = inferPackagingIntent(text);
  const family: PackagingFamily = i.physicalState ? STATE_FAMILIES[i.physicalState][0] : "boite";
  return resolvePackaging(text, { family });
}

/** Supported formats of a family, best first for this product (the short list after "Changer"). */
export function familyShapes(family: PackagingFamily, text = ""): PackagingCandidate[] {
  const intent = { ...inferPackagingIntent(text), preferredFamily: family };
  return SHAPE_ROWS.filter((r) => isSupportedShape(r[0]) && MODEL_FAMILY[r[3]] === family)
    .map((r) => ({ r, s: scoreShape(r, intent, true).score, index: ROW.get(r[0])!.index }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map(({ r, s }) => ({ shapeId: r[0], name: r[1], family, score: s }));
}

// ─── Stability ───────────────────────────────────────────────────────────────

/** How the current format was decided (kept with the project). */
export interface PackagingDecision {
  shapeId: string;
  source: "resolver" | "user" | "legacy";
  signature: string | null;
  family: PackagingFamily | null;
  level: ConfidenceLevel | null;
  reasons: string[];
}

export type PackagingAction =
  | { action: "keep"; shapeId: string; why: string }
  | { action: "change"; resolution: PackagingResolution }
  | { action: "ask"; resolution: PackagingResolution };

/**
 * Should a new generation change the format? Only when the product's packaging meaning changes:
 * nothing said about the packaging, the same product / form / container, or a choice the user made that
 * still fits the product (userChoiceFits; unless a container is now explicitly asked) → keep. A refused historical format is never kept for
 * a new decision. Called once per generation, never per keystroke.
 */
export function decidePackaging(text: string, current: PackagingDecision | null, opts: { fresh?: boolean } = {}): PackagingAction {
  const intent = inferPackagingIntent(text);
  const currentOk = !!current && isSupportedShape(current.shapeId);
  if (currentOk && !opts.fresh) {
    if (!isPackagingRelevant(intent)) return { action: "keep", shapeId: current!.shapeId, why: "le brief ne parle pas du packaging" };
    if (current!.source === "user" && !intent.preferredFamily && userChoiceFits(current!.shapeId, intent)) return { action: "keep", shapeId: current!.shapeId, why: "packaging choisi par vous" };
    if (current!.signature && current!.signature === packagingSignature(intent)) return { action: "keep", shapeId: current!.shapeId, why: "même produit, même packaging" };
  }
  const resolution = resolvePackaging(text);
  if (resolution.needsClarification) {
    // A known, supported current format beats a question when the brief is vague.
    if (currentOk && !opts.fresh) return { action: "keep", shapeId: current!.shapeId, why: "brief sans indication de packaging" };
    return { action: "ask", resolution };
  }
  if (currentOk && !opts.fresh && familyOfShape(current!.shapeId) === resolution.family && (current!.signature === null || current!.signature.split("|")[0] === resolution.signature.split("|")[0])) {
    return { action: "keep", shapeId: current!.shapeId, why: "même famille de packaging" };
  }
  return { action: "change", resolution };
}

/**
 * Is a format the user picked still right for this product? Same use (or no known use) and a form it can
 * hold. Within the same use the user's taste wins over the usual form (a shampoo in a jar stays); for
 * another product (a tube picked for a cream, then a mango juice) the packaging is decided again.
 * An explicitly stated form ("liquide") must always fit.
 */
export function userChoiceFits(shapeId: string, intent: ProductPackagingIntent): boolean {
  const use = usageOfShape(shapeId);
  if (intent.usage && use && use !== intent.usage) return false;
  const fam = familyOfShape(shapeId);
  if (!fam || !intent.physicalState || intent.stateSource === "unit") return true;
  const holds = STATE_FAMILIES[intent.physicalState].includes(fam);
  return holds || (intent.stateSource !== "explicit" && !!use && use === intent.usage);
}

/** The decision recorded for a resolution (or a user's pick). */
export function decisionFrom(resolution: PackagingResolution): PackagingDecision {
  return { shapeId: resolution.shapeId!, source: "resolver", signature: resolution.signature, family: resolution.family, level: resolution.level, reasons: resolution.reasons };
}
export function userDecision(shapeId: string): PackagingDecision {
  return { shapeId, source: "user", signature: null, family: familyOfShape(shapeId), level: null, reasons: ["choisi par vous"] };
}
/** Projects saved before phase 3C: the format they had, kept as it is (no migration). */
export function legacyDecision(shapeId: string): PackagingDecision {
  return { shapeId, source: "legacy", signature: null, family: familyOfShape(shapeId), level: null, reasons: [] };
}

/** A saved decision, validated (anything unreadable → the legacy decision of the current format). */
export function parseDecision(raw: unknown, shapeId: string): PackagingDecision {
  const o = raw as Partial<PackagingDecision> | null;
  if (!o || typeof o !== "object" || o.shapeId !== shapeId || !["resolver", "user", "legacy"].includes(String(o.source))) return legacyDecision(shapeId);
  return {
    shapeId,
    source: o.source as PackagingDecision["source"],
    signature: typeof o.signature === "string" ? o.signature : null,
    family: familyOfShape(shapeId),
    level: o.level === "high" || o.level === "medium" || o.level === "low" ? o.level : null,
    reasons: Array.isArray(o.reasons) ? o.reasons.filter((x): x is string => typeof x === "string").slice(0, 4) : [],
  };
}
