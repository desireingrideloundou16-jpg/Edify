/**
 * PI-5 — validation of a MasterDesignIntent: structured errors (the intent cannot be trusted as a design
 * decision) and warnings (it can be used, with a stated limitation).
 */
import { CONFIDENCE_LEVELS, POSITIONING_TERRITORIES, inVocabulary } from "@/lib/intelligence/taxonomy";
import { isShotStyle } from "./shot";
import type { IntentValue, MasterDesignIntent } from "./types";
import { INTENT_PRIORITIES, INTENT_SOURCES, INTENT_STATUSES } from "./vocabulary";

export interface IntentIssue { code: string; severity: "error" | "warning"; path: string; message: string }
export interface IntentValidation { valid: boolean; errors: IntentIssue[]; warnings: IntentIssue[] }

const CONF = ["unknown", "low", "medium", "high"];

export function validateMasterDesignIntent(m: MasterDesignIntent): IntentValidation {
  const errors: IntentIssue[] = [], warnings: IntentIssue[] = [];
  const err = (code: string, path: string, message: string) => errors.push({ code, severity: "error", path, message });
  const warn = (code: string, path: string, message: string) => warnings.push({ code, severity: "warning", path, message });

  if (!m.version) err("VERSION_MISSING", "version", "The contract version is required.");
  if (m.product.name.value === "unknown" && m.product.category.value === "unknown" && !m.product.archetypeId) err("PRODUCT_MISSING", "product", "Neither a product name nor a recognised product.");
  if (m.product.name.value === "unknown") warn("PRODUCT_NAME_NOT_PROVIDED", "product.name", "The product name is not provided; it is not invented.");
  if (m.brand.name.value === "unknown") warn("BRAND_NAME_NOT_PROVIDED", "brand.name", "The brand name is not provided; it is not invented.");
  if (!m.brand.personality.length) warn("BRAND_PERSONALITY_NOT_PROVIDED", "brand.personality", "No brand personality given.");
  if (m.product.market.status === "unknown") warn("MARKET_UNKNOWN", "product.market", "No market country: no jurisdiction can be confirmed.");
  for (const [i, p] of m.product.positioning.entries()) if (!inVocabulary(POSITIONING_TERRITORIES, p.value)) err("NOT_NORMALIZED", `product.positioning[${i}]`, `"${p.value}" is not a PI-1 positioning signal.`);
  if (m.unrecognizedStyles.length) warn("UNRECOGNIZED_STYLES", "unrecognizedStyles", `Not understood (ignored, not guessed): ${m.unrecognizedStyles.join(", ")}.`);

  // packaging: the structure is needed downstream, but the resolver asks the user when it cannot tell
  if (!m.packaging.shapeId) warn("PACKAGING_UNDECIDED", "packaging.shapeId", "No packaging decided yet: the resolver will ask the user before rendering.");
  else if (!m.packaging.supported) err("STRUCTURE_UNSUPPORTED", "packaging.shapeId", `"${m.packaging.shapeId}" is not supported by the packaging engine.`);

  // conflicts: each needs a decision and a reason
  for (const [i, c] of m.conflicts.entries()) if (!c.winner || !c.reason || c.values[0] === c.values[1]) err("UNRESOLVED_CONFLICT", `conflicts[${i}]`, "A conflict must state two values, a winner and a reason.");

  // claims: a prohibited claim never active; uncertain / inferred knowledge never presented as validated
  const active = new Set([...m.claims.supported, ...m.claims.required.filter((r) => m.claims.knowledge.some((k) => k.statement === r && k.status === "supported"))]);
  for (const p of m.claims.prohibited) for (const a of active) if (a.toLowerCase().includes(p.toLowerCase())) err("PROHIBITED_CLAIM_ACTIVE", "claims.supported", `"${a}" contains the prohibited claim "${p}".`);
  for (const [i, c] of m.claims.product.entries()) if (c.status === "validated" && c.priority !== "validatedClaim") err("UNVERIFIED_AS_VALIDATED", `claims.product[${i}]`, "Only a substantiated claim is validated.");
  for (const [i, k] of m.claims.knowledge.entries()) {
    if (k.status === "validated") err("UNVERIFIED_AS_VALIDATED", `claims.knowledge[${i}]`, "References support knowledge; they never validate it.");
    if (k.status === "supported" && !k.referenceIds.length) err("UNVERIFIED_AS_VALIDATED", `claims.knowledge[${i}]`, "A supported statement needs an in-scope verified reference.");
    if (k.status === "conflicted") warn("CONFLICTING_EVIDENCE", `claims.knowledge[${i}]`, `Sources disagree on ${k.knowledgeId}.`);
  }

  // references: disabled means no active influence
  if (m.references.mode === "disabled") {
    warn("REFERENCES_DISABLED", "references.mode", "Reference intelligence is disabled: no reference influence.");
    if (m.references.active.length || m.references.influences.length) err("DISABLED_REFERENCE_USED", "references.active", "References are disabled but still influence the intent.");
    if (m.claims.knowledge.some((k) => k.status === "supported")) err("DISABLED_REFERENCE_USED", "claims.knowledge", "A statement is marked supported while references are disabled.");
  }

  // shot: only an existing, canonical style
  const s = m.shotIntent;
  if (s.style !== null && !isShotStyle(s.style)) err("SHOT_STYLE_UNKNOWN", "shotIntent.style", `"${s.style}" is not a SHOT_STYLES id.`);
  if (s.status === "resolved" && !s.style) err("SHOT_STYLE_UNKNOWN", "shotIntent", "A resolved shot intent needs a canonical style.");
  if (s.status === "unresolved") warn("SHOT_UNRESOLVED", "shotIntent", s.rationale);

  // hierarchy: required information present, each role once
  const tiers = [...m.hierarchy.primary, ...m.hierarchy.secondary, ...m.hierarchy.tertiary, ...m.hierarchy.supporting];
  const roles = tiers.map((e) => e.role);
  if (new Set(roles).size !== roles.length) err("HIERARCHY_DUPLICATE", "hierarchy", "A role appears in two tiers.");
  for (const c of m.constraints.mandatory) {
    const role = c.value.replace(/^place lisible réservée: /, "");
    if (!roles.includes(role as never)) err("MANDATORY_INFO_MISSING", "hierarchy", `Required role "${role}" is not in the hierarchy.`);
  }
  if (!m.hierarchy.primary.length) err("HIERARCHY_EMPTY", "hierarchy.primary", "Nothing is designated to be seen first.");

  // provenance and confidence coherence of every decision
  const values: [string, IntentValue<unknown>][] = [
    ...m.product.positioning.map((v, i) => [`product.positioning[${i}]`, v] as [string, IntentValue<unknown>]),
    ...(["style", "mood", "colorDirection", "typographyDirection", "imageryDirection", "compositionDirection"] as const).flatMap((k) => m.visual[k].map((v, i) => [`visual.${k}[${i}]`, v] as [string, IntentValue<unknown>])),
    ...m.claims.product.map((v, i) => [`claims.product[${i}]`, v] as [string, IntentValue<unknown>]),
    ...(["mandatory", "prohibited", "structural", "regulatory"] as const).flatMap((k) => m.constraints[k].map((v, i) => [`constraints.${k}[${i}]`, v] as [string, IntentValue<unknown>])),
    ...m.negativeDirections.map((v, i) => [`negativeDirections[${i}]`, v] as [string, IntentValue<unknown>]),
  ];
  for (const [path, v] of values) {
    if (!inVocabulary(INTENT_SOURCES, v.source) || !inVocabulary(INTENT_PRIORITIES, v.priority) || !inVocabulary(INTENT_STATUSES, v.status) || !v.rationale?.trim()) err("PROVENANCE_MISSING", path, "Every decision states its source, priority, status and rationale.");
    if (!inVocabulary(CONFIDENCE_LEVELS, v.confidence)) err("CONFIDENCE_INCOHERENT", path, "Invalid confidence.");
    if ((v.status === "inferred" || v.status === "uncertain") && v.confidence === "high") err("CONFIDENCE_INCOHERENT", path, "An inferred or uncertain value cannot be highly confident.");
  }
  const sections = Object.values(m.confidence.sections);
  if (m.confidence.overall !== "unknown" && CONF.indexOf(m.confidence.overall) > Math.max(...sections.map((c) => CONF.indexOf(c)))) err("CONFIDENCE_INCOHERENT", "confidence.overall", "Overall confidence above every section.");
  if (!m.provenance.length) err("PROVENANCE_MISSING", "provenance", "No provenance at all.");

  return { valid: errors.length === 0, errors, warnings };
}
