/**
 * PI-3 — validation of the category knowledge base: controlled vocabularies (PI-1 / PI-2 / PI-3), real
 * provenance that matches the stated basis, no confidence above what the basis allows, a scope on every
 * regulatory item, no URL, and no colour or cultural pattern recommended as a convention.
 */
import { LAYOUTS, MOTIFS } from "@/lib/artwork/compose";
import { ART_STYLES } from "@/lib/ai/designSpec";
import { HIERARCHY_ROLES } from "@/lib/intelligence/grammar";
import { CONFIDENCE_LEVELS, POSITIONING_TERRITORIES, inVocabulary, isProductCategory, isSubcategoryOf, provenanceIssues, type ProductCategory } from "@/lib/intelligence/taxonomy";
import type { CategoryKnowledge, KnowledgeItem } from "./types";
import { BASIS_MAX_CONFIDENCE, BASIS_SOURCE_TYPE, KNOWLEDGE_BASES, KNOWLEDGE_KINDS, KNOWLEDGE_STRENGTHS } from "./vocabulary";

const CONF = ["unknown", "low", "medium", "high"];
const TENSION_EXTRA_POLES = ["technical", "emotional", "local", "global", "massMarket"];
/** A convention may not prescribe a colour or a cultural pattern: those are never category facts. */
const PRESCRIPTIVE_STEREOTYPE = /\b(vert|green|noir et or|black and gold|wax|kente|bogolan)\b/i;

export function knowledgeItemIssues(it: KnowledgeItem, categories: readonly ProductCategory[], at: string): string[] {
  const issues: string[] = [];
  if (!/^[a-zA-Z]+(\.[a-zA-Z]+)+$/.test(it.id)) issues.push(`${at}.id: dotted camelCase expected`);
  if (!inVocabulary(KNOWLEDGE_KINDS, it.kind)) issues.push(`${at}.kind: invalid`);
  if (!inVocabulary(KNOWLEDGE_STRENGTHS, it.strength)) issues.push(`${at}.strength: invalid`);
  if (!inVocabulary(KNOWLEDGE_BASES, it.basis)) issues.push(`${at}.basis: invalid`);
  if (!inVocabulary(CONFIDENCE_LEVELS, it.confidence)) issues.push(`${at}.confidence: invalid`);
  if (!it.statement?.trim() || !it.rationale?.trim()) issues.push(`${at}: statement and rationale required`);
  issues.push(...provenanceIssues(it.provenance, `${at}.provenance`));
  if (it.provenance.sourceType !== BASIS_SOURCE_TYPE[it.basis]) issues.push(`${at}: basis "${it.basis}" needs a ${BASIS_SOURCE_TYPE[it.basis]} source, not ${it.provenance.sourceType}`);
  if (CONF.indexOf(it.confidence) > CONF.indexOf(BASIS_MAX_CONFIDENCE[it.basis])) issues.push(`${at}.confidence: "${it.confidence}" is more than a ${it.basis} basis allows`);
  if (it.basis === "regulatory" && !it.scope?.trim()) issues.push(`${at}.scope: a regulatory item states where it applies`);
  if (it.provenance.sourceUrl) issues.push(`${at}.provenance.sourceUrl: no URL in the knowledge base (none is invented)`);
  if (it.kind === "pitfall" && it.strength !== "avoid") issues.push(`${at}: a pitfall has the "avoid" strength`);
  if (it.strength === "avoid" && it.kind !== "pitfall" && it.kind !== "differentiation") issues.push(`${at}: "avoid" is the strength of pitfalls and lookalike risks only`);
  if (it.kind === "opportunity" && it.strength !== "opportunity") issues.push(`${at}: an opportunity has the "opportunity" strength`);
  if (it.kind !== "pitfall" && it.strength !== "avoid" && PRESCRIPTIVE_STEREOTYPE.test(it.statement)) issues.push(`${at}: a convention never prescribes a colour or a cultural pattern`);
  for (const s of it.subcategories ?? []) if (!categories.some((c) => isSubcategoryOf(c, s))) issues.push(`${at}.subcategories: "${s}" is not in ${categories.join(", ")}`);
  const r = it.relates ?? {};
  for (const role of r.roles ?? []) if (!HIERARCHY_ROLES.includes(role)) issues.push(`${at}.relates.roles: invalid "${role}"`);
  for (const p of [...(r.positioning ?? []), ...(it.yieldsTo ?? [])]) if (!inVocabulary(POSITIONING_TERRITORIES, p)) issues.push(`${at}: invalid positioning "${p}"`);
  for (const a of r.illustration ?? []) if (!(ART_STYLES as readonly string[]).includes(a)) issues.push(`${at}.relates.illustration: invalid "${a}"`);
  if (it.check) {
    const vocab: readonly string[] = it.check.facet === "layout" ? LAYOUTS : it.check.facet === "motif" ? MOTIFS : ART_STYLES;
    for (const v of it.check.values) if (!vocab.includes(v)) issues.push(`${at}.check: invalid ${it.check.facet} "${v}"`);
  }
  return issues;
}

export function categoryKnowledgeIssues(k: CategoryKnowledge): string[] {
  const at = `category(${k.id})`;
  const issues: string[] = [];
  if (!k.appliesTo.categories.length || !k.appliesTo.categories.every(isProductCategory)) issues.push(`${at}.appliesTo.categories: invalid`);
  for (const s of k.appliesTo.subcategories ?? []) if (!k.appliesTo.categories.some((c) => isSubcategoryOf(c, s))) issues.push(`${at}.appliesTo.subcategories: "${s}" invalid`);
  for (const role of k.informationOrder ?? []) if (!HIERARCHY_ROLES.includes(role)) issues.push(`${at}.informationOrder: invalid "${role}"`);
  if (k.informationOrder && new Set(k.informationOrder).size !== k.informationOrder.length) issues.push(`${at}.informationOrder: duplicates`);
  const ids = new Set<string>();
  for (const it of k.items) {
    if (ids.has(it.id)) issues.push(`${at}: duplicate item ${it.id}`);
    ids.add(it.id);
    issues.push(...knowledgeItemIssues(it, k.appliesTo.categories, `${at}.${it.id}`));
  }
  for (const t of k.tensions) {
    for (const p of t.poles) if (!inVocabulary(POSITIONING_TERRITORIES, p) && !TENSION_EXTRA_POLES.includes(p)) issues.push(`${at}.${t.id}: invalid pole "${p}"`);
    if (t.poles[0] === t.poles[1]) issues.push(`${at}.${t.id}: two distinct poles expected`);
    issues.push(...provenanceIssues(t.provenance, `${at}.${t.id}.provenance`));
  }
  for (const n of k.dataNeeds) if (n.role && !HIERARCHY_ROLES.includes(n.role)) issues.push(`${at}.dataNeeds: invalid role "${n.role}"`);
  return issues;
}
