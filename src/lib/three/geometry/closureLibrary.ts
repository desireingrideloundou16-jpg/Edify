/**
 * Closure library (phase 2B-4): parametric caps, rings, capsules, pumps, sprays, droppers and
 * can lids, built from real geometry (ribs, pull tab, spout…) so they catch the studio lights.
 *
 * Every closure is returned as separate *parts*, each with a material slot, so the renderer can
 * give a collar, an actuator or a rubber bulb its own material, and a later photorealism phase
 * can add per-part micro-surface and roughness variation without touching the geometry.
 *
 * Conventions: millimetres, Y up. y = 0 is the top of the bottle neck (or of the can seam);
 * a cap's skirt goes below 0 to cover the neck finish. Front = +z, θ = 0 faces the front.
 * Deterministic: any irregularity comes from `seed`, never from Math.random().
 */
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ─── Public types ────────────────────────────────────────────────────────────

export type ClosureType = "screwCap" | "ribbedCap" | "tamperRing" | "wineCapsule" | "pump" | "spray" | "dropper" | "canLid";

/** Material slot of a part; the renderer maps each slot to one of its existing materials. */
export type ClosureMaterialSlot = "primary" | "secondary" | "metal" | "rubber" | "glass";

export interface ClosureConfig {
  type: ClosureType;
  /** Outer diameter (X) of the main body of the closure, mm. */
  width: number;
  /** Outer depth (Z), mm (default: round, = width). */
  depth?: number;
  /** Total height, skirt included, mm. */
  height: number;
  /** Neck outer diameter the closure sits on, mm (default: 0.8 × width). */
  neckWidth?: number;
  /** How far the closure goes down over the neck finish, mm (default: 0). */
  skirt?: number;
  /** Ribbed / screw caps, collars. */
  ribCount?: number;
  /** Screw / ribbed caps: add a separate tamper-evident ring under the cap. */
  tamperRing?: boolean;
  /** Pump / spray: direction of the spout or nozzle, degrees (0 = front, 90 = right). */
  sprayDirection?: number;
  nozzleWidth?: number;
  actuatorWidth?: number;
  /** Dropper: length of the glass pipette inside the bottle, mm. */
  stemLength?: number;
  /** Wine capsule: radial scale of the neck finish bead it must clear. */
  finishScale?: number;
  /** Segments around (default per type). */
  resolution?: number;
  seed?: number;
}

export interface ClosurePart {
  name: string;
  material: ClosureMaterialSlot;
  geometry: THREE.BufferGeometry;
}

export interface ClosureResult {
  type: ClosureType;
  parts: ClosurePart[];
  /** Highest point above the neck top (mm) — what the closure adds to the pack height. */
  top: number;
  /** Lowest point (≤ 0), mm. */
  bottom: number;
  triangles: number;
}

// ─── Revolve: the workhorse ──────────────────────────────────────────────────

type Profile = [number, number][]; // [radius, y], from the inner bottom outward, up, over the top

interface RevolveOptions {
  segments: number;
  /** Radial modulation (ribs, wrinkles): returns the new radius. */
  mod?: (theta: number, y: number, r: number) => number;
  /** Depth / width ratio (oval closures). */
  scaleZ?: number;
}

/**
 * Surface of revolution with real geometry for ribs. Profile order (inner bottom → outward →
 * up → over the top → axis) gives outward normals. Points on the axis (r = 0) become fans, so
 * there are no degenerate triangles; the UV seam column gets averaged normals.
 */
function revolve(profile: Profile, o: RevolveOptions): THREE.BufferGeometry {
  const n = Math.max(3, Math.round(o.segments));
  const sz = o.scaleZ ?? 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let total = 0;
  const along = [0];
  for (let k = 1; k < profile.length; k++) {
    total += Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]);
    along.push(total);
  }
  for (let k = 0; k < profile.length; k++) {
    const [r, y] = profile[k];
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      const rr = r > 0 && o.mod ? o.mod(th, y, r) : r;
      pos.push(rr * Math.sin(th), y, rr * Math.cos(th) * sz);
      uv.push(i / n, total > 0 ? along[k] / total : 0);
    }
  }
  const stride = n + 1;
  for (let k = 0; k < profile.length - 1; k++) {
    const r0 = profile[k][0], r1 = profile[k + 1][0];
    if (r0 === 0 && r1 === 0) continue;
    for (let i = 0; i < n; i++) {
      const a = k * stride + i, b = a + stride, d = a + 1, c = b + 1;
      if (r1 === 0) idx.push(a, d, b);
      else if (r0 === 0) idx.push(d, c, b);
      else idx.push(a, d, b, d, c, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal as THREE.BufferAttribute;
  for (let k = 0; k < profile.length; k++) {
    const a = k * stride, b = a + n;
    const v = new THREE.Vector3(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b));
    if (v.lengthSq() > 0) v.normalize();
    else v.set(0, profile[k][1] >= 0 ? 1 : -1, 0);
    nr.setXYZ(a, v.x, v.y, v.z);
    nr.setXYZ(b, v.x, v.y, v.z);
  }
  // Points on the axis: one normal along the axis instead of a smeared average.
  for (let k = 0; k < profile.length; k++) {
    if (profile[k][0] !== 0) continue;
    const up = k === profile.length - 1 ? 1 : -1;
    for (let i = 0; i <= n; i++) nr.setXYZ(k * stride + i, 0, up, 0);
  }
  return g;
}

/** Tube swept along a polyline path, radius per point, closed with a fan at the tip. */
function sweep(path: THREE.Vector3[], radii: number[], segments = 12): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const stride = segments + 1;
  let prevN = new THREE.Vector3();
  for (let k = 0; k < path.length; k++) {
    const t = (k < path.length - 1 ? path[k + 1].clone().sub(path[k]) : path[k].clone().sub(path[k - 1])).normalize();
    // Parallel-transported frame (no twist along the spout).
    let nrm = k === 0 ? new THREE.Vector3(0, 1, 0).cross(t) : prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t)));
    if (nrm.lengthSq() < 1e-8) nrm = new THREE.Vector3(1, 0, 0).cross(t);
    nrm.normalize();
    prevN = nrm;
    const bin = t.clone().cross(nrm).normalize();
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const p = path[k].clone().addScaledVector(nrm, Math.cos(a) * radii[k]).addScaledVector(bin, Math.sin(a) * radii[k]);
      pos.push(p.x, p.y, p.z);
      uv.push(i / segments, k / (path.length - 1));
    }
  }
  for (let k = 0; k < path.length - 1; k++) {
    for (let i = 0; i < segments; i++) {
      const a = k * stride + i, b = a + stride, d = a + 1, c = b + 1;
      idx.push(a, d, b, d, c, b);
    }
  }
  const tip = pos.length / 3;
  const end = path[path.length - 1];
  pos.push(end.x, end.y, end.z);
  uv.push(0.5, 1);
  const last = (path.length - 1) * stride;
  for (let i = 0; i < segments; i++) idx.push(last + i, last + i + 1, tip);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Smooth fade 0 → 1 → 0 across [y0, y1] with ramps of length `ramp`. */
function band(y: number, y0: number, y1: number, ramp: number) {
  const s = (x: number) => Math.max(0, Math.min(1, x));
  return s((y - y0) / ramp) * s((y1 - y) / ramp);
}

/** Deterministic pseudo-noise around the circle (sum of seeded sines). */
function ringNoise(seed: number) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const waves = Array.from({ length: 5 }, (_, k) => ({ f: 3 + k * 4 + Math.floor(rnd() * 3), p: rnd() * Math.PI * 2, a: 1 / (k + 1) }));
  const norm = waves.reduce((t, w) => t + w.a, 0);
  return (th: number) => waves.reduce((t, w) => t + w.a * Math.sin(w.f * th + w.p), 0) / norm;
}

const tri = (g: THREE.BufferGeometry) => (g.index ? g.index.count / 3 : g.attributes.position.count / 3);

// ─── Closures ────────────────────────────────────────────────────────────────

/** Rounded top edge + slightly domed top, appended to a profile ending at (R, yTop - e). */
function capTop(R: number, yTop: number, e: number, dome: number): Profile {
  return [
    [R * 0.995, yTop - e * 0.55],
    [R - e * 0.45, yTop - e * 0.12],
    [R - e, yTop],
    [R * 0.55, yTop + dome * 0.7],
    [0, yTop + dome],
  ];
}

/** Grip ribs on the side of a cap: ridge/groove with `perSeg` segments per rib. */
function ribMod(count: number, depth: number, y0: number, y1: number, ramp: number, sharpness: number) {
  return (th: number, y: number, r: number) => {
    const w = band(y, y0, y1, ramp);
    if (w <= 0) return r;
    const g = 0.5 + 0.5 * Math.cos(count * th);
    return r - depth * w * Math.pow(1 - g, sharpness);
  };
}

/**
 * Cap / collar shell: plain bottom and top (few segments) around a densely subdivided ribbed
 * sleeve (4 vertices per rib, so smooth normals keep each rib's light and shadow side).
 */
function ribbedShell(
  below: Profile, above: Profile,
  sleeve: { R: number; y0: number; y1: number; ribs: number; depth: number; sharpness: number },
  scaleZ = 1
): THREE.BufferGeometry {
  const { R, y0, y1, ribs, depth, sharpness } = sleeve;
  const ramp = Math.min((y1 - y0) * 0.2, R * 0.15);
  const plain = Math.max(32, Math.min(48, ribs * 2));
  const pieces = [revolve([...below, [R, y0]], { segments: plain, scaleZ })];
  if (ribs > 0 && y1 - y0 > ramp * 2) {
    pieces.push(revolve([[R, y0], [R, y0 + ramp], [R, y1 - ramp], [R, y1]], {
      segments: ribs * 4, scaleZ, mod: ribMod(ribs, depth, y0, y1, ramp, sharpness),
    }));
  } else {
    pieces.push(revolve([[R, y0], [R, y1]], { segments: plain, scaleZ }));
  }
  pieces.push(revolve([[R, y1], ...above], { segments: plain, scaleZ }));
  const merged = mergeGeometries(pieces, false)!;
  for (const p of pieces) p.dispose();
  return merged;
}

function tamperRingPart(R: number, Rn: number, y0: number, h: number, seg: number): ClosurePart {
  const e = Math.min(h * 0.25, (R - Rn) * 0.4);
  const profile: Profile = [
    [Rn, y0], [R - e, y0], [R, y0 + e], [R, y0 + h - e], [R - e, y0 + h], [Rn, y0 + h],
  ];
  return { name: "tamperRing", material: "primary", geometry: revolve(profile, { segments: seg }) };
}

function screwCap(c: ClosureConfig, ribbed: boolean): ClosurePart[] {
  const R = c.width / 2;
  const Rn = Math.min(R * 0.97, (c.neckWidth ?? c.width * 0.8) / 2);
  const skirt = Math.min(c.skirt ?? 0, c.height * 0.8);
  const y0 = -skirt;
  const top = c.height - skirt;
  // Screw caps: fine knurl; ribbed caps: fewer, deeper, rounder ribs.
  // ribCount 0 = smooth side (metal lug lids, jar lids).
  const ribs = c.ribCount === 0 ? 0 : Math.max(6, Math.round(c.ribCount ?? (ribbed ? 24 : 32)));
  const e = Math.min(R * 0.12, c.height * 0.12); // top edge round
  const ch = Math.min(R * 0.05, c.height * 0.06); // bottom chamfer
  const geometry = ribbedShell(
    [[Rn, y0], [R - ch, y0], [R, y0 + ch]],
    capTop(R, top, e, ribbed ? c.height * 0.015 : c.height * 0.03),
    { R, y0: y0 + c.height * 0.14, y1: top - e * 1.6, ribs, depth: R * (ribbed ? 0.07 : 0.04), sharpness: ribbed ? 1.6 : 1 },
    c.depth ? c.depth / c.width : 1
  );
  const parts: ClosurePart[] = [{ name: ribbed ? "ribbedCap" : "screwCap", material: "primary", geometry }];
  if (c.tamperRing) {
    const h = c.height * 0.14;
    parts.push(tamperRingPart(R * 0.94, Rn * 1.005, y0 - c.height * 0.05 - h, h, 36));
  }
  return parts;
}

function wineCapsule(c: ClosureConfig): ClosurePart[] {
  const Rn = (c.neckWidth ?? c.width * 0.9) / 2;
  const bead = Math.max(1, c.finishScale ?? 1.1);
  const R = Math.max(c.width / 2, Rn * bead * 1.02);
  const skirt = Math.min(c.skirt ?? c.height * 0.95, c.height);
  const y0 = -skirt;
  const top = c.height - skirt;
  const snug = Rn * 1.025;
  const flare = Math.min(c.height * 0.3, skirt * 0.4);
  const noise = ringNoise(c.seed ?? 1);
  const crimp = (th: number, y: number, r: number) => {
    // Foil creases near the bottom edge, fading out upward (deterministic).
    const w = Math.max(0, 1 - (y - y0) / (c.height * 0.35));
    return r + Rn * 0.012 * w * noise(th);
  };
  const profile: Profile = [
    [snug * 0.985, y0], [snug, y0 + c.height * 0.01],
    [snug, top - flare], [R, top - flare * 0.45], [R, top - c.height * 0.03],
    [R * 0.97, top - c.height * 0.004], [R * 0.88, top], [R * 0.86, top - c.height * 0.004], [0, top - c.height * 0.004],
  ];
  return [{ name: "wineCapsule", material: "metal", geometry: revolve(profile, { segments: c.resolution ?? 64, mod: crimp }) }];
}

/** Ribbed screw collar shared by pumps, sprays and droppers. */
function collar(c: ClosureConfig, R: number, Rn: number, h: number, ribs: number, material: ClosureMaterialSlot): { part: ClosurePart; top: number } {
  const skirt = Math.min(c.skirt ?? 0, h * 0.8);
  const y0 = -skirt;
  const top = h - skirt;
  const e = Math.min(R * 0.12, h * 0.2);
  const geometry = ribbedShell(
    [[Rn, y0], [R - e * 0.4, y0], [R, y0 + e * 0.4]],
    [[R - e * 0.35, top - e * 0.3], [R - e, top], [Rn * 0.55, top], [0, top]],
    { R, y0: y0 + h * 0.12, y1: top - e, ribs, depth: R * 0.035, sharpness: 1 }
  );
  return { part: { name: "collar", material, geometry }, top };
}

function directionVector(deg: number) {
  const a = (deg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
}

function pump(c: ClosureConfig): ClosurePart[] {
  const R = c.width / 2;
  const Rn = Math.min(R * 0.95, (c.neckWidth ?? c.width * 0.75) / 2);
  const H = c.height;
  const col = collar(c, R, Rn, H * 0.24, 32, "primary");
  const stemR = R * 0.22;
  const stemTop = col.top + H * 0.3;
  const stem: Profile = [[stemR * 1.6, col.top], [stemR * 1.15, col.top + H * 0.04], [stemR, col.top + H * 0.08], [stemR, stemTop], [0, stemTop]];
  const aR = (c.actuatorWidth ?? c.width * 0.8) / 2;
  const aH = H * 0.22;
  const a0 = stemTop - H * 0.02;
  const e = Math.min(aR * 0.25, aH * 0.3);
  const actuator: Profile = [
    [stemR * 0.9, a0], [aR - e, a0], [aR, a0 + e], [aR, a0 + aH - e], [aR - e * 0.5, a0 + aH - e * 0.15], [aR - e, a0 + aH],
    [aR * 0.4, a0 + aH - H * 0.012], [0, a0 + aH - H * 0.015],
  ];
  // Spout: out of the actuator, horizontal, then bending down at the tip.
  const dir = directionVector(c.sprayDirection ?? 90);
  const ls = aR * 1.9;
  const ys = a0 + aH * 0.55;
  const sr = (c.nozzleWidth ?? aR * 0.42) / 2;
  const path: THREE.Vector3[] = [];
  const radii: number[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const out = aR * 0.4 + ls * t;
    const drop = ls * 0.22 * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2);
    path.push(dir.clone().multiplyScalar(out).setY(ys - drop));
    radii.push(sr * (1 - 0.25 * t));
  }
  return [
    col.part,
    { name: "stem", material: "primary", geometry: revolve(stem, { segments: 24 }) },
    { name: "actuator", material: "primary", geometry: revolve(actuator, { segments: 48 }) },
    { name: "spout", material: "primary", geometry: sweep(path, radii, 12) },
  ];
}

function spray(c: ClosureConfig): ClosurePart[] {
  const R = c.width / 2;
  const Rn = Math.min(R * 0.95, (c.neckWidth ?? c.width * 0.75) / 2);
  const H = c.height;
  // Crimped metal ferrule: smooth, with a crimp bead.
  const col = collar(c, R, Rn, H * 0.28, 0, "metal");
  const aR = (c.actuatorWidth ?? c.width * 0.72) / 2;
  const a0 = col.top;
  const aH = H - (c.skirt ?? 0) - a0 - 0.01;
  const e = Math.min(aR * 0.3, aH * 0.2);
  const actuator: Profile = [
    [aR * 0.6, a0], [aR * 0.98, a0], [aR, a0 + aH * 0.05], [aR, a0 + aH - e], [aR - e * 0.3, a0 + aH - e * 0.3], [aR - e, a0 + aH],
    [aR * 0.5, a0 + aH + H * 0.008], [0, a0 + aH + H * 0.01],
  ];
  // Nozzle insert on the actuator side, facing `sprayDirection`.
  const dir = directionVector(c.sprayDirection ?? 0);
  const nr = (c.nozzleWidth ?? aR * 0.45) / 2;
  const yN = a0 + aH * 0.62;
  const path = [0.7, 0.95, 1.1, 1.16].map((f) => dir.clone().multiplyScalar(aR * f).setY(yN));
  const radii = [nr, nr, nr * 0.92, nr * 0.5];
  return [
    col.part,
    { name: "actuator", material: "primary", geometry: revolve(actuator, { segments: 48 }) },
    { name: "nozzle", material: "metal", geometry: sweep(path, radii, 12) },
  ];
}

function dropper(c: ClosureConfig): ClosurePart[] {
  const R = c.width / 2;
  const Rn = Math.min(R * 0.95, (c.neckWidth ?? c.width * 0.75) / 2);
  const H = c.height;
  const col = collar(c, R, Rn, H * 0.3, 28, "primary");
  // Rubber teat: shoulder, waist, rounded bulb.
  const bR = R * 0.78;
  const b0 = col.top;
  const bH = H - (c.skirt ?? 0) - b0;
  const bulb: Profile = [[bR * 0.92, b0], [bR, b0 + bH * 0.06], [bR * 0.9, b0 + bH * 0.14], [bR * 0.72, b0 + bH * 0.22], [bR * 0.8, b0 + bH * 0.4]];
  const cy = b0 + bH * 0.72;
  for (let k = 0; k <= 7; k++) {
    const phi = (k / 7) * (Math.PI / 2);
    bulb.push([k === 7 ? 0 : bR * 0.8 * Math.cos(phi), cy + bH * 0.28 * Math.sin(phi)]);
  }
  // Glass pipette below the collar, visible through the bottle.
  const sR = R * 0.17;
  const len = Math.max(H * 0.5, c.stemLength ?? H * 1.5);
  const stem: Profile = [[0, -len], [sR * 0.5, -len + sR * 0.2], [sR * 0.85, -len + sR * 1.5], [sR, -len + sR * 4], [sR, col.top - H * 0.05], [0, col.top - H * 0.05]];
  return [
    col.part,
    { name: "bulb", material: "rubber", geometry: revolve(bulb, { segments: 40 }) },
    { name: "stem", material: "glass", geometry: revolve(stem, { segments: 20 }) },
  ];
}

/** Ring-pull tab lying on the lid: paddle outline with finger hole and rivet slot. */
function pullTab(R: number, thick: number): THREE.BufferGeometry {
  const w = R * 0.42, L = R * 0.82;
  const s = new THREE.Shape();
  s.moveTo(-w * 0.4, 0);
  s.absarc(0, 0, w * 0.4, Math.PI, 0, true);
  s.lineTo(w * 0.5, L * 0.55);
  s.absarc(0, L * 0.62, w * 0.5, 0, Math.PI, false);
  s.lineTo(-w * 0.4, 0);
  const finger = new THREE.Path();
  finger.absellipse(0, L * 0.64, w * 0.3, L * 0.16, 0, Math.PI * 2, false, 0);
  s.holes.push(finger);
  const slot = new THREE.Path();
  slot.absellipse(0, L * 0.2, w * 0.1, L * 0.07, 0, Math.PI * 2, false, 0);
  s.holes.push(slot);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.3, bevelSize: thick * 0.3, bevelSegments: 1, curveSegments: 8 });
  // Lay it flat (shape plane → XZ), pointing to the back of the can (opening at the front).
  g.rotateX(Math.PI / 2);
  g.rotateY(Math.PI);
  // Indexed like every other part (ExtrudeGeometry is not), minus the bevel's zero-area triangles.
  const indexed = mergeVertices(g);
  g.dispose();
  const pos = indexed.attributes.position as THREE.BufferAttribute;
  const src = indexed.index!.array;
  const keep: number[] = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < src.length; i += 3) {
    A.fromBufferAttribute(pos, src[i]);
    B.fromBufferAttribute(pos, src[i + 1]);
    C.fromBufferAttribute(pos, src[i + 2]);
    if (B.sub(A).cross(C.sub(A)).lengthSq() > 1e-20) keep.push(src[i], src[i + 1], src[i + 2]);
  }
  indexed.setIndex(keep);
  return indexed;
}

function canLid(c: ClosureConfig): ClosurePart[] {
  const R = c.width / 2;
  const H = c.height; // seam height
  const seg = c.resolution ?? 64;
  const bead = Math.min(R * 0.05, H * 0.5);
  const cs = R * 0.86; // countersink
  const depth = Math.max(H * 0.9, R * 0.12);
  const panelY = -depth * 0.72;
  // Outside of the seam down to the can neck, then over the bead, down the countersink, panel.
  const profile: Profile = [
    [R * 0.985, -H], [R, -H + bead * 0.4], [R, -bead * 0.6], [R - bead * 0.25, -bead * 0.1], [R - bead * 0.6, 0],
    [R - bead * 1.05, -bead * 0.2], [R - bead * 1.3, -bead * 0.8], [cs + R * 0.01, -depth * 0.8],
    [cs - R * 0.005, -depth], [cs - R * 0.02, -depth * 0.95], [cs - R * 0.04, panelY - R * 0.004],
    [cs * 0.85, panelY], [cs * 0.4, panelY + R * 0.008], [0, panelY + R * 0.01],
  ];
  const lid = revolve(profile, { segments: seg });
  // Rivet at the centre, tab around it.
  const thick = Math.max(0.3, R * 0.012);
  const tabY = panelY + R * 0.014; // underside of the tab
  const tab = pullTab(R, thick);
  // The rivet slot (at 20 % of the tab length) sits on the rivet; the nose points to the front.
  tab.translate(0, tabY + thick * 1.3, R * 0.82 * 0.2);
  const rr = R * 0.07;
  const head = tabY + thick * 1.6 + R * 0.012;
  const rivet: Profile = [[rr * 1.15, panelY + R * 0.006], [rr * 0.55, panelY + R * 0.02], [rr * 0.5, head - R * 0.01], [rr * 0.42, head - R * 0.003], [0, head]];
  return [
    { name: "lid", material: "metal", geometry: lid },
    { name: "rivet", material: "metal", geometry: revolve(rivet, { segments: 24 }) },
    { name: "pullTab", material: "metal", geometry: tab },
  ];
}

// ─── Main API ────────────────────────────────────────────────────────────────

export function createClosureGeometry(config: ClosureConfig): ClosureResult {
  const c: ClosureConfig = { ...config, width: Math.max(0.5, config.width), height: Math.max(0.5, config.height) };
  let parts: ClosurePart[];
  switch (c.type) {
    case "screwCap": parts = screwCap(c, false); break;
    case "ribbedCap": parts = screwCap(c, true); break;
    case "tamperRing": {
      const R = c.width / 2;
      parts = [tamperRingPart(R, Math.min(R * 0.97, (c.neckWidth ?? c.width * 0.85) / 2), -c.height, c.height, c.resolution ?? 48)];
      break;
    }
    case "wineCapsule": parts = wineCapsule(c); break;
    case "pump": parts = pump(c); break;
    case "spray": parts = spray(c); break;
    case "dropper": parts = dropper(c); break;
    case "canLid": parts = canLid(c); break;
    default: throw new Error(`Unknown closure type: ${String((c as { type: unknown }).type)}`);
  }
  let top = -Infinity, bottom = Infinity, triangles = 0;
  for (const p of parts) {
    p.geometry.computeBoundingBox();
    top = Math.max(top, p.geometry.boundingBox!.max.y);
    bottom = Math.min(bottom, p.geometry.boundingBox!.min.y);
    triangles += tri(p.geometry);
  }
  return { type: c.type, parts, top, bottom, triangles };
}

// ─── Presets for the bottle families ─────────────────────────────────────────

export type ClosureFamily = "round" | "beverage" | "oval" | "perfume" | "wine" | "dropper" | "pump" | "spray";

/**
 * Closure for a bottle family. `packHeight` is the catalog height (closure included),
 * `neck` comes from the bottle geometry (finish bead to cover).
 */
export function closurePreset(
  family: ClosureFamily,
  packHeight: number,
  neck: { width: number; finishHeight: number; finishScale: number },
  bodyHeight = packHeight * 0.6
): ClosureConfig {
  const H = packHeight;
  const nw = neck.width;
  const cover = neck.finishHeight * 1.15;
  switch (family) {
    case "wine":
      return { type: "wineCapsule", width: nw * neck.finishScale * 1.04, height: H * 0.16, neckWidth: nw, skirt: H * 0.16 - H * 0.004, finishScale: neck.finishScale, seed: 7 };
    case "dropper":
      return { type: "dropper", width: nw * 1.3, height: H * 0.34 + cover, neckWidth: nw, skirt: cover, stemLength: bodyHeight * 0.8 };
    case "pump":
      return { type: "pump", width: nw * 1.4, height: H * 0.2 + cover, neckWidth: nw, skirt: cover, sprayDirection: 90 };
    case "spray":
    case "perfume":
      return { type: "spray", width: nw * 1.35, height: H * 0.2 + cover, neckWidth: nw, skirt: cover, sprayDirection: 0 };
    case "round":
      return { type: "ribbedCap", width: nw * 1.2, height: H * 0.1 + cover, neckWidth: nw, skirt: cover, ribCount: 24, tamperRing: true };
    case "oval":
    case "beverage":
    default:
      return { type: "screwCap", width: nw * 1.18, height: H * 0.1 + cover, neckWidth: nw, skirt: cover, ribCount: 32, tamperRing: true };
  }
}
