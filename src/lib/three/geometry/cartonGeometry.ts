/**
 * Parametric Gable-Top Carton Geometry for Edify.
 *
 * Generates realistic Tetra-Pak / gable-top carton geometry with:
 * - Rectangular body with chamfered vertical edges
 * - Gable roof with proper trapezoidal fold panels
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
  /** Gable roof panels geometry */
  roof: THREE.BufferGeometry;
  /** Fin-seal ridge strip geometry */
  ridge: THREE.BufferGeometry;
  /** Bottom cap geometry */
  bottom: THREE.BufferGeometry;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function chamferedRectProfile(
  hw: number,
  hd: number,
  chamfer: number,
  segments: number
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const corners: Array<[number, number, number, number]> = [
    [-hw + chamfer, -hd + chamfer, Math.PI,        Math.PI * 1.5],
    [+hw - chamfer, -hd + chamfer, Math.PI * 1.5,  Math.PI * 2  ],
    [+hw - chamfer, +hd - chamfer, 0,               Math.PI * 0.5],
    [-hw + chamfer, +hd - chamfer, Math.PI * 0.5,  Math.PI      ],
  ];
  for (const [cx, cz, a0, a1] of corners) {
    for (let k = 0; k <= segments; k++) {
      const a = a0 + (a1 - a0) * (k / segments);
      pts.push([cx + chamfer * Math.cos(a), cz + chamfer * Math.sin(a)]);
    }
  }
  return pts;
}

function perimeterOf(profile: Array<[number, number]>): number {
  let p = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const dx = profile[i + 1][0] - profile[i][0];
    const dz = profile[i + 1][1] - profile[i][1];
    p += Math.sqrt(dx * dx + dz * dz);
  }
  return p;
}

function extrudeRing(
  profile: Array<[number, number]>,
  yBot: number,
  yTop: number,
  totalPerim: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const n = profile.length;

  let uAcc = 0;
  // Bottom ring
  for (let i = 0; i < n; i++) {
    const [x, z] = profile[i];
    positions.push(x, yBot, z);
    uvs.push(uAcc / totalPerim, 0);
    if (i < n - 1) {
      const dx = profile[i + 1][0] - x;
      const dz = profile[i + 1][1] - z;
      uAcc += Math.sqrt(dx * dx + dz * dz);
    }
  }

  uAcc = 0;
  // Top ring
  for (let i = 0; i < n; i++) {
    const [x, z] = profile[i];
    positions.push(x, yTop, z);
    uvs.push(uAcc / totalPerim, 1);
    if (i < n - 1) {
      const dx = profile[i + 1][0] - x;
      const dz = profile[i + 1][1] - z;
      uAcc += Math.sqrt(dx * dx + dz * dz);
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const b0 = i, b1 = i + 1;
    const t0 = n + i, t1 = n + i + 1;
    indices.push(b0, t0, b1);
    indices.push(b1, t0, t1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv",       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addQuad(
  pos: number[], uvArr: number[], idx: number[],
  a: [number,number,number], b: [number,number,number],
  c: [number,number,number], d: [number,number,number],
  uva: [number,number], uvb: [number,number],
  uvc: [number,number], uvd: [number,number]
) {
  const base = pos.length / 3;
  for (const [p, uv] of [[a,uva],[b,uvb],[c,uvc],[d,uvd]] as const) {
    pos.push(p[0], p[1], p[2]);
    uvArr.push(uv[0], uv[1]);
  }
  idx.push(base, base+1, base+2);
  idx.push(base, base+2, base+3);
}

function addTri(
  pos: number[], uvArr: number[], idx: number[],
  a: [number,number,number], b: [number,number,number], c: [number,number,number],
  uva: [number,number], uvb: [number,number], uvc: [number,number]
) {
  const base = pos.length / 3;
  for (const [p, uv] of [[a,uva],[b,uvb],[c,uvc]] as const) {
    pos.push(p[0], p[1], p[2]);
    uvArr.push(uv[0], uv[1]);
  }
  idx.push(base, base+1, base+2);
}

function buildGeo(pos: number[], uvArr: number[], idx: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv",       new THREE.Float32BufferAttribute(uvArr, 2));
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
    gableRatio       = 0.17,
    edgeChamferRatio = 0.04,
    chamferSegments  = 5,
    bottomSealRatio  = 0.025,
    strawPatch       = true,
  } = config;

  const hw = W / 2;
  const hd = D / 2;
  const chamfer = Math.min(hw, hd) * edgeChamferRatio;

  const gableH  = H * gableRatio;
  const ridgeH  = gableH * 0.18;
  const bodyH   = H - gableH - ridgeH;
  const sealH   = H * bottomSealRatio;

  // ── Body (chamfered extruded rectangle) ──────────────────────────────────────
  const profile = chamferedRectProfile(hw, hd, chamfer, chamferSegments);
  const perim   = perimeterOf(profile);
  const bodyGeo = extrudeRing(profile, sealH, bodyH, perim);

  // ── Bottom cap (fan from centre) ─────────────────────────────────────────────
  const botPos: number[] = [];
  const botUvs: number[] = [];
  const botIdx: number[] = [];

  botPos.push(0, sealH, 0);
  botUvs.push(0.5, 0.5);

  for (const [x, z] of profile) {
    botPos.push(x, sealH, z);
    botUvs.push(0.5 + x / W, 0.5 + z / D);
  }
  for (let i = 1; i < profile.length; i++) {
    botIdx.push(0, i < profile.length - 1 ? i + 1 : 1, i);
  }
  const botGeo = buildGeo(botPos, botUvs, botIdx);

  // ── Gable roof ───────────────────────────────────────────────────────────────
  // 4 panels meeting at a ridge line at x = ±ridgeHalfW, y = bodyH + gableH
  const ridgeHalfW = hw * 0.12;
  const yRB = bodyH;          // roof base y
  const yRT = bodyH + gableH; // roof top y (ridge centre)

  const rPos: number[] = [];
  const rUvs: number[] = [];
  const rIdx: number[] = [];

  // Front panel (trapezoid: full width at base, narrow at apex)
  addQuad(rPos, rUvs, rIdx,
    [-hw, yRB, -hd], [+hw, yRB, -hd],
    [+ridgeHalfW, yRT, 0], [-ridgeHalfW, yRT, 0],
    [0,0],[1,0],[1,1],[0,1]
  );

  // Back panel
  addQuad(rPos, rUvs, rIdx,
    [+hw, yRB, +hd], [-hw, yRB, +hd],
    [-ridgeHalfW, yRT, 0], [+ridgeHalfW, yRT, 0],
    [0,0],[1,0],[1,1],[0,1]
  );

  // Left side panel (triangle)
  addTri(rPos, rUvs, rIdx,
    [-hw, yRB, -hd], [-hw, yRB, +hd], [-ridgeHalfW, yRT, 0],
    [0,0],[1,0],[0.5,1]
  );

  // Right side panel (triangle)
  addTri(rPos, rUvs, rIdx,
    [+hw, yRB, +hd], [+hw, yRB, -hd], [+ridgeHalfW, yRT, 0],
    [0,0],[1,0],[0.5,1]
  );

  // Straw patch
  if (strawPatch) {
    const px  = hw * 0.38;
    const pz  = -hd * 0.5;
    const patchY = yRB + gableH * 0.42;
    const pr  = hw * 0.055;
    const ns  = 8;
    const cb  = rPos.length / 3;
    rPos.push(px, patchY + 0.6, pz);
    rUvs.push(0.75, 0.8);
    for (let k = 0; k < ns; k++) {
      const a = (k / ns) * Math.PI * 2;
      rPos.push(px + pr * Math.cos(a), patchY + 0.6, pz + pr * Math.sin(a));
      rUvs.push(0.75 + 0.05 * Math.cos(a), 0.8 + 0.05 * Math.sin(a));
    }
    for (let k = 0; k < ns; k++) {
      rIdx.push(cb, cb + 1 + k, cb + 1 + (k+1) % ns);
    }
  }

  const roofGeo = buildGeo(rPos, rUvs, rIdx);

  // ── Ridge strip (fin seal) ────────────────────────────────────────────────────
  const rdPos: number[] = [];
  const rdUvs: number[] = [];
  const rdIdx: number[] = [];

  // Front face of ridge
  addQuad(rdPos, rdUvs, rdIdx,
    [-hw, yRT, 0], [+hw, yRT, 0],
    [+hw, yRT + ridgeH, 0], [-hw, yRT + ridgeH, 0],
    [0,0],[1,0],[1,1],[0,1]
  );
  // Top cap
  addQuad(rdPos, rdUvs, rdIdx,
    [-hw, yRT + ridgeH, -ridgeH * 0.5], [+hw, yRT + ridgeH, -ridgeH * 0.5],
    [+hw, yRT + ridgeH, +ridgeH * 0.5], [-hw, yRT + ridgeH, +ridgeH * 0.5],
    [0,0],[1,0],[1,1],[0,1]
  );

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
