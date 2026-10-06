/**
 * Edify Packaging Intelligence — PI-1, packaging taxonomy intelligence: the deterministic knowledge layer
 * (what the product is, who buys it, where, how it is used, what the pack must do, which families and
 * positioning fit). Local data and pure functions only; the packaging resolver and the frozen engine stay
 * the authorities on structures and geometry.
 */
export * from "./vocabulary";
export * from "./productTaxonomy";
export * from "./provenance";
export * from "./materials";
export type * from "./types";
export { PRODUCT_ARCHETYPES, archetypeById } from "./archetypes";
export { inferProductIntelligence, matchArchetype, normalizeBrief, withUserFacts, type IntelligenceInference } from "./infer";
export { SEMANTIC_TO_RESOLVER_FAMILY, resolvePackagingWithIntelligence, resolverFamiliesFor, resolverPhysicalState, type IntelligentResolution } from "./resolverAdapter";
export { archetypeIssues, productIntelligenceIssues } from "./validate";
