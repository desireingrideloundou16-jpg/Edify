/**
 * Composition constraints on a developed conical wall (phase 2C-4F-2). Pure geometry in the SAME
 * developed plane as the artwork (surface mm, y down, see conicalProfile.ts): it never moves the wall,
 * the sector or the UVs, and never touches a pixel of the artwork — it says where artwork reads well.
 *
 *   geometry (conicalProfile: sector, covered band)
 *       ↓
 *   safe area (inside the printable sector, away from the seam and from its edges)
 *       ↓
 *   primary area (front of the pot), recommended text rectangle and logo circle, score, orientation
 *
 * Every region is an annular sector about the apex of the development: radii ρ0..ρ1 and |ψ| ≤ ψmax,
 * ψ measured from the front axis (the seam is at ψ = ±angle/2).
 */
import type { Pt } from "../types";
import type { FrustumWall } from "./conicalProfile";

/** Annular sector about the apex: ρ0 ≤ ρ ≤ ρ1 and |ψ| ≤ psiMax (radians). */
export interface SectorRegion {
  rho0: number;
  rho1: number;
  psiMax: number;
}

export interface ConicalSafeAreaOptions {
  /** Keep-out from the top (covered band) and bottom edges, mm, along the generatrix. */
  radialMarginMm: number;
  /** Keep-out each side of the seam, as an angle AROUND THE POT, degrees. Default: radialMarginMm along the bottom circle. */
  angularMarginDeg?: number;
  /** Width of the primary (front) area, as an angle around the pot, degrees. Default PRIMARY_ARC_DEG. */
  primaryArcDeg?: number;
}

/**
 * Default width of the primary composition area: the front third of the pot (120° around it).
 * HYPOTHESIS of composition (a main panel ≈ ⅓ of the circumference), not a physical constant.
 */
export const PRIMARY_ARC_DEG = 120;
/** Below this tilt (degrees) a flat-horizontal line still reads level on the pot; above, follow the arc. */
export const LEVEL_TOLERANCE_DEG = 2;

export interface ConicalSafeArea {
  wall: FrustumWall;
  /** The printed part of the wall (sector without the band under the lid). */
  printable: SectorRegion;
  safe: SectorRegion;
  primary: SectorRegion;
  radialMarginMm: number;
  angularMarginDeg: number;
  primaryArcDeg: number;
  /** Largest upright rectangle (surface mm) inside the primary area, centred on the front. */
  textArea: { x: number; y: number; w: number; h: number };
  /** Largest circle inside the primary area, on the front axis. */
  logo: { cx: number; cy: number; r: number };
}

/** Pot angle (radians around the axis) ↔ sector angle ψ: arc lengths are kept, ψ = θ·angle / 2π. */
const potToPsi = (w: FrustumWall, theta: number) => (theta * w.angle) / (2 * Math.PI);

/** Polar coordinates of a surface point about the apex of the development. */
export function polarOf(w: FrustumWall, p: Pt): { rho: number; psi: number } {
  const dx = p[0] - w.width / 2, dy = w.rOut - p[1];
  return { rho: Math.hypot(dx, dy), psi: Math.atan2(dx, dy) };
}

const at = (w: FrustumWall, rho: number, psi: number): Pt => [w.width / 2 + rho * Math.sin(psi), w.rOut - rho * Math.cos(psi)];

export function conicalSafeArea(w: FrustumWall, coveredSlant: number, o: ConicalSafeAreaOptions): ConicalSafeArea {
  const half = w.angle / 2;
  const printable: SectorRegion = { rho0: w.rIn, rho1: w.rOut - coveredSlant, psiMax: half };
  const angularMarginDeg = o.angularMarginDeg ?? ((o.radialMarginMm / w.r) * 180) / Math.PI;
  const primaryArcDeg = o.primaryArcDeg ?? PRIMARY_ARC_DEG;
  const safe: SectorRegion = {
    rho0: printable.rho0 + o.radialMarginMm,
    rho1: printable.rho1 - o.radialMarginMm,
    psiMax: half - potToPsi(w, (angularMarginDeg * Math.PI) / 180),
  };
  if (!(safe.rho1 > safe.rho0 && safe.psiMax > 0)) throw new Error("conicalSafeArea: margins leave no safe area");
  const primary: SectorRegion = { rho0: safe.rho0, rho1: safe.rho1, psiMax: Math.min(safe.psiMax, potToPsi(w, ((primaryArcDeg / 2) * Math.PI) / 180)) };
  return { wall: w, printable, safe, primary, radialMarginMm: o.radialMarginMm, angularMarginDeg, primaryArcDeg, textArea: textRect(w, primary), logo: logoCircle(w, primary) };
}

/** Closed outline of a region (outer arc left → right, inner arc back), every chord within 0.01 mm. */
export function regionOutline(w: FrustumWall, g: SectorRegion, tolMm = 0.01): Pt[] {
  const step = 2 * Math.acos(1 - tolMm / g.rho1);
  let n = Math.max(2, Math.ceil((2 * g.psiMax) / step));
  if (n % 2) n++;
  const psis = Array.from({ length: n + 1 }, (_, i) => -g.psiMax + (2 * g.psiMax * i) / n);
  return [...psis.map((p) => at(w, g.rho1, p)), ...[...psis].reverse().map((p) => at(w, g.rho0, p))];
}

export function pointInRegion(w: FrustumWall, g: SectorRegion, p: Pt, eps = 1e-9): boolean {
  const { rho, psi } = polarOf(w, p);
  return rho >= g.rho0 - eps && rho <= g.rho1 + eps && Math.abs(psi) <= g.psiMax + eps;
}

/**
 * Is an upright rectangle (surface mm) entirely inside the region? The region is the intersection of
 * a disc (ρ ≤ ρ1) and a wedge (|ψ| ≤ ψmax < 90°), both convex — the 4 corners decide — minus the inner
 * disc (ρ < ρ0): the rectangle's point nearest to the apex decides.
 */
export function rectInRegion(w: FrustumWall, g: SectorRegion, r: { x: number; y: number; w: number; h: number }, eps = 1e-9): boolean {
  const corners: Pt[] = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  for (const c of corners) {
    const { rho, psi } = polarOf(w, c);
    if (rho > g.rho1 + eps || Math.abs(psi) > g.psiMax + eps) return false;
  }
  const ax = w.width / 2, ay = w.rOut;
  const nx = Math.min(Math.max(ax, r.x), r.x + r.w), ny = Math.min(Math.max(ay, r.y), r.y + r.h);
  return Math.hypot(nx - ax, ny - ay) >= g.rho0 - eps;
}

/** Shortest distance (mm, in the developed plane) from a point inside the sector to the seam (radial sides). */
export function distanceToSeam(w: FrustumWall, p: Pt): number {
  const { rho, psi } = polarOf(w, p);
  return rho * Math.sin(w.angle / 2 - Math.abs(psi));
}

/**
 * Deterministic placement score in [0, 1]: 0 outside the safe area; else (closeness to the front) ×
 * (distance to the nearest top / bottom safe edge, normalised to half the safe height). 1 = front,
 * mid-height.
 */
export function compositionScore(sa: ConicalSafeArea, p: Pt): number {
  if (!pointInRegion(sa.wall, sa.safe, p)) return 0;
  const { rho, psi } = polarOf(sa.wall, p);
  const front = 1 - Math.abs(psi) / (sa.wall.angle / 2);
  const radial = Math.min(rho - sa.safe.rho0, sa.safe.rho1 - rho) / ((sa.safe.rho1 - sa.safe.rho0) / 2);
  return Math.max(0, Math.min(1, front * radial));
}

/**
 * Orientation advice at a point (no transformation is applied): a flat-horizontal line there reads
 * tilted on the pot by ψ; rotating the text block by `tangentRotationDeg` makes it follow the circle.
 */
export function textOrientationAt(w: FrustumWall, p: Pt): { tiltDeg: number; tangentRotationDeg: number; recommended: "upright" | "tangent" } {
  const tiltDeg = (polarOf(w, p).psi * 180) / Math.PI;
  return { tiltDeg, tangentRotationDeg: tiltDeg, recommended: Math.abs(tiltDeg) < LEVEL_TOLERANCE_DEG ? "upright" : "tangent" };
}

/**
 * Largest upright rectangle centred on the front axis inside a region (a = ρ0, b = ρ1, β = ψmax):
 * bottom edge on the inner arc's crest (y = a above the apex), half width w/2 ≤ a·tan β (the wedge, at
 * that bottom edge), top corners on the outer arc (√(b² − w²/4)). Area w·(√(b² − w²/4) − a) is
 * maximised over w by a fixed deterministic search.
 */
function textRect(w: FrustumWall, g: SectorRegion) {
  const { rho0: a, rho1: b, psiMax: beta } = g;
  const wMax = Math.min(2 * a * Math.tan(beta), 2 * Math.sqrt(b * b - a * a));
  const area = (x: number) => x * (Math.sqrt(b * b - (x * x) / 4) - a);
  let best = 0, lo = 0, hi = wMax;
  for (let pass = 0; pass < 4; pass++) {
    const step = (hi - lo) / 200;
    for (let i = 0; i <= 200; i++) { const x = lo + i * step; if (area(x) > area(best)) best = x; }
    lo = Math.max(0, best - step); hi = Math.min(wMax, best + step);
  }
  const top = Math.sqrt(b * b - (best * best) / 4);
  return { x: w.width / 2 - best / 2, y: w.rOut - top, w: best, h: top - a };
}

/**
 * Largest circle on the front axis inside a region: centre at ρc, radius min(ρc − a, b − ρc, ρc·sin β).
 * The increasing bounds meet the decreasing one at ρ = (a + b)/2 and ρ = b / (1 + sin β): the optimum
 * is the later of the two.
 */
function logoCircle(w: FrustumWall, g: SectorRegion) {
  const { rho0: a, rho1: b, psiMax: beta } = g;
  const rc = Math.max((a + b) / 2, b / (1 + Math.sin(beta)));
  return { cx: w.width / 2, cy: w.rOut - rc, r: b - rc };
}
