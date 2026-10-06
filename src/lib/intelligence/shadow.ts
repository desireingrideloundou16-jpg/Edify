/**
 * PI-1.5 — Product Intelligence shadow mode: READ-ONLY comparison of the packaging the user actually gets
 * (the existing resolver, or the user's own choice) with what Product Intelligence would recommend.
 *
 *   brief ──→ existing resolver / user choice ──→ ACTUAL DECISION (authoritative, untouched)
 *     └────→ Product Intelligence ──→ preferred family ──→ the same resolver ──→ recommendation
 *                                              actual + recommendation ──→ diagnostic (measurement only)
 *
 * Pure and deterministic: no network, no AI, no state. The diagnostic never feeds back into a decision,
 * a design, the 2D / 3D / PDF or a saved project: it is only returned (and, server-side, logged).
 */
import { familyOfShape, resolvePackaging, type PackagingFamily } from "@/lib/catalog/packagingResolver";
import { inferProductIntelligence, resolverFamiliesFor, type Confidence } from "./taxonomy";

/** The decision the user actually got. */
export interface ActualPackaging {
  shapeId: string | null;
  /** resolver: decided by the resolver; user: picked by the user; legacy: kept from an old project;
   *  locked: imposed on the AI designer (server side, origin unknown). */
  source: "resolver" | "user" | "legacy" | "locked";
  /** The resolver's 0..1 confidence, when it decided. */
  confidence?: number | null;
}

export type ShadowDifference =
  | "same"
  | "noProductIntelligence"
  | "noSupportedFamily"
  | "currentUndecided"
  | "sameFamilyOtherStructure"
  | "currentInOtherPreferredFamily"
  | "currentOutsidePreferredFamilies";

export interface PackagingResolutionShadow {
  input: string;
  source: "productIntelligenceShadow";
  currentDecision: string | null;
  currentSource: ActualPackaging["source"];
  currentFamily: PackagingFamily | null;
  currentConfidence: number | null;
  intelligentDecision: string | null;
  intelligentFamily: PackagingFamily | null;
  intelligentConfidence: number | null;
  /** Resolver families Product Intelligence accepts for this product, best first. */
  intelligentFamilies: PackagingFamily[];
  archetypeId: string | null;
  productIntelligenceConfidence: Confidence;
  sameDecision: boolean;
  sameFamily: boolean;
  differenceReason: ShadowDifference;
}

export function shadowPackaging(text: string, actual: ActualPackaging): PackagingResolutionShadow {
  const { intelligence, archetypeId } = inferProductIntelligence(text);
  const families = archetypeId ? resolverFamiliesFor(intelligence) : [];
  // What the existing resolver chooses when Product Intelligence's preferred family is imposed (first one
  // with a supported format): the recommendation is still a real, supported structure.
  let rec: ReturnType<typeof resolvePackaging> | null = null;
  for (const family of families) {
    const r = resolvePackaging(text, { family });
    if (r.shapeId) { rec = r; break; }
  }
  const currentFamily = actual.shapeId ? familyOfShape(actual.shapeId) : null;
  const intelligentDecision = rec?.shapeId ?? null;
  const intelligentFamily = rec?.family ?? null;
  const sameDecision = !!intelligentDecision && intelligentDecision === actual.shapeId;
  const sameFamily = !!intelligentFamily && intelligentFamily === currentFamily;
  const differenceReason: ShadowDifference =
    !archetypeId ? "noProductIntelligence"
    : !rec ? "noSupportedFamily"
    : !actual.shapeId ? "currentUndecided"
    : sameDecision ? "same"
    : sameFamily ? "sameFamilyOtherStructure"
    : currentFamily && families.includes(currentFamily) ? "currentInOtherPreferredFamily"
    : "currentOutsidePreferredFamilies";
  return {
    input: text,
    source: "productIntelligenceShadow",
    currentDecision: actual.shapeId,
    currentSource: actual.source,
    currentFamily,
    currentConfidence: actual.confidence ?? null,
    intelligentDecision,
    intelligentFamily,
    intelligentConfidence: rec?.confidence ?? null,
    intelligentFamilies: families,
    archetypeId,
    productIntelligenceConfidence: intelligence.confidence,
    sameDecision,
    sameFamily,
    differenceReason,
  };
}

/** Fields safe for a server log line: never the brief itself (lib/log.ts rule). */
export function shadowLogFields(s: PackagingResolutionShadow): Record<string, unknown> {
  const { input: _input, ...rest } = s;
  void _input;
  return rest;
}
