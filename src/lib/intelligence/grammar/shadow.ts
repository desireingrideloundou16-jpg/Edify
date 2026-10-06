/**
 * PI-2 — Design Grammar shadow mode: READ-ONLY comparison of the design the existing generator actually
 * produced (layout, motif, illustration style, fonts of the DesignSpec) with what the grammar prefers.
 * Same contract as the packaging shadow (PI-1.5): pure, local, deterministic, no network, no AI; it never
 * changes the spec, the 2D / 3D / PDF or a saved project. Only for measurement.
 */
import type { LayoutId, MotifId } from "@/lib/artwork/compose";
import { PACKAGING_FONTS, type FontCategory } from "@/lib/catalog/fonts";
import { inferProductIntelligence } from "@/lib/intelligence/taxonomy";
import { designDirectivesFromBrief } from "./directives";
import { inferDesignGrammar } from "./infer";
import type { ArtStyle, DesignGrammar, Ranked } from "./types";

/** The parts of a generated design the grammar can judge (a subset of ai/designSpec DesignSpec). */
export interface ProducedDesign { layout: string; motif: string; artStyle: string; headingFont: string; bodyFont: string }

export type GrammarVerdict = "preferred" | "secondary" | "avoided" | "neutral" | "unknown";

export interface DesignGrammarShadow {
  source: "designGrammarShadow";
  archetypeId: string | null;
  territory: string | null;
  grammarConfidence: DesignGrammar["confidence"];
  layout: { value: string; verdict: GrammarVerdict };
  motif: { value: string; verdict: GrammarVerdict };
  artStyle: { value: string; verdict: GrammarVerdict };
  headingFont: { category: FontCategory | null; verdict: GrammarVerdict };
  avoidedCount: number;
  preferredCount: number;
}

const verdict = <T extends string>(r: Ranked<T>, v: string | null): GrammarVerdict =>
  v === null ? "unknown" : r.avoid.includes(v as T) ? "avoided" : r.prefer.includes(v as T) ? "preferred" : r.secondary.includes(v as T) ? "secondary" : "neutral";

const fontCategory = (family: string): FontCategory | null => PACKAGING_FONTS.find((f) => f.family === family)?.category ?? null;

export function shadowDesignGrammar(brief: string, produced: ProducedDesign): DesignGrammarShadow {
  const { intelligence, archetypeId } = inferProductIntelligence(brief);
  const g = inferDesignGrammar(intelligence, designDirectivesFromBrief(brief));
  const heading = fontCategory(produced.headingFont);
  const verdicts = {
    layout: verdict<LayoutId>(g.composition.layouts, produced.layout),
    motif: verdict<MotifId>(g.decoration.motifs, produced.motif),
    artStyle: verdict<ArtStyle>(g.illustration, produced.artStyle),
    heading: verdict<FontCategory>(g.typography.classes, heading),
  };
  const all = Object.values(verdicts);
  return {
    source: "designGrammarShadow",
    archetypeId,
    territory: g.territory.primary,
    grammarConfidence: g.confidence,
    layout: { value: produced.layout, verdict: verdicts.layout },
    motif: { value: produced.motif, verdict: verdicts.motif },
    artStyle: { value: produced.artStyle, verdict: verdicts.artStyle },
    headingFont: { category: heading, verdict: verdicts.heading },
    avoidedCount: all.filter((v) => v === "avoided").length,
    preferredCount: all.filter((v) => v === "preferred").length,
  };
}
