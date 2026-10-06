/**
 * PI-2 — inferDesignGrammar(ProductIntelligence, DesignDirectives?) → DesignGrammar.
 *
 *   brief → PI-1 ProductIntelligence ─┐
 *   explicit design intent (directives) ┴→ applicable rules → votes resolved by priority, then strength
 *                                        → territory, tone, typography, hierarchy, … , conflicts, trace
 *
 * Deterministic and pure: no randomness, no clock, no network, no AI; the inputs are never mutated.
 * Resolution: a higher priority always wins (RULE_PRIORITIES: user brief > brand > product constraint
 * > safety > category > positioning > audience > general > defaults); within a priority the stronger
 * vote wins; ties keep the vocabulary order. Conflicts are recorded, never silently stacked.
 */
import { LAYOUTS, MOTIFS, type MotifId } from "@/lib/artwork/compose";
import { ART_STYLES } from "@/lib/ai/designSpec";
import type { ElementRole } from "@/lib/structure";
import {
  CONFIDENCE_LEVELS, LEVELS, POSITIONING_TERRITORIES, userProvenance, type Confidence, type PositioningTerritory, type ProductIntelligence, type Provenance,
} from "@/lib/intelligence/taxonomy";
import { DERIVED_SIGNALS, DESIGN_TERRITORIES, GRAMMAR_RULES, PI2_GRAMMAR_SOURCE, STRUCTURE_LAYOUTS } from "./rules";
import type {
  ArtStyle, Avoidance, Decided, DesignDirectives, DesignGrammar, DesignTerritoryMatch, GrammarConflict, GrammarEffects, GrammarRule, Ranked, RuleCondition, Votes,
} from "./types";
import {
  ACCENT_ROLES, BACKGROUND_ROLES, CAPITALIZATIONS, COLOR_COMPLEXITIES, COMPOSITION_STRUCTURES, CONTRAST_KINDS, DECORATION_LEVELS, DECORATIVE_ELEMENTS, DENSITIES,
  DISPLAY_BODY_RELATIONS, DOMINANT_COLOR_ROLES, FAMILY_COUNTS, FONT_CATEGORIES, HIERARCHY_ROLES, IMAGE_DOMINANCES, IMAGE_PLACEMENTS, IMAGE_REGISTERS, IMAGERY_MODES,
  LETTER_SPACINGS, MATERIAL_CUES, SATURATIONS, STRENGTH_WEIGHT, TEMPERATURES, TONE_AXES, TONE_AXIS_KEYS, TYPE_TRAITS, WHITESPACES, priorityRank,
  type BrandTrait, type ContrastKind, type RulePriority, type ToneAxis, type ToneValue,
} from "./vocabulary";

const ART_STYLE_VALUES: readonly ArtStyle[] = ART_STYLES;

/** Ordinal scales: a conflict is only worth recording when the values are at least two steps apart. */
const ORDINAL: Readonly<Record<string, readonly string[]>> = {
  density: DENSITIES, whitespace: WHITESPACES, decorationLevel: DECORATION_LEVELS, saturation: SATURATIONS, colorComplexity: COLOR_COMPLEXITIES,
  hierarchyStrength: LEVELS, weightContrast: LEVELS, focalIsolation: LEVELS, shelfEmphasis: LEVELS, imageDominance: IMAGE_DOMINANCES,
};

/** What a conflict between two values of a facet means for the design (PI-6 can quote it). */
const CONFLICT_NOTES: Readonly<Record<string, string>> = {
  "density:minimal/informationRich": "Épure demandée face à une information obligatoire : face avant minimale ; les mentions obligatoires restent, regroupées au dos — jamais supprimées.",
  "density:informationRich/minimal": "Information obligatoire + désir d'épure : face avant épurée, informations regroupées et hiérarchisées au dos.",
  "density:informationRich/balanced": "L'information requise l'emporte ; la structurer plutôt que la réduire.",
  "saturation:vivid/muted": "Couleur vive demandée face à une préférence pour la retenue : la demande explicite est gardée, la retenue passe par la composition.",
  "saturation:muted/vivid": "La retenue l'emporte sur la couleur vive ; l'énergie passe par la composition.",
};

// ─── Context and rule selection ──────────────────────────────────────────────

interface Context {
  pi: ProductIntelligence;
  /** Positioning signals with their weight: user 3, PI-1 positioning 2, derived from audience/price 1. */
  signals: Map<PositioningTerritory, number>;
}

function contextOf(pi: ProductIntelligence, d: DesignDirectives | undefined): Context {
  const signals = new Map<PositioningTerritory, number>();
  const add = (p: PositioningTerritory, w: number) => signals.set(p, Math.max(signals.get(p) ?? 0, w));
  for (const p of pi.positioningTerritories ?? []) add(p, 2);
  for (const a of pi.targetAudience ?? []) for (const p of DERIVED_SIGNALS[a] ?? []) add(p, 1);
  if (pi.pricePosition && pi.pricePosition !== "unknown") for (const p of DERIVED_SIGNALS[`price:${pi.pricePosition}`] ?? []) add(p, 1);
  for (const p of d?.positioning ?? []) add(p, 3);
  return { pi, signals };
}

function matches(when: RuleCondition, c: Context): boolean {
  const { pi } = c;
  if (when.always) return true;
  if (when.positioning && !(pi.positioningTerritories ?? []).includes(when.positioning)) return false;
  if (when.allPositioning && !when.allPositioning.every((p) => c.signals.has(p))) return false;
  if (when.category && pi.productCategory !== when.category) return false;
  if (when.subcategory && pi.productSubcategory !== when.subcategory) return false;
  if (when.audience && !(pi.targetAudience ?? []).includes(when.audience as never)) return false;
  if (when.pricePosition && pi.pricePosition !== when.pricePosition) return false;
  if (when.requirement) {
    const v = pi.packagingRequirements?.[when.requirement[0] as keyof NonNullable<ProductIntelligence["packagingRequirements"]>];
    if (!(v === "required" || (when.requirement[1] === "preferred" && v === "preferred"))) return false;
  }
  if (when.shelfImportance && !(pi.shelfImportance && when.shelfImportance.includes(pi.shelfImportance as never))) return false;
  return true;
}

const BRAND_TONE: Readonly<Record<BrandTrait, Partial<Record<ToneAxis, ToneValue>>>> = {
  authoritative: { register: -1, weight: 1 }, warm: { register: 1 }, rebellious: { restraint: 2, era: 1 }, elegant: { restraint: -1, weight: -1 }, trustworthy: { register: -1, restraint: -1 },
  youthful: { era: 1, energy: 1 }, scientific: { register: -2 }, artisanal: { era: -1, register: 1 }, culturallyRooted: { register: 1 }, innovative: { era: 2 }, accessible: { access: -2 },
};

/** The user's (or the brand's) explicit intent, as rules of the highest priorities. */
function directiveRules(d: DesignDirectives | undefined, positioningRules: Map<PositioningTerritory, GrammarRule>): GrammarRule[] {
  if (!d) return [];
  const priority: RulePriority = d.source === "brand" ? "brandDirection" : "userBrief";
  const provenance: Provenance = d.source === "brand" ? { sourceType: "user", sourceId: "brand-direction", confidence: "high" } : userProvenance("design-brief");
  const make = (id: string, effects: GrammarEffects, rationale: string): GrammarRule => ({ id: `${priority}.${id}`, when: { always: true }, priority, strength: "high", effects, rationale, provenance });
  const out: GrammarRule[] = [];
  for (const p of d.positioning ?? []) {
    const base = positioningRules.get(p);
    if (base) out.push(make(`positioning.${p}`, base.effects, `Demandé explicitement : ${p}. ${base.rationale}`));
  }
  const intensity = d.colors?.find((c) => c.intensity)?.intensity;
  if (intensity) out.push(make("color.intensity", { saturation: intensity, ...(intensity === "vivid" ? { contrast: { color: "high" } } : {}) }, "Intensité de couleur demandée."));
  if (d.density) out.push(make("density", { density: d.density }, "Densité demandée."));
  if (d.whitespace) out.push(make("whitespace", { whitespace: d.whitespace }, "Espace demandé."));
  if (d.decorationLevel) out.push(make("decoration", { decorationLevel: d.decorationLevel }, "Niveau d'ornement demandé."));
  for (const t of d.brandTraits ?? []) out.push(make(`brand.${t}`, { tone: BRAND_TONE[t] }, `Personnalité de marque : ${t}.`));
  return out;
}

// ─── Resolution helpers ──────────────────────────────────────────────────────

const orderRules = (rules: GrammarRule[]) =>
  [...rules].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || STRENGTH_WEIGHT[b.strength] - STRENGTH_WEIGHT[a.strength]);

interface Resolver { rules: GrammarRule[]; conflicts: GrammarConflict[]; /** facet:item → priority that decided an avoidance */ avoidedBy: Map<string, RulePriority> }

function strategyFor(winner: GrammarRule[], loser: GrammarRule[]): GrammarConflict["strategy"] {
  const wp = Math.max(...winner.map((r) => priorityRank(r.priority))), lp = Math.max(...loser.map((r) => priorityRank(r.priority)));
  if (winner.some((r) => r.priority === "userBrief" || r.priority === "brandDirection") && wp > lp) return "userOverride";
  if (winner.some((r) => r.resolves)) return "namedResolution";
  return wp > lp ? "higherPriority" : "strongerRule";
}

/** One value per facet: highest priority, then summed strength, then vocabulary order. */
function decide<T>(res: Resolver, pick: (e: GrammarEffects) => T | undefined, vocab: readonly T[], facet: string): Decided<T> {
  const votes = res.rules.map((r) => ({ r, v: pick(r.effects) })).filter((x): x is { r: GrammarRule; v: T } => x.v !== undefined);
  if (!votes.length) return { value: "unknown", priority: null, because: [] };
  const top = Math.max(...votes.map((x) => priorityRank(x.r.priority)));
  const layer = votes.filter((x) => priorityRank(x.r.priority) === top);
  const weight = new Map<T, number>();
  for (const x of layer) weight.set(x.v, (weight.get(x.v) ?? 0) + STRENGTH_WEIGHT[x.r.strength]);
  const best = Math.max(...weight.values());
  const tied = [...weight.keys()].filter((v) => weight.get(v) === best).sort((a, b) => vocab.indexOf(a) - vocab.indexOf(b));
  // A tie on an ordinal scale blends: the tied value closest to the weighted mean of the layer's votes
  // (natural "muted" + energetic "vivid" + accessible "balanced" → "balanced"). Otherwise vocabulary order.
  const scale = ORDINAL[facet];
  let value = tied[0];
  if (tied.length > 1 && scale) {
    const total = layer.reduce((a, x) => a + STRENGTH_WEIGHT[x.r.strength], 0);
    const mean = layer.reduce((a, x) => a + scale.indexOf(String(x.v)) * STRENGTH_WEIGHT[x.r.strength], 0) / total;
    value = [...tied].sort((a, b) => Math.abs(scale.indexOf(String(a)) - mean) - Math.abs(scale.indexOf(String(b)) - mean) || scale.indexOf(String(a)) - scale.indexOf(String(b)))[0];
  }
  const winners = votes.filter((x) => x.v === value).map((x) => x.r);
  // the strongest real alternative (defaults never count as a conflict)
  const others = votes.filter((x) => x.v !== value && x.r.priority !== "aestheticDefault");
  if (others.length) {
    const alt = others.sort((a, b) => priorityRank(b.r.priority) - priorityRank(a.r.priority) || STRENGTH_WEIGHT[b.r.strength] - STRENGTH_WEIGHT[a.r.strength])[0];
    const far = !scale || Math.abs(scale.indexOf(String(value)) - scale.indexOf(String(alt.v))) >= 2;
    if (far) {
      const losers = others.filter((x) => x.v === alt.v).map((x) => x.r);
      res.conflicts.push({
        facet, between: [String(value), String(alt.v)], strategy: strategyFor(winners, losers), resolution: String(value),
        rationale: CONFLICT_NOTES[`${facet}:${String(value)}/${String(alt.v)}`] ?? `« ${String(value)} » retenu (${layer[0].r.priority}) face à « ${String(alt.v)} » (${alt.r.priority}).`,
        rules: [...new Set([...winners, ...losers].map((r) => r.id))],
      });
    }
  }
  return { value, priority: layer[0].r.priority, because: [...new Set(winners.map((r) => r.id))] };
}

/** A ranked facet: each item's sign is decided by its highest-priority votes; prefer / secondary / avoid. */
function rank<T extends string>(res: Resolver, pick: (r: GrammarRule) => Votes<T> | undefined, vocab: readonly T[], facet: string, keep = 3): Ranked<T> {
  const items = new Map<T, { sign: number; top: number; score: number; pro: GrammarRule[]; con: GrammarRule[] }>();
  for (const r of res.rules) {
    const v = pick(r);
    if (!v) continue;
    const w = STRENGTH_WEIGHT[r.strength], p = priorityRank(r.priority);
    for (const [list, s] of [[v.prefer ?? [], 1], [v.avoid ?? [], -1]] as const) {
      for (const it of list) {
        const cur = items.get(it) ?? { sign: 0, top: 0, score: 0, pro: [], con: [] };
        (s > 0 ? cur.pro : cur.con).push(r);
        cur.score += s * w * p;
        items.set(it, cur);
      }
    }
  }
  const because = new Set<string>();
  for (const [it, x] of items) {
    const top = Math.max(...[...x.pro, ...x.con].map((r) => priorityRank(r.priority)));
    const net = [...x.pro.filter((r) => priorityRank(r.priority) === top).map((r) => STRENGTH_WEIGHT[r.strength]), ...x.con.filter((r) => priorityRank(r.priority) === top).map((r) => -STRENGTH_WEIGHT[r.strength])].reduce((a, b) => a + b, 0);
    x.top = top;
    x.sign = net !== 0 ? Math.sign(net) : Math.sign(x.score) || 1;
    for (const r of [...x.pro, ...x.con]) because.add(r.id);
    if (x.sign < 0) res.avoidedBy.set(`${facet}:${it}`, (x.con.find((r) => priorityRank(r.priority) === top) ?? x.con[0]).priority);
    const losers = x.sign > 0 ? x.con : x.pro;
    if (losers.some((r) => STRENGTH_WEIGHT[r.strength] >= 2)) {
      const winners = x.sign > 0 ? x.pro : x.con;
      res.conflicts.push({
        facet: `${facet}.${it}`, between: x.sign > 0 ? ["prefer", "avoid"] : ["avoid", "prefer"], strategy: strategyFor(winners, losers), resolution: x.sign > 0 ? "prefer" : "avoid",
        rationale: `« ${it} » : ${x.sign > 0 ? "préféré" : "évité"} (${winners[0].priority}) malgré ${losers.map((r) => r.id).join(", ")}.`, rules: [...new Set([...winners, ...losers].map((r) => r.id))],
      });
    }
  }
  const order = (a: T, b: T) => items.get(b)!.top - items.get(a)!.top || Math.abs(items.get(b)!.score) - Math.abs(items.get(a)!.score) || vocab.indexOf(a) - vocab.indexOf(b);
  const pos = [...items.keys()].filter((k) => items.get(k)!.sign > 0).sort(order);
  return { prefer: pos.slice(0, keep), secondary: pos.slice(keep), avoid: [...items.keys()].filter((k) => items.get(k)!.sign < 0).sort(order), because: [...because].sort() };
}

/** Tone: weighted mean of the votes (strength × priority); explicit intent alone decides when present. */
function tone(res: Resolver): DesignGrammar["tone"] {
  const out = {} as DesignGrammar["tone"];
  for (const axis of TONE_AXIS_KEYS) {
    const votes = res.rules.filter((r) => r.effects.tone?.[axis] !== undefined).map((r) => ({ r, v: r.effects.tone![axis]! }));
    if (!votes.length) { out[axis] = { value: "unknown", priority: null, because: [] }; continue; }
    const decisive = votes.filter((x) => x.r.priority === "userBrief" || x.r.priority === "brandDirection");
    const used = decisive.length ? decisive : votes;
    const wsum = used.reduce((a, x) => a + STRENGTH_WEIGHT[x.r.strength] * priorityRank(x.r.priority), 0);
    const mean = used.reduce((a, x) => a + x.v * STRENGTH_WEIGHT[x.r.strength] * priorityRank(x.r.priority), 0) / wsum;
    const value = (Math.max(-2, Math.min(2, Math.round(mean))) || 0) as ToneValue; // never -0
    const neg = votes.filter((x) => x.v < 0 && STRENGTH_WEIGHT[x.r.strength] >= 2), posv = votes.filter((x) => x.v > 0 && STRENGTH_WEIGHT[x.r.strength] >= 2);
    if (neg.length && posv.length) {
      const [a, b] = TONE_AXES[axis];
      res.conflicts.push({
        facet: `tone.${axis}`, between: [a, b], strategy: decisive.length ? "userOverride" : used.some((x) => x.r.resolves) ? "namedResolution" : "blend",
        resolution: value < 0 ? a : value > 0 ? b : "balanced",
        rationale: decisive.length ? "La demande explicite fixe le ton." : value === 0 ? `Signaux ${a} et ${b} équilibrés : ton médian.` : `Moyenne pondérée des signaux : penche vers « ${value < 0 ? a : b} ».`,
        rules: [...new Set([...neg, ...posv].map((x) => x.r.id))],
      });
    }
    const top = Math.max(...used.map((x) => priorityRank(x.r.priority)));
    out[axis] = { value, priority: used.find((x) => priorityRank(x.r.priority) === top)!.r.priority, because: [...new Set(used.map((x) => x.r.id))] };
  }
  return out;
}

function territory(c: Context): DesignTerritoryMatch {
  const signals = [...c.signals.entries()].sort((a, b) => b[1] - a[1] || POSITIONING_TERRITORIES.indexOf(a[0]) - POSITIONING_TERRITORIES.indexOf(b[0])).map(([p]) => p);
  const scored = DESIGN_TERRITORIES.map((t, i) => {
    const hit = t.signature.filter((p) => c.signals.has(p));
    // a signal the user asked for (weight 3) is enough on its own, and its territories come first
    const user = hit.some((p) => c.signals.get(p) === 3);
    const enough = (hit.length >= Math.min(2, t.signature.length) || user) && (t.requires ?? []).every((p) => c.signals.has(p));
    return { t, i, user, score: enough ? hit.reduce((a, p) => a + c.signals.get(p)!, 0) + hit.length / t.signature.length : 0 };
  }).filter((x) => x.score > 0).sort((a, b) => Number(b.user) - Number(a.user) || b.score - a.score || a.i - b.i);
  return { primary: scored[0]?.t.id ?? null, secondary: scored.slice(1, 3).map((x) => x.t.id), signals };
}

const CONF_ORDER: readonly Confidence[] = ["unknown", "low", "medium", "high"];
const minConf = (a: Confidence, b: Confidence) => (CONF_ORDER.indexOf(a) <= CONF_ORDER.indexOf(b) ? a : b);

// ─── Inference ───────────────────────────────────────────────────────────────

export function inferDesignGrammar(pi: ProductIntelligence, directives?: DesignDirectives): DesignGrammar {
  const c = contextOf(pi, directives);
  const positioningRules = new Map(GRAMMAR_RULES.filter((r) => r.when.positioning).map((r) => [r.when.positioning!, r]));
  const res: Resolver = { rules: orderRules([...directiveRules(directives, positioningRules), ...GRAMMAR_RULES.filter((r) => matches(r.when, c))]), conflicts: [], avoidedBy: new Map() };

  // Named conflict resolutions first, so their record leads the list.
  for (const r of res.rules.filter((x) => x.resolves)) {
    const [a, b] = r.when.allPositioning!;
    res.conflicts.push({ facet: "positioning", between: [a, b], strategy: "namedResolution", resolution: r.resolves!, rationale: r.rationale, rules: [r.id] });
  }

  const d = <T,>(key: keyof GrammarEffects, vocab: readonly T[]) => decide(res, (e) => e[key] as T | undefined, vocab, key);
  const contrastOf = (k: ContrastKind) => decide(res, (e) => e.contrast?.[k], LEVELS, `contrast.${k}`);

  const hierarchyRule = res.rules.find((r) => r.effects.hierarchyLead);
  const lead = hierarchyRule?.effects.hierarchyLead ?? [];
  const order: ElementRole[] = [...lead, ...HIERARCHY_ROLES.filter((r) => !lead.includes(r))];

  const composition = rank(res, (r) => r.effects.composition, COMPOSITION_STRUCTURES, "composition");
  // Layouts: each structure votes for the existing layouts that realise it (adapter, no new layout);
  // their conflicts are those of the composition, already recorded.
  const layoutsRanked = rank({ ...res, conflicts: [] }, (r) => r.effects.composition && {
    prefer: [...new Set((r.effects.composition.prefer ?? []).flatMap((st) => STRUCTURE_LAYOUTS[st]))],
    avoid: [...new Set((r.effects.composition.avoid ?? []).flatMap((st) => STRUCTURE_LAYOUTS[st]))],
  }, LAYOUTS, "layouts");

  const typography: DesignGrammar["typography"] = {
    classes: rank(res, (r) => r.effects.typeClasses, FONT_CATEGORIES, "typography.classes", 2),
    traits: rank(res, (r) => r.effects.typeTraits, TYPE_TRAITS, "typography.traits"),
    hierarchyStrength: d("hierarchyStrength", LEVELS),
    weightContrast: d("weightContrast", LEVELS),
    letterSpacing: d("letterSpacing", LETTER_SPACINGS),
    capitalization: d("capitalization", CAPITALIZATIONS),
    maxFamilies: d("maxFamilies", FAMILY_COUNTS),
    displayBodyRelation: d("displayBodyRelation", DISPLAY_BODY_RELATIONS),
  };
  // one family means a single family for display and body
  if (typography.maxFamilies.value === 1) typography.displayBodyRelation = { value: "singleFamily", priority: typography.maxFamilies.priority, because: typography.maxFamilies.because };

  const color: DesignGrammar["color"] = {
    complexity: d("colorComplexity", COLOR_COMPLEXITIES),
    saturation: d("saturation", SATURATIONS),
    temperature: d("temperature", TEMPERATURES),
    background: d("background", BACKGROUND_ROLES),
    accentRole: d("accentRole", ACCENT_ROLES),
    dominantRole: d("dominantColorRole", DOMINANT_COLOR_ROLES),
    contrast: contrastOf("color"),
    requested: (directives?.colors ?? []).map((x) => (x.intensity ? `${x.name} (${x.intensity})` : x.name)),
  };

  const imagery: DesignGrammar["imagery"] = {
    modes: rank(res, (r) => r.effects.imagery, IMAGERY_MODES, "imagery"),
    dominance: d("imageDominance", IMAGE_DOMINANCES),
    placement: d("imagePlacement", IMAGE_PLACEMENTS),
    register: d("imageRegister", IMAGE_REGISTERS),
  };
  const decoration: DesignGrammar["decoration"] = {
    level: d("decorationLevel", DECORATION_LEVELS),
    elements: rank(res, (r) => r.effects.decorative, DECORATIVE_ELEMENTS, "decoration.elements"),
    motifs: rank(res, (r) => r.effects.motifs, MOTIFS as readonly MotifId[], "decoration.motifs"),
  };
  // no decoration → no decorative element or motif is preferred (an impossible state otherwise)
  if (decoration.level.value === "none") {
    decoration.elements = { ...decoration.elements, prefer: [], secondary: [], avoid: [...new Set([...decoration.elements.avoid, ...decoration.elements.prefer, ...decoration.elements.secondary])] };
    decoration.motifs = { ...decoration.motifs, prefer: [], secondary: [], avoid: [...new Set([...decoration.motifs.avoid, ...decoration.motifs.prefer, ...decoration.motifs.secondary])] };
  }

  const emphasis = d("shelfEmphasis", LEVELS);
  const grammar: DesignGrammar = {
    territory: territory(c),
    tone: tone(res),
    typography,
    hierarchy: { order, dominant: order[0], priority: hierarchyRule?.priority ?? null, because: hierarchyRule ? [hierarchyRule.id] : [] },
    composition: { structures: composition, layouts: layoutsRanked },
    color,
    imagery,
    illustration: rank(res, (r) => r.effects.illustration, ART_STYLE_VALUES, "illustration"),
    whitespace: { preference: d("whitespace", WHITESPACES), focalIsolation: d("focalIsolation", LEVELS) },
    density: d("density", DENSITIES),
    contrast: Object.fromEntries(CONTRAST_KINDS.map((k) => [k, k === "color" ? color.contrast : contrastOf(k)])) as DesignGrammar["contrast"],
    decoration,
    materialCues: { cues: rank(res, (r) => r.effects.materialCues, MATERIAL_CUES, "materialCues"), nature: "visualCue", manufacturing: "notAssessed" },
    brandExpression: directives?.brandTraits?.length ? { status: "provided", traits: [...directives.brandTraits] } : { status: "notProvided", traits: [] },
    visibility: {
      shelfImportance: pi.shelfImportance ?? "unknown",
      emphasis,
      focalRole: order[0],
      smallSizeOrder: order.filter((r) => r === "brand" || r === "productName" || r === "image" || r === "claim").slice(0, 3),
      colorBlock: emphasis.value === "high" ? "preferred" : "optional",
    },
    avoidances: [],
    pitfalls: [],
    conflicts: res.conflicts,
    applied: res.rules.map((r) => ({ id: r.id, priority: r.priority, strength: r.strength })),
    archetypeSignals: structuredClone(pi.designSignals ?? {}),
    confidence: "unknown",
    origin: "ruleBased",
    provenance: [],
  };

  // Avoidances: every ranked facet's avoid list, with what decided it (PI-6 checks a design against them).
  const ranked: [string, Ranked<string>][] = [
    ["typography.classes", grammar.typography.classes], ["typography.traits", grammar.typography.traits], ["composition", grammar.composition.structures],
    ["layouts", grammar.composition.layouts], ["imagery", grammar.imagery.modes], ["illustration", grammar.illustration], ["decoration.elements", grammar.decoration.elements],
    ["decoration.motifs", grammar.decoration.motifs], ["materialCues", grammar.materialCues.cues],
  ];
  grammar.avoidances = ranked.flatMap(([facet, r]): Avoidance[] => r.avoid.map((value) => ({ facet, value, priority: res.avoidedBy.get(`${facet}:${value}`) ?? "general", because: r.because })));
  const pitfalls = new Map<string, string[]>();
  for (const r of res.rules) for (const p of r.effects.pitfalls ?? []) pitfalls.set(p, [...(pitfalls.get(p) ?? []), r.id]);
  for (const [k, s] of Object.entries(pi.designSignals ?? {})) for (const a of s?.avoid ?? []) pitfalls.set(a, [...(pitfalls.get(a) ?? []), `archetype.${k}`]);
  grammar.pitfalls = [...pitfalls.entries()].map(([text, because]) => ({ text, because }));

  // Trust: never more confident than PI-1 and never above "medium" for internal heuristics; without any
  // product knowledge or explicit intent, only defaults spoke → "unknown".
  const knows = !!(pi.productCategory || pi.positioningTerritories?.length || pi.targetAudience?.length);
  const piConf = CONFIDENCE_LEVELS.includes(pi.confidence) ? pi.confidence : "unknown";
  grammar.confidence = knows ? minConf(piConf, "medium") : directives ? "low" : "unknown";
  const prov = [PI2_GRAMMAR_SOURCE, ...(directives ? [userProvenance(directives.source === "brand" ? "brand-direction" : "design-brief")] : []), ...pi.provenance];
  grammar.provenance = prov.filter((p, i) => prov.findIndex((q) => q.sourceType === p.sourceType && q.sourceId === p.sourceId) === i).map((p) => ({ ...p }));
  return grammar;
}
