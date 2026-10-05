/**
 * Persistent smart layout (phase 2C-4F-4). APPLY is kept in the saved project as a SmartLayoutState:
 * for every element drawn away from its original place, its original rectangle, its applied
 * rectangle and the delta, in the surface's mm, with the frame (printArea) they were computed on.
 *
 * - The artwork is never rewritten: the original layout stays what the design draws; the state only
 *   adds the deltas. Restoring the original = dropping the state (also after a reload).
 * - Reload: the saved state is validated (parseSmartLayoutState) and drawn as it is — no recompute
 *   is needed to reproduce it. The planner is deterministic, so applying again gives the same state
 *   (idempotent).
 * - Anything unreadable is refused with a reason, never drawn: an invalid placement is dropped, an
 *   invalid state is ignored (the original layout is drawn).
 */
import {
  PREFLIGHT_NOT_APPLICABLE, ROLE_PRIORITY, layoutOffsets, preflightLayout, rectInRegion,
  type ElementRole, type PackagingElement, type PackagingStructure, type PreflightReport, type Rect,
} from "@/lib/structure";
import type { WrapPlacement } from "./placement";
import type { SmartLayoutResult } from "./smartLayout";

export const SMART_LAYOUT_STATE_VERSION = 1;

export interface PersistedPlacement {
  elementId: string;
  role: ElementRole;
  surfaceId: string;
  original: Rect;
  applied: Rect;
  /** applied − original, mm (redundant on purpose: checked on load). */
  delta: [number, number];
  rotationDeg: 0;
  /** Linked element: the parent it followed. */
  parentId?: string;
}

export interface SmartLayoutState {
  version: typeof SMART_LAYOUT_STATE_VERSION;
  status: "applied";
  surfaceId: string;
  /** The printArea (surface mm) the placements were computed on. */
  frame: Rect;
  placements: PersistedPlacement[];
}

const byId = (a: { elementId: string }, b: { elementId: string }) => (a.elementId < b.elementId ? -1 : a.elementId > b.elementId ? 1 : 0);

/** APPLY: the state of a smart layout result (only the elements drawn away from their place). Pure. */
export function stateFromResult(r: SmartLayoutResult): SmartLayoutState {
  const offsets = layoutOffsets(r.plan);
  const placements = r.plan
    .filter((p) => offsets[p.id])
    .map((p): PersistedPlacement => ({
      elementId: p.id, role: p.role, surfaceId: r.surfaceId, original: { ...p.original }, applied: { ...p.rect },
      delta: [p.rect.x - p.original.x, p.rect.y - p.original.y], rotationDeg: 0, ...(p.parentId ? { parentId: p.parentId } : {}),
    }))
    .sort(byId);
  return { version: SMART_LAYOUT_STATE_VERSION, status: "applied", surfaceId: r.surfaceId, frame: { ...r.printArea }, placements };
}

/** Same applied layout (canonical comparison: the placements are sorted by id). */
export const sameState = (a: SmartLayoutState | null, b: SmartLayoutState | null) => JSON.stringify(a) === JSON.stringify(b);

const finite = (...v: unknown[]) => v.every((x) => typeof x === "number" && Number.isFinite(x));
const isRect = (r: unknown): r is Rect => {
  const o = r as Rect;
  return !!o && typeof o === "object" && finite(o.x, o.y, o.w, o.h) && o.w > 0 && o.h > 0;
};
const ID = /^[a-zA-Z]+#\d+$/;
const TOL = 1e-6;

export interface ParsedSmartLayoutState {
  state: SmartLayoutState | null;
  /** Why the state, or some of its placements, were refused (empty when everything is fine). */
  issues: string[];
}

/**
 * Validate a saved state against the current structure. Never throws: an unusable state gives
 * `state: null` (the original layout is drawn), an unusable placement is dropped; each refusal is
 * reported. Only known fields are kept.
 */
export function parseSmartLayoutState(raw: unknown, structure: PackagingStructure): ParsedSmartLayoutState {
  if (raw === null || raw === undefined) return { state: null, issues: [] };
  const issues: string[] = [];
  const refuse = (why: string): ParsedSmartLayoutState => ({ state: null, issues: [why] });
  if (typeof raw !== "object" || Array.isArray(raw)) return refuse("mise en page enregistrée illisible");
  const o = raw as Record<string, unknown>;
  if (o.version !== SMART_LAYOUT_STATE_VERSION) return refuse(`version de mise en page inconnue (${String(o.version)})`);
  if (o.status !== "applied") return refuse(`statut de mise en page inconnu (${String(o.status)})`);
  const comp = structure.composition;
  const surface = comp && structure.printSurfaces.find((p) => p.id === comp.surfaceId);
  if (!comp || !surface?.printArea) return refuse("ce format n'a pas de mise en page intelligente");
  if (o.surfaceId !== comp.surfaceId) return refuse(`surface inconnue (${String(o.surfaceId)})`);
  const pa = surface.printArea;
  if (!isRect(o.frame) || Math.abs(o.frame.x - pa.x) > TOL || Math.abs(o.frame.y - pa.y) > TOL || Math.abs(o.frame.w - pa.w) > TOL || Math.abs(o.frame.h - pa.h) > TOL) {
    return refuse("mise en page enregistrée pour un autre format");
  }
  if (!Array.isArray(o.placements)) return refuse("liste des placements absente");
  const w = comp.safeArea.wall;
  const sector = { rho0: w.rIn, rho1: w.rOut, psiMax: w.angle / 2 };
  const seen = new Set<string>();
  const placements: PersistedPlacement[] = [];
  for (const item of o.placements as unknown[]) {
    const p = item as Record<string, unknown>;
    const id = p && typeof p === "object" && typeof p.elementId === "string" ? p.elementId : "?";
    const drop = (why: string) => issues.push(`placement « ${id} » ignoré : ${why}`);
    if (!p || typeof p !== "object" || !ID.test(id)) { drop("identifiant invalide"); continue; }
    if (seen.has(id)) { drop("en double"); continue; }
    if (typeof p.role !== "string" || !(p.role in ROLE_PRIORITY)) { drop(`rôle inconnu (${String(p.role)})`); continue; }
    if (p.surfaceId !== comp.surfaceId) { drop(`surface inconnue (${String(p.surfaceId)})`); continue; }
    if (!isRect(p.original) || !isRect(p.applied)) { drop("rectangle invalide"); continue; }
    const d = p.delta as unknown[];
    if (!Array.isArray(d) || d.length !== 2 || !finite(d[0], d[1])) { drop("décalage invalide"); continue; }
    const [dx, dy] = d as [number, number];
    if (Math.abs(p.applied.x - p.original.x - dx) > TOL || Math.abs(p.applied.y - p.original.y - dy) > TOL) { drop("décalage incohérent avec les positions"); continue; }
    if (Math.abs(p.applied.w - p.original.w) > TOL || Math.abs(p.applied.h - p.original.h) > TOL) { drop("taille modifiée (déformation refusée)"); continue; }
    if (p.rotationDeg !== 0) { drop("rotation refusée"); continue; }
    if (!rectInRegion(w, sector, p.applied)) { drop("position hors du secteur"); continue; }
    if (p.parentId !== undefined && (typeof p.parentId !== "string" || !ID.test(p.parentId) || p.parentId === id)) { drop("parent invalide"); continue; }
    seen.add(id);
    placements.push({
      elementId: id, role: p.role as ElementRole, surfaceId: comp.surfaceId,
      original: { x: p.original.x, y: p.original.y, w: p.original.w, h: p.original.h },
      applied: { x: p.applied.x, y: p.applied.y, w: p.applied.w, h: p.applied.h },
      delta: [dx, dy], rotationDeg: 0, ...(typeof p.parentId === "string" ? { parentId: p.parentId } : {}),
    });
  }
  placements.sort(byId);
  return { state: { version: SMART_LAYOUT_STATE_VERSION, status: "applied", surfaceId: comp.surfaceId, frame: { ...o.frame }, placements }, issues };
}

/** What the design carries to draw an applied state (offsets in fractions of the printArea frame). */
export function wrapPlacementFromState(state: SmartLayoutState): WrapPlacement {
  const offsets: Record<string, [number, number]> = {};
  for (const p of state.placements) offsets[p.elementId] = [p.delta[0] / state.frame.w, p.delta[1] / state.frame.h];
  return { aspect: state.frame.w / state.frame.h, offsets };
}

/**
 * The elements as they are drawn: the original ones moved by the state's deltas, by id — exactly what
 * the renderer does with wrapPlacementFromState. Placements of elements no longer drawn are ignored.
 */
export function currentElements(elements: PackagingElement[], state: SmartLayoutState | null): PackagingElement[] {
  if (!state) return elements;
  const by = new Map(state.placements.map((p) => [p.elementId, p]));
  return elements.map((e) => {
    const p = by.get(e.id);
    return p ? { ...e, rect: { ...e.rect, x: e.rect.x + p.delta[0], y: e.rect.y + p.delta[1] } } : e;
  });
}

/** Placements of the state whose element the artwork no longer draws (the design changed since). */
export const orphanPlacements = (state: SmartLayoutState, elements: PackagingElement[]) => {
  const ids = new Set(elements.map((e) => e.id));
  return state.placements.filter((p) => !ids.has(p.elementId)).map((p) => p.elementId);
};

/**
 * Preflight of the packaging as it will be printed: the recorded elements, with the applied state.
 * Formats without composition regions: not applicable (pass, nothing checked, nothing changes).
 */
export function runPackagingPreflight(structure: PackagingStructure, elements: PackagingElement[] | null, state: SmartLayoutState | null): PreflightReport {
  const comp = structure.composition;
  if (!comp || !elements) return PREFLIGHT_NOT_APPLICABLE;
  return preflightLayout(comp.safeArea, comp.surfaceId, currentElements(elements, state), elements);
}

/** The final print export is allowed unless the preflight found a blocking issue (warnings go through). */
export const exportAllowed = (r: PreflightReport) => r.status !== "blocking";
