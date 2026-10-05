/**
 * Parametric bottle geometry (phase 2B): BottleSpec → cross-section → vertical profile
 * (base fillet, body, shoulder, neck, finish) → watertight BufferGeometry.
 *
 * Replaces the single circular LatheGeometry, which ignored L ≠ W. The cross-section is a
 * real ellipse, rounded rectangle or rounded polygon matching `width × depth` exactly, and
 * every ring of the bottle uses the *same* sampling (one vertex per direction), so the
 * shoulder can morph the body section into the (round or oval) neck without seams or NaN.
 *
 * Conventions: millimetres, Y up, origin at the centre of the base, front = +z.
 * Section vertices run back → left → front → right, so on the front face `u` grows from the
 * viewer's left to right, exactly like the former `wrapCylinder` labels.
 * Pure maths + three.js buffers: no DOM, no randomness (same config → same geometry).
 */
import * as THREE from "three";
import {
  bottleMetrics, len, sub, unit,
  type BottleGeometryConfig, type BottleSection, type P2, type Station,
} from "@/lib/structure/profile/bottleProfile";
export {
  bottleFamily, bottlePreset, bottleSection, shoulderCurve,
  type BaseStyle, type BottleBodyShape, type BottleFamily, type BottleGeometryConfig, type BottlePreset, type BottleSection, type ShoulderStyle,
} from "@/lib/structure/profile/bottleProfile";

// ─── Public types ────────────────────────────────────────────────────────────

export interface BottleGeometryResult {
  /** Lateral surface + top of the finish. */
  body: THREE.BufferGeometry;
  /** Bottom (flat or with a punt). */
  bottom: THREE.BufferGeometry;
  section: BottleSection;
  /** Straight part of the body, where labels go (mm). */
  bodyBottomY: number;
  shoulderStartY: number;
  neckStartY: number;
  /** Closure attachment (future cap / pump / spray / dropper). */
  neckTopY: number;
  neckTopRadius: number;
  neck: { width: number; depth: number; y: number };
  /** Finish bead at the top of the neck (closures cover it): height (mm) and radial scale. */
  finish: { height: number; scale: number };
  bodyPerimeter: number;
  triangles: number;
}


// ─── Buffers ─────────────────────────────────────────────────────────────────

interface Buffers {
  pos: number[];
  uv: number[];
  idx: number[];
}

/** A band of rings (smooth inside, separate vertices at creases), closed around with a UV seam column. */
function addStrip(buf: Buffers, rings: P2[][], ys: number[], H: number) {
  const n = rings[0].length;
  const base = buf.pos.length / 3;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    let acc = 0;
    let per = 0;
    for (let i = 0; i < n; i++) per += len(sub(ring[(i + 1) % n], ring[i]));
    for (let i = 0; i <= n; i++) {
      const [x, z] = ring[i % n];
      buf.pos.push(x, ys[r], z);
      buf.uv.push(per > 0 ? acc / per : i / n, ys[r] / H);
      if (i < n) acc += len(sub(ring[(i + 1) % n], ring[i]));
    }
  }
  const stride = n + 1;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = base + r * stride + i, b = a + stride, d = a + 1, c = b + 1;
      // (d - a) × (b - a) points outward with the back → left → front → right order.
      buf.idx.push(a, d, b, d, c, b);
    }
  }
  return { base, rows: rings.length, stride };
}

/** Fan from a ring to its centre. `up` = facing +y (top), otherwise facing −y. */
function addFan(buf: Buffers, ring: P2[], y: number, cy: number, up: boolean, H: number) {
  const n = ring.length;
  const c = buf.pos.length / 3;
  buf.pos.push(0, cy, 0);
  buf.uv.push(0.5, cy / H);
  for (const [x, z] of ring) {
    buf.pos.push(x, y, z);
    buf.uv.push(0.5, y / H);
  }
  for (let i = 0; i < n; i++) {
    const a = c + 1 + i, b = c + 1 + ((i + 1) % n);
    if (up) buf.idx.push(c, a, b);
    else buf.idx.push(c, b, a);
  }
}

function toGeometry(buf: Buffers, seams: { base: number; rows: number; stride: number }[]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uv, 2));
  geo.setIndex(buf.idx);
  geo.computeVertexNormals();
  // The UV seam duplicates the first column: give both copies the same (averaged) normal.
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  for (const s of seams) {
    for (let r = 0; r < s.rows; r++) {
      const a = s.base + r * s.stride, b = a + s.stride - 1;
      const v = new THREE.Vector3(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
      nrm.setXYZ(a, v.x, v.y, v.z);
      nrm.setXYZ(b, v.x, v.y, v.z);
    }
  }
  return geo;
}

const triangleCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count / 3 : g.attributes.position.count / 3);

// ─── Main API ────────────────────────────────────────────────────────────────

export function createBottleGeometry(config: BottleGeometryConfig): BottleGeometryResult {
  const cfg = { ...config };
  // Dimensions shared with the print structure (lib/structure/profile/bottleProfile.ts).
  const { section, hw, hd, nw, nd, list, rb, yShoulder, yNeck, H, finishH, bead } = bottleMetrics(cfg);
  const minHalf = Math.min(hw, hd);

  // Neck point in the same direction as each body vertex (same sampling on every ring).
  const neck: P2[] = section.points.map(([x, z]) => {
    const d = unit([x / hw, z / hd]);
    return [d[0] * nw, d[1] * nd];
  });
  const ring = (s: Station): P2[] =>
    section.points.map(([x, z], i) => {
      let px = x + (neck[i][0] - x) * s.t;
      let pz = z + (neck[i][1] - z) * s.t;
      if (s.inset) {
        px -= section.normals[i][0] * s.inset;
        pz -= section.normals[i][1] * s.inset;
      }
      if (s.scale && s.scale !== 1) {
        px *= s.scale;
        pz *= s.scale;
      }
      return [px, pz];
    });

  const body: Buffers = { pos: [], uv: [], idx: [] };
  const seams: { base: number; rows: number; stride: number }[] = [];
  let rings: P2[][] = [];
  let ys: number[] = [];
  for (const s of list) {
    const r = ring(s);
    if (s.crease && rings.length) {
      rings.push(r);
      ys.push(s.y);
      if (rings.length > 1) seams.push(addStrip(body, rings, ys, H));
      rings = [];
      ys = [];
    }
    rings.push(r);
    ys.push(s.y);
  }
  if (rings.length > 1) seams.push(addStrip(body, rings, ys, H));
  addFan(body, ring(list[list.length - 1]), H, H, true, H);
  const bodyGeo = toGeometry(body, seams);

  // Bottom: flat disc, or a punt (wine) rising into the bottle.
  const bottom: Buffers = { pos: [], uv: [], idx: [] };
  const rim = ring(list[0]);
  const bottomSeams: { base: number; rows: number; stride: number }[] = [];
  if ((cfg.baseStyle ?? "flat") === "recessed") {
    const punt = Math.min(H * 0.08, minHalf * 0.45);
    const steps = 5;
    const bRings: P2[][] = [];
    const bYs: number[] = [];
    for (let k = 0; k <= steps; k++) {
      const f = 1 - (k / steps) * 0.85;
      bRings.push(rim.map(([x, z]) => [x * f, z * f] as P2));
      bYs.push(punt * (1 - Math.cos((Math.PI / 2) * (k / steps))));
    }
    // Seen from below: reverse the order so the strip faces down/outward.
    const rev = bRings.map((r) => [r[0], ...r.slice(1).reverse()]);
    bottomSeams.push(addStrip(bottom, rev, bYs, H));
    addFan(bottom, bRings[steps], bYs[steps], punt, false, H);
  } else {
    addFan(bottom, rim, 0, 0, false, H);
  }
  const bottomGeo = toGeometry(bottom, bottomSeams);

  return {
    body: bodyGeo,
    bottom: bottomGeo,
    section,
    bodyBottomY: rb,
    shoulderStartY: yShoulder,
    neckStartY: yNeck,
    neckTopY: H,
    neckTopRadius: Math.max(nw, nd),
    neck: { width: nw * 2, depth: nd * 2, y: H },
    finish: { height: finishH, scale: bead },
    bodyPerimeter: section.perimeter,
    triangles: triangleCount(bodyGeo) + triangleCount(bottomGeo),
  };
}

// ─── Label and contents on the real section ──────────────────────────────────

/** Point and outward normal at arc length `s` along the section (wraps around). */
function sampleArc(sec: BottleSection, s: number): { p: P2; n: P2 } {
  const P = sec.perimeter;
  const x = ((s % P) + P) % P;
  const n = sec.points.length;
  let i = 0;
  while (i < n - 1 && sec.arc[i + 1] <= x) i++;
  const j = (i + 1) % n;
  const segLen = (j === 0 ? P : sec.arc[j]) - sec.arc[i];
  const f = segLen > 0 ? (x - sec.arc[i]) / segLen : 0;
  const p: P2 = [sec.points[i][0] + (sec.points[j][0] - sec.points[i][0]) * f, sec.points[i][1] + (sec.points[j][1] - sec.points[i][1]) * f];
  const nn = unit([sec.normals[i][0] + (sec.normals[j][0] - sec.normals[i][0]) * f, sec.normals[i][1] + (sec.normals[j][1] - sec.normals[i][1]) * f]);
  return { p, n: nn };
}

/**
 * Wrap label that follows the body's real section (ellipse, rounded rectangle…), centred on
 * the front. u runs left → right across the label, v bottom → top: the same mapping as the
 * former cylindrical labels, so `wrapTexture(design, arcLength, height, 0.5)` is unchanged.
 *
 * With `thickness` (mm, e.g. 0.15) the label is a thin physical shell: group 0 = printed face,
 * group 1 = paper edges and back (the white core seen on the cut edges and through clear glass).
 */
export function createBottleLabel(
  section: BottleSection,
  opts: { yStart: number; height: number; fraction: number; gap?: number; thickness?: number }
): { geometry: THREE.BufferGeometry; arcLength: number } {
  const L = Math.max(0.05, Math.min(1, opts.fraction)) * section.perimeter;
  const thick = Math.max(0, opts.thickness ?? 0);
  const gap = opts.gap ?? (thick > 0 ? Math.max(0.08, section.perimeter * 0.0004) : Math.max(0.25, section.perimeter * 0.0015));
  const s0 = section.perimeter / 2 - L / 2;
  // Every section vertex inside the window, plus both window edges: exact on corners.
  const cuts = [s0, s0 + L];
  for (const arc of section.arc) {
    for (const k of [0, 1]) {
      const x = arc + k * section.perimeter;
      if (x > s0 + 1e-6 && x < s0 + L - 1e-6) cuts.push(x);
    }
  }
  cuts.sort((p, q) => p - q);
  const samples = cuts.map((x) => sampleArc(section, x));
  const rows = [opts.yStart, opts.yStart + opts.height];

  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const face: number[] = [];
  const core: number[] = [];
  const vert = (x: number, y: number, z: number, n: [number, number, number], u: number, v: number) => {
    pos.push(x, y, z);
    nrm.push(...n);
    uv.push(u, v);
    return pos.length / 3 - 1;
  };
  /** Triangle wound so its face normal agrees with the intended normal `n`. */
  const tri = (list: number[], i: number, j: number, k: number, n: [number, number, number]) => {
    const P = (q: number) => new THREE.Vector3(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]);
    const fn = P(j).sub(P(i)).cross(P(k).sub(P(i)));
    if (fn.x * n[0] + fn.y * n[1] + fn.z * n[2] >= 0) list.push(i, j, k);
    else list.push(i, k, j);
  };
  /** Grid of the label surface at an offset; returns the vertex indices [row][column]. */
  const sheet = (offset: number, inward: boolean) =>
    rows.map((y, r) => samples.map(({ p, n }, c) =>
      vert(p[0] + n[0] * offset, y, p[1] + n[1] * offset, inward ? [-n[0], 0, -n[1]] : [n[0], 0, n[1]], (cuts[c] - s0) / L, r)));
  const quads = (list: number[], g: number[][], inward: boolean) => {
    for (let c = 0; c < cuts.length - 1; c++) {
      const n = samples[c].n;
      const want: [number, number, number] = inward ? [-n[0], 0, -n[1]] : [n[0], 0, n[1]];
      tri(list, g[0][c], g[0][c + 1], g[1][c], want);
      tri(list, g[0][c + 1], g[1][c + 1], g[1][c], want);
    }
  };

  const outer = sheet(gap + thick, false);
  quads(face, outer, false);
  if (thick > 0) {
    const inner = sheet(gap, true);
    quads(core, inner, true);
    // Top and bottom cut edges.
    for (const [r, ny] of [[1, 1], [0, -1]] as const) {
      const up: [number, number, number] = [0, ny, 0];
      const o = samples.map(({ p, n }, c) => vert(p[0] + n[0] * (gap + thick), rows[r], p[1] + n[1] * (gap + thick), up, (cuts[c] - s0) / L, r));
      const i = samples.map(({ p, n }, c) => vert(p[0] + n[0] * gap, rows[r], p[1] + n[1] * gap, up, (cuts[c] - s0) / L, r));
      for (let c = 0; c < cuts.length - 1; c++) {
        tri(core, o[c], o[c + 1], i[c], up);
        tri(core, o[c + 1], i[c + 1], i[c], up);
      }
    }
    // Left and right ends, facing along the section.
    for (const [c, sign] of [[0, -1], [cuts.length - 1, 1]] as const) {
      const { p, n } = samples[c];
      // Tangent of the path (direction of increasing arc length is (n.z, −n.x)), pointing out.
      const t: [number, number, number] = [n[1] * sign, 0, -n[0] * sign];
      const q = [0, 1].flatMap((r) => [gap, gap + thick].map((off) => vert(p[0] + n[0] * off, rows[r], p[1] + n[1] * off, t, c / (cuts.length - 1), r)));
      tri(core, q[0], q[1], q[2], t);
      tri(core, q[1], q[3], q[2], t);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex([...face, ...core]);
  geometry.addGroup(0, face.length, 0);
  if (core.length) geometry.addGroup(face.length, core.length, 1);
  return { geometry, arcLength: L };
}

/** Liquid seen through glass: the body section, slightly inset, from the base to `topY`. */
export function createBottleFill(result: BottleGeometryResult, topY: number, inset = 0.06): THREE.BufferGeometry {
  const k = 1 - inset;
  const r: P2[] = result.section.points.map(([x, z]) => [x * k, z * k]);
  const buf: Buffers = { pos: [], uv: [], idx: [] };
  const y0 = result.bodyBottomY * 0.6;
  const seam = addStrip(buf, [r, r], [y0, topY], topY);
  addFan(buf, r, topY, topY, true, topY);
  addFan(buf, r, y0, y0, false, topY);
  return toGeometry(buf, [seam]);
}

