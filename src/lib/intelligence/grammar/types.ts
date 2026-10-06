/**
 * PI-2 — DesignGrammar: the structured visual reasoning Edify derives from ProductIntelligence (PI-1),
 * before any design is generated. Preferences, not templates: every facet says what to prefer, what to
 * avoid, which rules decided it and at what priority, so PI-5 can turn it into instructions and PI-6
 * can check a design against it. Nothing here is a pixel, a colour value or a font file.
 */
import type { ElementRole } from "@/lib/structure";
import type { FontCategory } from "@/lib/catalog/fonts";
import type { LayoutId, MotifId } from "@/lib/artwork/compose";
import type { ART_STYLES } from "@/lib/ai/designSpec";
import type { Confidence, DesignSignals, InformationOrigin, Level, PositioningTerritory, Provenance, ShelfImportance } from "@/lib/intelligence/taxonomy";
import type {
  ACCENT_ROLES, BACKGROUND_ROLES, BrandTrait, CAPITALIZATIONS, COLOR_COMPLEXITIES, CompositionStructure, ConflictStrategy, ContrastKind, DECORATION_LEVELS,
  DENSITIES, DISPLAY_BODY_RELATIONS, DOMINANT_COLOR_ROLES, DecorativeElement, FAMILY_COUNTS, IMAGE_DOMINANCES, IMAGE_PLACEMENTS, IMAGE_REGISTERS, ImageryMode,
  LETTER_SPACINGS, MaterialCue, RulePriority, SATURATIONS, Strength, TEMPERATURES, ToneAxis, ToneValue, TypeTrait, WHITESPACES,
} from "./vocabulary";

/** Illustration styles the existing designer can produce (ai/designSpec ART_STYLES, reused). */
export type ArtStyle = (typeof ART_STYLES)[number];

type V<T extends readonly unknown[]> = T[number];
export type ColorComplexity = V<typeof COLOR_COMPLEXITIES>;
export type Saturation = V<typeof SATURATIONS>;
export type Temperature = V<typeof TEMPERATURES>;
export type BackgroundRole = V<typeof BACKGROUND_ROLES>;
export type AccentRole = V<typeof ACCENT_ROLES>;
export type DominantColorRole = V<typeof DOMINANT_COLOR_ROLES>;
export type ImageDominance = V<typeof IMAGE_DOMINANCES>;
export type ImagePlacement = V<typeof IMAGE_PLACEMENTS>;
export type ImageRegister = V<typeof IMAGE_REGISTERS>;
export type Whitespace = V<typeof WHITESPACES>;
export type Density = V<typeof DENSITIES>;
export type DecorationLevel = V<typeof DECORATION_LEVELS>;
export type LetterSpacing = V<typeof LETTER_SPACINGS>;
export type Capitalization = V<typeof CAPITALIZATIONS>;
export type DisplayBodyRelation = V<typeof DISPLAY_BODY_RELATIONS>;
export type FamilyCount = V<typeof FAMILY_COUNTS>;

// ─── Rules ───────────────────────────────────────────────────────────────────

/** Votes of a rule on a ranked facet. */
export interface Votes<T extends string> { prefer?: readonly T[]; avoid?: readonly T[] }

/** What a rule pushes. Every field is optional: a rule only speaks about what it knows. */
export interface GrammarEffects {
  tone?: Partial<Record<ToneAxis, ToneValue>>;
  typeClasses?: Votes<FontCategory>;
  typeTraits?: Votes<TypeTrait>;
  hierarchyStrength?: Level;
  weightContrast?: Level;
  letterSpacing?: LetterSpacing;
  capitalization?: Capitalization;
  maxFamilies?: FamilyCount;
  displayBodyRelation?: DisplayBodyRelation;
  /** Roles to put first, in this order (the rest keeps the canonical order). */
  hierarchyLead?: readonly ElementRole[];
  composition?: Votes<CompositionStructure>;
  colorComplexity?: ColorComplexity;
  saturation?: Saturation;
  temperature?: Temperature;
  background?: BackgroundRole;
  accentRole?: AccentRole;
  dominantColorRole?: DominantColorRole;
  imagery?: Votes<ImageryMode>;
  imageDominance?: ImageDominance;
  imagePlacement?: ImagePlacement;
  imageRegister?: ImageRegister;
  illustration?: Votes<ArtStyle>;
  whitespace?: Whitespace;
  density?: Density;
  focalIsolation?: Level;
  contrast?: Partial<Record<ContrastKind, Level>>;
  decorationLevel?: DecorationLevel;
  decorative?: Votes<DecorativeElement>;
  motifs?: Votes<MotifId>;
  materialCues?: Votes<MaterialCue>;
  shelfEmphasis?: Level;
  /** Named design pitfalls to avoid (they feed `avoidances`, for PI-6). */
  pitfalls?: readonly string[];
}

/** When a rule applies. All present conditions must hold. */
export interface RuleCondition {
  positioning?: PositioningTerritory;
  /** Every listed positioning signal is present (named conflict resolutions). */
  allPositioning?: readonly PositioningTerritory[];
  category?: string;
  subcategory?: string;
  audience?: string;
  pricePosition?: string;
  requirement?: readonly [string, "required" | "preferred"];
  shelfImportance?: readonly ShelfImportance[];
  always?: true;
}

export interface GrammarRule {
  id: string;
  when: RuleCondition;
  priority: RulePriority;
  strength: Strength;
  effects: GrammarEffects;
  /** Why, as a design heuristic (never a claim about sales or consumer preference). */
  rationale: string;
  provenance: Provenance;
  /** A named conflict this rule resolves ("refinedPlayful"…). */
  resolves?: string;
}

// ─── Output ──────────────────────────────────────────────────────────────────

/** A single decided value, with what decided it. "unknown": no rule spoke. */
export interface Decided<T> { value: T | "unknown"; priority: RulePriority | null; because: string[] }

/** A ranked facet: the most preferred first; `avoid` never overlaps `prefer` / `secondary`. */
export interface Ranked<T extends string> { prefer: T[]; secondary: T[]; avoid: T[]; because: string[] }

export interface DesignTerritoryMatch {
  primary: string | null;
  secondary: string[];
  /** The positioning signals the territory was read from (PI-1 vocabulary), strongest first. */
  signals: PositioningTerritory[];
}

export interface GrammarConflict {
  /** The facet or axis in conflict ("tone.register", "density", "positioning"). */
  facet: string;
  between: [string, string];
  strategy: ConflictStrategy;
  /** The value kept (or the named resolution). */
  resolution: string;
  rationale: string;
  rules: string[];
}

export interface Avoidance { facet: string; value: string; priority: RulePriority; because: string[] }

export interface DesignGrammar {
  territory: DesignTerritoryMatch;
  tone: Record<ToneAxis, Decided<ToneValue>>;
  typography: {
    classes: Ranked<FontCategory>;
    traits: Ranked<TypeTrait>;
    hierarchyStrength: Decided<Level>;
    weightContrast: Decided<Level>;
    letterSpacing: Decided<LetterSpacing>;
    capitalization: Decided<Capitalization>;
    maxFamilies: Decided<FamilyCount>;
    displayBodyRelation: Decided<DisplayBodyRelation>;
  };
  hierarchy: { order: ElementRole[]; dominant: ElementRole; priority: RulePriority | null; because: string[] };
  composition: { structures: Ranked<CompositionStructure>; layouts: Ranked<LayoutId> };
  color: {
    complexity: Decided<ColorComplexity>;
    saturation: Decided<Saturation>;
    temperature: Decided<Temperature>;
    background: Decided<BackgroundRole>;
    accentRole: Decided<AccentRole>;
    dominantRole: Decided<DominantColorRole>;
    contrast: Decided<Level>;
    /** Colours the user asked for, kept as said (never converted to production colours here). */
    requested: string[];
  };
  imagery: { modes: Ranked<ImageryMode>; dominance: Decided<ImageDominance>; placement: Decided<ImagePlacement>; register: Decided<ImageRegister> };
  illustration: Ranked<ArtStyle>;
  whitespace: { preference: Decided<Whitespace>; focalIsolation: Decided<Level> };
  density: Decided<Density>;
  contrast: Record<ContrastKind, Decided<Level>>;
  decoration: { level: Decided<DecorationLevel>; elements: Ranked<DecorativeElement>; motifs: Ranked<MotifId> };
  /** Visual cues only: `manufacturing` is never asserted by the grammar. */
  materialCues: { cues: Ranked<MaterialCue>; nature: "visualCue"; manufacturing: "notAssessed" };
  brandExpression: { status: "provided" | "notProvided"; traits: BrandTrait[] };
  visibility: {
    shelfImportance: ShelfImportance | "unknown";
    emphasis: Decided<Level>;
    focalRole: ElementRole;
    /** What must still read at thumbnail size, most important first. */
    smallSizeOrder: ElementRole[];
    colorBlock: "preferred" | "optional";
  };
  avoidances: Avoidance[];
  pitfalls: { text: string; because: string[] }[];
  conflicts: GrammarConflict[];
  /** Every rule that applied, highest priority first: the "because" of the whole grammar. */
  applied: { id: string; priority: RulePriority; strength: Strength }[];
  /** Free-text signals of the PI-1 archetype, passed through with their source (not re-interpreted). */
  archetypeSignals: DesignSignals;
  confidence: Confidence;
  origin: InformationOrigin;
  provenance: Provenance[];
}


/** Explicit design intent from the user (or the brand), the highest priorities of the grammar. */
export interface DesignDirectives {
  positioning?: PositioningTerritory[];
  /** Colours as the user named them ("rouge"), with the intensity they asked. */
  colors?: { name: string; intensity?: "vivid" | "muted" }[];
  density?: Density;
  whitespace?: Whitespace;
  decorationLevel?: DecorationLevel;
  brandTraits?: BrandTrait[];
  /** "brief": the user's own words (userBrief priority); "brand": a brand book (brandDirection). */
  source?: "brief" | "brand";
}
