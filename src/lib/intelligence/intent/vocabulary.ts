/**
 * PI-5 — Master Design Intent vocabularies. Reused, never redefined: PI-1 Confidence / Provenance /
 * positioning, PI-2 grammar vocabularies, PI-3 knowledge, PI-4 evidence statuses, the engine's ElementRole
 * and the 3D shot styles (SHOT_STYLES, scenePresets). Only what the intent layer adds lives here.
 */

/** Contract version (stable; bump on a breaking change of MasterDesignIntent). */
export const MASTER_DESIGN_INTENT_VERSION = "PI-5.0";

/**
 * Source priority, highest first. A lower source never overrides a higher one; within one priority the
 * conflict rules apply (see conflicts.ts).
 */
export const INTENT_PRIORITIES = [
  "hardConstraint", "userRequirement", "mandatoryProductInfo", "validatedClaim", "packagingStructure",
  "referenceIntelligence", "brandIdentity", "positioning", "audience", "creativeInference",
] as const;
export type IntentPriority = (typeof INTENT_PRIORITIES)[number];
export const intentPriorityRank = (p: IntentPriority) => INTENT_PRIORITIES.length - INTENT_PRIORITIES.indexOf(p);

/** How a value is known. "inferred" never becomes "validated"; "uncertain" never becomes a fact. */
export const INTENT_STATUSES = ["explicit", "validated", "supported", "inferred", "uncertain", "conflicted", "prohibited"] as const;
export type IntentStatus = (typeof INTENT_STATUSES)[number];

/** Which layer a decision comes from. */
export const INTENT_SOURCES = [
  "user", "brand", "productIntelligence", "designGrammar", "categoryKnowledge", "referenceIntelligence", "packagingResolver", "shotPresets",
] as const;
export type IntentSource = (typeof INTENT_SOURCES)[number];

/** Visual density, for the future 2D engine (never a pixel value). */
export const VISUAL_DENSITIES = ["sparse", "restrained", "balanced", "informationRich", "dense"] as const;
export type VisualDensity = (typeof VISUAL_DENSITIES)[number];

/** Read from PI-2 tone.access (exclusive ↔ accessible). */
export const SOPHISTICATION_LEVELS = ["accessible", "standard", "elevated", "high"] as const;
export type Sophistication = (typeof SOPHISTICATION_LEVELS)[number];

/** Why a picture is taken. An intention only: the camera stays resolveShot's. */
export const SHOT_PURPOSES = ["hero", "ecommerce", "catalog", "social", "presentation", "technical", "detail", "lifestyle"] as const;
export type ShotPurpose = (typeof SHOT_PURPOSES)[number];
