/**
 * PI-5 — buildMasterDesignIntent(input) → MasterDesignIntent.
 *
 *   brief + explicit intent ─→ normalise (PI-2 lexicon) ─→ PI-1 product ─→ PI-2 grammar ─→ PI-3 category
 *   ─→ PI-4 evidence (unless disabled) ─→ packaging (resolver, read-only) ─→ priorities + conflicts
 *   ─→ visual direction, hierarchy, claims, constraints, negative directions, shot intent, provenance
 *
 * Pure, deterministic, local: no network, no clock, no randomness; inputs are never mutated. It consumes
 * the existing layers and decides nothing they already decide: the resolver picks the structure, PI-2 the
 * grammar, PI-3 the category knowledge, PI-4 the evidence, resolveShot the camera.
 */
import type { ElementRole } from "@/lib/structure";
import { familyOfShape, isSupportedShape, resolvePackaging } from "@/lib/catalog/packagingResolver";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  inferProductIntelligence, resolverFamiliesFor, userProvenance, withUserFacts, type Confidence, type PositioningTerritory, type ProductIntelligence, type Provenance,
} from "@/lib/intelligence/taxonomy";
import { DESIGN_TERRITORIES, TONE_AXES, TONE_AXIS_KEYS, inferDesignGrammar, type Decided, type DesignGrammar, type GrammarConflict, type RulePriority } from "@/lib/intelligence/grammar";
import { inferCategoryKnowledge, type AppliedKnowledge, type CategoryKnowledgeResult } from "@/lib/intelligence/category";
import { contextFromProductIntelligence, getEvidenceForKnowledge, type KnowledgeEvidence } from "@/lib/intelligence/reference";
import { normalizeIntent, type NormalizedIntent } from "./normalize";
import { resolveShotIntent } from "./shot";
import type { HierarchyEntry, IntentConflict, IntentValue, KnowledgeIntent, MasterDesignIntent, MasterDesignIntentInput, Unknown } from "./types";
import { MASTER_DESIGN_INTENT_VERSION, type IntentPriority, type IntentSource, type IntentStatus, type Sophistication, type VisualDensity } from "./vocabulary";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONF: readonly Confidence[] = ["unknown", "low", "medium", "high"];
const minConf = (...xs: Confidence[]) => xs.reduce((a, b) => (CONF.indexOf(b) < CONF.indexOf(a) ? b : a), "high" as Confidence);
const maxConf = (xs: Confidence[]) => xs.reduce((a, b) => (CONF.indexOf(b) > CONF.indexOf(a) ? b : a), "unknown" as Confidence);
const unknown = (source: IntentSource, priority: IntentPriority, rationale: string): Unknown => ({ value: "unknown", status: "inferred", source, priority, confidence: "unknown", rationale });

/** PI-2 rule priorities in the PI-5 source order. */
const FROM_GRAMMAR: Readonly<Record<RulePriority, IntentPriority>> = {
  userBrief: "userRequirement", brandDirection: "brandIdentity", productConstraint: "mandatoryProductInfo", safetyRegulatory: "hardConstraint",
  category: "positioning", positioning: "positioning", audience: "audience", general: "creativeInference", aestheticDefault: "creativeInference",
};
const isExplicit = (p: RulePriority | null) => p === "userBrief" || p === "brandDirection";

/** A PI-2 decision as an intent value (explicit when the user's or the brand's rule decided it). */
function fromDecided<T>(d: Decided<T>, label: (v: T) => string, grammarConf: Confidence, rationale: string): IntentValue<string> | null {
  if (d.value === "unknown") return null;
  const explicit = isExplicit(d.priority);
  return {
    value: label(d.value as T), status: explicit ? "explicit" : "inferred", source: explicit ? "user" : "designGrammar",
    priority: d.priority ? FROM_GRAMMAR[d.priority] : "creativeInference", confidence: explicit ? "high" : d.priority === "aestheticDefault" ? "low" : grammarConf, rationale, refs: d.because,
  };
}
function fromRanked(prefix: string, r: { prefer: string[]; avoid: string[]; because: string[] }, conf: Confidence, rationale: string, explicit = false): IntentValue<string>[] {
  const v = (value: string): IntentValue<string> => ({ value, status: explicit ? "explicit" : "inferred", source: explicit ? "user" : "designGrammar", priority: explicit ? "userRequirement" : "positioning", confidence: explicit ? "high" : conf, rationale, refs: r.because });
  return [...(r.prefer.length ? [v(`${prefix}: ${r.prefer.join(", ")}`)] : []), ...(r.avoid.length ? [v(`${prefix} à éviter: ${r.avoid.join(", ")}`)] : [])];
}

// ─── Product, brand, packaging ───────────────────────────────────────────────

function productSection(input: MasterDesignIntentInput, pi: ProductIntelligence, archetypeId: string | null, norm: NormalizedIntent, ctxJur: string[]): MasterDesignIntent["product"] {
  const piConf = pi.confidence === "high" ? "medium" : pi.confidence;
  const inferred = (value: string, rationale: string, priority: IntentPriority = "positioning"): IntentValue<string> => ({ value, status: "inferred", source: "productIntelligence", priority, confidence: piConf, rationale, refs: archetypeId ? [`archetype.${archetypeId}`] : [] });
  const name = input.content?.productName?.trim();
  const explicitP = new Set(norm.explicitPositioning);
  const positioning: IntentValue<PositioningTerritory>[] = [
    ...norm.explicitPositioning.map((p): IntentValue<PositioningTerritory> => ({ value: p, status: "explicit", source: "user", priority: "userRequirement", confidence: "high", rationale: "Demandé explicitement." })),
    ...(pi.positioningTerritories ?? []).filter((p) => !explicitP.has(p)).map((p) => inferred(p, "Positionnement habituel de l'archétype produit (PI-1).") as IntentValue<PositioningTerritory>),
  ];
  return {
    name: name ? { value: name, status: "explicit", source: "user", priority: "mandatoryProductInfo", confidence: "high", rationale: "Nom donné par l'utilisateur." } : unknown("user", "mandatoryProductInfo", "Nom du produit non fourni : il n'est pas inventé."),
    category: pi.productCategory ? inferred(pi.productCategory, "Catégorie reconnue dans le brief (PI-1).") : unknown("productIntelligence", "positioning", "Catégorie non reconnue."),
    subcategory: pi.productSubcategory ? inferred(pi.productSubcategory, "Sous-catégorie reconnue dans le brief (PI-1).") : unknown("productIntelligence", "positioning", "Sous-catégorie non reconnue."),
    archetypeId,
    positioning,
    audience: (pi.targetAudience ?? []).map((a) => inferred(a, "Audience habituelle de l'archétype produit (PI-1).", "audience")),
    market: { countries: [...(input.marketCountries ?? [])], jurisdictions: ctxJur as MasterDesignIntent["product"]["market"]["jurisdictions"], status: input.marketCountries?.length ? "explicit" : "unknown" },
  };
}

function brandSection(input: MasterDesignIntentInput): MasterDesignIntent["brand"] {
  const name = input.content?.brandName?.trim();
  return {
    name: name ? { value: name, status: "explicit", source: "user", priority: "mandatoryProductInfo", confidence: "high", rationale: "Marque donnée par l'utilisateur." } : unknown("user", "brandIdentity", "Marque non fournie : elle n'est pas inventée."),
    personality: (input.brandTraits ?? []).map((t) => ({ value: t, status: "explicit", source: "brand", priority: "brandIdentity", confidence: "high", rationale: "Personnalité de marque fournie." })),
    values: "notProvided",
  };
}

function packagingSection(input: MasterDesignIntentInput): MasterDesignIntent["packaging"] {
  const resolution = resolvePackaging(input.brief); // read-only: the resolver applies phrase specificity
  const given = input.shapeId !== undefined;
  const shapeId = given ? input.shapeId ?? null : resolution.shapeId;
  const row = shapeId ? SHAPE_ROWS.find((r) => r[0] === shapeId) : undefined;
  const product = resolution.intent.product;
  return {
    shapeId,
    name: row?.[1] ?? null,
    family: shapeId ? familyOfShape(shapeId) : null,
    supported: isSupportedShape(shapeId),
    dimensionsMm: row ? { length: row[4], width: row[5], height: row[6] } : null,
    material: row?.[7] ?? null,
    source: shapeId ? (given ? "user" : "packagingResolver") : null,
    recognisedProduct: product?.product ?? null,
    recognitionPrecision: !product ? "none" : resolution.intent.productMatch === "family" ? "family" : "exact",
  };
}

// ─── Visual direction (PI-2) ─────────────────────────────────────────────────

function visualSection(g: DesignGrammar, norm: NormalizedIntent): MasterDesignIntent["visual"] {
  const conf = g.confidence;
  const territory = DESIGN_TERRITORIES.find((t) => t.id === g.territory.primary);
  const explicitP = new Set(norm.explicitPositioning);
  const style: IntentValue<string>[] = [
    ...norm.explicitPositioning.map((p): IntentValue<string> => ({ value: p, status: "explicit", source: "user", priority: "userRequirement", confidence: "high", rationale: "Style demandé explicitement." })),
    ...g.territory.signals.filter((p) => !explicitP.has(p)).map((p): IntentValue<string> => ({ value: p, status: "inferred", source: "designGrammar", priority: "positioning", confidence: conf, rationale: "Signal de positionnement lu par la grammaire (PI-2)." })),
  ];
  const mood = TONE_AXIS_KEYS.flatMap((axis): IntentValue<string>[] => {
    const t = g.tone[axis];
    if (t.value === "unknown" || t.value === 0) return [];
    const pole = TONE_AXES[axis][t.value < 0 ? 0 : 1];
    const explicit = isExplicit(t.priority);
    return [{ value: Math.abs(t.value) === 2 ? `${pole} (fort)` : pole, status: explicit ? "explicit" : "inferred", source: explicit ? "user" : "designGrammar", priority: t.priority ? FROM_GRAMMAR[t.priority] : "creativeInference", confidence: explicit ? "high" : conf, rationale: `Ton ${axis} (PI-2).`, refs: t.because }];
  });
  const access = g.tone.access;
  const sophistication: IntentValue<Sophistication> | Unknown = access.value === "unknown" ? unknown("designGrammar", "positioning", "Aucun signal d'exclusivité ou d'accessibilité.")
    : { value: access.value >= 2 ? "high" : access.value === 1 ? "elevated" : access.value === 0 ? "standard" : "accessible", status: isExplicit(access.priority) ? "explicit" : "inferred", source: isExplicit(access.priority) ? "user" : "designGrammar", priority: access.priority ? FROM_GRAMMAR[access.priority] : "creativeInference", confidence: isExplicit(access.priority) ? "high" : conf, rationale: "Lu sur l'axe accessible ↔ exclusif (PI-2).", refs: access.because };
  const d = g.density, ws = g.whitespace.preference;
  const density: VisualDensity | null = d.value === "unknown" ? null : d.value === "minimal" ? (ws.value === "generous" ? "sparse" : "restrained") : d.value === "balanced" ? "balanced" : d.value === "informationRich" ? "informationRich" : "dense";
  const visualDensity: IntentValue<VisualDensity> | Unknown = !density ? unknown("designGrammar", "creativeInference", "Densité non déterminée.")
    : { value: density, status: isExplicit(d.priority) ? "explicit" : "inferred", source: isExplicit(d.priority) ? "user" : "designGrammar", priority: d.priority ? FROM_GRAMMAR[d.priority] : "creativeInference", confidence: isExplicit(d.priority) ? "high" : d.priority === "aestheticDefault" ? "low" : conf, rationale: `Densité ${d.value} et espace ${ws.value} (PI-2).`, refs: d.because };

  const c = g.color;
  const colorDirection = [
    ...c.requested.map((r): IntentValue<string> => ({ value: `couleur demandée: ${r}`, status: "explicit", source: "user", priority: "userRequirement", confidence: "high", rationale: "Couleur demandée explicitement ; aucune valeur RVB n'est fixée ici." })),
    fromDecided(c.complexity, (v) => `palette: ${v}`, conf, "Complexité de palette (PI-2)."),
    fromDecided(c.saturation, (v) => `saturation: ${v}`, conf, "Saturation (PI-2)."),
    fromDecided(c.temperature, (v) => `température: ${v}`, conf, "Température (PI-2)."),
    fromDecided(c.background, (v) => `fond: ${v}`, conf, "Rôle du fond (PI-2)."),
    fromDecided(c.accentRole, (v) => `accent: ${v}`, conf, "Rôle de l'accent (PI-2)."),
    fromDecided(c.contrast, (v) => `contraste couleur: ${v}`, conf, "Contraste de couleur (PI-2)."),
  ].filter((x): x is IntentValue<string> => !!x);
  const t = g.typography;
  const typographyDirection = [
    ...fromRanked("classes", t.classes, conf, "Classes typographiques (PI-2) ; la police elle-même est choisie plus tard."),
    ...fromRanked("caractère", t.traits, conf, "Traits typographiques (PI-2)."),
    fromDecided(t.maxFamilies, (v) => `familles max: ${v}`, conf, "Nombre de familles (PI-2)."),
    fromDecided(t.displayBodyRelation, (v) => `titre/texte: ${v}`, conf, "Relation titre / texte (PI-2)."),
    fromDecided(t.letterSpacing, (v) => `interlettrage: ${v}`, conf, "Interlettrage (PI-2)."),
    fromDecided(t.hierarchyStrength, (v) => `force de hiérarchie: ${v}`, conf, "Force de hiérarchie (PI-2)."),
  ].filter((x): x is IntentValue<string> => !!x);
  const imageryDirection = [
    ...fromRanked("imagerie", g.imagery.modes, conf, "Modes d'imagerie (PI-2)."),
    ...fromRanked("illustration", g.illustration, conf, "Styles d'illustration existants (PI-2)."),
    fromDecided(g.imagery.dominance, (v) => `présence de l'image: ${v}`, conf, "Dominance de l'image (PI-2)."),
    fromDecided(g.imagery.register, (v) => `registre: ${v}`, conf, "Registre de l'image (PI-2)."),
  ].filter((x): x is IntentValue<string> => !!x);
  const compositionDirection = [
    ...fromRanked("structure", g.composition.structures, conf, "Structures de composition (PI-2)."),
    ...fromRanked("mises en page existantes", g.composition.layouts, conf, "Mises en page du moteur existant qui réalisent ces structures."),
    fromDecided(ws, (v) => `espace: ${v}`, conf, "Espace (PI-2)."),
    fromDecided(g.whitespace.focalIsolation, (v) => `isolement du point focal: ${v}`, conf, "Isolement du point focal (PI-2)."),
    fromDecided(g.decoration.level, (v) => `ornement: ${v}`, conf, "Niveau d'ornement (PI-2)."),
  ].filter((x): x is IntentValue<string> => !!x);

  return {
    territory: territory ? { value: territory.id, status: "inferred", source: "designGrammar", priority: "positioning", confidence: conf, rationale: `Territoire lu sur les signaux ${g.territory.signals.join(", ") || "—"} (PI-2).` } : unknown("designGrammar", "positioning", "Aucun territoire : pas assez de signaux."),
    style, mood, sophistication, visualDensity, colorDirection, typographyDirection, imageryDirection, compositionDirection,
  };
}

// ─── Hierarchy ───────────────────────────────────────────────────────────────

const CONTENT_ROLES: readonly ElementRole[] = ["brand", "productName", "subtitle", "claim", "image", "netContent", "bodyText", "regulatory", "barcode"];
const SUPPORTING_ROLES: readonly ElementRole[] = ["bodyText", "regulatory", "barcode"];

function hierarchySection(input: MasterDesignIntentInput, g: DesignGrammar, k: CategoryKnowledgeResult): MasterDesignIntent["hierarchy"] {
  // explicit intent → PI-2 order; otherwise the category's usual order (PI-3) when known; else PI-2.
  const fromCategory = !isExplicit(g.hierarchy.priority) && k.informationPriorities.order.length > 0;
  const order = (fromCategory ? k.informationPriorities.order : g.hierarchy.order).filter((r) => CONTENT_ROLES.includes(r));
  const c = input.content ?? {};
  const join = (...xs: (string | undefined)[]) => xs.map((x) => x?.trim()).filter(Boolean).join(" · ");
  const contentOf: Partial<Record<ElementRole, string>> = {
    brand: c.brandName?.trim(), productName: c.productName?.trim(), claim: c.tagline?.trim(), netContent: c.volume?.trim(),
    bodyText: join(c.ingredients, c.usage) || undefined, regulatory: join(c.expiry, c.production) || undefined, barcode: c.barcode?.trim(),
  };
  // required: identification (brand, product name), what the category's regulatory knowledge reserves, what the user gave
  const required = new Map<ElementRole, string[]>([["brand", ["identification"]], ["productName", ["identification"]]]);
  for (const it of [...k.regulatory, ...k.informationPriorities.items]) {
    if (it.basis !== "regulatory") continue;
    for (const r of it.relates?.roles ?? []) required.set(r, [...(required.get(r) ?? []), it.id]);
  }
  for (const r of CONTENT_ROLES) if (contentOf[r]) required.set(r, [...(required.get(r) ?? []), "userContent"]);
  const roles = [...order, ...[...required.keys()].filter((r) => !order.includes(r))];
  const entry = (r: ElementRole): HierarchyEntry => ({
    role: r, content: contentOf[r] ?? "notProvided", required: required.has(r),
    because: [...(required.get(r) ?? []), fromCategory ? `category.${k.informationPriorities.from}` : (g.hierarchy.because[0] ?? "designGrammar")],
  });
  const front = roles.filter((r) => !SUPPORTING_ROLES.includes(r));
  return {
    primary: front.slice(0, 2).map(entry),
    secondary: front.slice(2, 4).map(entry),
    tertiary: front.slice(4).map(entry),
    supporting: roles.filter((r) => SUPPORTING_ROLES.includes(r)).map(entry),
  };
}

// ─── Knowledge, references, claims ───────────────────────────────────────────

function knowledgeStatus(e: KnowledgeEvidence | null): IntentStatus {
  if (!e) return "inferred";
  return ["supported", "corroborated", "singleSource"].includes(e.evidenceStatus) ? "supported"
    : e.evidenceStatus === "conflicting" ? "conflicted"
    : e.evidenceStatus === "unsupported" ? "inferred" : "uncertain"; // pending, outOfScope, outdated: never a fact
}

const SENSITIVE_CLAIM = /\b(bio|organic|halal|igp|aop|certifi|label|sans conservateur|naturel|natural|100 ?%|clinique|clinically|teste|dermatolog|guerit|soigne|detox|minceur|sante|immunit|medic)/;
const normText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function claimsAndReferences(input: MasterDesignIntentInput, k: CategoryKnowledgeResult, evidence: Map<string, KnowledgeEvidence | null>, mode: "active" | "disabled") {
  const prohibited = [...new Set((input.prohibitedClaims ?? []).map((p) => p.trim()).filter(Boolean))];
  const isProhibited = (t: string) => prohibited.some((p) => normText(t).includes(normText(p)));
  const product: IntentValue<string>[] = (input.claims ?? []).map((c) => {
    if (isProhibited(c.text)) return { value: c.text, status: "prohibited", source: "user", priority: "hardConstraint", confidence: "high", rationale: "Allégation interdite : exclue." };
    if (c.substantiated) return { value: c.text, status: "validated", source: "user", priority: "validatedClaim", confidence: "high", rationale: "La marque déclare détenir la preuve." };
    if (SENSITIVE_CLAIM.test(normText(c.text))) return { value: c.text, status: "uncertain", source: "user", priority: "validatedClaim", confidence: "low", rationale: "Allégation sensible (certification, santé, naturalité) sans preuve fournie : elle n'est pas une promesse validée." };
    return { value: c.text, status: "explicit", source: "user", priority: "userRequirement", confidence: "medium", rationale: "Allégation donnée par l'utilisateur." };
  });

  const applied: AppliedKnowledge[] = [...k.conventions, ...k.trustSignals, ...k.informationPriorities.items, ...k.regulatory];
  const knowledge: KnowledgeIntent[] = applied.map((it) => {
    const e = evidence.get(it.id) ?? null;
    const usable = (e?.claims ?? []).filter((a) => a.applicability === "inScope" || a.applicability === "international");
    return {
      knowledgeId: it.id, statement: it.statement, status: knowledgeStatus(e), evidenceStatus: e ? e.evidenceStatus : "disabled",
      referenceIds: [...new Set(usable.map((a) => a.reference.id))].sort(), confidence: e?.confidence ?? it.confidence,
    };
  });

  const active = mode === "disabled" ? [] : knowledge.filter((x) => x.status === "supported" && x.referenceIds.length)
    .map((x) => ({ knowledgeId: x.knowledgeId, referenceIds: x.referenceIds, evidenceStatus: x.evidenceStatus as KnowledgeEvidence["evidenceStatus"], confidence: x.confidence }));
  const rejected = new Map<string, string>();
  for (const e of evidence.values()) for (const a of e?.claims ?? []) {
    if (a.applicability === "inScope" || a.applicability === "international") continue;
    const reason = a.applicability === "notVerified" ? "en attente de vérification" : a.applicability === "unconfirmed" ? "juridiction non confirmée" : a.applicability === "outOfScope" ? "hors périmètre" : "obsolète";
    if (!rejected.has(a.reference.id)) rejected.set(a.reference.id, reason);
  }
  return {
    claims: {
      product, knowledge,
      required: knowledge.filter((x) => k.regulatory.some((r) => r.id === x.knowledgeId)).map((x) => x.statement),
      supported: [...product.filter((c) => c.status === "validated" || c.status === "explicit").map((c) => c.value), ...knowledge.filter((x) => x.status === "supported").map((x) => x.statement)],
      uncertain: [...product.filter((c) => c.status === "uncertain").map((c) => c.value), ...knowledge.filter((x) => x.status === "uncertain" || x.status === "conflicted").map((x) => x.statement)],
      prohibited,
    },
    references: {
      mode,
      active,
      influences: active.map((a) => knowledge.find((x) => x.knowledgeId === a.knowledgeId)!.statement),
      rejected: [...rejected.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([referenceId, reason]) => ({ referenceId, reason })),
    },
  };
}

// ─── Constraints and negative directions ─────────────────────────────────────

function constraintsSection(pkg: MasterDesignIntent["packaging"], hierarchy: MasterDesignIntent["hierarchy"], k: CategoryKnowledgeResult, knowledge: KnowledgeIntent[], g: DesignGrammar, prohibitedClaims: string[]): MasterDesignIntent["constraints"] {
  const structural: IntentValue<string>[] = pkg.shapeId ? [
    { value: `structure: ${pkg.shapeId}${pkg.name ? ` (${pkg.name})` : ""}`, status: "explicit", source: pkg.source ?? "packagingResolver", priority: "hardConstraint", confidence: "high", rationale: "La structure décidée fait foi ; aucune référence ni direction ne la change." },
    ...(pkg.dimensionsMm ? [{ value: `dimensions: ${pkg.dimensionsMm.length} × ${pkg.dimensionsMm.width} × ${pkg.dimensionsMm.height} mm`, status: "explicit" as const, source: "packagingResolver" as const, priority: "hardConstraint" as const, confidence: "high" as const, rationale: "Dimensions du catalogue." }] : []),
    ...(pkg.material ? [{ value: `matériau: ${pkg.material}`, status: "explicit" as const, source: "packagingResolver" as const, priority: "hardConstraint" as const, confidence: "high" as const, rationale: "Matériau du catalogue ; un indice visuel de matière ne change pas la fabrication." }] : []),
  ] : [];
  const all = [...hierarchy.primary, ...hierarchy.secondary, ...hierarchy.tertiary, ...hierarchy.supporting];
  const mandatory: IntentValue<string>[] = all.filter((e) => e.required).map((e) => ({
    value: `place lisible réservée: ${e.role}`, status: "explicit", source: e.because.includes("userContent") ? "user" : "categoryKnowledge",
    priority: "mandatoryProductInfo", confidence: e.because.includes("userContent") || e.because.includes("identification") ? "high" : "medium", rationale: "Information à présenter, sans être inventée si elle manque.", refs: e.because,
  }));
  const regulatory: IntentValue<string>[] = k.regulatory.map((it) => {
    const ki = knowledge.find((x) => x.knowledgeId === it.id)!;
    return { value: it.statement, status: ki.status, source: ki.status === "supported" ? "referenceIntelligence" : "categoryKnowledge", priority: "referenceIntelligence", confidence: ki.confidence,
      rationale: `${it.scope ?? ""} Ces sources indiquent ; ce n'est ni un avis juridique ni une garantie de conformité.`.trim(), refs: [it.id, ...ki.referenceIds] };
  });
  const prohibited: IntentValue<string>[] = [
    ...prohibitedClaims.map((p): IntentValue<string> => ({ value: `allégation interdite: ${p}`, status: "prohibited", source: "user", priority: "hardConstraint", confidence: "high", rationale: "Interdite par l'utilisateur." })),
    ...g.avoidances.filter((a) => a.priority === "safetyRegulatory" || a.priority === "productConstraint").map((a): IntentValue<string> => ({ value: `${a.facet}: ${a.value}`, status: "prohibited", source: "designGrammar", priority: "hardConstraint", confidence: g.confidence, rationale: "Évitement de sécurité ou de contrainte produit (PI-2).", refs: a.because })),
    ...k.pitfalls.filter((p) => /certification|label/i.test(p.statement)).map((p): IntentValue<string> => ({ value: p.statement, status: "prohibited", source: "categoryKnowledge", priority: "validatedClaim", confidence: p.confidence, rationale: p.rationale, refs: [p.id] })),
  ];
  return { mandatory, prohibited, structural, regulatory };
}

function negativeDirections(g: DesignGrammar, k: CategoryKnowledgeResult, prohibited: IntentValue<string>[]): IntentValue<string>[] {
  const seen = new Set(prohibited.map((p) => p.value));
  const out: IntentValue<string>[] = [];
  const push = (v: IntentValue<string>) => { if (!seen.has(v.value)) { seen.add(v.value); out.push(v); } };
  for (const p of k.pitfalls) if (p.status === "applies") push({ value: p.statement, status: "inferred", source: "categoryKnowledge", priority: "positioning", confidence: p.confidence, rationale: p.rationale, refs: [p.id] });
  for (const p of g.pitfalls) push({ value: p.text, status: "inferred", source: "designGrammar", priority: "creativeInference", confidence: g.confidence, rationale: "Écueil de la grammaire (PI-2).", refs: p.because });
  for (const a of g.avoidances) if (a.priority !== "safetyRegulatory" && a.priority !== "productConstraint") {
    push({ value: `éviter ${a.facet}: ${a.value}`, status: isExplicit(a.priority) ? "explicit" : "inferred", source: isExplicit(a.priority) ? "user" : "designGrammar", priority: FROM_GRAMMAR[a.priority], confidence: isExplicit(a.priority) ? "high" : g.confidence, rationale: "Évitement de la grammaire (PI-2).", refs: a.because });
  }
  return out;
}

// ─── Conflicts ───────────────────────────────────────────────────────────────

function conflictsSection(g: DesignGrammar, k: CategoryKnowledgeResult, norm: NormalizedIntent, pi: ProductIntelligence, pkg: MasterDesignIntent["packaging"]): IntentConflict[] {
  const explicit = new Set<string>(norm.explicitPositioning);
  const out: IntentConflict[] = [];
  // 1. collisions between explicit requests of equal priority (normalisation): the more restrained is kept
  for (const c of norm.collisions) out.push({ facet: `style.${c.field}`, values: [c.kept, c.dropped], winner: c.kept, suppressed: c.dropped, attenuated: false, priority: "userRequirement", source: "user", reason: "Deux demandes explicites de même priorité : la valeur la plus retenue est gardée (elle préserve la lisibilité des mentions)." });
  // 2. PI-2 conflicts, with the side that is explicit winning
  const fromGrammar = (c: GrammarConflict): IntentConflict => {
    const [a, b] = c.between;
    const userRules = c.rules.filter((r) => r.startsWith("userBrief.") || r.startsWith("brandDirection."));
    if (c.facet === "positioning") {
      const ea = explicit.has(a), eb = explicit.has(b);
      if (ea !== eb) {
        const winner = ea ? a : b, loser = ea ? b : a;
        return { facet: "positioning", values: [a, b], winner, suppressed: loser, attenuated: true, priority: "userRequirement", source: "user", reason: `« ${winner} » est demandé explicitement, « ${loser} » est inféré : il reste une influence atténuée (${c.resolution}).` };
      }
      return { facet: "positioning", values: [a, b], winner: c.resolution, suppressed: null, attenuated: false, priority: ea ? "userRequirement" : "positioning", source: "designGrammar", reason: c.rationale };
    }
    const equalExplicit = userRules.length >= 2 && c.rules.every((r) => r.startsWith("userBrief.") || r.startsWith("brandDirection."));
    const loser = c.resolution === a ? b : c.resolution === b ? a : null;
    return {
      facet: c.facet, values: [a, b], winner: c.resolution, suppressed: c.strategy === "blend" ? null : loser, attenuated: c.strategy === "blend" || c.strategy === "namedResolution",
      priority: userRules.length ? "userRequirement" : "creativeInference", source: userRules.length ? "user" : "designGrammar",
      reason: equalExplicit ? "Deux demandes explicites de même priorité : la valeur la plus retenue est gardée (elle préserve la lisibilité des mentions)." : c.rationale,
    };
  };
  out.push(...g.conflicts.map(fromGrammar));
  // 3. a category convention suspended by the user's explicit intent (PI-3)
  for (const c of k.conventions) if (c.status === "overriddenByUser") out.push({ facet: `category.${c.id}`, values: [c.overriddenBecause ?? "demande explicite", c.id], winner: c.overriddenBecause ?? "demande explicite", suppressed: c.id, attenuated: false, priority: "userRequirement", source: "categoryKnowledge", reason: "Une demande explicite prime sur une convention de catégorie ; la convention reste tracée." });
  // 4. the decided structure against the product's usual families (the structure wins)
  const preferred = resolverFamiliesFor(pi);
  if (pkg.family && preferred.length && !preferred.includes(pkg.family)) {
    out.push({ facet: "packaging", values: [pkg.family, preferred[0]], winner: pkg.family, suppressed: preferred[0], attenuated: false, priority: "hardConstraint", source: "packagingResolver", reason: "La structure décidée est une contrainte ferme ; la famille habituelle du produit n'est qu'une préférence." });
  }
  return out;
}

// ─── Build ───────────────────────────────────────────────────────────────────

export function buildMasterDesignIntent(input: MasterDesignIntentInput): MasterDesignIntent {
  const norm = normalizeIntent(input.brief, input.styles, input.directives, input.brandTraits ? [...input.brandTraits] : []);
  const inferred = inferProductIntelligence(input.brief);
  const pi = input.marketCountries?.length ? withUserFacts(inferred.intelligence, { marketCountry: [...input.marketCountries] }, "intent-input") : inferred.intelligence;
  const grammar = inferDesignGrammar(pi, norm.directives);
  const knowledge = inferCategoryKnowledge(pi, norm.directives);
  const mode = input.references === "disabled" ? "disabled" : "active";
  const ctx = contextFromProductIntelligence(pi);
  const ids = [...knowledge.conventions, ...knowledge.trustSignals, ...knowledge.informationPriorities.items, ...knowledge.regulatory].map((x) => x.id);
  const evidence = new Map<string, KnowledgeEvidence | null>(ids.map((id) => [id, mode === "disabled" ? null : getEvidenceForKnowledge(id, ctx)]));

  const product = productSection(input, pi, inferred.archetypeId, norm, [...(ctx.jurisdictions ?? [])]);
  const brand = brandSection(input);
  const packaging = packagingSection(input);
  const visual = visualSection(grammar, norm);
  const hierarchy = hierarchySection(input, grammar, knowledge);
  const { claims, references } = claimsAndReferences(input, knowledge, evidence, mode);
  const constraints = constraintsSection(packaging, hierarchy, knowledge, claims.knowledge, grammar, claims.prohibited);
  const negative = negativeDirections(grammar, knowledge, constraints.prohibited);
  const conflicts = conflictsSection(grammar, knowledge, norm, pi, packaging);
  const shotIntent = resolveShotIntent(input.shot, pi, grammar);

  // data needs: what the layers say is missing, plus the facts the user has not given (never invented)
  const dataNeeds = [...new Set([
    ...knowledge.dataNeeds.map((n) => n.fact),
    ...[...evidence.values()].flatMap((e) => e?.dataNeeds ?? []),
    ...(brand.name.value === "unknown" ? ["nom de la marque"] : []),
    ...(product.name.value === "unknown" ? ["nom du produit"] : []),
    ...(product.market.status === "unknown" ? ["pays de vente"] : []),
    ...(brand.personality.length ? [] : ["personnalité de marque"]),
    ...(packaging.shapeId ? [] : ["packaging (le résolveur posera la question)"]),
  ])];

  const sections = {
    product: pi.productCategory ? minConf(pi.confidence, "medium") : "unknown" as Confidence,
    visual: grammar.confidence,
    hierarchy: knowledge.informationPriorities.order.length ? knowledge.confidence : grammar.confidence,
    claims: claims.uncertain.length ? "low" : claims.product.length || claims.knowledge.length ? "medium" : "unknown" as Confidence,
    references: mode === "disabled" ? "unknown" : maxConf(references.active.map((a) => a.confidence)),
    shot: shotIntent.confidence,
  } satisfies MasterDesignIntent["confidence"]["sections"];
  const overall = sections.product === "unknown" ? "unknown" : minConf(sections.product, sections.visual);

  const prov: Provenance[] = [...grammar.provenance, ...knowledge.provenance, ...[...evidence.values()].flatMap((e) => (e?.claims ?? []).filter((a) => a.applicability === "inScope" || a.applicability === "international").map((a) => a.provenance))];
  if (input.content || input.styles?.length || input.claims?.length || input.marketCountries?.length || input.shot) prov.push(userProvenance("intent-input"));
  const provenance = prov.filter((p, i) => prov.findIndex((q) => q.sourceType === p.sourceType && q.sourceId === p.sourceId) === i).map((p) => ({ ...p }));

  return {
    version: MASTER_DESIGN_INTENT_VERSION,
    product, brand, packaging, visual, hierarchy, shotIntent, references, claims, constraints,
    negativeDirections: negative,
    conflicts,
    unrecognizedStyles: norm.unrecognized,
    dataNeeds,
    confidence: { overall, sections },
    provenance,
    rationale: [
      visual.territory.value !== "unknown" ? `Territoire : ${visual.territory.value}.` : "Territoire indéterminé.",
      visual.visualDensity.value !== "unknown" ? `Densité visuelle : ${visual.visualDensity.value}.` : "Densité indéterminée.",
      `Hiérarchie : ${knowledge.informationPriorities.order.length && !isExplicit(grammar.hierarchy.priority) ? `ordre de catégorie (${knowledge.informationPriorities.from})` : "grammaire de design"}.`,
      `Prise de vue : ${shotIntent.style ?? shotIntent.status}.`,
      `Références : ${mode === "disabled" ? "désactivées" : `${references.active.length} connaissance(s) soutenue(s)`}.`,
    ],
  };
}
