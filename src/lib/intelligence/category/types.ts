/**
 * PI-3 — Industry / Category Knowledge: what a product category knows (conventions, expectations, trust
 * signals, information priorities, differentiation, pitfalls, tensions, shelf behaviour). Knowledge, not
 * decisions: it never picks a pack, a layout, a colour value or a font, and it never overrides the
 * user's brief, the brand, product or regulatory constraints, or PI-2's explicit user overrides.
 *
 * Every item is traceable: basis (research, expert, regulatory, market, internal, inferred), the PI-1
 * Provenance model, a confidence and a rationale. A category convention is a TENDENCY, never a rule:
 * the system keeps "this is what the category usually does" apart from "this is what Edify recommends".
 */
import type { ElementRole } from "@/lib/structure";
import type { Confidence, MarketRegion, PositioningTerritory, ProductCategory, ProductSubcategory, Provenance, TargetAudience } from "@/lib/intelligence/taxonomy";
import type { ArtStyle, CompositionStructure, DecorationLevel, DecorativeElement, Density, ImageryMode, Saturation, TypeTrait } from "@/lib/intelligence/grammar";
import type { KNOWLEDGE_BASES, KNOWLEDGE_KINDS, KNOWLEDGE_STRENGTHS } from "./vocabulary";

export type KnowledgeBasis = (typeof KNOWLEDGE_BASES)[number];
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];
export type KnowledgeStrength = (typeof KNOWLEDGE_STRENGTHS)[number];

/** Links of an item to the PI-1 / PI-2 vocabularies (reused, never redefined). */
export interface KnowledgeRelates {
  roles?: readonly ElementRole[];
  imagery?: readonly ImageryMode[];
  illustration?: readonly ArtStyle[];
  composition?: readonly CompositionStructure[];
  typeTraits?: readonly TypeTrait[];
  decorative?: readonly DecorativeElement[];
  positioning?: readonly PositioningTerritory[];
  saturation?: Saturation;
  density?: Density;
  decoration?: DecorationLevel;
}

/** What the shadow can observe on a produced design (subset of the DesignSpec). */
export interface ShadowCheck {
  facet: "layout" | "motif" | "artStyle";
  values: readonly string[];
}

export interface KnowledgeItem {
  id: string;
  kind: KnowledgeKind;
  /** The knowledge itself, as a tendency or a caution (French, the product's language). */
  statement: string;
  strength: KnowledgeStrength;
  basis: KnowledgeBasis;
  confidence: Confidence;
  provenance: Provenance;
  rationale: string;
  /** Narrower applicability inside the category (subcategories), when it does not apply to all of it. */
  subcategories?: readonly ProductSubcategory[];
  relates?: KnowledgeRelates;
  /** Explicitly requested positionings that suspend this convention (the user's intent wins). */
  yieldsTo?: readonly PositioningTerritory[];
  /** For regulatory items: where the source applies; never generalised beyond it. */
  scope?: string;
  check?: ShadowCheck;
  /** A pitfall the shadow only reports when the cultural context is not sourced (a motif without a source). */
  unlessSourcedCulture?: true;
}

/** A pole of a tension: a PI-1 positioning signal, a PI-2 tone pole, or the market scope (local / global). */
export type TensionPole = PositioningTerritory | "technical" | "emotional" | "local" | "global" | "massMarket";

export interface CategoryTension {
  id: string;
  poles: readonly [TensionPole, TensionPole];
  statement: string;
  /** How the category usually keeps both sides readable (guidance, not a decision). */
  guidance: string;
  basis: KnowledgeBasis;
  confidence: Confidence;
  provenance: Provenance;
}

/** A fact the category needs and that the brief usually has to provide (never guessed). */
export interface CategoryDataNeed { fact: string; why: string; role?: ElementRole }

export interface CategoryKnowledge {
  id: string;
  label: { fr: string; en: string };
  definition: string;
  appliesTo: {
    categories: readonly ProductCategory[];
    subcategories?: readonly ProductSubcategory[];
    /** Market regions where this knowledge holds (local beverages): all present conditions must hold. */
    regions?: readonly MarketRegion[];
  };
  typicalProducts: readonly string[];
  usages: readonly string[];
  audience: readonly TargetAudience[];
  /** Usual information order (engine roles, phase 3A), most prominent first. */
  informationOrder?: readonly ElementRole[];
  items: readonly KnowledgeItem[];
  tensions: readonly CategoryTension[];
  dataNeeds: readonly CategoryDataNeed[];
}

// ─── Output ──────────────────────────────────────────────────────────────────

export type ItemStatus = "applies" | "overriddenByUser";
export interface AppliedKnowledge extends KnowledgeItem { from: string; status: ItemStatus; overriddenBecause?: string }
export interface AppliedTension extends CategoryTension { from: string; state: "active" | "latent" }

export interface CategoryKnowledgeResult {
  /** Knowledge entries that apply, most specific first. */
  matched: { id: string; specificity: "region" | "subcategory" | "category" }[];
  status: "known" | "unknown";
  conventions: AppliedKnowledge[];
  trustSignals: AppliedKnowledge[];
  informationPriorities: { order: ElementRole[]; from: string | null; items: AppliedKnowledge[] };
  differentiation: AppliedKnowledge[];
  opportunities: AppliedKnowledge[];
  pitfalls: AppliedKnowledge[];
  shelfBehavior: AppliedKnowledge[];
  /** Items whose basis is a regulation, with their scope (never an automatic legal conclusion). */
  regulatory: AppliedKnowledge[];
  tensions: AppliedTension[];
  /** Facts the category needs that the brief has not given (to ask, never to invent). */
  dataNeeds: (CategoryDataNeed & { from: string })[];
  confidence: Confidence;
  provenance: Provenance[];
}
