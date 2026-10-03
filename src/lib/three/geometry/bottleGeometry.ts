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

// ─── Public types ────────────────────────────────────────────────────────────

export type BottleBodyShape = "round" | "oval" | "rectangular" | "square" | "faceted";
export type ShoulderStyle = "none" | "soft" | "rounded" | "sloped" | "sharp";
export type BaseStyle = "flat" | "slightlyRounded" | "recessed";

export interface BottleGeometryConfig {
  /** Body width (X), mm. */
  width: number;
  /** Body depth (Z), mm: respected exactly, independently of the width. */
  depth: number;
  /** Height of the bottle itself (base to top of the neck finish, closure excluded), mm. */
  height: number;
  bodyShape: BottleBodyShape;
  shoulderStyle: ShoulderStyle;
  /** Height of the shoulder zone (body → neck), mm. */
  shoulderHeight: number;
  /** Neck outer width (X), mm. */
  neckWidth: number;
  /** Neck outer depth (Z), mm (default: round neck, = neckWidth). */
  neckDepth?: number;
  /** Neck height including the finish, mm. */
  neckHeight: number;
  /** Radius of the rounded edge at the base, mm (default depends on `baseStyle`). */
  baseHeight?: number;
  baseStyle?: BaseStyle;
  /** Rectangular / square / faceted: corner radius as a fraction of the smaller half-side (0..1). */
  cornerRadius?: number;
  /** Faceted: number of faces (default 8). */
  facetCount?: number;
  /** Vertices around the section (round / oval), default 72. */
  resolution?: number;
  /** Reserved for future deterministic variations; the geometry is already deterministic. */
  seed?: number;
}

/** Cross-section shared by every ring (and by the label). */
export interface BottleSection {
  /** [x, z] vertices, back → left → front → right, not closed. */
  points: [number, number][];
  /** Outward unit normals of the section at each vertex. */
  normals: [number, number][];
  /** Cumulative arc length at each vertex (0 at the back); `perimeter` closes the loop. */
  arc: number[];
  perimeter: number;
}

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

// ─── Cross-sections ──────────────────────────────────────────────────────────

type P2 = [number, number];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const len = (a: P2) => Math.hypot(a[0], a[1]);
const unit = (a: P2): P2 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

/** Point of an ellipse at parameter θ (θ = 0 back, π/2 left, π front). */
function ellipsePoint(hw: number, hd: number, t: number): P2 {
  return [-hw * Math.sin(t), -hd * Math.cos(t)];
}

function ellipseSection(hw: number, hd: number, n: number) {
  const points: P2[] = [];
  const normals: P2[] = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = ellipsePoint(hw, hd, (i / n) * Math.PI * 2);
    points.push([x, z]);
    normals.push(unit([x / (hw * hw), z / (hd * hd)]));
  }
  return { points, normals };
}

/**
 * Polygon with rounded corners, sampled edge by edge (`edgeSeg` per edge, `cornerSeg` per
 * corner), starting at the middle of the back edge. Vertices must be in path order.
 */
function roundedPolygonSection(vertices: P2[], radius: number, edgeSeg: number, cornerSeg: number) {
  const m = vertices.length;
  const corners = vertices.map((v, k) => {
    const a = unit(sub(vertices[(k - 1 + m) % m], v));
    const b = unit(sub(vertices[(k + 1) % m], v));
    const half = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) / 2;
    const shortest = Math.min(len(sub(vertices[(k - 1 + m) % m], v)), len(sub(vertices[(k + 1) % m], v)));
    const t = Math.min(radius / Math.tan(half), shortest * 0.49);
    const r = t * Math.tan(half);
    const bis = unit([a[0] + b[0], a[1] + b[1]]);
    const c: P2 = [v[0] + (bis[0] * r) / Math.sin(half), v[1] + (bis[1] * r) / Math.sin(half)];
    return { t1: [v[0] + a[0] * t, v[1] + a[1] * t] as P2, t2: [v[0] + b[0] * t, v[1] + b[1] * t] as P2, c, r };
  });
  const points: P2[] = [];
  const normals: P2[] = [];
  const centroid: P2 = [vertices.reduce((s, v) => s + v[0], 0) / m, vertices.reduce((s, v) => s + v[1], 0) / m];
  const edgeNormal = (from: P2, to: P2): P2 => {
    const d = unit(sub(to, from));
    let n: P2 = [d[1], -d[0]];
    const mid: P2 = [(from[0] + to[0]) / 2 - centroid[0], (from[1] + to[1]) / 2 - centroid[1]];
    if (n[0] * mid[0] + n[1] * mid[1] < 0) n = [-n[0], -n[1]];
    return n;
  };
  const line = (from: P2, to: P2, seg: number) => {
    const n = edgeNormal(from, to);
    for (let s = 0; s < seg; s++) {
      const f = s / seg;
      points.push([from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f]);
      normals.push(n);
    }
  };
  const arc = (k: number) => {
    const { t1, t2, c, r } = corners[k];
    if (r < 1e-6) return;
    const a0 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
    let a1 = Math.atan2(t2[1] - c[1], t2[0] - c[0]);
    let da = a1 - a0;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    a1 = a0 + da;
    for (let s = 0; s < cornerSeg; s++) {
      const ang = a0 + (da * s) / cornerSeg;
      points.push([c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang)]);
      normals.push([Math.cos(ang), Math.sin(ang)]);
    }
  };
  const last = corners[m - 1];
  const start: P2 = [(last.t2[0] + corners[0].t1[0]) / 2, (last.t2[1] + corners[0].t1[1]) / 2];
  const half = Math.max(1, Math.round(edgeSeg / 2));
  line(start, corners[0].t1, half);
  for (let k = 0; k < m; k++) {
    arc(k);
    line(corners[k].t2, k === m - 1 ? start : corners[k + 1].t1, k === m - 1 ? half : edgeSeg);
  }
  return { points, normals };
}

function withArc(points: P2[], normals: P2[]): BottleSection {
  const arc: number[] = [0];
  for (let i = 1; i < points.length; i++) arc.push(arc[i - 1] + len(sub(points[i], points[i - 1])));
  const perimeter = arc[arc.length - 1] + len(sub(points[0], points[points.length - 1]));
  return { points, normals, arc, perimeter };
}

/** Scales a section so its bounding box is exactly (2hw × 2hd) (rounding shrinks polygons). */
function fitExtents(s: { points: P2[]; normals: P2[] }, hw: number, hd: number) {
  const mx = Math.max(...s.points.map((p) => Math.abs(p[0])));
  const mz = Math.max(...s.points.map((p) => Math.abs(p[1])));
  const kx = hw / mx, kz = hd / mz;
  return {
    points: s.points.map(([x, z]) => [x * kx, z * kz] as P2),
    normals: s.normals.map(([x, z]) => unit([x / kx, z / kz])),
  };
}

/** Half width / half depth of the body (a round body is a circle of the given width). */
function halfExtents(cfg: Pick<BottleGeometryConfig, "width" | "depth" | "bodyShape">): [number, number] {
  return [cfg.width / 2, (cfg.bodyShape === "round" ? cfg.width : cfg.depth) / 2];
}

export function bottleSection(cfg: Pick<BottleGeometryConfig, "width" | "depth" | "bodyShape" | "cornerRadius" | "facetCount" | "resolution">): BottleSection {
  const [hw, hd] = halfExtents(cfg);
  const minHalf = Math.min(hw, hd);
  switch (cfg.bodyShape) {
    case "rectangular":
    case "square": {
      const r = Math.min(0.999, Math.max(0, cfg.cornerRadius ?? 0.2)) * minHalf;
      const verts: P2[] = [[-hw, -hd], [-hw, hd], [hw, hd], [hw, -hd]];
      const s = roundedPolygonSection(verts, Math.max(r, minHalf * 0.02), 6, 6);
      return withArc(s.points, s.normals);
    }
    case "faceted": {
      const m = Math.max(3, Math.min(24, Math.round(cfg.facetCount ?? 8)));
      // Faces (not vertices) at the back and the front: vertices at half steps.
      const verts = Array.from({ length: m }, (_, k) => ellipsePoint(hw, hd, ((k + 0.5) / m) * Math.PI * 2));
      const r = Math.max(0.02, Math.min(0.9, cfg.cornerRadius ?? 0.12)) * minHalf * (4 / m);
      const s = fitExtents(roundedPolygonSection(verts, r, 2, 3), hw, hd);
      return withArc(s.points, s.normals);
    }
    case "oval":
    case "round":
    default: {
      const s = ellipseSection(hw, hd, Math.max(16, Math.round(cfg.resolution ?? 72)));
      return withArc(s.points, s.normals);
    }
  }
}

// ─── Vertical profile ────────────────────────────────────────────────────────

/** One ring of the bottle: height, morph toward the neck (t), inward offset, neck scale. */
interface Station {
  y: number;
  t: number;
  inset?: number;
  scale?: number;
  /** Hard edge: the ring is duplicated so normals are not shared across it. */
  crease?: boolean;
}

/** Shoulder curve: list of (u = height fraction, t = morph) pairs, from body (0,0) to neck (1,1). */
export function shoulderCurve(style: ShoulderStyle, steps = 16): { u: number; t: number; crease?: boolean }[] {
  const out: { u: number; t: number; crease?: boolean }[] = [];
  switch (style) {
    case "none":
      return [{ u: 1, t: 0, crease: true }, { u: 1, t: 1, crease: true }];
    case "soft":
      // Cosine ease: tangent to the body and to the neck.
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        out.push({ u, t: (1 - Math.cos(Math.PI * u)) / 2 });
      }
      return out;
    case "rounded":
      // Quarter ellipse: dome that meets the neck almost horizontally (cosmetic, Boston round).
      for (let i = 1; i <= steps; i++) {
        const phi = (i / steps) * (Math.PI / 2);
        out.push(i === steps ? { u: 1, t: 1 } : { u: Math.sin(phi), t: 1 - Math.cos(phi) });
      }
      return out;
    case "sloped": {
      // Rounded turn off the body, long straight cone, short ease into the neck (Bordeaux).
      const a = 0.35, b = 0.15;
      const speed = (u: number) => (u < a ? u / a : u > 1 - b ? (1 - u) / b : 1);
      const N = 200;
      const cum: number[] = [0];
      for (let k = 1; k <= N; k++) cum.push(cum[k - 1] + speed((k - 0.5) / N));
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        out.push({ u, t: cum[Math.round(u * N)] / cum[N] });
      }
      return out;
    }
    case "sharp": {
      // Straight body, tight fillet, flat top, hard edge at the neck (premium perfume).
      const tf = 0.22, fu = 0.6;
      const fillet = Math.max(3, Math.round(steps / 3));
      out.push({ u: fu, t: 0 });
      for (let i = 1; i <= fillet; i++) {
        const phi = (i / fillet) * (Math.PI / 2);
        out.push({ u: fu + (1 - fu) * Math.sin(phi), t: tf * (1 - Math.cos(phi)) });
      }
      out.push({ u: 1, t: 1, crease: true });
      return out;
    }
  }
}

function stations(cfg: BottleGeometryConfig, minHalf: number, neckMinHalf: number) {
  const H = cfg.height;
  const neckH = Math.max(H * 0.02, Math.min(cfg.neckHeight, H * 0.6));
  const shoulderH = Math.max(0, Math.min(cfg.shoulderHeight, H - neckH - H * 0.1));
  const yNeck = H - neckH;
  const yShoulder = yNeck - shoulderH;
  const style = cfg.baseStyle ?? "flat";
  const defaultFillet = minHalf * (style === "slightlyRounded" ? 0.26 : style === "recessed" ? 0.12 : 0.07);
  const rb = Math.max(0.2, Math.min(cfg.baseHeight ?? defaultFillet, minHalf * 0.45, yShoulder * 0.3));

  const list: Station[] = [];
  // Base fillet: quarter circle from the bottom (horizontal tangent) to the side (vertical).
  const baseSeg = 6;
  for (let k = 0; k <= baseSeg; k++) {
    const phi = (k / baseSeg) * (Math.PI / 2);
    list.push({ y: rb - rb * Math.cos(phi), t: 0, inset: rb - rb * Math.sin(phi) });
  }
  // Straight body (one band is enough: it is a ruled surface).
  list.push({ y: yShoulder, t: 0 });
  // Shoulder.
  for (const p of shoulderCurve(cfg.shoulderStyle)) {
    list.push({ y: yShoulder + p.u * shoulderH, t: p.t, crease: p.crease });
  }
  // Neck and finish bead (the closure attachment ring).
  const finishH = Math.min(neckH * 0.35, Math.max(1, neckMinHalf * 0.5));
  const bead = 1 + Math.min(0.12, 1.2 / Math.max(1, neckMinHalf));
  list.push({ y: H - finishH, t: 1, scale: 1 });
  list.push({ y: H - finishH * 0.75, t: 1, scale: bead });
  list.push({ y: H - finishH * 0.2, t: 1, scale: bead });
  list.push({ y: H, t: 1, scale: 1 });
  return { list, rb, yShoulder, yNeck, H, finishH, bead };
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
  const section = bottleSection(cfg);
  const [hw, hd] = halfExtents(cfg);
  const minHalf = Math.min(hw, hd);
  const nw = Math.max(0.5, Math.min(cfg.neckWidth / 2, hw * 0.98));
  const nd = Math.max(0.5, Math.min((cfg.neckDepth ?? cfg.neckWidth) / 2, hd * 0.98));

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

  const { list, rb, yShoulder, yNeck, H, finishH, bead } = stations(cfg, minHalf, Math.min(nw, nd));
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
 */
export function createBottleLabel(
  section: BottleSection,
  opts: { yStart: number; height: number; fraction: number; gap?: number }
): { geometry: THREE.BufferGeometry; arcLength: number } {
  const L = Math.max(0.05, Math.min(1, opts.fraction)) * section.perimeter;
  const gap = opts.gap ?? Math.max(0.25, section.perimeter * 0.0015);
  const s0 = section.perimeter / 2 - L / 2;
  // Every section vertex inside the window, plus both window edges: exact on corners.
  const cuts = [s0, s0 + L];
  for (const a of section.arc) {
    for (const k of [0, 1]) {
      const s = a + k * section.perimeter;
      if (s > s0 + 1e-6 && s < s0 + L - 1e-6) cuts.push(s);
    }
  }
  cuts.sort((a, b) => a - b);
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const rows = [opts.yStart, opts.yStart + opts.height];
  for (let r = 0; r < 2; r++) {
    for (const s of cuts) {
      const { p, n } = sampleArc(section, s);
      pos.push(p[0] + n[0] * gap, rows[r], p[1] + n[1] * gap);
      nrm.push(n[0], 0, n[1]);
      uv.push((s - s0) / L, r);
    }
  }
  const idx: number[] = [];
  const m = cuts.length;
  for (let i = 0; i < m - 1; i++) {
    const a = i, d = i + 1, b = m + i, c = m + i + 1;
    idx.push(a, d, b, d, c, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(idx);
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

// ─── Families ────────────────────────────────────────────────────────────────

export type BottleFamily = "round" | "beverage" | "oval" | "perfume" | "wine" | "dropper" | "pump" | "spray";

export interface BottlePreset {
  family: BottleFamily;
  config: BottleGeometryConfig;
  /** Label zone as fractions of the straight body, and share of the perimeter it covers. */
  label: { from: number; to: number; fraction: number };
}

/** Which family a catalog bottle belongs to (model + footprint + material). */
export function bottleFamily(model: string, L: number, W: number, material = ""): BottleFamily {
  const flat = Math.min(L, W) / Math.max(L, W) < 0.85;
  if (model === "wine") return "wine";
  if (model === "dropper") return "dropper";
  if (model === "pump") return "pump";
  if (model === "spray") return flat ? "perfume" : "spray";
  if (flat) return "oval";
  return /\bPET\b/i.test(material) ? "beverage" : "round";
}

/**
 * One parametric engine, a few family settings. `height` is the bottle without its closure.
 * Proportions are relative to the footprint so every catalog size stays coherent.
 */
export function bottlePreset(family: BottleFamily, L: number, W: number, height: number): BottlePreset {
  const D = Math.min(L, W);
  const round = (over: Partial<BottleGeometryConfig>, label: BottlePreset["label"]): BottlePreset => ({
    family,
    config: {
      width: D, depth: D, height, bodyShape: "round", shoulderStyle: "soft",
      shoulderHeight: height * 0.16, neckWidth: D * 0.38, neckHeight: height * 0.12, baseStyle: "flat", ...over,
    },
    label,
  });
  switch (family) {
    case "beverage":
      return round({ shoulderHeight: height * 0.24, neckWidth: D * 0.36, neckHeight: height * 0.1, baseStyle: "slightlyRounded" }, { from: 0.15, to: 0.72, fraction: 0.65 });
    case "wine":
      return round({ shoulderStyle: "sloped", shoulderHeight: height * 0.15, neckWidth: D * 0.39, neckHeight: height * 0.24, baseStyle: "recessed" }, { from: 0.1, to: 0.8, fraction: 0.55 });
    case "dropper":
      return round({ shoulderStyle: "rounded", shoulderHeight: height * 0.14, neckWidth: D * 0.5, neckHeight: height * 0.08 }, { from: 0.1, to: 0.9, fraction: 0.62 });
    case "pump":
    case "spray": {
      const oval = Math.min(L, W) / Math.max(L, W) < 0.85;
      const p = round({ shoulderStyle: "rounded", shoulderHeight: height * 0.12, neckWidth: D * 0.42, neckHeight: height * 0.06 }, { from: 0.12, to: 0.82, fraction: 0.62 });
      if (oval) Object.assign(p.config, { bodyShape: "oval", width: L, depth: W });
      return p;
    }
    case "oval":
      // Shampoo / lotion: true ellipse L × W, short rounded shoulder, round neck for the cap.
      return {
        family,
        config: {
          width: L, depth: W, height, bodyShape: "oval", shoulderStyle: "rounded",
          shoulderHeight: height * 0.1, neckWidth: D * 0.55, neckHeight: height * 0.05, baseStyle: "slightlyRounded",
        },
        label: { from: 0.1, to: 0.85, fraction: 0.5 },
      };
    case "perfume":
      // Flat glass flacon: rounded rectangle L × W, sharp flat shoulder, short neck.
      return {
        family,
        config: {
          width: L, depth: W, height, bodyShape: Math.abs(L - W) < Math.max(L, W) * 0.08 ? "square" : "rectangular",
          cornerRadius: 0.35, shoulderStyle: "sharp", shoulderHeight: height * 0.08,
          neckWidth: D * 0.36, neckHeight: height * 0.07, baseStyle: "flat", baseHeight: D * 0.06,
        },
        label: { from: 0.22, to: 0.78, fraction: 0.3 },
      };
    case "round":
    default:
      return round({}, { from: 0.12, to: 0.82, fraction: 0.62 });
  }
}
