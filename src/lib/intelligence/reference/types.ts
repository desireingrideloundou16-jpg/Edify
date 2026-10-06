/**
 * PI-4 — references (who said it), claims (what they said, about which PI-3 knowledge, in which scope)
 * and evidence (what the claims establish for a piece of knowledge, in a given context). Three separate
 * objects: a reference supports many claims, a piece of knowledge collects many claims.
 */
import type { Confidence, ProductCategory, Provenance } from "@/lib/intelligence/taxonomy";
import type {
  ClaimRelation, ClaimType, EvidenceKind, EvidenceStatus, Jurisdiction, KnowledgeMaturity, ReferenceDataNeed, ReferenceSourceType, ReferenceStatus, VerificationMethod,
} from "./vocabulary";

export interface Reference {
  /** Stable id ("ref.codex.cxs_1_1985"), never an array index. */
  id: string;
  title: string;
  sourceType: ReferenceSourceType;
  publisher: string;
  /** Publishers of the same family are not independent evidence (FAO, WHO and Codex are one family). */
  sourceFamily: string;
  /** The official identifier, when there is one ("CXS 1-1985"). */
  officialId?: string;
  /** Only a URL that was actually read; never reconstructed. */
  url?: string;
  author?: string;
  /** ISO date or year, only when verified. */
  publicationDate?: string;
  /** Latest revision known and verified (e.g. "2024"). */
  lastRevision?: string;
  jurisdiction: Jurisdiction;
  language?: string;
  /** Where the reference applies, in its own terms; never extrapolated. */
  scope: string;
  status: ReferenceStatus;
  verification: { method: VerificationMethod; checkedAt?: string; note: string };
  validFrom?: string;
  validUntil?: string;
  /** Ids under which earlier layers (PI-1 / PI-3 provenance sourceId) refer to this source. */
  legacyIds?: readonly string[];
}

export interface ReferenceClaim {
  id: string;
  referenceId: string;
  /** PI-3 knowledge item this claim is about (existing id, never a copy), when it is about one. */
  knowledgeId?: string;
  /** PI-3 category entries the claim concerns (e.g. "prepackagedFood", "household"). */
  categoryIds: readonly string[];
  /** PI-1 product categories where the claim holds. */
  productCategories: readonly ProductCategory[];
  claimType: ClaimType;
  relation: ClaimRelation;
  /** A short summary in our words (never a long quotation of the source). */
  claim: string;
  jurisdiction: Jurisdiction;
  evidence: { kind: EvidenceKind; note: string };
  /** The claim's own validity period, when it differs from the reference's. */
  validFrom?: string;
  validUntil?: string;
}

/** The evaluation context: where the product is sold (explicit only) and at which date. */
export interface EvidenceContext {
  jurisdictions?: readonly Jurisdiction[];
  productCategory?: ProductCategory;
  /** ISO date; defaults to the dataset date (deterministic). */
  asOf?: string;
}

export type ClaimApplicability = "inScope" | "international" | "unconfirmed" | "outOfScope" | "outdated" | "notVerified";

export interface AssessedClaim {
  claim: ReferenceClaim;
  reference: Reference;
  applicability: ClaimApplicability;
  /** Quality of this source for this type of claim (PI-1 Confidence levels). */
  quality: Confidence;
  confidence: Confidence;
  provenance: Provenance;
}

export interface SourceConflict {
  between: [string, string];
  /** A real contradiction, or an apparent one explained by scope or time. */
  kind: "conflicting" | "differentScope" | "differentJurisdiction" | "differentPeriod";
  note: string;
}

export interface KnowledgeEvidence {
  knowledgeId: string;
  categoryId: string | null;
  evidenceStatus: EvidenceStatus;
  maturity: KnowledgeMaturity;
  confidence: Confidence;
  /** Independent source families among the usable claims (not the raw number of sources). */
  independentSources: number;
  claims: AssessedClaim[];
  conflicts: SourceConflict[];
  dataNeeds: ReferenceDataNeed[];
  /** "This source indicates…", never "Edify guarantees compliance". */
  disclaimer: string | null;
}
