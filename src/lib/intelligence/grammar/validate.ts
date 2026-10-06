/**
 * PI-2 — validation of the rule base and of a DesignGrammar: controlled values only, provenance on every
 * rule, no impossible state (an item both preferred and avoided, ornaments preferred with no decoration,
 * imagery preferred with no image), well-formed conflicts and priorities. "unknown" is always valid.
 */
import { LAYOUTS, MOTIFS } from "@/lib/artwork/compose";
import { ART_STYLES } from "@/lib/ai/designSpec";
import { CONFIDENCE_LEVELS, INFORMATION_ORIGINS, LEVELS, POSITIONING_TERRITORIES, inVocabulary, provenanceIssues } from "@/lib/intelligence/taxonomy";
import type { DesignGrammar, GrammarEffects, GrammarRule, Ranked, Votes } from "./types";
import {
  ACCENT_ROLES, BACKGROUND_ROLES, BRAND_TRAITS, CAPITALIZATIONS, COLOR_COMPLEXITIES, COMPOSITION_STRUCTURES, CONFLICT_STRATEGIES, CONTRAST_KINDS, DECORATION_LEVELS,
  DECORATIVE_ELEMENTS, DENSITIES, DISPLAY_BODY_RELATIONS, DOMINANT_COLOR_ROLES, FAMILY_COUNTS, FONT_CATEGORIES, HIERARCHY_ROLES, IMAGE_DOMINANCES, IMAGE_PLACEMENTS,
  IMAGE_REGISTERS, IMAGERY_MODES, LETTER_SPACINGS, MATERIAL_CUES, RULE_PRIORITIES, SATURATIONS, STRENGTHS, TEMPERATURES, TONE_AXIS_KEYS, TYPE_TRAITS, WHITESPACES,
} from "./vocabulary";

const SCALARS: readonly [keyof GrammarEffects, readonly unknown[]][] = [
  ["hierarchyStrength", LEVELS], ["weightContrast", LEVELS], ["letterSpacing", LETTER_SPACINGS], ["capitalization", CAPITALIZATIONS], ["maxFamilies", FAMILY_COUNTS],
  ["displayBodyRelation", DISPLAY_BODY_RELATIONS], ["colorComplexity", COLOR_COMPLEXITIES], ["saturation", SATURATIONS], ["temperature", TEMPERATURES], ["background", BACKGROUND_ROLES],
  ["accentRole", ACCENT_ROLES], ["dominantColorRole", DOMINANT_COLOR_ROLES], ["imageDominance", IMAGE_DOMINANCES], ["imagePlacement", IMAGE_PLACEMENTS], ["imageRegister", IMAGE_REGISTERS],
  ["whitespace", WHITESPACES], ["density", DENSITIES], ["focalIsolation", LEVELS], ["decorationLevel", DECORATION_LEVELS], ["shelfEmphasis", LEVELS],
];
const VOTES: readonly [keyof GrammarEffects, readonly string[]][] = [
  ["typeClasses", FONT_CATEGORIES], ["typeTraits", TYPE_TRAITS], ["composition", COMPOSITION_STRUCTURES], ["imagery", IMAGERY_MODES], ["illustration", ART_STYLES],
  ["decorative", DECORATIVE_ELEMENTS], ["motifs", MOTIFS], ["materialCues", MATERIAL_CUES],
];

export function ruleIssues(r: GrammarRule): string[] {
  const at = `rule(${r.id})`;
  const issues: string[] = [];
  if (!/^[a-zA-Z]+(\.[a-zA-Z]+)+$/.test(r.id)) issues.push(`${at}.id: dotted camelCase expected`);
  if (!inVocabulary(RULE_PRIORITIES, r.priority)) issues.push(`${at}.priority: invalid "${r.priority}"`);
  if (!inVocabulary(STRENGTHS, r.strength)) issues.push(`${at}.strength: invalid "${r.strength}"`);
  if (!r.rationale?.trim()) issues.push(`${at}.rationale: required`);
  if (!r.provenance) issues.push(`${at}.provenance: required`);
  else issues.push(...provenanceIssues(r.provenance, `${at}.provenance`));
  if (r.priority === "userBrief" || r.priority === "brandDirection") issues.push(`${at}: the rule base cannot speak for the user or the brand`);
  const w = r.when;
  if (!Object.keys(w).length) issues.push(`${at}.when: empty condition`);
  for (const p of [w.positioning, ...(w.allPositioning ?? [])]) if (p !== undefined && !inVocabulary(POSITIONING_TERRITORIES, p)) issues.push(`${at}.when: invalid positioning "${p}"`);
  if (r.resolves && !w.allPositioning?.length) issues.push(`${at}: a named resolution needs allPositioning`);
  const e = r.effects;
  for (const [k, vocab] of SCALARS) if (e[k] !== undefined && !vocab.includes(e[k])) issues.push(`${at}.${k}: invalid "${String(e[k])}"`);
  for (const [k, vocab] of VOTES) {
    const v = e[k] as Votes<string> | undefined;
    if (!v) continue;
    for (const x of [...(v.prefer ?? []), ...(v.avoid ?? [])]) if (!vocab.includes(x)) issues.push(`${at}.${k}: invalid "${x}"`);
    const both = (v.prefer ?? []).filter((x) => (v.avoid ?? []).includes(x));
    if (both.length) issues.push(`${at}.${k}: both preferred and avoided: ${both.join(", ")}`);
  }
  for (const [axis, v] of Object.entries(e.tone ?? {})) {
    if (!TONE_AXIS_KEYS.includes(axis as never)) issues.push(`${at}.tone.${axis}: unknown axis`);
    if (![-2, -1, 0, 1, 2].includes(v as number)) issues.push(`${at}.tone.${axis}: must be an integer in [-2, 2]`);
  }
  for (const [k, v] of Object.entries(e.contrast ?? {})) if (!CONTRAST_KINDS.includes(k as never) || !LEVELS.includes(v as never)) issues.push(`${at}.contrast.${k}: invalid`);
  for (const role of e.hierarchyLead ?? []) if (!HIERARCHY_ROLES.includes(role)) issues.push(`${at}.hierarchyLead: invalid role "${role}"`);
  for (const p of e.pitfalls ?? []) if (!p.trim()) issues.push(`${at}.pitfalls: empty`);
  return issues;
}

const rankedIssues = (r: Ranked<string>, vocab: readonly string[], at: string): string[] => {
  const issues: string[] = [];
  for (const x of [...r.prefer, ...r.secondary, ...r.avoid]) if (!vocab.includes(x)) issues.push(`${at}: invalid "${x}"`);
  const clash = [...r.prefer, ...r.secondary].filter((x) => r.avoid.includes(x));
  if (clash.length) issues.push(`${at}: both preferred and avoided: ${clash.join(", ")}`);
  return issues;
};

export function grammarIssues(g: DesignGrammar): string[] {
  const issues: string[] = [];
  const decided = (d: { value: unknown; priority: unknown }, vocab: readonly unknown[], at: string) => {
    if (d.value !== "unknown" && !vocab.includes(d.value)) issues.push(`${at}: invalid "${String(d.value)}"`);
    if (d.priority !== null && !inVocabulary(RULE_PRIORITIES, d.priority)) issues.push(`${at}.priority: invalid`);
  };
  for (const axis of TONE_AXIS_KEYS) decided(g.tone[axis], [-2, -1, 0, 1, 2], `tone.${axis}`);
  issues.push(...rankedIssues(g.typography.classes, FONT_CATEGORIES, "typography.classes"), ...rankedIssues(g.typography.traits, TYPE_TRAITS, "typography.traits"));
  decided(g.typography.maxFamilies, FAMILY_COUNTS, "typography.maxFamilies");
  decided(g.typography.displayBodyRelation, DISPLAY_BODY_RELATIONS, "typography.displayBodyRelation");
  if (g.typography.maxFamilies.value === 1 && g.typography.displayBodyRelation.value === "contrasting") issues.push("typography: one family cannot contrast display and body");
  for (const r of g.hierarchy.order) if (!HIERARCHY_ROLES.includes(r)) issues.push(`hierarchy: invalid role "${r}"`);
  if (new Set(g.hierarchy.order).size !== g.hierarchy.order.length) issues.push("hierarchy: duplicate roles");
  if (g.hierarchy.dominant !== g.hierarchy.order[0]) issues.push("hierarchy: dominant must lead the order");
  issues.push(...rankedIssues(g.composition.structures, COMPOSITION_STRUCTURES, "composition"), ...rankedIssues(g.composition.layouts, LAYOUTS, "layouts"));
  decided(g.color.complexity, COLOR_COMPLEXITIES, "color.complexity");
  decided(g.color.saturation, SATURATIONS, "color.saturation");
  issues.push(...rankedIssues(g.imagery.modes, IMAGERY_MODES, "imagery"), ...rankedIssues(g.illustration, ART_STYLES, "illustration"));
  if (g.imagery.dominance.value === "none" && g.imagery.modes.prefer.some((m) => m !== "none" && m !== "typography")) issues.push("imagery: images preferred while dominance is none");
  decided(g.density, DENSITIES, "density");
  decided(g.whitespace.preference, WHITESPACES, "whitespace");
  decided(g.decoration.level, DECORATION_LEVELS, "decoration.level");
  issues.push(...rankedIssues(g.decoration.elements, DECORATIVE_ELEMENTS, "decoration.elements"), ...rankedIssues(g.decoration.motifs, MOTIFS, "decoration.motifs"));
  if (g.decoration.level.value === "none" && (g.decoration.elements.prefer.length || g.decoration.motifs.prefer.some((m) => m !== "none"))) issues.push("decoration: elements preferred while decoration is none");
  issues.push(...rankedIssues(g.materialCues.cues, MATERIAL_CUES, "materialCues"));
  if (g.materialCues.nature !== "visualCue" || g.materialCues.manufacturing !== "notAssessed") issues.push("materialCues: a grammar never asserts a manufacturing finish");
  for (const t of g.brandExpression.traits) if (!inVocabulary(BRAND_TRAITS, t)) issues.push(`brandExpression: invalid "${t}"`);
  if (g.brandExpression.status === "notProvided" && g.brandExpression.traits.length) issues.push("brandExpression: traits without a provided brand");
  for (const [i, c] of g.conflicts.entries()) {
    if (!inVocabulary(CONFLICT_STRATEGIES, c.strategy)) issues.push(`conflicts[${i}].strategy: invalid`);
    if (c.between.length !== 2 || c.between[0] === c.between[1]) issues.push(`conflicts[${i}].between: two distinct sides expected`);
    if (!c.rationale?.trim() || !c.resolution?.trim() || !c.rules.length) issues.push(`conflicts[${i}]: resolution, rationale and rules required`);
  }
  for (const a of g.avoidances) if (!inVocabulary(RULE_PRIORITIES, a.priority)) issues.push(`avoidances: invalid priority for ${a.facet}:${a.value}`);
  for (const a of g.applied) if (!inVocabulary(RULE_PRIORITIES, a.priority) || !inVocabulary(STRENGTHS, a.strength)) issues.push(`applied: invalid rule ${a.id}`);
  if (!inVocabulary(CONFIDENCE_LEVELS, g.confidence)) issues.push("confidence: invalid");
  if (!inVocabulary(INFORMATION_ORIGINS, g.origin)) issues.push("origin: invalid");
  if (g.confidence === "high") issues.push("confidence: internal design heuristics are never \"high\"");
  if (!g.provenance.length) issues.push("provenance: required");
  g.provenance.forEach((p, i) => issues.push(...provenanceIssues(p, `provenance[${i}]`)));
  return issues;
}
