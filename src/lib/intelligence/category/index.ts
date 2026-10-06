/**
 * Edify Packaging Intelligence — PI-3, Industry / Category Knowledge: what each product category knows
 * (conventions, trust signals, information priorities, differentiation, pitfalls, tensions, shelf
 * behaviour), with provenance. Knowledge only: no pack, layout, colour or font is decided here, and
 * nothing in production depends on it (read-only shadow).
 */
export * from "./vocabulary";
export type * from "./types";
export { CATEGORY_KNOWLEDGE } from "./knowledge";
export { inferCategoryKnowledge } from "./infer";
export { categoryKnowledgeIssues, knowledgeItemIssues } from "./validate";
export { shadowCategoryKnowledge, type CategoryKnowledgeShadow, type CategoryVerdict } from "./shadow";
