/**
 * Edify Packaging Intelligence — PI-4, Reference Intelligence: the evidence layer above PI-3. References
 * (who said it), claims (what they said, about which PI-3 knowledge, in which scope and period) and
 * evidence (what they establish in a context). Local, versioned, read-only; nothing in production
 * depends on it (shadow only). See README.md.
 */
export * from "./vocabulary";
export type * from "./types";
export { REFERENCES } from "./sources";
export { CLAIMS } from "./claims";
export {
  REFERENCE_DATASET, assessClaim, contextFromProductIntelligence, getClaimsForCategory, getClaimsForKnowledge, getEvidenceForCategory, getEvidenceForClaim,
  getEvidenceForKnowledge, getReference, getReferenceByLegacyId, getReferencesByJurisdiction, getReferencesByType, getReferencesForCategory, getSupportedKnowledge,
  knowledgeById, sourceQuality, toProvenance, type ReferenceDataset,
} from "./evidence";
export { claimIssues, datasetIssues, duplicateReferences, normalizeText, normalizeUrl, referenceIssues } from "./validate";
export { shadowReferenceEvidence, type ReferenceShadow } from "./shadow";
