/**
 * Flat (die-line) layouts in millimetres, y pointing down, origin at the top-left of the cut
 * contour. Used by the 2D preview and the print PDF.
 *
 * Adapter since phase 2C-1: the structure (templates, panels, print surfaces, supported or not)
 * comes from resolveStructure() in lib/structure; this file only converts it to the FlatLayout
 * shape its consumers already use. Formats without a valid template are refused, never faked.
 */
import { BLEED_MM, resolveStructure, type PackagingStructure, type PrintSurface, type Pt, type StructureInput } from "@/lib/structure";
import type { FaceKind } from "@/lib/artwork/draw";

export { BLEED_MM };
export type { Pt };

export interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FaceKind | "wrap";
  /** Rotate artwork by 180° (lids that fold over). */
  flip?: boolean;
  /** Rotate artwork by a quarter turn, clockwise (walls folded up from a side edge); w / h are the panel's. */
  quarterTurn?: 90 | 270;
  /** For wraps: share of the width used by the front artwork. */
  frontFraction?: number;
  label?: string;
  /** Stable print surface id (lib/structure). */
  surfaceId?: string;
  /** The shared surface (size, print area, artwork) — what both the PDF and the 3D draw. */
  surface?: PrintSurface;
  /** Horizontal start of the surface in this panel, mm, wrapping around (closed tubes, see lib/structure). */
  surfaceOffsetMm?: number;
}

export interface FlatLayout {
  width: number;
  height: number;
  panels: Panel[];
  /** Closed cut contour. */
  cut: Pt[];
  /** Other independent pieces of the sheet (closed contours). */
  extraCuts?: Pt[][];
  /** Knife cuts inside the contour (open segments). */
  slits?: [Pt, Pt][];
  /** Glue areas of folded sheets (structure glueZones), drawn hatched. */
  glueZones?: Pt[][];
  /** Machine-formed folds (film), drawn apart from the scored creases. */
  formedFolds?: [Pt, Pt][];
  /** Weld / seam areas (flexible webs); `afterFilling`: sealed by the packer once filled. */
  sealZones?: { polygon: Pt[]; afterFilling?: boolean }[];
  /** Technical zones (structure technicalZones): seam (keep critical artwork out), covered (not printed)… */
  technicalZones?: { polygon: Pt[]; kind: string }[];
  /** Composition guides (structure compositionGuides): drawn in the preview only, never in the PDF. */
  guides?: { polygon: Pt[]; kind: string }[];
  /** Fold lines as [from, to] segments. */
  creases: [Pt, Pt][];
  kindLabel: string;
}

/** The format has no valid flat template yet (the structure says "unsupported"). */
export class UnsupportedDielineError extends Error {
  constructor(readonly model: string, message: string) {
    super(message);
    this.name = "UnsupportedDielineError";
  }
}

export type FlatLayoutResult =
  | { supported: true; layout: FlatLayout; structure: PackagingStructure }
  | { supported: false; message: string; structure: PackagingStructure };

/** FlatLayout view of a supported structure. */
export function layoutFromStructure(s: PackagingStructure): FlatLayout {
  if (s.dieline !== "supported" || !s.flatMm || !s.cut || !s.panels) {
    throw new UnsupportedDielineError(s.model, s.dielineNote ?? "Le patron de découpe n'est pas disponible pour ce format.");
  }
  const surfaces = new Map(s.printSurfaces.map((p) => [p.id, p]));
  return {
    width: s.flatMm.width,
    height: s.flatMm.height,
    kindLabel: s.kindLabel ?? "",
    cut: s.cut,
    ...(s.extraCuts ? { extraCuts: s.extraCuts } : {}),
    ...(s.slits ? { slits: s.slits } : {}),
    ...(s.glueZones ? { glueZones: s.glueZones.map((z) => z.polygon) } : {}),
    ...(s.formedFolds ? { formedFolds: s.formedFolds } : {}),
    ...(s.compositionGuides ? { guides: s.compositionGuides.map((g) => ({ polygon: g.polygon, kind: g.kind })) } : {}),
    ...(s.technicalZones ? { technicalZones: s.technicalZones.map((z) => ({ polygon: z.polygon, kind: z.kind })) } : {}),
    ...(s.sealZones ? { sealZones: s.sealZones.map((z) => ({ polygon: z.polygon, ...(z.afterFilling ? { afterFilling: true } : {}) })) } : {}),
    creases: s.creases ?? [],
    // Printed panels only: board without artwork (glue flap, gable gussets, fin) stays in the cut
    // contour and takes the sheet background, like its plain 3D material.
    panels: s.panels.filter((panel) => panel.surfaceId && surfaces.get(panel.surfaceId)?.printable !== false).map((panel) => {
      const xs = panel.polygon.map((p) => p[0]);
      const ys = panel.polygon.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      const surf = panel.surfaceId ? surfaces.get(panel.surfaceId) : undefined;
      // Exact size from the print surface (avoids float drift of max - min).
      const quarter = surf?.draw.rotate === 90 || surf?.draw.rotate === 270;
      // A window on a surface spread over several panels keeps its own (smaller) size.
      const pw = Math.max(...xs) - x, ph = Math.max(...ys) - y;
      const window = !!surf && Math.abs(pw - (quarter ? surf.hMm : surf.wMm)) > 1e-6;
      const out: Panel = {
        x, y,
        w: surf && !window ? (quarter ? surf.hMm : surf.wMm) : pw,
        h: surf && !window ? (quarter ? surf.wMm : surf.hMm) : ph,
        kind: surf?.draw.kind ?? "plain",
      };
      if (surf?.draw.rotate === 180) out.flip = true;
      if (surf?.draw.rotate === 90 || surf?.draw.rotate === 270) out.quarterTurn = surf.draw.rotate;
      if (surf?.draw.frontFraction !== undefined) out.frontFraction = surf.draw.frontFraction;
      if (surf) out.label = surf.label;
      if (panel.surfaceId) out.surfaceId = panel.surfaceId;
      if (surf) out.surface = surf;
      if (panel.surfaceOffsetMm) out.surfaceOffsetMm = panel.surfaceOffsetMm;
      return out;
    }),
  };
}

/** Never throws: lets the UI show a message for formats without a template. */
export function resolveFlatLayout(dims: StructureInput): FlatLayoutResult {
  const structure = resolveStructure(dims);
  if (structure.dieline !== "supported") {
    return { supported: false, message: structure.dielineNote ?? "Le patron de découpe n'est pas disponible pour ce format.", structure };
  }
  return { supported: true, layout: layoutFromStructure(structure), structure };
}

/** Supported formats only; throws UnsupportedDielineError instead of inventing a template. */
export function flatLayout(dims: StructureInput): FlatLayout {
  return layoutFromStructure(resolveStructure(dims));
}
