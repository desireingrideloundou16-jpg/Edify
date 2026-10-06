/**
 * PI-2 — the design grammar rule base: how each PI-1 positioning signal, product category, audience,
 * market position and packaging requirement shapes the visual language. Internal design heuristics
 * (PI2_GRAMMAR_SOURCE, confidence "medium"): preferences with a rationale, never claims about sales or
 * consumer behaviour, never a fixed template ("luxury" does not mean black and gold).
 *
 * Every rule votes; infer.ts resolves the votes by priority (RULE_PRIORITIES), then strength.
 */
import type { LayoutId } from "@/lib/artwork/compose";
import type { PositioningTerritory, Provenance, TargetAudience, PricePosition } from "@/lib/intelligence/taxonomy";
import type { GrammarEffects, GrammarRule, RuleCondition } from "./types";
import type { CompositionStructure, RulePriority, Strength } from "./vocabulary";

export const PI2_GRAMMAR_SOURCE: Provenance = Object.freeze({
  sourceType: "internalRule",
  sourceId: "edify.pi2.grammar",
  sourceTitle: "Edify PI-2 design grammar (internal design heuristics)",
  confidence: "medium",
});

const rule = (id: string, when: RuleCondition, priority: RulePriority, strength: Strength, effects: GrammarEffects, rationale: string, resolves?: string): GrammarRule =>
  ({ id, when, priority, strength, effects, rationale, provenance: PI2_GRAMMAR_SOURCE, ...(resolves ? { resolves } : {}) });
const pos = (p: PositioningTerritory, effects: GrammarEffects, rationale: string, strength: Strength = "medium") => rule(`positioning.${p}`, { positioning: p }, "positioning", strength, effects, rationale);

// ─── Positioning (one rule per PI-1 positioning territory) ───────────────────

const POSITIONING_RULES: GrammarRule[] = [
  pos("clinical", {
    tone: { register: -1, restraint: -1, ornament: -1 }, typeClasses: { prefer: ["sans"], avoid: ["script"] }, typeTraits: { prefer: ["grotesque", "monoline"], avoid: ["handwritten"] },
    colorComplexity: "limited", background: "light", accentRole: "functional", contrast: { color: "high", typography: "high" }, imagery: { prefer: ["typography", "icon"], avoid: ["pattern"] },
    decorationLevel: "none", whitespace: "generous", composition: { prefer: ["grid", "leftAligned", "informationLed"] }, motifs: { avoid: ["wax", "sunburst", "dots"] },
    pitfalls: ["codes médicaux décoratifs (croix, blouses) sans fondement dans le produit"],
  }, "Le registre clinique rassure par l'ordre, la lisibilité et l'absence d'ornement."),
  pos("scientific", {
    tone: { register: -2, restraint: -1 }, typeClasses: { prefer: ["sans", "mono"] }, typeTraits: { prefer: ["geometric", "grotesque"] }, imagery: { prefer: ["abstract", "icon"] },
    illustration: { prefer: ["lineart"], avoid: ["mascot"] }, composition: { prefer: ["grid", "informationLed"] }, accentRole: "functional",
    pitfalls: ["graphiques, molécules ou chiffres décoratifs sans source"],
  }, "Le registre scientifique se lit dans la précision : grille, typographie technique, schémas sobres."),
  pos("natural", {
    tone: { nature: -2, register: 1 }, temperature: "warm", saturation: "muted", imagery: { prefer: ["botanical", "ingredient", "texture"] },
    illustration: { prefer: ["lineart", "engraving", "watercolor"] }, materialCues: { prefer: ["paper", "matte", "naturalRaw"], avoid: ["gloss"] }, motifs: { prefer: ["botanical"] },
    pitfalls: ["cliché « vert + feuille » générique qui rend le produit interchangeable"],
  }, "Le naturel passe par des matières et des sujets réels plutôt que par une couleur imposée."),
  pos("organic", {
    tone: { nature: -2 }, saturation: "muted", imagery: { prefer: ["botanical", "ingredient"] }, materialCues: { prefer: ["kraft", "paper", "matte"] }, illustration: { prefer: ["lineart", "engraving"] },
    pitfalls: ["mention ou logo « bio » sans certification fournie"],
  }, "Biologique : sobriété des matières et honnêteté des visuels ; la certification ne se dessine pas, elle se prouve."),
  pos("artisanal", {
    tone: { era: -1, register: 1, restraint: 0 }, typeClasses: { prefer: ["serif", "display"] }, typeTraits: { prefer: ["handwritten", "slab"] }, materialCues: { prefer: ["kraft", "paper", "naturalRaw"] },
    decorationLevel: "subtle", decorative: { prefer: ["badges", "borders"] }, illustration: { prefer: ["linocut", "engraving"] }, imagery: { prefer: ["illustration", "texture"] },
    composition: { prefer: ["framed", "centered"] },
  }, "L'artisanal montre la main : tampon, gravure, papier, typographie à caractère."),
  pos("traditional", {
    tone: { era: -2 }, typeClasses: { prefer: ["serif"] }, capitalization: "title", decorative: { prefer: ["borders", "frames", "ornaments"] }, composition: { prefer: ["centered", "framed"] },
  }, "Le traditionnel s'appuie sur des structures reconnues : axe centré, cadre, typographie classique."),
  pos("modern", {
    tone: { era: 2, ornament: -1 }, typeClasses: { prefer: ["sans"] }, typeTraits: { prefer: ["geometric", "grotesque"] }, composition: { prefer: ["asymmetric", "grid"] },
    decorationLevel: "subtle", decorative: { avoid: ["ornaments", "flourishes"] },
  }, "Le moderne se dit par la structure (asymétrie, grille) et une typographie sans ornement."),
  pos("minimalist", {
    tone: { ornament: -2, restraint: -2 }, whitespace: "generous", density: "minimal", decorationLevel: "none", colorComplexity: "limited", maxFamilies: 1, focalIsolation: "high",
    imagery: { prefer: ["typography", "none"], avoid: ["pattern"] }, composition: { prefer: ["typographyLed", "editorial"], avoid: ["badgeDriven"] }, decorative: { avoid: ["badges", "patterns", "ornaments", "flourishes"] },
    pitfalls: ["minimalisme vide : sans hiérarchie forte, l'épure devient anonyme"],
  }, "Le minimalisme vit de peu d'éléments, donc d'une hiérarchie et d'un espace très maîtrisés.", "high"),
  pos("premium", {
    tone: { access: 1, restraint: -1 }, hierarchyStrength: "high", whitespace: "generous", colorComplexity: "limited", decorationLevel: "subtle", typeTraits: { prefer: ["refined", "highContrast"] },
    materialCues: { prefer: ["matte", "embossed", "premiumTactile"] }, decorative: { avoid: ["badges"] },
    pitfalls: ["effets bon marché (dégradés criards, ombres portées, accumulation de pastilles)"],
  }, "Le premium se signale par la retenue et la maîtrise, pas par l'accumulation."),
  pos("luxury", {
    tone: { access: 2, restraint: -2, ornament: -1 }, whitespace: "generous", density: "minimal", colorComplexity: "limited", saturation: "muted", letterSpacing: "generous", maxFamilies: 2,
    typeTraits: { prefer: ["refined", "highContrast"], avoid: ["heavy", "rounded"] }, composition: { prefer: ["typographyLed", "editorial", "centered"], avoid: ["badgeDriven"] },
    decorationLevel: "subtle", decorative: { avoid: ["badges", "icons"] }, materialCues: { prefer: ["embossed", "metallic", "premiumTactile"] }, imagery: { prefer: ["typography", "productObject"] },
    focalIsolation: "high", pitfalls: ["équation automatique « luxe = noir + or »", "photo générique de banque d'images"],
  }, "Le luxe isole un point focal et laisse respirer : chaque élément doit être justifié.", "high"),
  pos("playful", {
    tone: { mood: 2, energy: 1, weight: 1 }, typeClasses: { prefer: ["display", "sans"] }, typeTraits: { prefer: ["rounded", "heavy"] }, saturation: "vivid", colorComplexity: "moderate",
    illustration: { prefer: ["flat", "mascot", "papercut"] }, imagery: { prefer: ["illustration"] }, decorationLevel: "moderate", motifs: { prefer: ["dots", "waves"] }, composition: { prefer: ["asymmetric", "badgeDriven"] },
  }, "Le ludique accepte le mouvement, la couleur et le personnage, à condition de garder une hiérarchie."),
  pos("youthful", {
    tone: { era: 1, energy: 1 }, typeClasses: { prefer: ["sans", "display"] }, saturation: "vivid", composition: { prefer: ["asymmetric"] }, contrast: { scale: "high" },
  }, "Le jeune se traduit par du contraste d'échelle et une composition dynamique."),
  pos("masculine", {
    tone: { weight: 1 }, typeTraits: { prefer: ["condensed", "grotesque"] }, pitfalls: ["codes de genre caricaturaux (bleu/rose, clichés)"],
  }, "Signal de genre traité par la typographie (poids, chasse), jamais par des clichés de couleur.", "low"),
  pos("feminine", {
    tone: { weight: -1 }, typeTraits: { prefer: ["refined", "humanist"] }, pitfalls: ["codes de genre caricaturaux (bleu/rose, clichés)"],
  }, "Signal de genre traité par la finesse typographique, jamais par des clichés de couleur.", "low"),
  pos("neutral", { temperature: "neutral", colorComplexity: "limited" }, "Le neutre évite les signaux appuyés.", "low"),
  pos("technical", {
    tone: { register: -2 }, typeClasses: { prefer: ["sans", "mono"] }, typeTraits: { prefer: ["grotesque", "condensed", "monoline"] }, composition: { prefer: ["grid", "informationLed"] },
    density: "informationRich", imagery: { prefer: ["icon", "productObject"] }, illustration: { prefer: ["lineart"], avoid: ["watercolor", "mascot"] },
  }, "Le technique privilégie l'information structurée et les pictogrammes."),
  pos("industrial", {
    tone: { register: -2, weight: 1 }, density: "informationRich", decorationLevel: "none", contrast: { typography: "high", color: "high" }, composition: { prefer: ["informationLed", "horizontalEmphasis"] },
  }, "L'industriel est fonctionnel : identification rapide, information complète, aucun ornement."),
  pos("sustainable", {
    tone: { nature: -1 }, materialCues: { prefer: ["kraft", "paper", "matte"], avoid: ["gloss", "metallic"] }, decorationLevel: "subtle",
    pitfalls: ["allégation environnementale non sourcée (greenwashing)", "codes « vert » utilisés comme preuve"],
  }, "La durabilité se montre par la sobriété des moyens ; toute allégation doit être sourcée."),
  pos("cultural", {
    tone: { register: 1 }, imagery: { prefer: ["pattern", "illustration"] }, decorationLevel: "moderate", decorative: { prefer: ["patterns"] },
    pitfalls: ["motifs culturels en caricature, hors contexte ou non précisés par le brief"],
  }, "Le culturel s'appuie sur des codes visuels locaux réels, à préciser par le brief ou une source."),
  pos("heritage", {
    tone: { era: -2, access: 1 }, typeClasses: { prefer: ["serif"] }, typeTraits: { prefer: ["highContrast", "slab"] }, decorative: { prefer: ["frames", "borders", "badges"] },
    composition: { prefer: ["framed", "centered"] }, materialCues: { prefer: ["embossed", "paper"] },
  }, "L'héritage s'exprime par le sceau, le cadre et la typographie de tradition."),
  pos("bold", {
    tone: { weight: 2, restraint: 1 }, contrast: { color: "high", typography: "high", scale: "high" }, saturation: "vivid", typeTraits: { prefer: ["heavy", "condensed"] },
    composition: { prefer: ["typographyLed", "verticalEmphasis"] }, shelfEmphasis: "high",
  }, "L'audace repose sur un contraste fort et un élément dominant."),
  pos("energetic", {
    tone: { energy: 2 }, saturation: "vivid", composition: { prefer: ["asymmetric", "verticalEmphasis"] }, typeTraits: { prefer: ["condensed", "heavy"] },
  }, "L'énergie passe par le mouvement de la composition et la tension typographique."),
  pos("elegant", {
    tone: { restraint: -1, weight: -1 }, typeTraits: { prefer: ["refined", "highContrast"], avoid: ["heavy"] }, whitespace: "generous", letterSpacing: "generous", decorationLevel: "subtle",
  }, "L'élégance tient à la finesse et à l'espace."),
  pos("sophisticated", {
    tone: { access: 1, restraint: -1 }, typeTraits: { prefer: ["highContrast"] }, composition: { prefer: ["editorial", "asymmetric"] }, colorComplexity: "limited",
  }, "La sophistication emprunte à l'éditorial : composition asymétrique, contrastes typographiques."),
  pos("accessible", {
    tone: { access: -2 }, hierarchyStrength: "high", contrast: { typography: "high" }, saturation: "balanced", composition: { prefer: ["centered", "stacked"] }, density: "balanced",
    hierarchyLead: ["productName", "brand", "claim"],
  }, "L'accessible doit se comprendre immédiatement : nom du produit lisible, hiérarchie franche."),
];

// ─── Categories (market / category requirements) ────────────────────────────

const cat = (c: string, effects: GrammarEffects, rationale: string, priority: RulePriority = "category", strength: Strength = "medium") => rule(`category.${c}`, { category: c }, priority, strength, effects, rationale);

const CATEGORY_RULES: GrammarRule[] = [
  cat("food", {
    hierarchyLead: ["productName", "brand", "image", "claim", "netContent"], imagery: { prefer: ["ingredient", "photography", "productObject"] }, imageRegister: "emotional", imageDominance: "medium", temperature: "warm",
    pitfalls: ["visuel d'un ingrédient absent de la recette"],
  }, "En alimentaire, l'identification du produit et l'appétence guident la lecture."),
  cat("beverages", {
    hierarchyLead: ["brand", "productName", "subtitle", "netContent"], composition: { prefer: ["verticalEmphasis"] }, shelfEmphasis: "high", imagery: { prefer: ["ingredient", "typography"] },
  }, "Une boisson se reconnaît de loin : marque et variante lisibles sur un format vertical."),
  cat("cosmetics", {
    hierarchyLead: ["brand", "productName", "subtitle", "claim"], typeClasses: { prefer: ["sans", "serif"] }, whitespace: "generous", imagery: { prefer: ["typography", "botanical", "texture"] },
    pitfalls: ["allégations d'efficacité non fournies par la marque"],
  }, "En cosmétique, la marque et la fonction du soin priment ; l'espace porte la qualité perçue."),
  cat("personalCare", {
    hierarchyLead: ["brand", "productName", "claim"], contrast: { typography: "high" }, density: "balanced",
  }, "L'hygiène se choisit vite : marque, fonction et bénéfice lisibles."),
  cat("supplements", {
    hierarchyLead: ["productName", "claim", "netContent", "brand"], density: "informationRich", imagery: { prefer: ["icon", "typography"] }, contrast: { typography: "high" },
    pitfalls: ["allégation de santé non fournie par la marque"],
  }, "Un complément doit porter dosage, quantité et usage : l'information fait partie du produit.", "productConstraint"),
  cat("pharmaceutical", {
    hierarchyLead: ["productName", "subtitle", "netContent", "brand"], density: "informationRich", decorationLevel: "none", imagery: { prefer: ["icon", "typography"] }, contrast: { typography: "high" },
  }, "Un produit de santé est d'abord une information exacte et lisible.", "productConstraint", "high"),
  cat("household", {
    hierarchyLead: ["productName", "brand", "claim", "regulatory"], imagery: { avoid: ["ingredient"] }, illustration: { avoid: ["mascot"] }, contrast: { typography: "high" },
    pitfalls: ["codes alimentaires ou de boisson (fruits, verres, gouttes appétissantes) sur un produit d'entretien", "visuels qui attirent les enfants vers un produit dangereux"],
  }, "Un produit d'entretien ne doit jamais ressembler à un aliment ni attirer un enfant.", "safetyRegulatory", "high"),
  cat("petCare", {
    hierarchyLead: ["brand", "productName", "image", "claim"], imagery: { prefer: ["photography", "productObject"] }, imageRegister: "emotional",
  }, "L'animal est le sujet : image et bénéfice dominent."),
  cat("luxury", { hierarchyLead: ["brand", "productName"], whitespace: "generous", decorationLevel: "subtle", density: "minimal" }, "En luxe, la marque est le produit."),
  cat("industrial", {
    hierarchyLead: ["productName", "subtitle", "regulatory", "brand"], density: "informationRich", decorationLevel: "none", composition: { prefer: ["informationLed"] },
  }, "En B2B, l'identification et l'information techniques passent avant l'émotion.", "productConstraint"),
];

// ─── Audience and market position ───────────────────────────────────────────

const aud = (a: TargetAudience, effects: GrammarEffects, rationale: string) => rule(`audience.${a}`, { audience: a }, "audience", "medium", effects, rationale);
const AUDIENCE_RULES: GrammarRule[] = [
  aud("children", {
    tone: { mood: 2, energy: 1 }, typeTraits: { prefer: ["rounded"] }, illustration: { prefer: ["flat", "mascot"] }, saturation: "vivid", contrast: { typography: "high" },
    pitfalls: ["personnage ou promesse qui trompe l'enfant sur le produit"],
  }, "Pour les enfants : formes simples, couleur franche, lecture immédiate."),
  aud("family", { hierarchyStrength: "high", composition: { prefer: ["centered"] } }, "Un produit familial doit se comprendre au premier regard."),
  aud("athletes", { tone: { energy: 2, weight: 1 }, typeTraits: { prefer: ["condensed", "heavy"] } }, "Le public sportif répond à la tension et à la performance typographique."),
  aud("healthConsumers", { tone: { register: -1 }, contrast: { typography: "high" }, pitfalls: ["allégation santé non fournie"] }, "La confiance passe par la clarté de l'information."),
  aud("environmentallyConscious", { materialCues: { prefer: ["kraft", "paper"] }, pitfalls: ["allégation environnementale non sourcée"] }, "Sobriété des moyens, aucune allégation sans preuve."),
  aud("culturallyFocused", { tone: { register: 1 } }, "Une clientèle attachée à sa culture attend des codes justes, pas caricaturaux."),
  aud("professional", { density: "informationRich", composition: { prefer: ["informationLed"] } }, "Le professionnel cherche l'information d'abord."),
  aud("beautyConsumers", { whitespace: "generous", typeTraits: { prefer: ["refined"] } }, "Le public beauté lit la qualité dans l'espace et la finesse."),
  aud("massMarket", { tone: { access: -1 }, contrast: { typography: "high" } }, "Grand public : lisibilité et reconnaissance rapides."),
  aud("budget", { tone: { access: -1 }, hierarchyLead: ["productName", "netContent", "brand"] }, "Petit budget : le produit et la quantité doivent se lire tout de suite."),
];

const price = (p: PricePosition, effects: GrammarEffects, rationale: string) => rule(`market.${p}`, { pricePosition: p }, "category", "low", effects, rationale);
const MARKET_RULES: GrammarRule[] = [
  price("luxury", { tone: { access: 2 } }, "Positionnement prix luxe."),
  price("premium", { tone: { access: 1 } }, "Positionnement prix premium."),
  price("entry", { tone: { access: -1 }, contrast: { typography: "high" } }, "Premier prix : lisibilité avant tout."),
  price("value", { tone: { access: -1 } }, "Prix accessible."),
];

// ─── Packaging requirements (PI-1) ──────────────────────────────────────────

const REQUIREMENT_RULES: GrammarRule[] = [
  rule("requirement.premiumPresentation", { requirement: ["needsPremiumPresentation", "required"] }, "category", "medium",
    { decorationLevel: "subtle", whitespace: "generous", materialCues: { prefer: ["premiumTactile", "embossed"] } }, "Une présentation premium exigée appelle de la retenue et des indices de matière."),
  rule("requirement.shelfImpact", { requirement: ["needsShelfImpact", "required"] }, "category", "medium",
    { shelfEmphasis: "high", contrast: { color: "high" } }, "Un fort impact en rayon exige un bloc de couleur et un point focal lisibles de loin."),
  rule("requirement.transparency", { requirement: ["needsTransparency", "preferred"] }, "category", "low",
    { imagery: { prefer: ["productObject"] }, composition: { prefer: ["productLed"] } }, "Quand le produit se montre, la composition doit le laisser voir."),
  rule("visibility.critical", { shelfImportance: ["critical", "high"] }, "category", "low", { shelfEmphasis: "high" }, "Rayon décisif : la vignette doit rester lisible."),
];

// ─── General grammar and aesthetic defaults ─────────────────────────────────

const GENERAL_RULES: GrammarRule[] = [
  rule("general.singleFocus", { always: true }, "general", "medium", {
    pitfalls: ["plusieurs points focaux concurrents en face avant", "plus de deux familles typographiques sans raison"],
  }, "Une face avant porte un point focal et une hiérarchie claire."),
  rule("default.base", { always: true }, "aestheticDefault", "low", {
    hierarchyStrength: "medium", weightContrast: "medium", letterSpacing: "normal", capitalization: "mixed", maxFamilies: 2, displayBodyRelation: "harmonious",
    hierarchyLead: ["brand", "productName", "subtitle", "claim", "netContent"], colorComplexity: "moderate", saturation: "balanced", temperature: "neutral", background: "light",
    accentRole: "brand", dominantColorRole: "brand", imageDominance: "medium", imagePlacement: "accent", imageRegister: "balanced", whitespace: "balanced", density: "balanced",
    focalIsolation: "medium", decorationLevel: "subtle", shelfEmphasis: "medium",
    contrast: { typography: "medium", color: "medium", scale: "medium", density: "medium", imagery: "medium" },
  }, "Valeurs par défaut neutres, toujours battues par une règle plus précise."),
];

// ─── Named conflict resolutions ─────────────────────────────────────────────

const both = (a: PositioningTerritory, b: PositioningTerritory) => ({ allPositioning: [a, b] as const });
const RESOLUTION_RULES: GrammarRule[] = [
  rule("resolve.refinedPlayful.premium", both("premium", "playful"), "positioning", "high", {
    tone: { mood: 1, restraint: 0 }, colorComplexity: "limited", saturation: "balanced", decorationLevel: "subtle", illustration: { prefer: ["flat", "lineart"], avoid: ["mascot"] },
    typeTraits: { prefer: ["rounded", "refined"] }, pitfalls: ["ludique « bon marché » sur un produit premium"],
  }, "Premium + ludique : un ludisme maîtrisé (palette réduite, illustration fine), pas un minimalisme de luxe.", "refinedPlayful"),
  rule("resolve.refinedPlayful.luxury", both("luxury", "playful"), "positioning", "high", {
    tone: { mood: 1, restraint: -1 }, colorComplexity: "limited", saturation: "balanced", decorationLevel: "subtle", illustration: { prefer: ["lineart", "papercut"], avoid: ["mascot"] },
  }, "Luxe + ludique : un clin d'œil graphique dans un cadre très retenu.", "refinedPlayful"),
  rule("resolve.evidenceNatural.scientific", both("natural", "scientific"), "positioning", "high", {
    imagery: { prefer: ["botanical"] }, illustration: { prefer: ["lineart", "engraving"], avoid: ["watercolor"] }, typeTraits: { prefer: ["humanist"] }, colorComplexity: "limited", contrast: { typography: "high" },
  }, "Naturel + scientifique : le végétal dessiné avec précision, une typographie humaniste, une information nette.", "evidenceNatural"),
  rule("resolve.evidenceNatural.clinical", both("natural", "clinical"), "positioning", "high", {
    imagery: { prefer: ["botanical"] }, illustration: { prefer: ["lineart"] }, typeTraits: { prefer: ["humanist"] }, background: "light",
  }, "Naturel + clinique : fond clair, végétal au trait, lisibilité de pharmacie.", "evidenceNatural"),
  rule("resolve.contemporaryHeritage.traditional", both("traditional", "modern"), "positioning", "high", {
    tone: { era: 0 }, typeClasses: { prefer: ["serif", "sans"] }, displayBodyRelation: "contrasting", decorationLevel: "subtle", composition: { prefer: ["centered", "asymmetric"] },
    decorative: { prefer: ["borders"], avoid: ["ornaments", "flourishes"] },
  }, "Traditionnel + moderne : un héritage relu (sérif de caractère + sans contemporain, ornement réduit).", "contemporaryHeritage"),
  rule("resolve.contemporaryHeritage.heritage", both("heritage", "modern"), "positioning", "high", {
    tone: { era: 0 }, displayBodyRelation: "contrasting", decorationLevel: "subtle", decorative: { prefer: ["frames"], avoid: ["flourishes"] },
  }, "Héritage + moderne : le sceau et le cadre gardés, simplifiés.", "contemporaryHeritage"),
  rule("resolve.masstige.luxury", both("luxury", "accessible"), "positioning", "high", {
    tone: { access: 0 }, hierarchyStrength: "high", contrast: { typography: "high" }, decorationLevel: "subtle", materialCues: { prefer: ["matte"] }, colorComplexity: "limited",
  }, "Grand public + luxe : des codes premium choisis (retenue, matière), sans sacrifier la lisibilité.", "masstige"),
  rule("resolve.masstige.premium", both("premium", "accessible"), "positioning", "high", {
    tone: { access: 0 }, hierarchyStrength: "high", contrast: { typography: "high" },
  }, "Premium accessible : qualité perçue et lecture immédiate.", "masstige"),
];

export const GRAMMAR_RULES: readonly GrammarRule[] = Object.freeze([...RESOLUTION_RULES, ...POSITIONING_RULES, ...CATEGORY_RULES, ...AUDIENCE_RULES, ...MARKET_RULES, ...REQUIREMENT_RULES, ...GENERAL_RULES]);

/**
 * Positioning signals implied by the audience and the price position, used to read the territory and to
 * detect named conflicts (a luxury product for the mass market). They trigger no positioning rule.
 */
export const DERIVED_SIGNALS: Readonly<Partial<Record<TargetAudience | `price:${PricePosition}`, PositioningTerritory[]>>> = {
  massMarket: ["accessible"], budget: ["accessible"], family: ["accessible"], children: ["playful"], athletes: ["energetic"], luxury: ["luxury"], premium: ["premium"],
  professional: ["technical"], environmentallyConscious: ["sustainable"], culturallyFocused: ["cultural"],
  "price:luxury": ["luxury"], "price:premium": ["premium"], "price:entry": ["accessible"], "price:value": ["accessible"],
};

// ─── Design territories (named compositions of PI-1 positioning signals) ────

/** A territory is read when at least two of its signals are present (one for a single-signal territory),
 *  including every signal it `requires` (a refined playful territory is never read without "playful"). */
export interface DesignTerritory { id: string; label: { fr: string; en: string }; signature: readonly PositioningTerritory[]; requires?: readonly PositioningTerritory[] }
export const DESIGN_TERRITORIES: readonly DesignTerritory[] = [
  { id: "luxuryMinimal", label: { fr: "Luxe minimal", en: "Luxury minimal" }, signature: ["luxury", "minimalist", "elegant"] },
  { id: "premiumEditorial", label: { fr: "Premium éditorial", en: "Premium editorial" }, signature: ["premium", "sophisticated", "elegant"] },
  { id: "refinedPlayful", label: { fr: "Ludique raffiné", en: "Refined playful" }, signature: ["premium", "luxury", "playful"], requires: ["playful"] },
  { id: "masstige", label: { fr: "Premium accessible", en: "Masstige" }, signature: ["premium", "luxury", "accessible"], requires: ["accessible"] },
  { id: "modernNatural", label: { fr: "Naturel moderne", en: "Modern natural" }, signature: ["natural", "modern"] },
  { id: "botanicalOrganic", label: { fr: "Botanique bio", en: "Botanical organic" }, signature: ["organic", "natural", "sustainable"] },
  { id: "evidenceNatural", label: { fr: "Naturel prouvé", en: "Evidence natural" }, signature: ["natural", "scientific"] },
  { id: "clinicalScientific", label: { fr: "Clinique scientifique", en: "Clinical scientific" }, signature: ["clinical", "scientific"] },
  { id: "technicalProfessional", label: { fr: "Technique professionnel", en: "Technical professional" }, signature: ["technical", "industrial"] },
  { id: "youthfulEnergetic", label: { fr: "Jeune et énergique", en: "Youthful energetic" }, signature: ["youthful", "energetic", "bold"] },
  { id: "playfulFamily", label: { fr: "Ludique familial", en: "Playful family" }, signature: ["playful", "accessible"] },
  { id: "artisanalCraft", label: { fr: "Artisanal", en: "Artisanal craft" }, signature: ["artisanal", "traditional"] },
  { id: "heritageClassic", label: { fr: "Héritage", en: "Heritage" }, signature: ["heritage", "traditional", "elegant"] },
  { id: "contemporaryHeritage", label: { fr: "Héritage contemporain", en: "Contemporary heritage" }, signature: ["heritage", "traditional", "modern"], requires: ["modern"] },
  { id: "contemporaryCultural", label: { fr: "Culturel contemporain", en: "Contemporary cultural" }, signature: ["cultural", "modern"] },
  { id: "boldCommercial", label: { fr: "Commercial percutant", en: "Bold commercial" }, signature: ["bold", "energetic", "accessible"] },
  { id: "massAccessible", label: { fr: "Grand public lisible", en: "Mass-market accessible" }, signature: ["accessible", "neutral"] },
  { id: "sustainableHonest", label: { fr: "Durable sobre", en: "Sustainable honest" }, signature: ["sustainable", "natural", "minimalist"], requires: ["sustainable"] },
  { id: "naturalMinimal", label: { fr: "Naturel épuré", en: "Natural minimal" }, signature: ["natural", "minimalist"] },
  { id: "cleanFunctional", label: { fr: "Fonctionnel épuré", en: "Clean functional" }, signature: ["minimalist", "modern", "neutral"] },
  { id: "minimal", label: { fr: "Minimal", en: "Minimal" }, signature: ["minimalist"] },
];

// ─── Adapter to the existing front layouts (artwork/compose LAYOUTS) ────────

/** Which existing layouts realise each composition structure (no new layout is invented). */
export const STRUCTURE_LAYOUTS: Readonly<Record<CompositionStructure, readonly LayoutId[]>> = {
  centered: ["classic", "emblem", "label"],
  leftAligned: ["split"],
  asymmetric: ["split", "pop"],
  grid: ["band"],
  editorial: ["minimal", "poster"],
  stacked: ["classic", "band"],
  verticalEmphasis: ["vertical"],
  horizontalEmphasis: ["band"],
  framed: ["frame", "label"],
  badgeDriven: ["emblem", "pop"],
  imageLed: ["illustrated", "arch"],
  typographyLed: ["bold", "poster", "minimal"],
  productLed: ["window"],
  informationLed: ["band", "classic"],
};
