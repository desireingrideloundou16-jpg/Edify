/**
 * PI-2 — controlled vocabularies of the Packaging Design Grammar. Only what PI-1 and the renderer do not
 * already name lives here; everything else is reused:
 *   - positioning signals      → PI-1 POSITIONING_TERRITORIES
 *   - levels, confidence       → PI-1 LEVELS, CONFIDENCE_LEVELS
 *   - type classes             → catalog/fonts FontCategory (sans, serif, display, script, mono)
 *   - information roles        → the engine's explicit artwork roles (ElementRole, phase 3A)
 *   - layouts, motifs          → artwork/compose LAYOUTS, MOTIFS
 *   - illustration styles      → ai/designSpec ART_STYLES
 * These are design preferences, never rendering values: no pixel, no RGB, no font file.
 */
import type { ElementRole } from "@/lib/structure";
import type { FontCategory } from "@/lib/catalog/fonts";

export const FONT_CATEGORIES: readonly FontCategory[] = ["sans", "serif", "display", "script", "mono"];

/**
 * Tone as bipolar axes, from −2 (first pole) to +2 (second pole), 0 = neutral. Five steps are enough to
 * order preferences; finer numbers would only pretend to a precision design heuristics do not have.
 */
export const TONE_AXES = {
  restraint: ["restrained", "expressive"],
  energy: ["calm", "energetic"],
  era: ["traditional", "contemporary"],
  register: ["technical", "emotional"],
  mood: ["serious", "playful"],
  access: ["accessible", "exclusive"],
  nature: ["natural", "synthetic"],
  ornament: ["minimal", "decorative"],
  weight: ["soft", "bold"],
} as const;
export type ToneAxis = keyof typeof TONE_AXES;
export const TONE_AXIS_KEYS = Object.keys(TONE_AXES) as ToneAxis[];
export type ToneValue = -2 | -1 | 0 | 1 | 2;

export const TYPE_TRAITS = ["humanist", "geometric", "grotesque", "condensed", "extended", "highContrast", "rounded", "slab", "handwritten", "monoline", "refined", "heavy"] as const;
export type TypeTrait = (typeof TYPE_TRAITS)[number];
export const LETTER_SPACINGS = ["tight", "normal", "generous"] as const;
export const CAPITALIZATIONS = ["sentence", "title", "allCapsDisplay", "mixed"] as const;
export const DISPLAY_BODY_RELATIONS = ["singleFamily", "harmonious", "contrasting"] as const;
export const FAMILY_COUNTS = [1, 2, 3] as const;

export const COMPOSITION_STRUCTURES = [
  "centered", "leftAligned", "asymmetric", "grid", "editorial", "stacked", "verticalEmphasis", "horizontalEmphasis",
  "framed", "badgeDriven", "imageLed", "typographyLed", "productLed", "informationLed",
] as const;
export type CompositionStructure = (typeof COMPOSITION_STRUCTURES)[number];

export const COLOR_COMPLEXITIES = ["monochrome", "limited", "moderate", "rich"] as const;
export const SATURATIONS = ["muted", "balanced", "vivid"] as const;
export const TEMPERATURES = ["warm", "neutral", "cool", "mixed"] as const;
export const BACKGROUND_ROLES = ["light", "dark", "material", "colored"] as const;
export const ACCENT_ROLES = ["none", "functional", "brand", "decorative"] as const;
export const DOMINANT_COLOR_ROLES = ["background", "brand", "product", "material"] as const;

export const IMAGERY_MODES = ["photography", "illustration", "typography", "productObject", "botanical", "ingredient", "abstract", "pattern", "icon", "texture", "none"] as const;
export type ImageryMode = (typeof IMAGERY_MODES)[number];
export const IMAGE_DOMINANCES = ["none", "low", "medium", "high"] as const;
export const IMAGE_PLACEMENTS = ["hero", "background", "accent", "none"] as const;
export const IMAGE_REGISTERS = ["emotional", "informational", "balanced"] as const;

export const WHITESPACES = ["generous", "balanced", "compact"] as const;
export const DENSITIES = ["minimal", "balanced", "informationRich", "dense"] as const;
export const CONTRAST_KINDS = ["typography", "color", "scale", "density", "imagery"] as const;
export type ContrastKind = (typeof CONTRAST_KINDS)[number];

export const DECORATION_LEVELS = ["none", "subtle", "moderate", "expressive"] as const;
export const DECORATIVE_ELEMENTS = ["borders", "frames", "patterns", "ornaments", "badges", "icons", "flourishes"] as const;
export type DecorativeElement = (typeof DECORATIVE_ELEMENTS)[number];

/** Visual cues only: "metallic" is a look, never a promise that a foil finish can be produced. */
export const MATERIAL_CUES = ["matte", "gloss", "metallic", "kraft", "paper", "glass", "frosted", "embossed", "premiumTactile", "naturalRaw"] as const;
export type MaterialCue = (typeof MATERIAL_CUES)[number];

/** Brand personality: only ever taken from the brief, never invented. */
export const BRAND_TRAITS = ["authoritative", "warm", "rebellious", "elegant", "trustworthy", "youthful", "scientific", "artisanal", "culturallyRooted", "innovative", "accessible"] as const;
export type BrandTrait = (typeof BRAND_TRAITS)[number];

/**
 * Rule precedence, highest first. A rule of a higher priority is never overridden by a lower one:
 * the user's explicit brief beats the brand direction, which beats product and safety constraints, …,
 * which beat aesthetic defaults.
 */
export const RULE_PRIORITIES = ["userBrief", "brandDirection", "productConstraint", "safetyRegulatory", "category", "positioning", "audience", "general", "aestheticDefault"] as const;
export type RulePriority = (typeof RULE_PRIORITIES)[number];
export const priorityRank = (p: RulePriority) => RULE_PRIORITIES.length - RULE_PRIORITIES.indexOf(p);
/** Priorities that decide on their own: a generic preference never outvotes them. */
export const DECISIVE_PRIORITIES: readonly RulePriority[] = ["userBrief", "brandDirection", "productConstraint", "safetyRegulatory"];

export const STRENGTHS = ["low", "medium", "high"] as const;
export type Strength = (typeof STRENGTHS)[number];
export const STRENGTH_WEIGHT: Readonly<Record<Strength, number>> = { low: 1, medium: 2, high: 3 };

export const CONFLICT_STRATEGIES = ["higherPriority", "strongerRule", "blend", "namedResolution", "userOverride"] as const;
export type ConflictStrategy = (typeof CONFLICT_STRATEGIES)[number];

/** Information roles, reused from the engine (phase 3A explicit artwork roles). */
export const HIERARCHY_ROLES: readonly ElementRole[] = ["brand", "logo", "productName", "subtitle", "claim", "image", "netContent", "badge", "bodyText", "secondary", "regulatory", "barcode", "decorative"];
