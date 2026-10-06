/**
 * Runtime validation of ProductIntelligence: every value must belong to its controlled vocabulary, every
 * provenance must be well formed, and nothing regulatory may be asserted without an authoritative source.
 * Used by the tests and, later, on data that comes from a user, a JSON file or an AI.
 */
import { isProductCategory, isSubcategoryOf } from "./productTaxonomy";
import { isAuthoritativeSource, provenanceIssues } from "./provenance";
import type { IntelligenceField, ProductArchetype, ProductIntelligence } from "./types";
import {
  COMPETITION_LEVELS, CONFIDENCE_LEVELS, DESIGN_SIGNAL_KEYS, DISPENSING_NEEDS, FLOW_BEHAVIORS, INFORMATION_ORIGINS, LEVELS, MARKET_REGIONS, PACKAGING_MATERIALS,
  PACKAGING_REQUIREMENT_KEYS, PHYSICAL_STATES, PORTION_MODELS, POSITIONING_TERRITORIES, PRICE_POSITIONS, PURCHASE_CONTEXTS, REGULATORY_REQUIREMENT_KEYS,
  REQUIREMENT_LEVELS, SEMANTIC_PACKAGING_FAMILIES, SENSITIVITIES, SHELF_IMPORTANCES, TARGET_AUDIENCES, USAGE_CONTEXTS, USAGE_FREQUENCIES, VISCOSITIES,
  inVocabulary, inVocabularyOrUnknown,
} from "./vocabulary";

/** Single-valued fields (value or "unknown"). */
const SCALARS: [IntelligenceField, readonly string[]][] = [
  ["physicalState", PHYSICAL_STATES], ["viscosity", VISCOSITIES], ["flowBehavior", FLOW_BEHAVIORS], ["fragility", LEVELS], ["temperatureSensitivity", LEVELS],
  ["usageFrequency", USAGE_FREQUENCIES], ["portionModel", PORTION_MODELS], ["portability", LEVELS], ["pricePosition", PRICE_POSITIONS],
  ["competitionLevel", COMPETITION_LEVELS], ["shelfImportance", SHELF_IMPORTANCES],
];
/** Multi-valued fields (lists, no duplicates). */
const LISTS: [IntelligenceField, readonly string[]][] = [
  ["sensitivities", SENSITIVITIES], ["usageContext", USAGE_CONTEXTS], ["dispensingNeed", DISPENSING_NEEDS], ["targetAudience", TARGET_AUDIENCES],
  ["purchaseContext", PURCHASE_CONTEXTS], ["marketRegion", MARKET_REGIONS], ["preferredPackagingFamilies", SEMANTIC_PACKAGING_FAMILIES],
  ["preferredMaterials", PACKAGING_MATERIALS], ["positioningTerritories", POSITIONING_TERRITORIES],
];

export const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  "productCategory", "productSubcategory", "productType", "customType", ...SCALARS.map(([k]) => k), ...LISTS.map(([k]) => k),
  "marketCountry", "cultureContext", "languageContext", "regulatoryContext", "packagingRequirements", "designSignals",
  "confidence", "origin", "provenance", "fieldMeta",
]);

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim().length > 0);

export function productIntelligenceIssues(pi: ProductIntelligence, at = "intelligence"): string[] {
  const issues: string[] = [];
  const o = pi as unknown as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KNOWN_FIELDS.has(k)) issues.push(`${at}.${k}: unknown field`);

  // What it is
  if (pi.productCategory !== undefined) {
    if (!isProductCategory(pi.productCategory)) issues.push(`${at}.productCategory: invalid "${String(pi.productCategory)}"`);
    else if (pi.productSubcategory !== undefined && !isSubcategoryOf(pi.productCategory, pi.productSubcategory)) issues.push(`${at}.productSubcategory: "${String(pi.productSubcategory)}" is not in ${pi.productCategory}`);
  } else if (pi.productSubcategory !== undefined) issues.push(`${at}.productSubcategory: needs a productCategory`);
  for (const k of ["productType", "customType"] as const) if (pi[k] !== undefined && (typeof pi[k] !== "string" || !pi[k]!.trim())) issues.push(`${at}.${k}: must be non-empty text`);

  for (const [k, vocab] of SCALARS) if (o[k] !== undefined && !inVocabularyOrUnknown(vocab, o[k])) issues.push(`${at}.${k}: invalid "${String(o[k])}"`);
  for (const [k, vocab] of LISTS) {
    const v = o[k];
    if (v === undefined) continue;
    if (!Array.isArray(v)) { issues.push(`${at}.${k}: must be a list`); continue; }
    for (const x of v) if (!inVocabulary(vocab, x)) issues.push(`${at}.${k}: invalid "${String(x)}"`);
    if (new Set(v).size !== v.length) issues.push(`${at}.${k}: duplicate values`);
  }
  if (pi.marketCountry !== undefined && !(isStringList(pi.marketCountry) && pi.marketCountry.every((c) => /^[A-Z]{2}$/.test(c)))) issues.push(`${at}.marketCountry: ISO 3166-1 alpha-2 codes expected`);

  // Requirements: closed keys and levels; regulatory ones need an authoritative source.
  if (pi.packagingRequirements !== undefined) {
    for (const [k, v] of Object.entries(pi.packagingRequirements)) {
      if (!inVocabulary(PACKAGING_REQUIREMENT_KEYS, k)) { issues.push(`${at}.packagingRequirements.${k}: unknown requirement`); continue; }
      if (!inVocabulary(REQUIREMENT_LEVELS, v)) issues.push(`${at}.packagingRequirements.${k}: invalid "${String(v)}"`);
      if (REGULATORY_REQUIREMENT_KEYS.includes(k) && v !== "unknown" && !isAuthoritativeSource(pi.fieldMeta?.packagingRequirements?.provenance)) {
        issues.push(`${at}.packagingRequirements.${k}: regulatory requirement "${v}" without a user, research or expert source`);
      }
    }
  }

  // Culture, language, regulation
  const cc = pi.cultureContext;
  if (cc) {
    for (const k of ["consumptionConventions", "categoryConventions", "localVisualCodes"] as const) if (cc[k] !== undefined && !isStringList(cc[k])) issues.push(`${at}.cultureContext.${k}: list of text expected`);
    cc.colorAssociations?.forEach((c, i) => issues.push(...provenanceIssues(c.provenance, `${at}.cultureContext.colorAssociations[${i}].provenance`)));
    cc.constraints?.forEach((c, i) => {
      if (!isAuthoritativeSource(c.provenance)) issues.push(`${at}.cultureContext.constraints[${i}]: needs a user, research or expert source`);
      issues.push(...provenanceIssues(c.provenance, `${at}.cultureContext.constraints[${i}].provenance`));
    });
  }
  const lc = pi.languageContext;
  if (lc) {
    if (lc.labelLanguages !== undefined && !(isStringList(lc.labelLanguages) && lc.labelLanguages.every((l) => /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l)))) issues.push(`${at}.languageContext.labelLanguages: BCP 47 codes expected`);
    if (lc.scripts !== undefined && !(isStringList(lc.scripts) && lc.scripts.every((s) => /^[A-Z][a-z]{3}$/.test(s)))) issues.push(`${at}.languageContext.scripts: ISO 15924 codes expected`);
    if (lc.provenance) issues.push(...provenanceIssues(lc.provenance, `${at}.languageContext.provenance`));
  }
  const rc = pi.regulatoryContext;
  if (rc && rc.status !== "unknown") {
    if (rc.status !== "sourced" || !isStringList(rc.statements) || !rc.statements.length) issues.push(`${at}.regulatoryContext: "sourced" needs statements`);
    else if (!rc.provenance?.length || !rc.provenance.every(isAuthoritativeSource)) issues.push(`${at}.regulatoryContext: every statement source must be user, research or expert`);
    rc.provenance?.forEach((p, i) => issues.push(...provenanceIssues(p, `${at}.regulatoryContext.provenance[${i}]`)));
  }

  // Design signals
  if (pi.designSignals) {
    for (const [k, s] of Object.entries(pi.designSignals)) {
      if (!inVocabulary(DESIGN_SIGNAL_KEYS, k)) { issues.push(`${at}.designSignals.${k}: unknown signal`); continue; }
      for (const part of ["primary", "secondary", "avoid"] as const) if (s?.[part] !== undefined && !isStringList(s[part])) issues.push(`${at}.designSignals.${k}.${part}: list of text expected`);
      if (s?.reason !== undefined && (typeof s.reason !== "string" || !s.reason.trim())) issues.push(`${at}.designSignals.${k}.reason: text expected`);
    }
  }

  // Trust
  if (!inVocabulary(CONFIDENCE_LEVELS, pi.confidence)) issues.push(`${at}.confidence: invalid "${String(pi.confidence)}"`);
  if (!inVocabulary(INFORMATION_ORIGINS, pi.origin)) issues.push(`${at}.origin: invalid "${String(pi.origin)}"`);
  if (!Array.isArray(pi.provenance)) issues.push(`${at}.provenance: list expected`);
  else pi.provenance.forEach((p, i) => issues.push(...provenanceIssues(p, `${at}.provenance[${i}]`)));
  if (pi.origin === "inferred" || pi.origin === "aiGenerated") {
    if (pi.confidence === "high") issues.push(`${at}.confidence: ${pi.origin} information cannot be "high" overall`);
  }
  for (const [k, m] of Object.entries(pi.fieldMeta ?? {})) {
    if (!KNOWN_FIELDS.has(k) || ["confidence", "origin", "provenance", "fieldMeta"].includes(k)) { issues.push(`${at}.fieldMeta.${k}: not an assessable field`); continue; }
    if (!inVocabulary(INFORMATION_ORIGINS, m?.origin)) issues.push(`${at}.fieldMeta.${k}.origin: invalid "${String(m?.origin)}"`);
    if (!inVocabulary(CONFIDENCE_LEVELS, m?.confidence)) issues.push(`${at}.fieldMeta.${k}.confidence: invalid "${String(m?.confidence)}"`);
    if (m?.provenance) issues.push(...provenanceIssues(m.provenance, `${at}.fieldMeta.${k}.provenance`));
  }
  return issues;
}

export function archetypeIssues(a: ProductArchetype): string[] {
  const at = `archetype(${a.id})`;
  const issues: string[] = [];
  if (!/^[a-z][A-Za-z0-9]*$/.test(a.id)) issues.push(`${at}.id: camelCase expected`);
  if (!a.label?.fr?.trim() || !a.label?.en?.trim()) issues.push(`${at}.label: fr and en required`);
  if (!a.rationale?.trim()) issues.push(`${at}.rationale: required`);
  if (!a.terms.length) issues.push(`${at}.terms: at least one`);
  for (const t of a.terms) if (t !== t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()) issues.push(`${at}.terms: "${t}" must be normalised (lowercase, no accents)`);
  if (!a.intelligence.productCategory) issues.push(`${at}: productCategory required`);
  if (!a.intelligence.preferredPackagingFamilies?.length) issues.push(`${at}: at least one preferred packaging family`);
  issues.push(...productIntelligenceIssues(a.intelligence, at));
  return issues;
}
