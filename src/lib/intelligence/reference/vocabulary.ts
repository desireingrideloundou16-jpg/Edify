/**
 * PI-4 — Reference Intelligence vocabularies. Reused from PI-1: Confidence (high / medium / low /
 * unknown, also used as source quality), ProductCategory, Provenance and its SourceType. Only what the
 * evidence layer adds is defined here.
 */
import type { SourceType } from "@/lib/intelligence/taxonomy";

/** Version of the local, versioned reference dataset (no external mutable database). */
export const REFERENCE_DATASET_VERSION = "pi4-2026.10.06";
/** The date the dataset is evaluated at (deterministic: never the clock). */
export const REFERENCE_DATASET_DATE = "2026-10-06";

/** What kind of publisher a reference is. No type is "always better": quality depends on the claim. */
export const REFERENCE_SOURCE_TYPES = [
  "regulatory", "governmental", "institutional", "academic", "scientific", "professional", "industry", "market", "retailer",
  "packagingBenchmark", "brandObservation", "expert", "internal", "inferred",
] as const;
export type ReferenceSourceType = (typeof REFERENCE_SOURCE_TYPES)[number];

/**
 * The PI-1 provenance source type each reference type maps to (one provenance model). PI-1 "research"
 * stands for a published, citable, non-regulatory document (institutional, governmental guidance,
 * academic); "regulatory" for a law or standard; "market" for an observation of the market.
 */
export const PROVENANCE_SOURCE_TYPE: Readonly<Record<ReferenceSourceType, SourceType>> = {
  regulatory: "regulatory", governmental: "research", institutional: "research", academic: "research", scientific: "research",
  professional: "expert", industry: "expert", expert: "expert", market: "market", retailer: "market", packagingBenchmark: "market",
  brandObservation: "market", internal: "internalRule", inferred: "internalRule",
};

/** Only "verified" references may support knowledge; "pendingVerification" is never presented as certain. */
export const REFERENCE_STATUSES = ["verified", "pendingVerification", "archived", "outdated", "inaccessible", "rejected"] as const;
export type ReferenceStatus = (typeof REFERENCE_STATUSES)[number];

/** How a reference was checked. "verified" requires an official page actually read. */
export const VERIFICATION_METHODS = ["officialPageRead", "searchSummaryOnly", "notVerified"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

/** What the evidence of a claim is: the primary text, an official summary by the issuer, or a secondary summary. */
export const EVIDENCE_KINDS = ["primaryText", "officialSummary", "secondarySummary"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const CLAIM_TYPES = [
  "regulatoryRequirement", "labelingRequirement", "safetySignal", "trustSignal", "categoryConvention", "informationPriority", "marketObservation",
  "shelfObservation", "differentiationObservation", "consumerExpectation", "packagingPractice", "materialExpectation", "visualConvention",
  "terminology", "productCharacteristic", "regulatoryContext",
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

/** How a claim relates to the PI-3 knowledge it is attached to. */
export const CLAIM_RELATIONS = ["supports", "partiallySupports", "contextualizes", "contradicts"] as const;
export type ClaimRelation = (typeof CLAIM_RELATIONS)[number];

/** Explicit legal / market areas. Never inferred from culture or region. */
export const JURISDICTIONS = ["global", "EU", "Belgium", "France", "Cameroon", "CEMAC", "US"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

/** Countries (ISO 3166-1 alpha-2, as in PI-1 marketCountry) → the jurisdictions that certainly cover them. */
export const COUNTRY_JURISDICTIONS: Readonly<Record<string, readonly Jurisdiction[]>> = {
  CM: ["Cameroon", "CEMAC"], BE: ["Belgium", "EU"], FR: ["France", "EU"], US: ["US"],
};

export const EVIDENCE_STATUSES = ["unsupported", "pending", "singleSource", "supported", "corroborated", "conflicting", "outdated", "outOfScope"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** Knowledge maturity, derived (never scored by hand): internal → inferred → observed → supported → stronglySupported. */
export const KNOWLEDGE_MATURITIES = ["inferred", "internal", "observed", "supported", "stronglySupported"] as const;
export type KnowledgeMaturity = (typeof KNOWLEDGE_MATURITIES)[number];

export const REFERENCE_DATA_NEEDS = [
  "missingJurisdiction", "missingMarket", "missingProductSubtype", "missingRegulatoryContext", "pendingVerification", "outdatedReference",
  "conflictingSources", "insufficientEvidence",
] as const;
export type ReferenceDataNeed = (typeof REFERENCE_DATA_NEEDS)[number];

/** Claim types for which a source type is strong, medium or weak (anything unlisted: low). */
export const SOURCE_STRENGTH: Readonly<Partial<Record<ReferenceSourceType, { high?: readonly ClaimType[]; medium?: readonly ClaimType[] }>>> = {
  regulatory: { high: ["regulatoryRequirement", "labelingRequirement", "safetySignal", "regulatoryContext", "terminology"] },
  governmental: { high: ["regulatoryContext"], medium: ["regulatoryRequirement", "labelingRequirement", "safetySignal"] },
  institutional: { high: ["regulatoryContext"], medium: ["labelingRequirement", "safetySignal", "terminology", "productCharacteristic"] },
  academic: { high: ["productCharacteristic", "safetySignal", "consumerExpectation"], medium: ["shelfObservation", "visualConvention", "packagingPractice"] },
  scientific: { high: ["productCharacteristic", "safetySignal"], medium: ["consumerExpectation"] },
  professional: { medium: ["packagingPractice", "visualConvention", "categoryConvention", "informationPriority", "materialExpectation", "terminology"] },
  industry: { medium: ["packagingPractice", "materialExpectation", "categoryConvention", "terminology"] },
  expert: { medium: ["categoryConvention", "packagingPractice", "visualConvention", "informationPriority", "trustSignal", "differentiationObservation"] },
  market: { medium: ["marketObservation", "shelfObservation", "differentiationObservation"] },
  retailer: { medium: ["shelfObservation", "marketObservation"] },
  packagingBenchmark: { medium: ["visualConvention", "differentiationObservation", "shelfObservation", "categoryConvention"] },
  brandObservation: { medium: ["visualConvention", "differentiationObservation"] },
};

/** Claim types that only observe (never a rule): the maturity they give is "observed". */
export const OBSERVATION_CLAIM_TYPES: readonly ClaimType[] = ["marketObservation", "shelfObservation", "differentiationObservation", "visualConvention"];
