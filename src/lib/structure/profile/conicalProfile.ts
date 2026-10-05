/**
 * Conical wall (phase 2C-4F-1): a right frustum of a cone and its EXACT flat development, an annular
 * sector. Pure geometry in millimetres, shared by the 3D UVs, the print surface and the die-line.
 *
 * Cone (three.js axes like every pack): y up from the bottom of the wall, front at θ = 0 (+z), the
 * seam at the back (θ = ±π), x = rad·sin θ, z = rad·cos θ — the convention of the wall's
 * CylinderGeometry (thetaStart −π).
 *
 * Developed sector, seen from the printed side: the apex of the development is below the sector,
 * the TOP of the wall is the OUTER arc, the front is the vertical axis of symmetry, the seam is the
 * two radial sides. Surface coordinates: mm, origin at the top-left of the sector's bounding box,
 * y down (like every print surface).
 *
 *         outer arc (top of the wall, 2πR)
 *       ╭──────────────────────────────╮
 *        \                            /     ← radial sides = the seam (back)
 *         ╰──────────────────────────╯
 *          inner arc (bottom, 2πr)
 */
import type { Pt } from "../types";
import { cylinderWrap } from "./labels";

export interface FrustumWall {
  /** Top and bottom radii, vertical height of the wall, mm. */
  R: number;
  r: number;
  h: number;
  /** Generatrix (slant) length, mm. */
  slant: number;
  /** Radii of the developed sector (outer = top edge, inner = bottom edge), mm. */
  rOut: number;
  rIn: number;
  /** Angle of the sector, radians (θ·rOut = 2πR, θ·rIn = 2πr). */
  angle: number;
  /** Bounding box of the sector, mm. */
  width: number;
  height: number;
}

/** Frustum wall from its radii and height (R > r > 0: wider at the top, like the tubs). */
export function frustumWall(R: number, r: number, h: number): FrustumWall {
  if (!(R > r && r > 0 && h > 0)) throw new Error("frustumWall: needs R > r > 0 and h > 0");
  const slant = Math.hypot(h, R - r);
  const rOut = (slant * R) / (R - r);
  const rIn = (slant * r) / (R - r);
  const angle = (2 * Math.PI * R) / rOut;
  if (!(angle < Math.PI)) throw new Error("frustumWall: sector wider than a half turn is not supported");
  return { R, r, h, slant, rOut, rIn, angle, width: 2 * rOut * Math.sin(angle / 2), height: rOut - rIn * Math.cos(angle / 2) };
}

/** Point of the developed plane at distance ρ from the apex and angle ψ from the front axis → surface mm. */
export function sectorPoint(w: FrustumWall, rho: number, psi: number): Pt {
  return [w.width / 2 + rho * Math.sin(psi), w.rOut - rho * Math.cos(psi)];
}

/** Number of straight segments per arc so that no chord strays more than `tolMm` from the arc (even). */
export function arcSegments(w: FrustumWall, tolMm = 0.01): number {
  const step = 2 * Math.acos(1 - tolMm / w.rOut);
  const n = Math.max(2, Math.ceil(w.angle / step));
  return n % 2 ? n + 1 : n;
}

/**
 * Closed outline of the part of the sector between radii ρ0 < ρ1 (the whole wall by default):
 * outer arc from left to right, then inner arc back. Even segment count: the front (ψ = 0) and both
 * seam corners are vertices, so the outline's bounding box is exact.
 */
export function sectorOutline(w: FrustumWall, rho0 = w.rIn, rho1 = w.rOut, segments = arcSegments(w)): Pt[] {
  const psis = Array.from({ length: segments + 1 }, (_, i) => -w.angle / 2 + (w.angle * i) / segments);
  return [...psis.map((p) => sectorPoint(w, rho1, p)), ...[...psis].reverse().map((p) => sectorPoint(w, rho0, p))];
}

/** Cone → developed sector: the point at angle θ (0 = front, ±π = seam) and height y on the wall. */
export function coneToSurface(w: FrustumWall, theta: number, y: number): Pt {
  const rho = w.rIn + (y / w.h) * w.slant; // along the generatrix
  const psi = (theta * w.angle) / (2 * Math.PI); // arc lengths kept: ρ·ψ = rad·θ
  return sectorPoint(w, rho, psi);
}

/** Developed sector → cone: the 3D point (x, y, z) of a surface point (inverse of coneToSurface). */
export function surfaceToCone(w: FrustumWall, p: Pt): [number, number, number] {
  const dx = p[0] - w.width / 2, dy = w.rOut - p[1];
  const rho = Math.hypot(dx, dy), psi = Math.atan2(dx, dy);
  const y = ((rho - w.rIn) / w.slant) * w.h;
  const rad = w.r + ((rho - w.rIn) / w.slant) * (w.R - w.r);
  const theta = (psi * 2 * Math.PI) / w.angle;
  return [rad * Math.sin(theta), y, rad * Math.cos(theta)];
}

/**
 * Wall of a plastic tub as Edify builds it (cylinderWrap "tub": R, rBottom, bodyH, lidH). The lid's
 * skirt starts at H − lidH and covers the top of the wall: that band (vertical `covered`, along the
 * generatrix `coveredSlant`) is hidden once the lid is on.
 */
export function tubWall(L: number, W: number, H: number) {
  const c = cylinderWrap("tub", L, W, H);
  const wall = frustumWall(c.R, c.rBottom, c.bodyH);
  const covered = Math.max(0, c.bodyH - (H - c.lidH));
  return { wall, lidH: c.lidH, bodyH: c.bodyH, covered, coveredSlant: (covered / wall.h) * wall.slant, frontFraction: c.label.frontFraction };
}
