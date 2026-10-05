/**
 * Smart packaging layout on a developed conical wall (phase 2C-4F-3). Pure, deterministic geometry:
 * it takes the artwork elements as upright rectangles in surface mm (the same plane as the artwork,
 * see conicalProfile.ts) and says where each one may stay, where it should move, or why it cannot be
 * placed. It never changes the wall, the sector, the UVs, nor the size of an element.
 *
 *   conicalProfile (sector, covered band)
 *       ↓
 *   conicalSafeArea (safe / primary areas, text and logo recommendations)
 *       ↓
 *   conicalLayout (classification, priorities, valid placement, collisions)   ← this file
 *       ↓
 *   artwork (the same offsets for the preview, the 3D and the PDF)
 *
 * Validity is always decided on the real annular sectors (rectInRegion), never on a bounding box.
 */
import type { Pt } from "../types";
import { polarOf, rectInRegion, textOrientationAt, type ConicalSafeArea, type SectorRegion } from "./conicalSafeArea";

/** What an artwork element is (deterministic classification, no AI). */
export type ElementRole =
  | "barcode" | "regulatory"
  | "logo" | "brand" | "productName"
  | "subtitle" | "netContent" | "bodyText"
  | "claim" | "badge" | "secondary"
  | "image" | "decorative";

export type ElementGroup = "REGULATORY" | "IDENTITY" | "PRODUCT" | "INFORMATION" | "MARKETING" | "DECORATIVE";

/** 0 = critical … 4 = decorative. Lower is placed first and is never moved for a higher number. */
export type Priority = 0 | 1 | 2 | 3 | 4;

export const ROLE_GROUP: Record<ElementRole, ElementGroup> = {
  barcode: "REGULATORY", regulatory: "REGULATORY",
  logo: "IDENTITY", brand: "IDENTITY",
  productName: "PRODUCT", subtitle: "PRODUCT",
  netContent: "INFORMATION", bodyText: "INFORMATION",
  claim: "MARKETING", badge: "MARKETING", secondary: "MARKETING",
  image: "DECORATIVE", decorative: "DECORATIVE",
};

/**
 * P0 critical (barcode, mandatory label copy) · P1 identity (logo, brand, product name) · P2 main
 * information (subtitle, net content, body text) · P3 marketing (claim, badge, secondary lines) ·
 * P4 decorative (motif, illustration: never constrained, may run under the cut).
 */
export const ROLE_PRIORITY: Record<ElementRole, Priority> = {
  barcode: 0, regulatory: 0,
  logo: 1, brand: 1, productName: 1,
  subtitle: 2, netContent: 2, bodyText: 2,
  claim: 3, badge: 3, secondary: 3,
  image: 4, decorative: 4,
};

/** Fixed role order inside a priority (deterministic tie-break, independent of the input order). */
const ROLE_ORDER: ElementRole[] = ["barcode", "regulatory", "logo", "brand", "productName", "subtitle", "netContent", "bodyText", "claim", "badge", "secondary", "image", "decorative"];

/** Elements up to this priority are protected: nothing placed after them may overlap them. */
export const PROTECTED_MAX_PRIORITY: Priority = 2;

/**
 * Resolution of the placement search, mm (candidate positions on a grid anchored at the element's
 * own position). 1 mm: a third of the project's safe margin (SAFE_MM = 3 mm), so a move overshoots
 * the minimal one by less than 1 mm.
 */
export const PLACEMENT_GRID_MM = 1;

export type RegionId = "logo" | "primary" | "safe";

/**
 * Per-role constraints. `accept`: where the element may stay as it is. `targets`: where it is moved
 * when it must move, in order of preference (a weaker region is used only when no position exists
 * in the stronger ones). Every region lies inside the safe area: away from the seam, out of the band
 * under the lid, inside the sector.
 */
export const ROLE_RULES: Record<ElementRole, { accept: RegionId; targets: RegionId[] } | null> = {
  barcode: { accept: "safe", targets: ["safe"] },
  regulatory: { accept: "safe", targets: ["safe"] },
  logo: { accept: "primary", targets: ["logo", "primary", "safe"] },
  brand: { accept: "primary", targets: ["primary", "safe"] },
  productName: { accept: "primary", targets: ["primary", "safe"] },
  subtitle: { accept: "safe", targets: ["safe"] },
  netContent: { accept: "safe", targets: ["safe"] },
  bodyText: { accept: "safe", targets: ["safe"] },
  claim: { accept: "safe", targets: ["safe"] },
  badge: { accept: "safe", targets: ["safe"] },
  secondary: { accept: "safe", targets: ["safe"] },
  image: null,
  decorative: null,
};

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * One artwork element: an upright rectangle in surface mm that already includes the element's own
 * clearance (the barcode's GS1 quiet zones, a text block's line box). Never resized by the layout.
 */
export interface PackagingElement {
  id: string;
  role: ElementRole;
  rect: Rect;
  /**
   * Linked element (phase 2C-4F-4): it never moves on its own, it follows this parent's movement
   * (same offset, same size) and is then checked again. One level only.
   */
  parentId?: string;
}

export type PlacementStatus = "valid" | "moved" | "invalid" | "free";

export interface Placement {
  id: string;
  role: ElementRole;
  priority: Priority;
  status: PlacementStatus;
  /** Final rectangle (= original unless moved). Same size as the original, always. */
  rect: Rect;
  original: Rect;
  /** Always 0: elements stay upright (the renderer's convention); see orientation for advice. */
  rotationDeg: 0;
  /** Region the element satisfies (null when invalid or free). */
  region: RegionId | null;
  displacementMm: number;
  /** 1 = kept in place, decreasing with the displacement; 0 = invalid. */
  score: number;
  reason: string;
  /** Orientation advice at the final centre (textOrientationAt): a recommendation, never applied. */
  orientation: { recommended: "upright" | "tangent"; tiltDeg: number };
  /** Linked element: the parent it follows. */
  parentId?: string;
  /** On a parent: what went wrong with a linked element after the move (never hidden). */
  groupIssue?: string;
  /** On a linked decoration: it left the printed sector because of its parent. */
  linkIssue?: string;
}

const EPS = 1e-9;

export function rectsOverlap(a: Rect, b: Rect, eps = 1e-9): boolean {
  return a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
}

/** Is the rectangle entirely inside the circle (its 4 corners: a disc is convex)? */
export function rectInCircle(r: Rect, c: { cx: number; cy: number; r: number }, eps = 1e-9): boolean {
  const corners: Pt[] = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  return corners.every(([x, y]) => Math.hypot(x - c.cx, y - c.cy) <= c.r + eps);
}

/** Exact containment of a rectangle in a composition region (annular sectors, logo circle). */
export function rectInLayoutRegion(sa: ConicalSafeArea, region: RegionId, r: Rect): boolean {
  if (region === "logo") return rectInCircle(r, sa.logo) && rectInRegion(sa.wall, sa.primary, r);
  return rectInRegion(sa.wall, region === "primary" ? sa.primary : sa.safe, r);
}

/** Axis-aligned extent of an annular sector about the apex (|ψ| ≤ ψmax < 90°), surface mm. */
function sectorExtent(sa: ConicalSafeArea, g: SectorRegion) {
  const w = sa.wall, s = Math.sin(g.psiMax);
  return { x0: w.width / 2 - g.rho1 * s, x1: w.width / 2 + g.rho1 * s, y0: w.rOut - g.rho1, y1: w.rOut - g.rho0 * Math.cos(g.psiMax) };
}

function regionExtent(sa: ConicalSafeArea, region: RegionId) {
  if (region === "logo") return { x0: sa.logo.cx - sa.logo.r, x1: sa.logo.cx + sa.logo.r, y0: sa.logo.cy - sa.logo.r, y1: sa.logo.cy + sa.logo.r };
  return sectorExtent(sa, region === "primary" ? sa.primary : sa.safe);
}

const centre = (r: Rect): Pt => [r.x + r.w / 2, r.y + r.h / 2];

function orientationOf(sa: ConicalSafeArea, r: Rect) {
  const o = textOrientationAt(sa.wall, centre(r));
  return { recommended: o.recommended, tiltDeg: o.tiltDeg };
}

const corners = (r: Rect): Pt[] => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];

/**
 * Side of the pot an element starts on: 0 = the face (its centre in the primary wedge), ±1 = the
 * sides / back. The primary area is reserved to the face composition: an element of the sides or the
 * back whose rule does not ask for the face is never moved into it (every corner stays on its side
 * of the wedge, an exact test: the wedge edges are straight lines through the apex).
 */
function sideOf(sa: ConicalSafeArea, r: Rect): -1 | 0 | 1 {
  const psi = polarOf(sa.wall, centre(r)).psi;
  return Math.abs(psi) <= sa.primary.psiMax + EPS ? 0 : psi > 0 ? 1 : -1;
}

function keepsSide(sa: ConicalSafeArea, side: -1 | 0 | 1, r: Rect): boolean {
  if (side === 0) return true;
  return corners(r).every((p) => {
    const psi = polarOf(sa.wall, p).psi;
    return side > 0 ? psi >= sa.primary.psiMax - EPS : psi <= -sa.primary.psiMax + EPS;
  });
}

/** The side an element must keep when it moves (0: free to reach the face — the face's own roles). */
const sideRule = (sa: ConicalSafeArea, el: PackagingElement) => (ROLE_RULES[el.role]?.accept === "primary" ? 0 : sideOf(sa, el.rect));

/**
 * Best position of `rect` inside `region`, free of `obstacles` and on its side: candidates on a
 * PLACEMENT_GRID_MM grid anchored at the rectangle's own position, restricted to the region's extent;
 * every candidate is tested exactly (rectInLayoutRegion). Smallest displacement wins; ties: smaller
 * |dy|, then dy, then dx (fixed order). `fits`: whether anything fits at all without the obstacles
 * (tells "too large" from "no free position").
 */
function searchRegion(sa: ConicalSafeArea, region: RegionId, rect: Rect, obstacles: Rect[], step: number, side: -1 | 0 | 1) {
  const e = regionExtent(sa, region);
  const iMin = Math.ceil((e.x0 - rect.x) / step - EPS), iMax = Math.floor((e.x1 - rect.w - rect.x) / step + EPS);
  const jMin = Math.ceil((e.y0 - rect.y) / step - EPS), jMax = Math.floor((e.y1 - rect.h - rect.y) / step + EPS);
  let best: { r: Rect; d: number; dx: number; dy: number } | null = null;
  let fits = false;
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      const dx = i * step, dy = j * step, d = Math.hypot(dx, dy);
      if (best && (d > best.d + EPS)) continue;
      const r = { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h };
      if (!rectInLayoutRegion(sa, region, r) || !keepsSide(sa, side, r)) continue;
      fits = true;
      if (obstacles.some((o) => rectsOverlap(r, o))) continue;
      if (best && Math.abs(d - best.d) <= EPS) {
        const k = (a: number, b: number) => (Math.abs(a - b) <= EPS ? 0 : a < b ? -1 : 1);
        const cmp = k(Math.abs(dy), Math.abs(best.dy)) || k(dy, best.dy) || k(dx, best.dx);
        if (cmp >= 0) continue;
      }
      best = { r, d, dx, dy };
    }
  }
  // No short-circuit happens before a first fitting candidate: `fits` is exact.
  return { best, fits };
}

const REGION_LABEL: Record<RegionId, string> = { logo: "cercle du logo conseillé", primary: "zone principale", safe: "zone sûre" };

export interface PlacementOptions {
  /** Search resolution, mm (default PLACEMENT_GRID_MM). */
  gridMm?: number;
}

type PlacementBase = Pick<Placement, "id" | "role" | "priority" | "original" | "rotationDeg">;

const baseOf = (el: PackagingElement): PlacementBase => ({ id: el.id, role: el.role, priority: ROLE_PRIORITY[el.role], original: el.rect, rotationDeg: 0 });

function moved(sa: ConicalSafeArea, base: PlacementBase, r: Rect, region: RegionId | null, reason: string): Placement {
  const d = Math.hypot(r.x - base.original.x, r.y - base.original.y);
  return { ...base, status: "moved", rect: r, region, displacementMm: d, score: 1 / (1 + d / (sa.safe.rho1 - sa.safe.rho0)), reason, orientation: orientationOf(sa, r) };
}

function kept(sa: ConicalSafeArea, base: PlacementBase, region: RegionId | null, reason: string): Placement {
  return { ...base, status: region ? "valid" : "free", rect: base.original, region, displacementMm: 0, score: 1, reason, orientation: orientationOf(sa, base.original) };
}

/**
 * Valid position of one element given what is already placed (`obstacles`). Distinguishes an element
 * already valid (kept, status "valid"), moved to a valid position ("moved") and impossible to place
 * ("invalid", kept where it was, with a deterministic reason). Never resizes, cuts or rotates it.
 */
export function findValidPlacement(sa: ConicalSafeArea, el: PackagingElement, obstacles: Rect[], o: PlacementOptions = {}): Placement {
  const rules = ROLE_RULES[el.role];
  const base = baseOf(el);
  if (!rules) return kept(sa, base, null, "décoratif : non contraint");
  const free = (r: Rect) => !obstacles.some((ob) => rectsOverlap(r, ob));
  const step = o.gridMm ?? PLACEMENT_GRID_MM;
  const side = sideRule(sa, el);
  if (rectInLayoutRegion(sa, rules.accept, el.rect) && free(el.rect)) return kept(sa, base, rules.accept, `déjà dans la ${REGION_LABEL[rules.accept]}`);
  let tooLarge = true;
  for (const region of rules.targets) {
    if (rectInLayoutRegion(sa, region, el.rect) && free(el.rect)) return kept(sa, base, region, `déjà dans la ${REGION_LABEL[region]} (aucune place dans une zone plus favorable)`);
    const { best, fits } = searchRegion(sa, region, el.rect, obstacles, step, side);
    if (fits) tooLarge = false;
    if (best) return moved(sa, base, best.r, region, `déplacé de ${best.d.toFixed(1)} mm dans la ${REGION_LABEL[region]}`);
  }
  const last = rules.targets[rules.targets.length - 1];
  const where = side ? `${REGION_LABEL[last]}, de son côté du pot` : REGION_LABEL[last];
  const reason = tooLarge
    ? `trop grand : ${el.rect.w.toFixed(1)} × ${el.rect.h.toFixed(1)} mm ne tient nulle part dans la ${where}`
    : `aucune position libre dans la ${where} : les éléments prioritaires occupent la place`;
  return { ...base, status: "invalid", rect: el.rect, region: null, displacementMm: 0, score: 0, reason, orientation: orientationOf(sa, el.rect) };
}

/** Deterministic processing order: priority, then the fixed role order, then the id. */
export function placementOrder(elements: PackagingElement[]): PackagingElement[] {
  return [...elements].sort((a, b) =>
    ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role] || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Spacing steps tried when a column is re-flowed: its gaps are scaled by k / COLUMN_SPACING_STEPS,
 * k = COLUMN_SPACING_STEPS … 0 (100 %, 95 % … 0 %: steps of 5 %); the largest spacing that fits wins.
 */
export const COLUMN_SPACING_STEPS = 20;

/**
 * Columns: elements stacked one above the other (horizontal extents overlap, vertical extents do
 * not), joined transitively. Everything else is a column of one. Deterministic.
 */
export function layoutColumns(elements: PackagingElement[]): PackagingElement[][] {
  const parent = elements.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < elements.length; i++) for (let j = i + 1; j < elements.length; j++) {
    const a = elements[i].rect, b = elements[j].rect;
    const xOverlap = a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS;
    const yOverlap = a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
    if (xOverlap && !yOverlap) parent[find(i)] = find(j);
  }
  const groups = new Map<number, PackagingElement[]>();
  elements.forEach((e, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), e]));
  return [...groups.values()];
}

/** Members top to bottom (top edge, then id). */
const topDown = (m: PackagingElement[]) => [...m].sort((a, b) => a.rect.y - b.rect.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/**
 * Did one-by-one placement keep the column as composed: nothing invalid, no member out of its column
 * (a sideways nudge is fine while the new horizontal extent still overlaps the original one), same
 * top-to-bottom order?
 */
function columnKept(members: PackagingElement[], placed: Map<string, Placement>) {
  const ps = members.map((m) => placed.get(m.id)!);
  const outOfColumn = (p: Placement) => p.rect.x >= p.original.x + p.original.w - EPS || p.rect.x + p.rect.w <= p.original.x + EPS;
  if (ps.some((p) => p.status === "invalid" || (p.status === "moved" && outOfColumn(p)))) return false;
  const tops = topDown(members).map((m) => placed.get(m.id)!.rect.y);
  return tops.every((y, i) => i === 0 || y >= tops[i - 1] - EPS);
}

/**
 * Re-flow a column: same order, same sizes, same horizontal alignment; the gaps between members are
 * scaled (largest spacing first) and the column slides as a block on the PLACEMENT_GRID_MM grid,
 * sideways by at most its own width; the smallest total displacement wins (ties: the smaller
 * sideways slide, left first, then the smaller vertical slide, upward first). Each constrained member must meet
 * `need` (the region it reached one by one, or its last target), keep its side and stay free of
 * `obstacles`; declared decorative members (rules, fillets) follow. Null when no spacing fits.
 */
function reflowColumn(sa: ConicalSafeArea, members: PackagingElement[], need: Map<string, RegionId>, obstacles: Rect[], step: number): { rects: Map<string, Rect>; spacing: number } | null {
  const col = topDown(members);
  const gaps = col.slice(1).map((m, i) => m.rect.y - (col[i].rect.y + col[i].rect.h));
  if (gaps.some((g) => g < -EPS)) return null;
  const e = sectorExtent(sa, sa.safe);
  const sides = new Map(col.map((m) => [m.id, sideRule(sa, m)]));
  const width = Math.max(...col.map((m) => m.rect.x + m.rect.w)) - Math.min(...col.map((m) => m.rect.x));
  const iMax = Math.floor(width / step + EPS);
  const slides = [0, ...Array.from({ length: iMax }, (_, k) => [-(k + 1), k + 1]).flat()];
  for (let k = COLUMN_SPACING_STEPS; k >= 0; k--) {
    const s = k / COLUMN_SPACING_STEPS;
    const rel = [0];
    for (let i = 1; i < col.length; i++) rel.push(rel[i - 1] + col[i - 1].rect.h + s * gaps[i - 1]);
    const span = rel[col.length - 1] + col[col.length - 1].rect.h;
    const jMin = Math.ceil((e.y0 - col[0].rect.y) / step - EPS), jMax = Math.floor((e.y1 - span - col[0].rect.y) / step + EPS);
    let best: { i: number; j: number; cost: number } | null = null;
    for (const i of slides) {
      const dx = i * step;
      if (best && col.length * Math.abs(dx) > best.cost + EPS) break; // every later slide costs more
      for (let j = jMin; j <= jMax; j++) {
        const y0 = col[0].rect.y + j * step;
        let cost = 0, ok = true;
        for (let n = 0; n < col.length && ok; n++) {
          const m = col[n], r = { ...m.rect, x: m.rect.x + dx, y: y0 + rel[n] };
          cost += Math.hypot(dx, r.y - m.rect.y);
          const region = need.get(m.id);
          if (!region) continue; // decorative: follows its column
          ok = rectInLayoutRegion(sa, region, r) && keepsSide(sa, sides.get(m.id)!, r) && !obstacles.some((o) => rectsOverlap(r, o));
        }
        if (!ok) continue;
        // slides come in a fixed order (|i| ascending, left first): an equal cost keeps the earlier slide
        if (!best || cost < best.cost - EPS || (Math.abs(cost - best.cost) <= EPS && i === best.i && (Math.abs(j) < Math.abs(best.j) || (Math.abs(j) === Math.abs(best.j) && j < best.j)))) best = { i, j, cost };
      }
    }
    if (best) {
      const y0 = col[0].rect.y + best.j * step, dx = best.i * step;
      return { rects: new Map(col.map((m, n) => [m.id, { ...m.rect, x: m.rect.x + dx, y: y0 + rel[n] }])), spacing: s };
    }
  }
  return null;
}

/**
 * RECOMMEND: the placement of every element, without touching the artwork.
 *
 * Columns are placed in the order of their most important member (placementOrder), so the P0
 * elements come first; a protected element (P0–P2) becomes an obstacle for everything placed after
 * it — a barcode is never displaced by a logo, nor a logo by a claim. Inside a column the elements
 * are first placed one by one (minimal movement). If that breaks the column (a member moved sideways,
 * changed order or could not be placed), the column is re-flowed vertically instead (reflowColumn)
 * when possible. An invalid element stays where it is (it is still drawn there) and remains an
 * obstacle. Returned in the input order.
 */
export function planLayout(sa: ConicalSafeArea, elements: PackagingElement[], o: PlacementOptions = {}): Placement[] {
  const ids = new Set<string>();
  for (const e of elements) {
    if (ids.has(e.id)) throw new Error(`planLayout: duplicate element id "${e.id}"`);
    ids.add(e.id);
    if (![e.rect.x, e.rect.y, e.rect.w, e.rect.h].every(Number.isFinite) || e.rect.w < 0 || e.rect.h < 0) throw new Error(`planLayout: invalid rectangle for "${e.id}"`);
  }
  // Linked elements: a valid link points to another element that is a root itself (one level; a
  // parent whose own link is broken counts as a root).
  const byId = new Map(elements.map((e) => [e.id, e]));
  const brokenOrNone = (e: PackagingElement) => !e.parentId || e.parentId === e.id || !byId.has(e.parentId);
  const linked = (e: PackagingElement) => !brokenOrNone(e) && brokenOrNone(byId.get(e.parentId!)!);
  const children = elements.filter(linked);
  const roots = elements.filter((e) => !linked(e));
  const step = o.gridMm ?? PLACEMENT_GRID_MM;
  const rank = new Map(placementOrder(roots).map((e, i) => [e.id, i]));
  const columns = layoutColumns(roots)
    .map((c) => [...c].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!))
    .sort((a, b) => rank.get(a[0].id)! - rank.get(b[0].id)!);
  const obstacles: Rect[] = [];
  const obstacleIds: string[] = [];
  const out = new Map<string, Placement>();
  const isObstacle = (p: Placement) => p.status !== "free" && ROLE_RULES[p.role] !== null && p.priority <= PROTECTED_MAX_PRIORITY;
  for (const col of columns) {
    const local = [...obstacles];
    const placed = new Map<string, Placement>();
    for (const el of col) {
      const p = findValidPlacement(sa, el, local, o);
      placed.set(el.id, p);
      if (isObstacle(p)) local.push(p.rect);
    }
    // A member too large on its own cannot fit in any column either: no re-flow then.
    const tooLarge = col.some((el) => placed.get(el.id)!.status === "invalid" && placed.get(el.id)!.reason.startsWith("trop grand"));
    if (col.length > 1 && !tooLarge && !columnKept(col, placed)) {
      const need = new Map<string, RegionId>();
      for (const el of col) {
        const rules = ROLE_RULES[el.role];
        if (rules) need.set(el.id, placed.get(el.id)!.region ?? rules.targets[rules.targets.length - 1]);
      }
      const rf = reflowColumn(sa, col, need, obstacles, step);
      if (rf) {
        const pct = Math.round(rf.spacing * 100);
        for (const el of col) {
          const r = rf.rects.get(el.id)!, region = need.get(el.id) ?? null, base = baseOf(el);
          const d = Math.hypot(r.x - el.rect.x, r.y - el.rect.y);
          placed.set(el.id, d <= EPS
            ? kept(sa, base, region, region ? `déjà dans la ${REGION_LABEL[region]}` : "décoratif : non contraint")
            : moved(sa, base, r, region, region ? `réaligné avec sa colonne, déplacé de ${d.toFixed(1)} mm (espacement ${pct} %)` : "décoratif : suit sa colonne"));
        }
      }
    }
    for (const el of col) {
      const p = placed.get(el.id)!;
      // A link that cannot be honoured is reported, never silently dropped.
      out.set(el.id, el.parentId ? { ...p, reason: `${p.reason} (lien ignoré : parent « ${el.parentId} » absent ou lui-même lié)` } : p);
      if (isObstacle(p)) {
        obstacles.push(p.rect);
        obstacleIds.push(el.id);
      }
    }
  }
  // Linked elements follow their parent (same offset, same size), then are checked like any element:
  // a valid parent never hides an invalid child — the child is flagged and so is the parent's group.
  for (const child of placementOrder(children)) {
    const parent = out.get(child.parentId!)!;
    const dx = parent.rect.x - parent.original.x, dy = parent.rect.y - parent.original.y;
    const r = { ...child.rect, x: child.rect.x + dx, y: child.rect.y + dy };
    const base = { ...baseOf(child), parentId: parent.id };
    const follows = Math.hypot(dx, dy) > EPS;
    const rules = ROLE_RULES[child.role];
    let p: Placement;
    let issue: string | undefined;
    if (!rules) {
      p = follows ? moved(sa, base, r, null, `suit « ${parent.id} »`) : kept(sa, base, null, "décoratif : non contraint");
      if (follows && rectInRegion(sa.wall, sa.printable, child.rect) && !rectInRegion(sa.wall, sa.printable, r)) {
        issue = `« ${child.id} » sort de la zone imprimée en suivant « ${parent.id} »`;
        p = { ...p, linkIssue: issue };
      }
    } else {
      // its own parent and the other linked pieces of the group are not obstacles for it
      const others = obstacles.filter((_, i) => obstacleIds[i] !== parent.id && byId.get(obstacleIds[i])?.parentId !== parent.id);
      const ok = rectInLayoutRegion(sa, rules.accept, r) && !others.some((ob) => rectsOverlap(r, ob));
      if (ok) p = follows ? moved(sa, base, r, rules.accept, `suit « ${parent.id} »`) : kept(sa, base, rules.accept, `déjà dans la ${REGION_LABEL[rules.accept]}`);
      else {
        issue = `« ${child.id} » sort de la ${REGION_LABEL[rules.accept]} ou chevauche un élément prioritaire en suivant « ${parent.id} »`;
        p = { ...base, status: "invalid", rect: r, region: null, displacementMm: Math.hypot(dx, dy), score: 0, reason: issue, orientation: orientationOf(sa, r) };
      }
      if (isObstacle(p)) {
        obstacles.push(p.rect);
        obstacleIds.push(child.id);
      }
    }
    out.set(child.id, p);
    if (issue) out.set(parent.id, { ...out.get(parent.id)!, groupIssue: [out.get(parent.id)!.groupIssue, issue].filter(Boolean).join(" ; ") });
  }
  return elements.map((e) => out.get(e.id)!);
}

/** APPLY: the elements at their planned positions (moved ones only; sizes untouched). Pure. */
export function applyLayout(elements: PackagingElement[], plan: Placement[]): PackagingElement[] {
  const by = new Map(plan.map((p) => [p.id, p]));
  return elements.map((e) => {
    const p = by.get(e.id);
    return p && p.status === "moved" ? { ...e, rect: { ...p.rect } } : e;
  });
}

/**
 * Offsets (mm) of the elements drawn away from their original place, the only thing the artwork needs
 * to apply a plan: the moved ones, and the linked ones that follow a moved parent (even if flagged).
 */
export function layoutOffsets(plan: Placement[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const p of plan) {
    const dx = p.rect.x - p.original.x, dy = p.rect.y - p.original.y;
    if (p.status === "moved" || (p.parentId && Math.hypot(dx, dy) > EPS)) out[p.id] = [dx, dy];
  }
  return out;
}

/** Polar position of a rectangle's centre (diagnostics, tests). */
export const rectPolar = (sa: ConicalSafeArea, r: Rect) => polarOf(sa.wall, centre(r));
