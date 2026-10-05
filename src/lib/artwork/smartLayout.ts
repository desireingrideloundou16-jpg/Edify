/**
 * Smart layout of a developed conical wrap (phase 2C-4F-3): the bridge between the artwork and the
 * pure placement engine (structure/profile/conicalLayout.ts).
 *
 *   record   drawWrap in "record" mode on a scratch canvas → the elements actually drawn (boxes)
 *   plan     planLayout on the structure's composition regions (RECOMMEND: nothing is modified)
 *   apply    the moved elements' offsets as a WrapPlacement carried by the design (APPLY), so the
 *            preview, the 3D texture and the PDF draw the same element at the same logical position.
 *
 * Only surfaces with composition regions are concerned (developed cones); every other surface keeps
 * its artwork untouched.
 */
import { layoutOffsets, planLayout, type ConicalSafeArea, type PackagingElement, type PackagingStructure, type Placement, type PrintSurface } from "@/lib/structure";
import { drawWrap, type PackagingDesign } from "./draw";
import type { RecordedElement, WrapPlacement } from "./placement";

/** Resolution of the record pass (px per mm). Boxes are converted back to mm: the result does not depend on the display. */
export const RECORD_PX_PER_MM = 4;

type Rect = { x: number; y: number; w: number; h: number };

/** Recorded boxes (fractions of the wrap frame = printArea) → elements in surface mm. Pure. */
export function elementsFromRecords(records: RecordedElement[], printArea: Rect): PackagingElement[] {
  return records.map((r) => ({
    id: r.id,
    role: r.role,
    rect: { x: printArea.x + r.box.x * printArea.w, y: printArea.y + r.box.y * printArea.h, w: r.box.w * printArea.w, h: r.box.h * printArea.h },
    ...(r.parentId ? { parentId: r.parentId } : {}),
  }));
}

/** Plan → the design's WrapPlacement (offsets in fractions of the printArea frame). Pure. */
export function placementFromPlan(plan: Placement[], printArea: Rect): WrapPlacement {
  const offsets: Record<string, [number, number]> = {};
  for (const [id, [dx, dy]] of Object.entries(layoutOffsets(plan))) offsets[id] = [dx / printArea.w, dy / printArea.h];
  return { aspect: printArea.w / printArea.h, offsets };
}

/** Record the elements drawn on `surface` (a wrap with a printArea) with `ctx`, a scratch context. */
export function recordWrapElements(ctx: CanvasRenderingContext2D, design: PackagingDesign, surface: PrintSurface, pxPerMm = RECORD_PX_PER_MM): RecordedElement[] {
  const a = surface.printArea;
  if (surface.draw.kind !== "wrap" || !a) return [];
  let out: RecordedElement[] = [];
  // The plan is made on the artwork as designed: an applied placement is never recorded over.
  const plain: PackagingDesign = { ...design, wrapPlacement: undefined };
  drawWrap(ctx, 0, 0, a.w * pxPerMm, a.h * pxPerMm, plain, surface.draw.frontFraction ?? 0.3, { record: (els) => (out = els) });
  return out;
}

export interface SmartLayoutResult {
  surfaceId: string;
  safeArea: ConicalSafeArea;
  printArea: Rect;
  elements: PackagingElement[];
  /** RECOMMEND: one placement per element (valid / moved / invalid / free). */
  plan: Placement[];
  /** APPLY: what the design carries to draw the moved elements at their planned position. */
  placement: WrapPlacement;
  counts: { valid: number; moved: number; invalid: number; free: number };
}

/** Elements → plan → placement, for the structure's composition surface. Pure. */
export function smartLayoutFromElements(structure: PackagingStructure, elements: PackagingElement[]): SmartLayoutResult | null {
  const comp = structure.composition;
  const surface = comp && structure.printSurfaces.find((s) => s.id === comp.surfaceId);
  if (!comp || !surface?.printArea) return null;
  const plan = planLayout(comp.safeArea, elements);
  const counts = { valid: 0, moved: 0, invalid: 0, free: 0 };
  for (const p of plan) counts[p.status]++;
  return { surfaceId: comp.surfaceId, safeArea: comp.safeArea, printArea: surface.printArea, elements, plan, placement: placementFromPlan(plan, surface.printArea), counts };
}

/**
 * The whole chain for a design on a structure (null when the structure has no composition regions).
 * `ctx`: a scratch 2D context (browser canvas) used only to record what the artwork draws.
 */
export function computeSmartLayout(structure: PackagingStructure, design: PackagingDesign, ctx: CanvasRenderingContext2D): SmartLayoutResult | null {
  const comp = structure.composition;
  const surface = comp && structure.printSurfaces.find((s) => s.id === comp.surfaceId);
  if (!comp || !surface?.printArea) return null;
  const records = recordWrapElements(ctx, design, surface);
  return smartLayoutFromElements(structure, elementsFromRecords(records, surface.printArea));
}
