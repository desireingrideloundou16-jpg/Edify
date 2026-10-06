/**
 * PI-3 — inferCategoryKnowledge(ProductIntelligence, DesignDirectives?) → CategoryKnowledgeResult.
 *
 *   PI-1 ProductIntelligence → applicable knowledge entries (most specific first: region > subcategory
 *   > category) → items grouped by kind, tensions marked active / latent, data needs.
 *
 * Knowledge, not decisions. The user's explicit intent (PI-2 DesignDirectives) is never overridden: a
 * convention that conflicts with it is kept in the result but marked "overriddenByUser". Trust signals,
 * pitfalls and regulatory items are never suspended. Deterministic and pure; inputs are not mutated.
 */
import type { ElementRole } from "@/lib/structure";
import type { Confidence, PositioningTerritory, ProductIntelligence, Provenance } from "@/lib/intelligence/taxonomy";
import type { DesignDirectives } from "@/lib/intelligence/grammar";
import { CATEGORY_KNOWLEDGE } from "./knowledge";
import type { AppliedKnowledge, AppliedTension, CategoryKnowledge, CategoryKnowledgeResult, KnowledgeItem, TensionPole } from "./types";

type Specificity = CategoryKnowledgeResult["matched"][number]["specificity"];
const SPECIFICITY_ORDER: Specificity[] = ["region", "subcategory", "category"];

function specificityOf(k: CategoryKnowledge, pi: ProductIntelligence): Specificity | null {
  const a = k.appliesTo;
  if (!pi.productCategory || !a.categories.includes(pi.productCategory)) return null;
  if (a.subcategories && !(pi.productSubcategory && a.subcategories.includes(pi.productSubcategory))) return null;
  if (a.regions && !(pi.marketRegion ?? []).some((r) => a.regions!.includes(r))) return null;
  return a.regions ? "region" : a.subcategories ? "subcategory" : "category";
}

/** Why the user's explicit intent suspends a convention (null: it does not). */
function overriddenBy(it: KnowledgeItem, d: DesignDirectives | undefined): string | null {
  if (!d || it.kind === "trustSignal" || it.kind === "pitfall" || it.basis === "regulatory") return null;
  const asked = (d.positioning ?? []).find((p) => it.yieldsTo?.includes(p));
  if (asked) return `positionnement demandé : ${asked}`;
  const intensity = d.colors?.find((c) => c.intensity)?.intensity;
  if (intensity && it.relates?.saturation && it.relates.saturation !== intensity) return `intensité de couleur demandée : ${intensity}`;
  if (d.density && it.relates?.density && it.relates.density !== d.density) return `densité demandée : ${d.density}`;
  if (d.decorationLevel && it.relates?.decoration && it.relates.decoration !== d.decorationLevel) return `ornement demandé : ${d.decorationLevel}`;
  return null;
}

/** A tension is active when the product's signals touch both poles. */
function poleActive(p: TensionPole, signals: Set<string>, pi: ProductIntelligence): boolean {
  if (p === "local") return (pi.marketRegion ?? []).some((r) => r !== "Global") || signals.has("cultural");
  if (p === "global") return (pi.marketRegion ?? []).includes("Global");
  if (p === "massMarket") return (pi.targetAudience ?? []).includes("massMarket") || signals.has("accessible");
  if (p === "technical") return signals.has("technical") || signals.has("scientific") || signals.has("clinical");
  if (p === "emotional") return signals.has("playful") || signals.has("artisanal") || signals.has("cultural") || signals.has("heritage");
  return signals.has(p);
}

const CONF: readonly Confidence[] = ["unknown", "low", "medium", "high"];
const minConf = (a: Confidence, b: Confidence) => (CONF.indexOf(a) <= CONF.indexOf(b) ? a : b);

export function inferCategoryKnowledge(pi: ProductIntelligence, directives?: DesignDirectives): CategoryKnowledgeResult {
  const matched = CATEGORY_KNOWLEDGE
    .map((k, i) => ({ k, i, s: specificityOf(k, pi) }))
    .filter((x): x is { k: CategoryKnowledge; i: number; s: Specificity } => x.s !== null)
    .sort((a, b) => SPECIFICITY_ORDER.indexOf(a.s) - SPECIFICITY_ORDER.indexOf(b.s) || a.i - b.i);

  const signals = new Set<string>([...(pi.positioningTerritories ?? []), ...((directives?.positioning ?? []) as PositioningTerritory[])]);
  const items: AppliedKnowledge[] = [];
  const tensions: AppliedTension[] = [];
  const seenTension = new Set<string>();
  for (const { k } of matched) {
    for (const it of k.items) {
      if (it.subcategories && !(pi.productSubcategory && it.subcategories.includes(pi.productSubcategory))) continue;
      const why = overriddenBy(it, directives);
      items.push({ ...structuredClone(it), from: k.id, status: why ? "overriddenByUser" : "applies", ...(why ? { overriddenBecause: why } : {}) });
    }
    for (const t of k.tensions) {
      const key = [...t.poles].sort().join("|");
      if (seenTension.has(key)) continue; // the most specific entry speaks for a pair of poles
      seenTension.add(key);
      tensions.push({ ...structuredClone(t), from: k.id, state: t.poles.every((p) => poleActive(p, signals, pi)) ? "active" : "latent" });
    }
  }

  const of = (kind: KnowledgeItem["kind"]) => items.filter((x) => x.kind === kind && x.basis !== "regulatory");
  const orderFrom = matched.find((x) => x.k.informationOrder)?.k;
  const order: ElementRole[] = orderFrom ? [...orderFrom.informationOrder!] : [];

  // Confidence: never above the PI-1 description nor above the items' own; nothing matched → unknown.
  const itemConf = items.reduce<Confidence>((a, x) => (CONF.indexOf(x.confidence) > CONF.indexOf(a) ? x.confidence : a), "unknown");
  const confidence = matched.length ? minConf(minConf(pi.confidence, "medium"), itemConf === "unknown" ? "low" : itemConf) : "unknown";

  const prov: Provenance[] = [];
  for (const x of [...items, ...tensions]) if (!prov.some((p) => p.sourceType === x.provenance.sourceType && p.sourceId === x.provenance.sourceId)) prov.push({ ...x.provenance });

  return {
    matched: matched.map((x) => ({ id: x.k.id, specificity: x.s })),
    status: matched.length ? "known" : "unknown",
    conventions: of("convention"),
    trustSignals: of("trustSignal"),
    informationPriorities: { order, from: orderFrom?.id ?? null, items: of("informationPriority") },
    differentiation: of("differentiation"),
    opportunities: of("opportunity"),
    pitfalls: of("pitfall"),
    shelfBehavior: of("shelfBehavior"),
    regulatory: items.filter((x) => x.basis === "regulatory"),
    tensions,
    dataNeeds: matched.flatMap((x) => x.k.dataNeeds.map((n) => ({ ...n, from: x.k.id }))),
    confidence,
    provenance: prov,
  };
}
