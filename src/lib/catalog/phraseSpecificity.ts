/**
 * PI-1.5 — semantic specificity for the packaging resolver: a specific phrase dominates a generic word it
 * contains. "eau de javel" is bleach and "eau de parfum" a fragrance, never the water that the generic
 * word "eau" names on its own; "crème capillaire" beats "crème", "lait en poudre" beats "lait".
 *
 *   exactPhrase (3+ words)  >  multiWord (2 words)  >  keyword (1 whole word)  >  generic
 *   generic = a single word that heads a longer phrase of the lexicon ("eau", "crème", "lait", "huile"),
 *             or a word matched inside a longer one ("parfum" in "parfumée").
 *
 * The phrase lexicon is not a third copy of the product words: it is read from the two existing sources,
 * the catalogue's known products (PRODUCT_INTENTS words) and the PI-1 archetype terms, linked by the
 * archetypes' catalogueProducts. Pure, deterministic, local.
 */
import { PRODUCT_ARCHETYPES } from "@/lib/intelligence/taxonomy/archetypes";
import type { ProductArchetype } from "@/lib/intelligence/taxonomy/types";
import { PRODUCT_INTENTS, type ProductIntent } from "./productIntents";

export type Specificity = "exactPhrase" | "multiWord" | "keyword" | "generic";
export const SPECIFICITY_RANK: Readonly<Record<Specificity, number>> = { exactPhrase: 4, multiWord: 3, keyword: 2, generic: 1 };

/** Same normalisation as the resolver's texts (lowercase, no accents, straight apostrophes). */
export const normTerm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
const tokens = (term: string) => term.split(/[\s']+/).filter(Boolean);

/** What a phrase means: the archetypes it belongs to, or the known product itself when no archetype describes it. */
const intentMeanings = new Map<ProductIntent, Set<string>>(
  PRODUCT_INTENTS.map((p) => {
    const ids = PRODUCT_ARCHETYPES.filter((a) => a.catalogueProducts?.includes(p.product)).map((a) => a.id);
    return [p, new Set(ids.length ? ids : [`intent:${p.product}`])];
  })
);

export interface Phrase { term: string; meanings: Set<string>; archetype: ProductArchetype | null; intent: ProductIntent | null }

/** Every multi-word expression the catalogue and the archetypes know. */
const PHRASES: Phrase[] = [
  ...PRODUCT_ARCHETYPES.flatMap((a) => a.terms.filter((t) => tokens(t).length > 1).map((term) => ({ term, meanings: new Set([a.id]), archetype: a, intent: null }))),
  ...PRODUCT_INTENTS.flatMap((p) => p.words.map(normTerm).filter((t) => tokens(t).length > 1).map((term) => ({ term, meanings: intentMeanings.get(p)!, archetype: null, intent: p }))),
];
/** Single words that open a longer phrase: alone they name a family of products, not one. */
const PHRASE_HEADS = new Set(PHRASES.map((p) => tokens(p.term)[0]));

export function specificityOf(term: string, partialWord = false): Specificity {
  const n = tokens(term).length;
  if (n >= 3) return "exactPhrase";
  if (n === 2) return "multiWord";
  return partialWord || PHRASE_HEADS.has(term) ? "generic" : "keyword";
}

const reCache = new Map<string, RegExp>();
const termRe = (term: string) => {
  let re = reCache.get(term);
  if (!re) reCache.set(term, (re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g")));
  re.lastIndex = 0;
  return re;
};

export interface TermMatch { start: number; end: number; partialWord: boolean }

/** Every place a normalised term starts a word of the normalised text (a plural s / x is a whole word). */
export function termMatches(text: string, term: string): TermMatch[] {
  const out: TermMatch[] = [];
  const re = termRe(term);
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index + m[1].length, end = start + term.length;
    const rest = text.slice(end);
    out.push({ start, end, partialWord: /^[a-z0-9]/.test(rest) && !/^[sx]([^a-z0-9]|$)/.test(rest) });
    re.lastIndex = start + 1;
  }
  return out;
}


function phraseHits(text: string): { phrase: Phrase; start: number; end: number }[] {
  return PHRASES.flatMap((phrase) => termMatches(text, phrase.term).filter((m) => !m.partialWord).map((m) => ({ phrase, start: m.start, end: m.end })));
}

/**
 * The more specific phrases of another meaning that dominate this match of a known product's word ([]:
 * none, the word keeps its meaning). Only a generic word can be dominated: when the phrase contains it
 * ("eau" inside "eau de javel", "crème" inside "crème capillaire"), or when it is only part of a longer
 * word ("parfum" inside "parfumée" in "eau de javel parfumée"). A real keyword elsewhere in the text
 * keeps its meaning ("savon à l'huile de palme" is a soap). The resolver decides what a domination means
 * (packagingResolver: another use → not this product; same use → the product's family only).
 */
export function dominatingPhrases(text: string, intent: ProductIntent, term: string, match: TermMatch): Phrase[] {
  if (specificityOf(term, match.partialWord) !== "generic") return [];
  const own = intentMeanings.get(intent)!;
  return phraseHits(text)
    .filter((h) => ![...h.phrase.meanings].some((m) => own.has(m)) && (match.partialWord || (h.start <= match.start && match.end <= h.end)))
    .map((h) => h.phrase);
}

/** The resolver's use of an archetype, from its category (null: no resolver use covers it). */
export type PhraseUsage = "supplement" | "pet" | "household" | "food" | "cosmetic";
export function archetypeUsage(a: ProductArchetype): PhraseUsage | null {
  const { productCategory: c, productSubcategory: s } = a.intelligence;
  if (c === "food" || c === "beverages") return "food";
  if (c === "cosmetics" || c === "personalCare") return "cosmetic";
  if (c === "household") return "household";
  if (c === "petCare") return "pet";
  if (c === "supplements") return "supplement";
  if (c === "luxury") return s === "luxuryFood" || s === "premiumBeverage" ? "food" : s === "perfume" || s === "luxuryCosmetics" ? "cosmetic" : null;
  return null;
}
