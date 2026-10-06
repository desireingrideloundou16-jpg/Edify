/**
 * PI-5 — MasterDesignIntent: the structured visual decision of Edify for one product — what the design
 * must communicate and how it is oriented — built from PI-1 (product), PI-2 (grammar), PI-3 (category),
 * PI-4 (references), the packaging resolver (structure) and the user's explicit intent.
 *
 * Structured first: every decision carries WHAT (value), WHY (rationale), SOURCE, CONFIDENCE (PI-1
 * levels), PRIORITY and STATUS. The text brief is derived from it, never the source of truth. It is not a
 * renderer, a camera, a layout engine or a structure resolver: it hands a shot STYLE to resolveShot and
 * directions to the future 2D engine.
 */
import type { ElementRole } from "@/lib/structure";
import type { CurrentDesign } from "@/lib/ai/designSpec";
import type { PackagingFamily } from "@/lib/catalog/packagingResolver";
import type { ShotStyleId } from "@/lib/three/scenePresets";
import type { Confidence, PositioningTerritory, Provenance } from "@/lib/intelligence/taxonomy";
import type { BrandTrait, DesignDirectives } from "@/lib/intelligence/grammar";
import type { EvidenceStatus, Jurisdiction } from "@/lib/intelligence/reference";
import type { IntentPriority, IntentSource, IntentStatus, ShotPurpose, Sophistication, VisualDensity } from "./vocabulary";

// ─── Input ───────────────────────────────────────────────────────────────────

/** A product claim the brand wants on the pack. */
export interface ClaimInput {
  text: string;
  /** The brand states it holds the proof (a certificate, a test). Only then can a claim be "validated". */
  substantiated?: boolean;
}

export interface MasterDesignIntentInput {
  /** The user's brief (free text): read by PI-1 / PI-2, never copied into the output. */
  brief: string;
  /** Texts the user already gave (reuses the designer's CurrentDesign fields). */
  content?: Partial<Pick<CurrentDesign, "brandName" | "productName" | "volume" | "tagline" | "ingredients" | "usage" | "barcode" | "expiry" | "production">>;
  /** Explicit style words ("premium", "minimaliste", "maximalist"…), normalised with PI-2's lexicon. */
  styles?: readonly string[];
  /** Explicit design intent already structured (PI-2 DesignDirectives); merged with what the brief says. */
  directives?: DesignDirectives;
  /** Brand personality, only when the user or a brand book gives it. */
  brandTraits?: readonly BrandTrait[];
  claims?: readonly ClaimInput[];
  prohibitedClaims?: readonly string[];
  /** Market countries (ISO 3166-1 alpha-2), the only source of jurisdiction. */
  marketCountries?: readonly string[];
  /** The packaging actually decided (resolver or user choice); when absent the resolver is consulted. */
  shapeId?: string | null;
  /** An explicit shot purpose or canonical shot style asked by the user. */
  shot?: { purpose?: ShotPurpose; style?: string };
  /** "disabled": PI-4 references give no active influence (shadow / switched off). Default "active". */
  references?: "active" | "disabled";
}

// ─── Output ──────────────────────────────────────────────────────────────────

/** One traceable decision. */
export interface IntentValue<T> {
  value: T;
  status: IntentStatus;
  source: IntentSource;
  priority: IntentPriority;
  confidence: Confidence;
  rationale: string;
  /** Rule, knowledge, claim or reference ids behind it. */
  refs?: string[];
}

export type Unknown = { value: "unknown"; status: "inferred"; source: IntentSource; priority: IntentPriority; confidence: "unknown"; rationale: string };

export interface HierarchyEntry {
  role: ElementRole;
  /** The text the user gave for it, or "notProvided" (never invented). */
  content: string | "notProvided";
  required: boolean;
  because: string[];
}

export interface IntentConflict {
  facet: string;
  values: [string, string];
  winner: string;
  /** The losing signal; null when the two were blended. */
  suppressed: string | null;
  /** The suppressed signal still acts as an attenuated influence (e.g. refined playfulness). */
  attenuated: boolean;
  priority: IntentPriority;
  reason: string;
  source: IntentSource;
}

export interface ShotIntent {
  purpose: ShotPurpose | null;
  /** What was asked or derived, as given. */
  requestedStyle: string | null;
  /** A canonical SHOT_STYLES id, or null. Never a new style. */
  style: ShotStyleId | null;
  status: "resolved" | "unresolved" | "unspecified";
  source: IntentSource | null;
  priority: IntentPriority | null;
  confidence: Confidence;
  rationale: string;
}

export interface KnowledgeIntent {
  knowledgeId: string;
  statement: string;
  status: IntentStatus;
  evidenceStatus: EvidenceStatus | "disabled";
  referenceIds: string[];
  confidence: Confidence;
}

export interface MasterDesignIntent {
  version: string;
  product: {
    name: IntentValue<string> | Unknown;
    category: IntentValue<string> | Unknown;
    subcategory: IntentValue<string> | Unknown;
    archetypeId: string | null;
    positioning: IntentValue<PositioningTerritory>[];
    audience: IntentValue<string>[];
    market: { countries: string[]; jurisdictions: Jurisdiction[]; status: "explicit" | "unknown" };
  };
  brand: {
    name: IntentValue<string> | Unknown;
    personality: IntentValue<BrandTrait>[];
    /** Brand values are never derived: only an explicit brand book could fill them. */
    values: "notProvided";
  };
  packaging: {
    shapeId: string | null;
    name: string | null;
    family: PackagingFamily | null;
    supported: boolean;
    dimensionsMm: { length: number; width: number; height: number } | null;
    material: string | null;
    source: IntentSource | null;
    /** What the resolver recognised (phrase specificity: "eau de javel" is not water), for traceability. */
    recognisedProduct: string | null;
    recognitionPrecision: "exact" | "family" | "none";
  };
  visual: {
    territory: IntentValue<string> | Unknown;
    style: IntentValue<string>[];
    mood: IntentValue<string>[];
    sophistication: IntentValue<Sophistication> | Unknown;
    visualDensity: IntentValue<VisualDensity> | Unknown;
    colorDirection: IntentValue<string>[];
    typographyDirection: IntentValue<string>[];
    imageryDirection: IntentValue<string>[];
    compositionDirection: IntentValue<string>[];
  };
  hierarchy: { primary: HierarchyEntry[]; secondary: HierarchyEntry[]; tertiary: HierarchyEntry[]; supporting: HierarchyEntry[] };
  shotIntent: ShotIntent;
  references: {
    mode: "active" | "disabled";
    /** Knowledge backed by verified, in-scope references (none when disabled). */
    active: { knowledgeId: string; referenceIds: string[]; evidenceStatus: EvidenceStatus; confidence: Confidence }[];
    influences: string[];
    rejected: { referenceId: string; reason: string }[];
  };
  claims: {
    product: IntentValue<string>[];
    knowledge: KnowledgeIntent[];
    required: string[];
    supported: string[];
    uncertain: string[];
    prohibited: string[];
  };
  constraints: {
    mandatory: IntentValue<string>[];
    prohibited: IntentValue<string>[];
    structural: IntentValue<string>[];
    regulatory: IntentValue<string>[];
  };
  negativeDirections: IntentValue<string>[];
  conflicts: IntentConflict[];
  /** Words the user asked for that no vocabulary knows (reported, never guessed). */
  unrecognizedStyles: string[];
  dataNeeds: string[];
  confidence: { overall: Confidence; sections: Record<"product" | "visual" | "hierarchy" | "claims" | "references" | "shot", Confidence> };
  provenance: Provenance[];
  rationale: string[];
}
