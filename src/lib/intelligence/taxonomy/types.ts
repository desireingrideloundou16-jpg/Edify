/**
 * PI-1N — ProductIntelligence: the canonical, structured understanding of a product before any design.
 *
 *   PRODUCT → PRODUCT CONTEXT → MARKET CONTEXT → PACKAGING REQUIREMENTS → PACKAGING FAMILY
 *           → (existing packagingResolver) SUPPORTED STRUCTURE → DESIGN TERRITORY
 *
 * Every field is optional: absent = not assessed; "unknown" = assessed, undecided. Nothing here names an
 * engine structure: the packaging resolver stays the only authority on supported structures.
 */
import type { Provenance } from "./provenance";
import type { ProductCategory, ProductSubcategory } from "./productTaxonomy";
import type {
  CompetitionLevel, Confidence, DesignSignalKey, DispensingNeed, FlowBehavior, InformationOrigin, Level, MarketRegion, OrUnknown, PackagingMaterial,
  PackagingRequirementKey, PhysicalState, PortionModel, PositioningTerritory, PricePosition, PurchaseContext, RequirementLevel, SemanticPackagingFamily,
  Sensitivity, ShelfImportance, TargetAudience, UsageContext, UsageFrequency, Viscosity,
} from "./vocabulary";

export type PackagingRequirements = Record<PackagingRequirementKey, RequirementLevel>;

/** PI-1J: a semantic direction for PI-2 (Design Grammar), not a rendering instruction. */
export interface DesignSignal {
  primary?: string[];
  secondary?: string[];
  avoid?: string[];
  reason?: string;
}
export type DesignSignals = Partial<Record<DesignSignalKey, DesignSignal>>;

/**
 * PI-1E: design-relevant cultural factors (language, script, conventions, local visual codes). Never a
 * stereotype; a colour association is only recorded with its source.
 */
export interface CultureContext {
  consumptionConventions?: string[];
  categoryConventions?: string[];
  localVisualCodes?: string[];
  colorAssociations?: { color: string; association: string; provenance: Provenance }[];
  /** Religious or customary constraints, only when sourced. */
  constraints?: { text: string; provenance: Provenance }[];
}

export interface LanguageContext {
  /** BCP 47 codes of the languages the label must or may carry ("fr", "en"…). */
  labelLanguages?: string[];
  /** ISO 15924 scripts ("Latn", "Arab"…). */
  scripts?: string[];
  provenance?: Provenance;
}

/** Regulatory facts are "unknown" until a real source supports them. */
export type RegulatoryContext =
  | { status: "unknown" }
  | { status: "sourced"; statements: string[]; provenance: Provenance[] };

/** Fields that can carry their own origin and confidence. */
export type IntelligenceField = Exclude<keyof ProductIntelligence, "confidence" | "origin" | "provenance" | "fieldMeta">;

/** PI-1K: how one field is known. */
export interface FieldAssessment {
  origin: InformationOrigin;
  confidence: Confidence;
  provenance?: Provenance;
}

export interface ProductIntelligence {
  // 1. What the product is
  productCategory?: ProductCategory;
  productSubcategory?: ProductSubcategory;
  /** Free text ("lait en poudre infantile"). */
  productType?: string;
  /** Free text for what no vocabulary foresees. */
  customType?: string;

  // 2. Physical intelligence
  physicalState?: OrUnknown<PhysicalState>;
  viscosity?: OrUnknown<Viscosity>;
  flowBehavior?: OrUnknown<FlowBehavior>;
  sensitivities?: Sensitivity[];
  fragility?: OrUnknown<Level>;
  temperatureSensitivity?: OrUnknown<Level>;

  // 3. How it is used
  usageFrequency?: OrUnknown<UsageFrequency>;
  usageContext?: UsageContext[];
  portionModel?: OrUnknown<PortionModel>;
  dispensingNeed?: DispensingNeed[];
  portability?: OrUnknown<Level>;

  // 4. Who buys it, where
  targetAudience?: TargetAudience[];
  pricePosition?: OrUnknown<PricePosition>;
  purchaseContext?: PurchaseContext[];
  competitionLevel?: OrUnknown<CompetitionLevel>;
  shelfImportance?: OrUnknown<ShelfImportance>;

  // 5. Geography and culture (optional by design)
  marketRegion?: MarketRegion[];
  /** ISO 3166-1 alpha-2 ("CM", "SN"…). */
  marketCountry?: string[];
  cultureContext?: CultureContext;
  languageContext?: LanguageContext;
  regulatoryContext?: RegulatoryContext;

  // 6. What packaging it requires
  packagingRequirements?: Partial<PackagingRequirements>;
  /** Semantic families, most suitable first (never engine structure ids). */
  preferredPackagingFamilies?: SemanticPackagingFamily[];
  preferredMaterials?: PackagingMaterial[];

  // 7. Positioning and visual language
  positioningTerritories?: PositioningTerritory[];
  designSignals?: DesignSignals;

  // Trust
  /** Overall confidence of this description. */
  confidence: Confidence;
  /** Default origin of every field without its own fieldMeta entry. */
  origin: InformationOrigin;
  provenance: Provenance[];
  fieldMeta?: Partial<Record<IntelligenceField, FieldAssessment>>;
}

/** PI-1P: a high-value product archetype of the initial knowledge base. */
export interface ProductArchetype {
  /** camelCase, stable. */
  id: string;
  label: { fr: string; en: string };
  /** Normalised words that name it in a brief (French and English, no accents), most specific first. */
  terms: string[];
  /** Products of the existing catalogue (PRODUCT_INTENTS[].product) this archetype describes, for traceability. */
  catalogueProducts?: string[];
  /** Why the packaging requirements and families follow (the designer's reasoning, in one or two lines). */
  rationale: string;
  intelligence: ProductIntelligence;
}
