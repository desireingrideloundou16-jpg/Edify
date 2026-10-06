/**
 * Local, deterministic reading of a brief into ProductIntelligence: the brief is matched against the
 * archetypes' terms (no network, no AI, same input → same output). A match is "inferred", never a fact:
 * its confidence is at most "medium", and what the user states themselves (withUserFacts) is recorded as
 * "userProvided" field by field, so the two are never confused.
 */
import { PRODUCT_ARCHETYPES } from "./archetypes";
import { userProvenance } from "./provenance";
import type { IntelligenceField, ProductArchetype, ProductIntelligence } from "./types";

export interface IntelligenceInference {
  intelligence: ProductIntelligence;
  archetypeId: string | null;
  matchedTerm: string | null;
}

export const normalizeBrief = (s: string) =>
  ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim()} `;

const termRe = new Map<string, RegExp>();
/** Position of a whole term (an s / x plural allowed) in a normalised text, or -1. */
function termAt(text: string, term: string): number {
  let re = termRe.get(term);
  if (!re) termRe.set(term, (re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|x)?(?=[^a-z0-9]|$)`)));
  const m = re.exec(text);
  return m ? m.index : -1;
}

/** The archetype a brief speaks of: the longest (most specific) term wins, then the first mentioned. */
export function matchArchetype(text: string): { archetype: ProductArchetype; term: string } | null {
  const t = normalizeBrief(text);
  let best: { archetype: ProductArchetype; term: string; pos: number } | null = null;
  for (const archetype of PRODUCT_ARCHETYPES) {
    for (const term of archetype.terms) {
      const pos = termAt(t, term);
      if (pos < 0) continue;
      if (!best || term.length > best.term.length || (term.length === best.term.length && pos < best.pos)) best = { archetype, term, pos };
    }
  }
  return best && { archetype: best.archetype, term: best.term };
}

const EMPTY: ProductIntelligence = Object.freeze({ confidence: "unknown", origin: "unknown", provenance: [] }) as ProductIntelligence;

/**
 * What Edify can tell about a product from its brief, before any design. Unknown when no archetype
 * matches (nothing is guessed). A multi-word match ("lait en poudre") is "medium", a single word "low".
 */
export function inferProductIntelligence(text: string): IntelligenceInference {
  const m = matchArchetype(text);
  if (!m) return { intelligence: { ...EMPTY, provenance: [] }, archetypeId: null, matchedTerm: null };
  const base = structuredClone(m.archetype.intelligence) as ProductIntelligence;
  return {
    intelligence: { ...base, origin: "inferred", confidence: m.term.includes(" ") ? "medium" : "low" },
    archetypeId: m.archetype.id,
    matchedTerm: m.term,
  };
}

/**
 * Overlay what the user said (always wins, "userProvided", high confidence) on an inferred description.
 * The input is not mutated.
 */
export function withUserFacts(pi: ProductIntelligence, facts: Partial<Omit<ProductIntelligence, "confidence" | "origin" | "provenance" | "fieldMeta">>, sourceId?: string): ProductIntelligence {
  const provenance = userProvenance(sourceId);
  const keys = (Object.keys(facts) as IntelligenceField[]).filter((k) => facts[k] !== undefined);
  if (!keys.length) return structuredClone(pi);
  const out = structuredClone(pi) as ProductIntelligence;
  const meta = { ...(out.fieldMeta ?? {}) };
  for (const k of keys) {
    (out as unknown as Record<string, unknown>)[k] = structuredClone(facts[k]);
    meta[k] = { origin: "userProvided", confidence: "high", provenance };
  }
  out.fieldMeta = meta;
  out.provenance = [...out.provenance, provenance];
  return out;
}
