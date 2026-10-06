/**
 * PI-3 — the few vocabularies category knowledge needs on top of PI-1 and PI-2 (which are reused for
 * categories, positioning, roles, imagery, illustration, composition, provenance and confidence).
 */
import type { Confidence, Provenance, SourceType } from "@/lib/intelligence/taxonomy";

/** Where a piece of category knowledge comes from. Unsourced knowledge is "internal" or "inferred". */
export const KNOWLEDGE_BASES = ["research", "expert", "regulatory", "market", "internal", "inferred"] as const;

/** Which PI-1 provenance source type each basis must carry (the provenance model is PI-1's). */
export const BASIS_SOURCE_TYPE: Readonly<Record<(typeof KNOWLEDGE_BASES)[number], SourceType>> = {
  research: "research", expert: "expert", regulatory: "regulatory", market: "market", internal: "internalRule", inferred: "internalRule",
};
/** The most a basis can claim: unsourced knowledge is never more than "medium", an inference never more than "low". */
export const BASIS_MAX_CONFIDENCE: Readonly<Record<(typeof KNOWLEDGE_BASES)[number], Confidence>> = {
  research: "high", expert: "high", regulatory: "high", market: "medium", internal: "medium", inferred: "low",
};

export const KNOWLEDGE_KINDS = ["convention", "trustSignal", "informationPriority", "differentiation", "opportunity", "pitfall", "shelfBehavior"] as const;

/** strongConvention / weakConvention: what the category usually does; optional; avoid; opportunity. */
export const KNOWLEDGE_STRENGTHS = ["strongConvention", "weakConvention", "optional", "avoid", "opportunity"] as const;

/** Edify's own editorial category notes (not a study, not a market survey). */
export const PI3_INTERNAL_SOURCE: Provenance = Object.freeze({
  sourceType: "internalRule",
  sourceId: "edify.pi3.categories",
  sourceTitle: "Edify PI-3 category notes (internal editorial knowledge)",
  confidence: "medium",
});

/** Inferences from the other notes (lowest trust). */
export const PI3_INFERRED_SOURCE: Provenance = Object.freeze({
  sourceType: "internalRule",
  sourceId: "edify.pi3.inferred",
  sourceTitle: "Edify PI-3 inferred category notes",
  confidence: "low",
});

/**
 * Real, identifiable standards (no URL is given: none is invented). Their scope is stated on each item:
 * an international reference is not a statement of any country's law.
 */
export const CODEX_PREPACKAGED_LABELLING: Provenance = Object.freeze({
  sourceType: "regulatory",
  sourceId: "CXS 1-1985",
  sourceTitle: "Codex Alimentarius — General Standard for the Labelling of Prepackaged Foods (CXS 1-1985)",
  confidence: "medium",
});
export const UN_GHS: Provenance = Object.freeze({
  sourceType: "regulatory",
  sourceId: "UN GHS",
  sourceTitle: "United Nations — Globally Harmonized System of Classification and Labelling of Chemicals (GHS)",
  confidence: "medium",
});
