/**
 * PI-1 — controlled vocabularies of Edify Packaging Intelligence. Every closed list the knowledge layer
 * uses lives here, as a frozen array (for runtime validation) and its literal type (for the compiler).
 * Pure data: no network, no AI, client- and server-safe.
 *
 * "unknown" is a valid answer everywhere: a field that is absent was not assessed, a field set to
 * "unknown" was assessed and could not be decided. Neither is ever filled with a guess.
 */

/** Adds "unknown" to a vocabulary value. */
export type OrUnknown<T> = T | "unknown";
export const UNKNOWN = "unknown" as const;

// ─── PI-1B Physical ──────────────────────────────────────────────────────────

export const PHYSICAL_STATES = ["liquid", "viscous", "cream", "gel", "paste", "powder", "granules", "solid", "tablet", "capsule", "semiSolid", "frozen", "gasAerosol", "mixed"] as const;
export type PhysicalState = (typeof PHYSICAL_STATES)[number];

export const VISCOSITIES = ["none", "low", "medium", "high"] as const;
export type Viscosity = (typeof VISCOSITIES)[number];

export const FLOW_BEHAVIORS = ["freeFlowing", "pourable", "squeezable", "scoopable", "spreadable", "pumpable", "sprayable", "nonFlowing"] as const;
export type FlowBehavior = (typeof FLOW_BEHAVIORS)[number];

export const SENSITIVITIES = ["light", "oxygen", "moisture", "heat", "contamination", "impact", "leakage", "oxidation"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

/** Shared by fragility, temperature sensitivity and portability. */
export const LEVELS = ["low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

// ─── PI-1C Usage ─────────────────────────────────────────────────────────────

export const USAGE_FREQUENCIES = ["occasional", "daily", "multipleDaily", "professional"] as const;
export type UsageFrequency = (typeof USAGE_FREQUENCIES)[number];

export const USAGE_CONTEXTS = ["home", "office", "travel", "gym", "restaurant", "hospitality", "professional", "medical", "outdoor"] as const;
export type UsageContext = (typeof USAGE_CONTEXTS)[number];

export const PORTION_MODELS = ["singleServe", "multiServe", "refill", "bulk"] as const;
export type PortionModel = (typeof PORTION_MODELS)[number];

export const DISPENSING_NEEDS = ["none", "pour", "scoop", "pump", "spray", "squeeze", "dropper", "spoon", "flipCap", "screwCap", "other"] as const;
export type DispensingNeed = (typeof DISPENSING_NEEDS)[number];

// ─── PI-1D Market ────────────────────────────────────────────────────────────

export const TARGET_AUDIENCES = ["massMarket", "budget", "middleMarket", "premium", "luxury", "professional", "children", "family", "athletes", "beautyConsumers", "healthConsumers", "environmentallyConscious", "culturallyFocused", "other"] as const;
export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

export const PRICE_POSITIONS = ["entry", "value", "mid", "premium", "luxury"] as const;
export type PricePosition = (typeof PRICE_POSITIONS)[number];

export const PURCHASE_CONTEXTS = ["supermarket", "convenience", "pharmacy", "beautyStore", "specialtyStore", "ecommerce", "restaurant", "hotel", "directToConsumer", "professionalDistribution"] as const;
export type PurchaseContext = (typeof PURCHASE_CONTEXTS)[number];

export const COMPETITION_LEVELS = ["low", "medium", "high", "saturated"] as const;
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];

export const SHELF_IMPORTANCES = ["low", "medium", "high", "critical"] as const;
export type ShelfImportance = (typeof SHELF_IMPORTANCES)[number];

// ─── PI-1E Geography ─────────────────────────────────────────────────────────

export const MARKET_REGIONS = ["CentralAfrica", "WestAfrica", "EastAfrica", "SouthernAfrica", "NorthAfrica", "Europe", "NorthAmerica", "LatinAmerica", "MiddleEast", "Asia", "Oceania", "Global"] as const;
export type MarketRegion = (typeof MARKET_REGIONS)[number];

// ─── PI-1F Packaging requirements ────────────────────────────────────────────

export const REQUIREMENT_LEVELS = ["required", "preferred", "notRelevant", "unknown"] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const PACKAGING_REQUIREMENT_KEYS = [
  "needsBarrierProtection", "needsLightProtection", "needsMoistureProtection", "needsLeakProtection", "needsResealability", "needsPortionControl",
  "needsTamperEvidence", "needsChildResistance", "needsDispensing", "needsVisibility", "needsTransparency", "needsStackability", "needsPortability",
  "needsPremiumPresentation", "needsShelfImpact", "needsShippingProtection",
] as const;
export type PackagingRequirementKey = (typeof PACKAGING_REQUIREMENT_KEYS)[number];

/**
 * Requirements that are (or may be) set by law. They stay "unknown" unless a field-level provenance from
 * the user, research or an expert supports them: Edify never invents a regulatory obligation.
 */
export const REGULATORY_REQUIREMENT_KEYS: readonly PackagingRequirementKey[] = ["needsTamperEvidence", "needsChildResistance"];

// ─── PI-1G Semantic packaging families ───────────────────────────────────────

/**
 * What a designer calls a pack. NOT one of the 119 engine structures: it is mapped to the resolver's
 * human families by resolverAdapter.ts, and the resolver alone picks a supported structure.
 * "box" = folding or rigid box; "carton" = liquid carton (brick, gable top).
 */
export const SEMANTIC_PACKAGING_FAMILIES = ["bottle", "jar", "tube", "pouch", "sachet", "box", "carton", "can", "tin", "tub", "cup", "tray", "bag", "envelope", "blister", "sleeve", "wrapper", "stick", "ampoule", "dropper", "spray", "pump", "other"] as const;
export type SemanticPackagingFamily = (typeof SEMANTIC_PACKAGING_FAMILIES)[number];

// ─── PI-1H Materials ─────────────────────────────────────────────────────────

export const PACKAGING_MATERIALS = ["glass", "PET", "HDPE", "PP", "aluminum", "steel", "paper", "carton", "kraft", "flexibleFilm", "metallizedFilm", "composite", "biodegradableMaterial", "other"] as const;
export type PackagingMaterial = (typeof PACKAGING_MATERIALS)[number];

export const TRANSPARENCIES = ["opaque", "translucent", "transparent", "variable"] as const;
export type Transparency = (typeof TRANSPARENCIES)[number];

/** A recyclability claim is never inferred from a material: only a sourced claim is allowed. */
export const RECYCLABILITY_CLAIMS = ["notClaimed", "claimedBySource"] as const;
export type RecyclabilityClaim = (typeof RECYCLABILITY_CLAIMS)[number];

// ─── PI-1I Positioning ───────────────────────────────────────────────────────

/** Positioning signals, not styles: several coexist (natural + premium + modern). */
export const POSITIONING_TERRITORIES = [
  "clinical", "scientific", "natural", "organic", "artisanal", "traditional", "modern", "minimalist", "premium", "luxury", "playful", "youthful",
  "masculine", "feminine", "neutral", "technical", "industrial", "sustainable", "cultural", "heritage", "bold", "energetic", "elegant",
  "sophisticated", "accessible",
] as const;
export type PositioningTerritory = (typeof POSITIONING_TERRITORIES)[number];

// ─── PI-1J Design signals ────────────────────────────────────────────────────

export const DESIGN_SIGNAL_KEYS = ["typographyDirection", "colorDirection", "imageryDirection", "compositionDirection", "materialDirection", "finishDirection", "illustrationDirection", "photographyDirection"] as const;
export type DesignSignalKey = (typeof DESIGN_SIGNAL_KEYS)[number];

// ─── PI-1K / PI-1L Confidence and provenance ─────────────────────────────────

export const CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/** Where a value comes from, as shown to the user: inferred values are never presented as facts. */
export const INFORMATION_ORIGINS = ["userProvided", "inferred", "catalogue", "ruleBased", "aiGenerated", "unknown"] as const;
export type InformationOrigin = (typeof INFORMATION_ORIGINS)[number];

/** "regulatory": a law or standard (identified by its reference); "market": an observed market fact with a named source (PI-3). */
export const SOURCE_TYPES = ["user", "catalogue", "internalRule", "research", "expert", "regulatory", "market", "ai", "unknown"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Is a value part of a vocabulary (runtime check for data that comes from JSON, a user or an AI)? */
export const inVocabulary = <T extends string>(vocab: readonly T[], v: unknown): v is T => typeof v === "string" && (vocab as readonly string[]).includes(v);
export const inVocabularyOrUnknown = <T extends string>(vocab: readonly T[], v: unknown): v is OrUnknown<T> => v === UNKNOWN || inVocabulary(vocab, v);
