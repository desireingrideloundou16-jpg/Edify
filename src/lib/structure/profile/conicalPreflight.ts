/**
 * Packaging preflight on a developed conical wall (phase 2C-4F-4): is the artwork AS IT WILL BE
 * PRINTED acceptable? Pure and deterministic, no new rule: the regions, the per-role rules, the
 * collision protection, the side rule and the suggested fixes are those of the smart layout
 * (conicalSafeArea.ts, conicalLayout.ts). It never modifies the artwork — it only says whether the
 * final export is allowed.
 *
 *   pass      nothing to report
 *   warning   exportable, the user is told (P1–P3 out of place but fixable, decoration out of print)
 *   blocking  never exported silently: a P0 element (barcode, mandatory copy) not acceptable, or a
 *             P0–P2 element that cannot be placed anywhere
 */
import type { Rect as SurfaceRect } from "./conicalLayout";
import {
  PROTECTED_MAX_PRIORITY, ROLE_PRIORITY, ROLE_RULES, placementOrder, planLayout, rectInLayoutRegion, rectsOverlap,
  type ElementRole, type PackagingElement, type Placement, type Priority,
} from "./conicalLayout";
import { polarOf, rectInRegion, type ConicalSafeArea } from "./conicalSafeArea";

export type PreflightSeverity = "pass" | "warning" | "blocking";

export interface PreflightIssue {
  severity: "warning" | "blocking";
  blocking: boolean;
  elementId: string;
  role: ElementRole;
  priority: Priority;
  surfaceId: string;
  /** Where / what is wrong with the element as it will be printed (deterministic French text). */
  message: string;
  /** The smart layout's verdict for this element (why it can or cannot be fixed). */
  reason: string;
  /** How to fix it: apply the smart layout, or change the content (it cannot fit as it is). */
  fix: "smart-layout" | "content";
  currentRect: SurfaceRect;
  /** Where the smart layout would put it (when a valid position exists). */
  suggestedRect?: SurfaceRect;
}

export interface PreflightReport {
  /** False when the format has no composition regions: nothing is checked, nothing changes. */
  applicable: boolean;
  status: PreflightSeverity;
  issues: PreflightIssue[];
  /** Elements checked (decorations included) and those without any remark. */
  checked: number;
  passed: string[];
}

export const PREFLIGHT_NOT_APPLICABLE: PreflightReport = { applicable: false, status: "pass", issues: [], checked: 0, passed: [] };

const corners = (r: SurfaceRect): [number, number][] => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];

/** Why a rectangle is out of a region, from the same polar tests as rectInRegion (first cause found). */
function outOfPlace(sa: ConicalSafeArea, role: ElementRole, r: SurfaceRect): string | null {
  const rules = ROLE_RULES[role];
  if (!rules || rectInLayoutRegion(sa, rules.accept, r)) return null;
  const w = sa.wall;
  if (!rectInRegion(w, { rho0: w.rIn, rho1: w.rOut, psiMax: w.angle / 2 }, r)) return "coupé par la découpe (sort du secteur)";
  const pol = corners(r).map((c) => polarOf(w, c));
  if (pol.some((p) => p.rho > sa.printable.rho1)) return "passe sous le couvercle (bande non imprimée)";
  if (pol.some((p) => Math.abs(p.psi) > sa.safe.psiMax)) return "trop près de la couture";
  if (pol.some((p) => p.rho > sa.safe.rho1)) return "trop près du bord haut (marge de sécurité)";
  // the inner arc: the point of the block nearest the apex decides (rectInRegion)
  if (!rectInRegion(w, { rho0: sa.safe.rho0, rho1: w.rOut + 1, psiMax: w.angle / 2 }, r)) return "traverse l'arc du bas (marge de sécurité)";
  if (rules.accept === "primary") return "hors de la face du pot (zone principale)";
  return "hors de la zone sûre";
}

/**
 * Preflight of the elements at their CURRENT (printed) positions. `elements` are the elements as
 * drawn — with an applied layout already carried in their rects (see artwork/smartLayoutState.ts);
 * `originals`, the same elements as designed: a linked decoration that left the printed sector
 * because its parent was moved is reported (never hidden).
 */
export function preflightLayout(sa: ConicalSafeArea, surfaceId: string, elements: PackagingElement[], originals: PackagingElement[] = elements): PreflightReport {
  const origById = new Map(originals.map((e) => [e.id, e.rect]));
  const plan = planLayout(sa, elements);
  const byPlan = new Map(plan.map((p) => [p.id, p]));
  const byId = new Map(elements.map((e) => [e.id, e]));
  const group = (e: PackagingElement) => e.parentId && byId.has(e.parentId) ? e.parentId : e.id;
  const order = placementOrder(elements);
  const issues: PreflightIssue[] = [];
  const passed: string[] = [];
  const protectedSoFar: PackagingElement[] = [];
  for (const el of order) {
    const p = byPlan.get(el.id)!;
    const priority = ROLE_PRIORITY[el.role];
    const rules = ROLE_RULES[el.role];
    let message: string | null = null;
    if (!rules) {
      const o = origById.get(el.id);
      const moved = !!o && (Math.abs(o.x - el.rect.x) > 1e-9 || Math.abs(o.y - el.rect.y) > 1e-9);
      if (el.parentId && moved && rectInRegion(sa.wall, sa.printable, o!) && !rectInRegion(sa.wall, sa.printable, el.rect)) {
        message = `sort de la zone imprimée en suivant « ${el.parentId} »`;
      }
    } else {
      message = outOfPlace(sa, el.role, el.rect);
      // Collision: the same protection as the smart layout — an earlier protected element wins.
      const hit = protectedSoFar.find((o) => group(o) !== group(el) && rectsOverlap(o.rect, el.rect));
      if (!message && hit) message = `chevauche « ${hit.id} »`;
    }
    if (rules && priority <= PROTECTED_MAX_PRIORITY) protectedSoFar.push(el);
    if (!message) {
      passed.push(el.id);
      continue;
    }
    const impossible = p.status === "invalid";
    const blocking = rules !== null && (priority === 0 || (impossible && priority <= PROTECTED_MAX_PRIORITY));
    issues.push({
      severity: blocking ? "blocking" : "warning",
      blocking,
      elementId: el.id,
      role: el.role,
      priority,
      surfaceId,
      message,
      reason: p.reason,
      fix: impossible ? "content" : "smart-layout",
      currentRect: el.rect,
      ...(p.status === "moved" ? { suggestedRect: p.rect } : {}),
    });
  }
  const status: PreflightSeverity = issues.some((i) => i.blocking) ? "blocking" : issues.length ? "warning" : "pass";
  return { applicable: true, status, issues, checked: elements.length, passed };
}

/** The plan the preflight relies on, exposed for tests and diagnostics. */
export const preflightPlan = (sa: ConicalSafeArea, elements: PackagingElement[]): Placement[] => planLayout(sa, elements);
