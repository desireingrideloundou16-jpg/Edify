/**
 * PI-5 — normalisation of the user's explicit design intent into PI-2 DesignDirectives (one vocabulary).
 *
 * A style word ("premium", "haut de gamme", "luxe", "minimaliste"…) is read with PI-2's own lexicon
 * (designDirectivesFromBrief, given the word in a design context), so "luxury" / "premium" / "haut de
 * gamme" land on PI-1's positioning signals instead of becoming new concepts. PI-5 only adds the few words
 * that are not positionings but density / ornament requests (maximalist, dense, rustic…). Unknown words are
 * reported, never guessed.
 *
 * Two explicit requests on the same field have the same priority: the MORE RESTRAINED value is kept
 * (it never sacrifices the legibility of mandatory information) and the collision is returned for the
 * conflict record. One rule, applied everywhere.
 */
import type { PositioningTerritory } from "@/lib/intelligence/taxonomy";
import { DECORATION_LEVELS, DENSITIES, WHITESPACES, designDirectivesFromBrief, type DesignDirectives } from "@/lib/intelligence/grammar";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type ScalarField = "density" | "decorationLevel" | "whitespace";
/** Each scale from the most restrained to the most expressive (PI-2 vocabularies). */
const SCALES: Readonly<Record<ScalarField, readonly string[]>> = { density: DENSITIES, decorationLevel: DECORATION_LEVELS, whitespace: WHITESPACES };

/** Design words PI-2's lexicon does not cover: they map onto PI-2 directive fields or PI-1 signals. */
const EXTENSION: Readonly<Record<string, Partial<Pick<DesignDirectives, ScalarField>> & { positioning?: PositioningTerritory }>> = {
  maximalist: { decorationLevel: "expressive", density: "dense" },
  maximaliste: { decorationLevel: "expressive", density: "dense" },
  charge: { decorationLevel: "expressive", density: "dense" },
  dense: { density: "dense" },
  aere: { whitespace: "generous" },
  airy: { whitespace: "generous" },
  rustic: { positioning: "artisanal" },
  rustique: { positioning: "artisanal" },
  "ultra-minimal": { positioning: "minimalist", density: "minimal" },
  "ultra minimal": { positioning: "minimalist", density: "minimal" },
};

export interface ScalarCollision { field: ScalarField; kept: string; dropped: string }

export interface NormalizedIntent {
  directives: DesignDirectives | undefined;
  /** Positioning signals the user asked for explicitly. */
  explicitPositioning: PositioningTerritory[];
  collisions: ScalarCollision[];
  unrecognized: string[];
}

function merge(a: DesignDirectives | undefined, b: DesignDirectives | undefined, collisions: ScalarCollision[]): DesignDirectives | undefined {
  if (!a) return b && structuredClone(b);
  if (!b) return structuredClone(a);
  const positioning = [...new Set([...(a.positioning ?? []), ...(b.positioning ?? [])])];
  const colors = [...(a.colors ?? []), ...(b.colors ?? []).filter((c) => !(a.colors ?? []).some((x) => x.name === c.name))];
  const brandTraits = [...new Set([...(a.brandTraits ?? []), ...(b.brandTraits ?? [])])];
  const out: DesignDirectives = {
    ...(positioning.length ? { positioning } : {}),
    ...(colors.length ? { colors } : {}),
    ...(brandTraits.length ? { brandTraits } : {}),
    // the user's own words keep the highest priority even when brand traits are merged in
    source: a.source === "brand" && b.source === "brand" ? "brand" : "brief",
  };
  for (const f of ["density", "decorationLevel", "whitespace"] as const) {
    const x = a[f], y = b[f];
    if (x && y && x !== y) {
      const scale = SCALES[f];
      const kept = scale.indexOf(x) <= scale.indexOf(y) ? x : y;
      collisions.push({ field: f, kept, dropped: kept === x ? y : x });
      (out as Record<string, unknown>)[f] = kept;
    } else if (x ?? y) (out as Record<string, unknown>)[f] = x ?? y;
  }
  return out;
}

export function normalizeIntent(brief: string, styles: readonly string[] = [], structured?: DesignDirectives, brandTraits: NonNullable<DesignDirectives["brandTraits"]> = []): NormalizedIntent {
  const collisions: ScalarCollision[] = [];
  let directives = merge(structured, designDirectivesFromBrief(brief), collisions);
  const unrecognized: string[] = [];
  for (const raw of styles) {
    const w = norm(raw);
    const ext = EXTENSION[w];
    const fromLexicon = designDirectivesFromBrief(`style ${w}`);
    if (!ext && !fromLexicon?.positioning?.length && !fromLexicon?.colors?.length) { unrecognized.push(raw); continue; }
    const d: DesignDirectives = { source: "brief", ...(fromLexicon ?? {}) };
    if (ext?.positioning) d.positioning = [...new Set([...(d.positioning ?? []), ext.positioning])];
    for (const f of ["density", "decorationLevel", "whitespace"] as const) if (ext?.[f]) (d as Record<string, unknown>)[f] = ext[f];
    directives = merge(directives, d, collisions);
  }
  if (brandTraits.length) directives = merge(directives, { source: "brand", brandTraits: [...brandTraits] }, collisions);
  return { directives, explicitPositioning: [...(directives?.positioning ?? [])], collisions, unrecognized };
}
