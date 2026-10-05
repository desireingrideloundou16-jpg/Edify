/**
 * Gable-top carton dimensions (phase 2C-3), shared by the 3D builder (three/geometry/
 * cartonGeometry.ts) and the print structure: the printed body wrap and roof panels are the real
 * surfaces of the mesh. Millimetres. Pure (no three.js).
 */

/**
 * Closed chamfered rectangle, back-centre → left → front → right (same convention as the
 * bottles): on the front face u grows from the viewer's left to right, and the front centre
 * sits at exactly half the perimeter, where `drawWrap` puts the front artwork.
 */
export function chamferedRectProfile(hw: number, hd: number, chamfer: number, segments: number): Array<[number, number]> {
  const c = Math.max(0, Math.min(chamfer, Math.min(hw, hd) * 0.45));
  const pts: Array<[number, number]> = [[0, -hd]];
  // corner centre, start angle, end angle (going around back → left → front → right)
  const corners: Array<[number, number, number, number]> = [
    [-hw + c, -hd + c, -Math.PI / 2, -Math.PI],
    [-hw + c, +hd - c, Math.PI, Math.PI / 2],
    [+hw - c, +hd - c, Math.PI / 2, 0],
    [+hw - c, -hd + c, 0, -Math.PI / 2],
  ];
  for (const [cx, cz, a0, a1] of corners) {
    for (let k = 0; k <= segments; k++) {
      const a = a0 + (a1 - a0) * (k / segments);
      pts.push([cx + c * Math.cos(a), cz + c * Math.sin(a)]);
    }
    // Mid-points of the left, front and right faces (the front centre is exactly u = 0.5).
    if (cx < 0 && cz < 0) pts.push([-hw, 0]);
    if (cx < 0 && cz > 0) pts.push([0, hd]);
    if (cx > 0 && cz > 0) pts.push([hw, 0]);
  }
  // Remove consecutive duplicates (zero chamfer).
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-9);
}

/** Perimeter of the closed profile. */
export function perimeterOf(profile: Array<[number, number]>): number {
  let p = 0;
  for (let i = 0; i < profile.length; i++) {
    const [ax, az] = profile[i];
    const [bx, bz] = profile[(i + 1) % profile.length];
    p += Math.hypot(bx - ax, bz - az);
  }
  return p;
}


export interface CartonDimsConfig {
  width: number;
  depth: number;
  height: number;
  gableRatio?: number;
  edgeChamferRatio?: number;
  chamferSegments?: number;
  bottomSealRatio?: number;
}

/** Carton of the catalog (L × W × H): the roof ratio and chamfer used by the 3D. */
export function cartonConfigFor(L: number, W: number, H: number) {
  return { width: L, depth: W, height: H, gableRatio: Math.min(0.22, Math.max(0.13, (W / H) * 1.1)), edgeChamferRatio: 0.035, strawPatch: true };
}

export function cartonDims(c: CartonDimsConfig) {
  const { width: W, depth: D, height: H, gableRatio = 0.17, edgeChamferRatio = 0.04, chamferSegments = 5, bottomSealRatio = 0.025 } = c;
  const hw = W / 2;
  const hd = D / 2;
  const chamfer = Math.min(hw, hd) * edgeChamferRatio;
  const gableH = H * Math.max(0.05, Math.min(0.4, gableRatio));
  const ridgeH = gableH * 0.18;
  const bodyH = H - gableH - ridgeH;
  const sealH = H * bottomSealRatio;
  const profile = chamferedRectProfile(hw, hd, chamfer, chamferSegments);
  const perimeter = perimeterOf(profile);
  return {
    hw, hd, chamfer, gableH, ridgeH, bodyH, sealH, profile, perimeter,
    /** Printed body wrap: the closed tube from the bottom seal to the roof, mm. */
    bodyPrintH: bodyH - sealH,
    /** Each roof panel goes from the body edge (z = ±hd) up to the ridge (z = 0). */
    roofSlant: Math.hypot(gableH, hd),
  };
}
