/**
 * Parametric Gable-Top Carton Geometry for Edify.
 *
 * Generates realistic Tetra-Pak / gable-top carton geometry with:
 * - Rectangular body with chamfered vertical edges
 * - Gable roof: front/back panels up to a full-width ridge, triangular side gussets
 * - Welded top ridge (fin seal)
 * - Fin-seal indent on body bottom (cross seal)
 * - Optional straw perforation patch on roof
 *
 * Geometry output: plain THREE.BufferGeometry (no React deps).
 * Triangle budget: ~3 200 tris.
 */
import * as THREE from "three";

export interface CartonGeometryConfig {
  /** Width of the body face (X axis, "front" face) in mm */
  width: number;
  /** Depth of the body face (Z axis, "side" face) in mm */
  depth: number;
  /** Total height of the carton in mm */
  height: number;
  /** Fraction of height for the gable roof [0.10–0.28]. Default: 0.17 */
  gableRatio?: number;
  /** Chamfer as fraction of min(width,depth). Default: 0.04 */
  edgeChamferRatio?: number;
  /** Segments along each chamfered vertical edge. Default: 5 */
  chamferSegments?: number;
  /** Height of bottom fin-seal indent as fraction of height. Default: 0.025 */
  bottomSealRatio?: number;
  /** Add straw perforation patch on gable roof. Default: true */
  strawPatch?: boolean;
}

export interface CartonGeometryResult {
  /** Wrap-mapped body geometry */
  body: THREE.BufferGeometry;
  /** Gable roof: group 0 = printed front/back panels, group 1 = plain side gussets + straw patch */
  roof: THREE.BufferGeometry;
  /** Fin-seal ridge strip geometry */
  ridge: THREE.BufferGeometry;
  /** Bottom cap geometry */
  bottom: THREE.BufferGeometry;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type V3 = [number, number, number];

/**
 * Closed chamfered rectangle, back-centre → left → front → right (same convention as the
 * bottles): on the front face u grows from the viewer's left to right, and the front centre
 * sits at exactly half the perimeter, where `drawWrap` puts the front artwork.
 */
function chamferedRectProfile(hw: number, hd: number, chamfer: number, segments: number): Array<[number, number]> {
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
function perimeterOf(profile: Array<[number, number]>): number {
  let p = 0;
  for (let i = 0; i < profile.length; i++) {
    const [ax, az] = profile[i];
    const [bx, bz] = profile[(i + 1) % profile.length];
    p += Math.hypot(bx - ax, bz - az);
  }
  return p;
}

/** Closed vertical wall; UV seam column duplicated at the back, outward winding. */
function extrudeRing(profile: Array<[number, number]>, yBot: number, yTop: number, totalPerim: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = profile.length;
  for (const [y, v] of [[yBot, 0], [yTop, 1]] as const) {
    let uAcc = 0;
    for (let i = 0; i <= n; i++) {
      const [x, z] = profile[i % n];
      positions.push(x, y, z);
      uvs.push(uAcc / totalPerim, v);
      const [nx, nz] = profile[(i + 1) % n];
      uAcc += Math.hypot(nx - x, nz - z);
    }
  }
  const s = n + 1;
  for (let i = 0; i < n; i++) {
    const a = i, d = i + 1, b = s + i, c = s + i + 1;
    indices.push(a, d, b, d, c, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Quad a-b-c-d (counter-clockwise seen from outside). */
function addQuad(pos: number[], uvArr: number[], idx: number[], a: V3, b: V3, c: V3, d: V3,
  uva: [number, number], uvb: [number, number], uvc: [number, number], uvd: [number, number]) {
  const base = pos.length / 3;
  for (const [p, uv] of [[a, uva], [b, uvb], [c, uvc], [d, uvd]] as const) {
    pos.push(p[0], p[1], p[2]);
    uvArr.push(uv[0], uv[1]);
  }
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/** Triangle a-b-c (counter-clockwise seen from outside). */
function addTri(pos: number[], uvArr: number[], idx: number[], a: V3, b: V3, c: V3,
  uva: [number, number], uvb: [number, number], uvc: [number, number]) {
  const base = pos.length / 3;
  for (const [p, uv] of [[a, uva], [b, uvb], [c, uvc]] as const) {
    pos.push(p[0], p[1], p[2]);
    uvArr.push(uv[0], uv[1]);
  }
  idx.push(base, base + 1, base + 2);
}

function buildGeo(pos: number[], uvArr: number[], idx: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createCartonGeometry(config: CartonGeometryConfig): CartonGeometryResult {
  const {
    width: W,
    depth: D,
    height: H,
    gableRatio = 0.17,
    edgeChamferRatio = 0.04,
    chamferSegments = 5,
    bottomSealRatio = 0.025,
    strawPatch = true,
  } = config;

  const hw = W / 2;
  const hd = D / 2;
  const chamfer = Math.min(hw, hd) * edgeChamferRatio;

  const gableH = H * Math.max(0.05, Math.min(0.4, gableRatio));
  const ridgeH = gableH * 0.18;
  const bodyH = H - gableH - ridgeH;
  const sealH = H * bottomSealRatio;

  // ── Body (closed chamfered tube) ─────────────────────────────────────────────
  const profile = chamferedRectProfile(hw, hd, chamfer, chamferSegments);
  const perim = perimeterOf(profile);
  const bodyGeo = extrudeRing(profile, sealH, bodyH, perim);

  // ── Bottom (fan from centre, facing down) ────────────────────────────────────
  const botPos: number[] = [0, sealH, 0];
  const botUvs: number[] = [0.5, 0.5];
  const botIdx: number[] = [];
  for (const [x, z] of profile) {
    botPos.push(x, sealH, z);
    botUvs.push(0.5 + x / W, 0.5 + z / D);
  }
  for (let i = 0; i < profile.length; i++) botIdx.push(0, 1 + ((i + 1) % profile.length), 1 + i);
  const botGeo = buildGeo(botPos, botUvs, botIdx);

  // ── Gable roof: front and back panels rise to a full-width ridge, triangular side gussets ──
  const yRB = bodyH;
  const yRT = bodyH + gableH;
  const rPos: number[] = [];
  const rUvs: number[] = [];
  const rIdx: number[] = [];
  // Front panel (faces +z and up). UV: the roof artwork reads upright from the front.
  addQuad(rPos, rUvs, rIdx, [-hw, yRB, hd], [hw, yRB, hd], [hw, yRT, 0], [-hw, yRT, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  // Back panel (faces −z and up).
  addQuad(rPos, rUvs, rIdx, [hw, yRB, -hd], [-hw, yRB, -hd], [-hw, yRT, 0], [hw, yRT, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  // Side gussets (folded triangles).
  addTri(rPos, rUvs, rIdx, [-hw, yRB, -hd], [-hw, yRB, hd], [-hw, yRT, 0], [0, 0], [1, 0], [0.5, 1]);
  addTri(rPos, rUvs, rIdx, [hw, yRB, hd], [hw, yRB, -hd], [hw, yRT, 0], [0, 0], [1, 0], [0.5, 1]);

  // Straw patch: small disc on the back panel, slightly proud of it.
  if (strawPatch) {
    const ns = 12;
    const f = 0.42; // position up the slope
    const along = new THREE.Vector3(0, gableH, hd).normalize(); // up the back panel
    const nrm = new THREE.Vector3(0, hd, -gableH).normalize(); // back panel normal
    const centre = new THREE.Vector3(hw * 0.38, yRB + gableH * f, -hd * (1 - f)).addScaledVector(nrm, 0.25);
    const pr = Math.min(hw, gableH) * 0.12;
    const side = new THREE.Vector3(1, 0, 0);
    const cb = rPos.length / 3;
    rPos.push(centre.x, centre.y, centre.z);
    rUvs.push(0.75, 0.8);
    for (let k = 0; k < ns; k++) {
      const a = (k / ns) * Math.PI * 2;
      const p = centre.clone().addScaledVector(side, pr * Math.cos(a)).addScaledVector(along, pr * Math.sin(a));
      rPos.push(p.x, p.y, p.z);
      rUvs.push(0.75 + 0.05 * Math.cos(a), 0.8 + 0.05 * Math.sin(a));
    }
    for (let k = 0; k < ns; k++) rIdx.push(cb, cb + 1 + ((k + 1) % ns), cb + 1 + k);
  }
  const roofGeo = buildGeo(rPos, rUvs, rIdx);
  // Group 0: front and back panels (printed). Group 1: folded side gussets and straw patch (plain).
  roofGeo.addGroup(0, 12, 0);
  roofGeo.addGroup(12, rIdx.length - 12, 1);

  // ── Ridge (fin seal): a thin solid fin along the top, full width ─────────────
  const t = Math.max(0.3, Math.min(D * 0.012, ridgeH * 0.25));
  const y0 = yRT - ridgeH * 0.2;
  const y1 = yRT + ridgeH;
  const rdPos: number[] = [];
  const rdUvs: number[] = [];
  const rdIdx: number[] = [];
  addQuad(rdPos, rdUvs, rdIdx, [-hw, y0, t], [hw, y0, t], [hw, y1, t], [-hw, y1, t], [0, 0], [1, 0], [1, 1], [0, 1]); // front
  addQuad(rdPos, rdUvs, rdIdx, [hw, y0, -t], [-hw, y0, -t], [-hw, y1, -t], [hw, y1, -t], [0, 0], [1, 0], [1, 1], [0, 1]); // back
  addQuad(rdPos, rdUvs, rdIdx, [-hw, y1, t], [hw, y1, t], [hw, y1, -t], [-hw, y1, -t], [0, 0], [1, 0], [1, 1], [0, 1]); // top
  addQuad(rdPos, rdUvs, rdIdx, [hw, y0, t], [hw, y0, -t], [hw, y1, -t], [hw, y1, t], [0, 0], [1, 0], [1, 1], [0, 1]); // right end
  addQuad(rdPos, rdUvs, rdIdx, [-hw, y0, -t], [-hw, y0, t], [-hw, y1, t], [-hw, y1, -t], [0, 0], [1, 0], [1, 1], [0, 1]); // left end
  const ridgeGeo = buildGeo(rdPos, rdUvs, rdIdx);

  return { body: bodyGeo, roof: roofGeo, ridge: ridgeGeo, bottom: botGeo };
}

/** Merge all carton parts into one geometry (for thumbnails / single-material). */
export function mergeCartonGeometry(parts: CartonGeometryResult): THREE.BufferGeometry {
  const geos = [parts.body, parts.roof, parts.ridge, parts.bottom];

  let totalPos = 0, totalUv = 0, totalIdx = 0;
  for (const g of geos) {
    totalPos += g.getAttribute("position").count * 3;
    totalUv  += (g.getAttribute("uv")?.count ?? 0) * 2;
    totalIdx += g.getIndex()?.count ?? 0;
  }

  const mPos = new Float32Array(totalPos);
  const mUv  = new Float32Array(totalUv);
  const mIdx = new Uint32Array(totalIdx);
  let po = 0, uo = 0, io = 0, vo = 0;

  for (const g of geos) {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const uv  = g.getAttribute("uv")       as THREE.BufferAttribute;
    const idx = g.getIndex();
    mPos.set(pos.array as Float32Array, po); po += pos.array.length;
    if (uv)  { mUv.set(uv.array  as Float32Array, uo); uo += uv.array.length; }
    if (idx) {
      for (let i = 0; i < idx.count; i++) mIdx[io + i] = idx.getX(i) + vo;
      io += idx.count;
    }
    vo += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
  merged.setAttribute("uv",       new THREE.BufferAttribute(mUv, 2));
  merged.setIndex(new THREE.BufferAttribute(mIdx, 1));
  merged.computeVertexNormals();
  return merged;
}
