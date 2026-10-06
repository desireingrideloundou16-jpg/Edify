/**
 * Edify Packaging Intelligence — PI-2, Packaging Design Grammar: the structured visual reasoning layer
 * between product understanding (PI-1) and future design strategy (PI-5). Deterministic, local, read-only:
 * it does not change any production design, rendering, 2D / 3D or PDF.
 */
export * from "./vocabulary";
export type * from "./types";
export { DERIVED_SIGNALS, DESIGN_TERRITORIES, GRAMMAR_RULES, PI2_GRAMMAR_SOURCE, STRUCTURE_LAYOUTS, type DesignTerritory } from "./rules";
export { inferDesignGrammar } from "./infer";
export { designDirectivesFromBrief } from "./directives";
export { grammarIssues, ruleIssues } from "./validate";
export { shadowDesignGrammar, type DesignGrammarShadow, type GrammarVerdict, type ProducedDesign } from "./shadow";
