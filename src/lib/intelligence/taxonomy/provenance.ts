/**
 * PI-1L — provenance: every knowledge item can say where it comes from. A rule is never presented as
 * research-backed without a real source: "research" and "expert" need a title, "research" a URL too,
 * and no URL is ever made up (the PI-1 archetypes are internal rules and carry none).
 */
import { CONFIDENCE_LEVELS, SOURCE_TYPES, inVocabulary, type Confidence, type SourceType } from "./vocabulary";

export interface Provenance {
  sourceType: SourceType;
  /** Stable id of the source inside Edify ("edify.pi1.archetypes", a catalog id, a user brief id…). */
  sourceId?: string;
  sourceTitle?: string;
  /** Only for a real, published source. */
  sourceUrl?: string;
  /** ISO 8601 date the source was read. */
  retrievedAt?: string;
  confidence: Confidence;
}

/** The PI-1 archetypes: editorial rules written for Edify, not a study. */
export const PI1_ARCHETYPE_SOURCE: Provenance = Object.freeze({
  sourceType: "internalRule",
  sourceId: "edify.pi1.archetypes",
  sourceTitle: "Edify PI-1 product archetypes (internal editorial rules)",
  confidence: "medium",
});

/** What the user said themselves. */
export const userProvenance = (sourceId?: string): Provenance => ({ sourceType: "user", ...(sourceId ? { sourceId } : {}), confidence: "high" });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

/** Structural problems of a provenance record ([] when valid). */
export function provenanceIssues(p: unknown, at = "provenance"): string[] {
  if (!p || typeof p !== "object") return [`${at}: not an object`];
  const o = p as Partial<Provenance>;
  const issues: string[] = [];
  if (!inVocabulary(SOURCE_TYPES, o.sourceType)) issues.push(`${at}.sourceType: invalid "${String(o.sourceType)}"`);
  if (!inVocabulary(CONFIDENCE_LEVELS, o.confidence)) issues.push(`${at}.confidence: invalid "${String(o.confidence)}"`);
  for (const k of ["sourceId", "sourceTitle", "sourceUrl", "retrievedAt"] as const) {
    if (o[k] !== undefined && (typeof o[k] !== "string" || !o[k]!.trim())) issues.push(`${at}.${k}: must be a non-empty string when present`);
  }
  if (o.sourceUrl !== undefined) {
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(String(o.sourceUrl))) issues.push(`${at}.sourceUrl: must be an https URL`);
    if (o.sourceType === "internalRule" || o.sourceType === "ai" || o.sourceType === "unknown") issues.push(`${at}.sourceUrl: a ${o.sourceType} source has no URL`);
    if (o.retrievedAt === undefined) issues.push(`${at}.retrievedAt: required with a sourceUrl`);
  }
  if (o.retrievedAt !== undefined && !ISO_DATE.test(String(o.retrievedAt))) issues.push(`${at}.retrievedAt: must be an ISO 8601 date`);
  if ((o.sourceType === "research" || o.sourceType === "expert" || o.sourceType === "regulatory" || o.sourceType === "market") && !o.sourceTitle) issues.push(`${at}.sourceTitle: required for a ${o.sourceType} source`);
  if (o.sourceType === "regulatory" && !o.sourceId) issues.push(`${at}.sourceId: a regulatory source needs its reference (e.g. a standard number)`);
  if (o.sourceType === "research" && !o.sourceUrl) issues.push(`${at}.sourceUrl: required for a research source`);
  // An AI or an unknown source cannot be highly trusted on its own.
  if ((o.sourceType === "ai" || o.sourceType === "unknown") && o.confidence === "high") issues.push(`${at}.confidence: a ${o.sourceType} source cannot be "high"`);
  return issues;
}

/** Sources that may support a regulatory statement or a sustainability claim. */
export const isAuthoritativeSource = (p: Provenance | undefined) => !!p && (p.sourceType === "user" || p.sourceType === "research" || p.sourceType === "expert" || p.sourceType === "regulatory");
