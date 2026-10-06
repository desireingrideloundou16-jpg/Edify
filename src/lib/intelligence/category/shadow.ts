/**
 * PI-3 — Category Knowledge shadow mode: READ-ONLY comparison of the design the generator actually
 * produced with what the category knows (conventions respected or ignored, pitfalls detected). Same
 * contract as the PI-1.5 and PI-2 shadows: pure, local, deterministic, no network, no AI, no effect on
 * the spec, the 2D / 3D / PDF or the project. The brief is never part of the result.
 */
import { inferProductIntelligence } from "@/lib/intelligence/taxonomy";
import { designDirectivesFromBrief, type ProducedDesign } from "@/lib/intelligence/grammar";
import { inferCategoryKnowledge } from "./infer";
import type { AppliedKnowledge } from "./types";

export type CategoryVerdict = "conventionRespected" | "conventionIgnored" | "pitfallDetected" | "neutral";

export interface CategoryKnowledgeShadow {
  source: "categoryKnowledgeShadow";
  archetypeId: string | null;
  categories: string[];
  confidence: string;
  checks: { item: string; verdict: CategoryVerdict }[];
  pitfallsDetected: number;
  conventionsIgnored: number;
  conventionsRespected: number;
}

export function shadowCategoryKnowledge(brief: string, produced: ProducedDesign): CategoryKnowledgeShadow {
  const { intelligence, archetypeId } = inferProductIntelligence(brief);
  const k = inferCategoryKnowledge(intelligence, designDirectivesFromBrief(brief));
  // a cultural motif is only a pitfall when no sourced cultural context backs it
  const culturalSourced = !!intelligence.cultureContext?.colorAssociations?.length || !!intelligence.cultureContext?.constraints?.length;
  const observed = (it: AppliedKnowledge) => (it.check ? it.check.values.includes(produced[it.check.facet]) : false);
  const checks: CategoryKnowledgeShadow["checks"] = [];
  for (const it of [...k.conventions, ...k.pitfalls]) {
    if (!it.check || it.status === "overriddenByUser") continue;
    const seen = observed(it);
    const verdict: CategoryVerdict = it.kind === "pitfall"
      ? (seen && !(it.unlessSourcedCulture && culturalSourced) ? "pitfallDetected" : "neutral")
      : seen ? "conventionRespected" : it.strength === "strongConvention" ? "conventionIgnored" : "neutral";
    checks.push({ item: it.id, verdict });
  }
  const count = (v: CategoryVerdict) => checks.filter((c) => c.verdict === v).length;
  return {
    source: "categoryKnowledgeShadow",
    archetypeId,
    categories: k.matched.map((m) => m.id),
    confidence: k.confidence,
    checks,
    pitfallsDetected: count("pitfallDetected"),
    conventionsIgnored: count("conventionIgnored"),
    conventionsRespected: count("conventionRespected"),
  };
}
