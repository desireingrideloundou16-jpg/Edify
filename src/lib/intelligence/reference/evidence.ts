/**
 * PI-4 — evidence and retrieval: what the references establish for a piece of PI-3 knowledge, in a
 * context (where the product is sold, which category, at which date). Local, indexed, deterministic;
 * read-only (no decision, no production effect).
 *
 * Per claim: verified reference? within its period? within the product category? within the
 * jurisdiction (inScope), an international reference (international), or the market is unknown
 * (unconfirmed)? Its confidence is the lowest of: the source's quality for that type of claim, the
 * evidence kind (a secondary summary is never more than "medium"), the scope and the relation.
 *
 * Per piece of knowledge: corroborated = at least two independent source FAMILIES (two pages of the same
 * organisation are one source); supported = one family of high quality; singleSource = one family below
 * that; conflicting = a real contradiction in the same scope and period (an apparent one across
 * jurisdictions or periods is recorded but is not a conflict); otherwise outOfScope, outdated, pending or
 * unsupported. The number of sources alone never makes a claim true.
 */
import { CATEGORY_KNOWLEDGE, type KnowledgeItem } from "@/lib/intelligence/category";
import type { Confidence, ProductIntelligence, Provenance } from "@/lib/intelligence/taxonomy";
import { CLAIMS } from "./claims";
import { REFERENCES } from "./sources";
import type { AssessedClaim, ClaimApplicability, EvidenceContext, KnowledgeEvidence, Reference, ReferenceClaim, SourceConflict } from "./types";
import {
  COUNTRY_JURISDICTIONS, OBSERVATION_CLAIM_TYPES, PROVENANCE_SOURCE_TYPE, REFERENCE_DATASET_DATE, SOURCE_STRENGTH,
  type ClaimType, type EvidenceStatus, type Jurisdiction, type KnowledgeMaturity, type ReferenceDataNeed, type ReferenceSourceType,
} from "./vocabulary";

export interface ReferenceDataset { references: readonly Reference[]; claims: readonly ReferenceClaim[] }
export const REFERENCE_DATASET: ReferenceDataset = Object.freeze({ references: REFERENCES, claims: CLAIMS });

// ─── Indexes (built once per dataset) ────────────────────────────────────────

interface Index {
  ref: Map<string, Reference>;
  legacy: Map<string, Reference>;
  byKnowledge: Map<string, ReferenceClaim[]>;
  byCategory: Map<string, ReferenceClaim[]>;
}
const indexes = new WeakMap<ReferenceDataset, Index>();
function indexOf(ds: ReferenceDataset): Index {
  let ix = indexes.get(ds);
  if (!ix) {
    ix = { ref: new Map(), legacy: new Map(), byKnowledge: new Map(), byCategory: new Map() };
    for (const r of ds.references) {
      ix.ref.set(r.id, r);
      for (const l of r.legacyIds ?? []) ix.legacy.set(l, r);
    }
    const push = (m: Map<string, ReferenceClaim[]>, k: string, c: ReferenceClaim) => m.set(k, [...(m.get(k) ?? []), c]);
    for (const c of ds.claims) {
      if (c.knowledgeId) push(ix.byKnowledge, c.knowledgeId, c);
      for (const cat of c.categoryIds) push(ix.byCategory, cat, c);
    }
    indexes.set(ds, ix);
  }
  return ix;
}

/** PI-3 knowledge by id (the knowledge itself stays in PI-3). */
const KNOWLEDGE = new Map<string, { item: KnowledgeItem; categoryId: string }>(
  CATEGORY_KNOWLEDGE.flatMap((k) => k.items.map((item) => [item.id, { item, categoryId: k.id }] as const)),
);
export const knowledgeById = (id: string) => KNOWLEDGE.get(id);

// ─── Confidence helpers (PI-1 levels) ────────────────────────────────────────

const CONF: readonly Confidence[] = ["unknown", "low", "medium", "high"];
const minConf = (...xs: Confidence[]) => xs.reduce((a, b) => (CONF.indexOf(b) < CONF.indexOf(a) ? b : a), "high" as Confidence);
const maxConf = (xs: Confidence[]) => xs.reduce((a, b) => (CONF.indexOf(b) > CONF.indexOf(a) ? b : a), "unknown" as Confidence);
const raise = (c: Confidence): Confidence => CONF[Math.min(CONF.length - 1, CONF.indexOf(c) + 1)];

/** How strong a type of source is for a type of claim (no source is "always better"). */
export function sourceQuality(type: ReferenceSourceType, claimType: ClaimType): Confidence {
  if (type === "internal" || type === "inferred") return "low";
  const s = SOURCE_STRENGTH[type];
  return s?.high?.includes(claimType) ? "high" : s?.medium?.includes(claimType) ? "medium" : "low";
}

/** The reference as a PI-1 provenance record (one provenance model across PI-1 → PI-4). */
export function toProvenance(r: Reference, confidence: Confidence = "unknown"): Provenance {
  return {
    sourceType: PROVENANCE_SOURCE_TYPE[r.sourceType],
    sourceId: r.id,
    sourceTitle: r.officialId ? `${r.officialId} — ${r.title}` : r.title,
    ...(r.url ? { sourceUrl: r.url, retrievedAt: r.verification.checkedAt } : {}),
    confidence: PROVENANCE_SOURCE_TYPE[r.sourceType] === "internalRule" && confidence === "high" ? "medium" : confidence,
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

/** Jurisdictions only from an explicit country (never from a region or a culture). */
export function contextFromProductIntelligence(pi: ProductIntelligence): EvidenceContext {
  const jurisdictions = [...new Set((pi.marketCountry ?? []).flatMap((c) => COUNTRY_JURISDICTIONS[c] ?? []))];
  return { ...(jurisdictions.length ? { jurisdictions } : {}), ...(pi.productCategory ? { productCategory: pi.productCategory } : {}) };
}

// ─── Claims ──────────────────────────────────────────────────────────────────

const REGULATORY_TYPES: readonly ClaimType[] = ["regulatoryRequirement", "labelingRequirement", "safetySignal", "regulatoryContext"];
const usable = (a: ClaimApplicability) => a === "inScope" || a === "international" || a === "unconfirmed";

export function assessClaim(claim: ReferenceClaim, ctx: EvidenceContext = {}, ds: ReferenceDataset = REFERENCE_DATASET): AssessedClaim {
  const reference = indexOf(ds).ref.get(claim.referenceId);
  if (!reference) throw new Error(`Unknown reference ${claim.referenceId} for ${claim.id}`);
  const asOf = ctx.asOf ?? REFERENCE_DATASET_DATE;
  const until = claim.validUntil ?? reference.validUntil, from = claim.validFrom ?? reference.validFrom;
  const applicability: ClaimApplicability =
    reference.status === "outdated" || reference.status === "archived" || (until !== undefined && until < asOf) ? "outdated"
    : reference.status !== "verified" ? "notVerified"
    : (from !== undefined && from > asOf) || (ctx.productCategory && !claim.productCategories.includes(ctx.productCategory)) ? "outOfScope"
    : claim.jurisdiction === "global" ? "international"
    : !ctx.jurisdictions?.length ? "unconfirmed"
    : ctx.jurisdictions.includes(claim.jurisdiction) ? "inScope" : "outOfScope";
  const quality = sourceQuality(reference.sourceType, claim.claimType);
  const evidenceCap: Confidence = claim.evidence.kind === "secondarySummary" ? "medium" : "high";
  // An international REGULATORY reference applies only where a country adopts it: at most "medium". A
  // non-regulatory claim of worldwide scope (a product property, a consumer expectation) is not capped.
  const regulatory = REGULATORY_TYPES.includes(claim.claimType);
  const scopeCap: Confidence = applicability === "inScope" ? "high" : applicability === "international" ? (regulatory ? "medium" : "high") : applicability === "unconfirmed" ? "low" : "unknown";
  const relationCap: Confidence = claim.relation === "supports" ? "high" : claim.relation === "partiallySupports" ? "medium" : "low";
  const confidence = minConf(quality, evidenceCap, scopeCap, relationCap);
  return { claim, reference, applicability, quality, confidence, provenance: toProvenance(reference, confidence) };
}

function periodsOverlap(a: ReferenceClaim, b: ReferenceClaim) {
  const s = (x: ReferenceClaim) => x.validFrom ?? "0000", e = (x: ReferenceClaim) => x.validUntil ?? "9999";
  return s(a) <= e(b) && s(b) <= e(a);
}

function conflictsOf(assessed: AssessedClaim[]): SourceConflict[] {
  const out: SourceConflict[] = [];
  const contra = assessed.filter((a) => a.claim.relation === "contradicts" && a.reference.status === "verified");
  const pro = assessed.filter((a) => (a.claim.relation === "supports" || a.claim.relation === "partiallySupports") && a.reference.status === "verified");
  for (const c of contra) for (const p of pro) {
    const sameJur = c.claim.jurisdiction === p.claim.jurisdiction || c.claim.jurisdiction === "global" || p.claim.jurisdiction === "global";
    const sameCat = c.claim.productCategories.some((x) => p.claim.productCategories.includes(x));
    const samePeriod = periodsOverlap(c.claim, p.claim) && c.applicability !== "outdated" && p.applicability !== "outdated";
    const kind: SourceConflict["kind"] = !sameJur ? "differentJurisdiction" : !samePeriod ? "differentPeriod" : !sameCat ? "differentScope"
      : usable(c.applicability) && usable(p.applicability) ? "conflicting" : "differentScope";
    out.push({
      between: [p.claim.id, c.claim.id], kind,
      note: kind === "conflicting" ? "Deux sources vérifiées se contredisent dans le même périmètre : l'incertitude est transmise, aucune n'est choisie."
        : `Contradiction apparente expliquée par ${kind === "differentJurisdiction" ? "des juridictions différentes" : kind === "differentPeriod" ? "des périodes différentes" : "des périmètres différents"}.`,
    });
  }
  return out;
}

// ─── Knowledge evidence ──────────────────────────────────────────────────────


export function getEvidenceForKnowledge(knowledgeId: string, ctx: EvidenceContext = {}, ds: ReferenceDataset = REFERENCE_DATASET): KnowledgeEvidence {
  const k = KNOWLEDGE.get(knowledgeId);
  const claims = (indexOf(ds).byKnowledge.get(knowledgeId) ?? []).map((c) => assessClaim(c, ctx, ds));
  const support = claims.filter((a) => usable(a.applicability) && (a.claim.relation === "supports" || a.claim.relation === "partiallySupports"));
  const conflicts = conflictsOf(claims);
  // A claim whose jurisdiction cannot be confirmed (market unknown) is reported, never counted as corroboration.
  const confirmed = support.filter((a) => a.applicability !== "unconfirmed");
  const families = new Set(confirmed.map((a) => a.reference.sourceFamily));
  const best = maxConf(support.map((a) => a.confidence));

  const status: EvidenceStatus = conflicts.some((c) => c.kind === "conflicting") ? "conflicting"
    : support.length ? (families.size >= 2 ? "corroborated" : best === "high" && families.size === 1 ? "supported" : "singleSource")
    : claims.some((a) => a.applicability === "outOfScope") ? "outOfScope"
    : claims.some((a) => a.applicability === "outdated") ? "outdated"
    : claims.some((a) => a.applicability === "notVerified") ? "pending"
    : "unsupported";

  // corroboration raises confidence one step only when two independent families are each at least "medium"
  // ... and only when at least one of them is in scope for this market (an international reference alone is not)
  const strongFamilies = new Set(confirmed.filter((a) => CONF.indexOf(a.confidence) >= CONF.indexOf("medium")).map((a) => a.reference.sourceFamily));
  const confidence: Confidence = status === "conflicting" ? "low" : !support.length ? "unknown"
    : status === "corroborated" && strongFamilies.size >= 2 && confirmed.some((a) => a.applicability === "inScope") ? raise(best) : best;

  const maturity: KnowledgeMaturity = status === "conflicting" ? "observed"
    : support.length ? (support.every((a) => OBSERVATION_CLAIM_TYPES.includes(a.claim.claimType)) ? "observed" : status === "corroborated" ? "stronglySupported" : "supported")
    : k?.item.basis === "inferred" ? "inferred" : "internal";

  const needs = new Set<ReferenceDataNeed>();
  const regulatory = claims.filter((a) => REGULATORY_TYPES.includes(a.claim.claimType));
  if (regulatory.length && !ctx.jurisdictions?.length) needs.add("missingJurisdiction");
  if (regulatory.length && ctx.jurisdictions?.length && !regulatory.some((a) => a.applicability === "inScope")) needs.add("missingRegulatoryContext");
  if (claims.some((a) => a.applicability === "notVerified")) needs.add("pendingVerification");
  if (claims.some((a) => a.applicability === "outdated")) needs.add("outdatedReference");
  if (status === "conflicting") needs.add("conflictingSources");
  if (status === "unsupported" || status === "pending") needs.add("insufficientEvidence");
  if (claims.some((a) => OBSERVATION_CLAIM_TYPES.includes(a.claim.claimType)) && !ctx.jurisdictions?.length) needs.add("missingMarket");

  return {
    knowledgeId,
    categoryId: k?.categoryId ?? null,
    evidenceStatus: status,
    maturity,
    confidence,
    independentSources: families.size,
    claims,
    conflicts,
    dataNeeds: [...needs],
    disclaimer: support.some((a) => REGULATORY_TYPES.includes(a.claim.claimType))
      ? "Ces sources indiquent des exigences dans leur périmètre et leur juridiction ; ce n'est ni un avis juridique ni une garantie de conformité."
      : null,
  };
}

// ─── Retrieval API (internal, local) ─────────────────────────────────────────

export const getReference = (id: string, ds: ReferenceDataset = REFERENCE_DATASET) => indexOf(ds).ref.get(id);
/** The reference an earlier layer cites by its old id (PI-1 / PI-3 provenance sourceId). */
export const getReferenceByLegacyId = (legacyId: string, ds: ReferenceDataset = REFERENCE_DATASET) => indexOf(ds).legacy.get(legacyId);
export const getClaimsForKnowledge = (knowledgeId: string, ds: ReferenceDataset = REFERENCE_DATASET) => [...(indexOf(ds).byKnowledge.get(knowledgeId) ?? [])];
export const getClaimsForCategory = (categoryId: string, ds: ReferenceDataset = REFERENCE_DATASET) => [...(indexOf(ds).byCategory.get(categoryId) ?? [])];
export function getReferencesForCategory(categoryId: string, ds: ReferenceDataset = REFERENCE_DATASET): Reference[] {
  const ix = indexOf(ds);
  return [...new Set((ix.byCategory.get(categoryId) ?? []).map((c) => c.referenceId))].map((id) => ix.ref.get(id)!);
}
export const getReferencesByType = (type: ReferenceSourceType, ds: ReferenceDataset = REFERENCE_DATASET) => ds.references.filter((r) => r.sourceType === type);
export const getReferencesByJurisdiction = (j: Jurisdiction, ds: ReferenceDataset = REFERENCE_DATASET) => ds.references.filter((r) => r.jurisdiction === j);
export function getEvidenceForClaim(claimId: string, ctx: EvidenceContext = {}, ds: ReferenceDataset = REFERENCE_DATASET): AssessedClaim | undefined {
  const c = ds.claims.find((x) => x.id === claimId);
  return c && assessClaim(c, ctx, ds);
}

/** Every PI-3 item of a category entry with its evidence, plus the claims about the category as a whole. */
export function getEvidenceForCategory(categoryId: string, ctx: EvidenceContext = {}, ds: ReferenceDataset = REFERENCE_DATASET) {
  const entry = CATEGORY_KNOWLEDGE.find((k) => k.id === categoryId);
  return {
    categoryId,
    items: (entry?.items ?? []).map((it) => getEvidenceForKnowledge(it.id, ctx, ds)),
    categoryClaims: getClaimsForCategory(categoryId, ds).filter((c) => !c.knowledgeId).map((c) => assessClaim(c, ctx, ds)),
  };
}

/** PI-3 knowledge ids that verified, in-scope references support in this context. */
export function getSupportedKnowledge(ctx: EvidenceContext = {}, ds: ReferenceDataset = REFERENCE_DATASET): string[] {
  return [...indexOf(ds).byKnowledge.keys()].filter((id) => ["supported", "corroborated", "singleSource"].includes(getEvidenceForKnowledge(id, ctx, ds).evidenceStatus)).sort();
}
