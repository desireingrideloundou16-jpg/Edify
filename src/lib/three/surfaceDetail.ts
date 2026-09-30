/**
 * Procedural micro-surface detail (phase 2.2): tileable height fields → normal and
 * roughness maps, generated once per kind in the browser and cached. Zero assets,
 * zero network: paper fibres, kraft, laid paper, soft-touch, orange peel, brushed
 * aluminium and film crinkle.
 *
 * The maths (height fields, normals) is DOM-free so it can be unit-tested; only
 * `microSurface()` touches the canvas.
 */
import * as THREE from "three";

export type MicroKind = "paper" | "laid" | "kraft" | "coated" | "softtouch" | "plastic" | "brushed" | "film";

export const MICRO_SIZE = 256;

/** Physical size of one tile, in millimetres (drives texture repeat). */
export const TILE_MM: Record<MicroKind, number> = {
  paper: 30,
  laid: 40,
  kraft: 45,
  coated: 25,
  softtouch: 20,
  plastic: 35,
  brushed: 60,
  film: 110,
};

// ─── Deterministic, tileable noise ───────────────────────────────────────────

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Tileable value noise with `fx × fy` lattice cells over an n×n tile, in [0, 1]. */
export function valueNoise(n: number, fx: number, fy: number, seed: number): Float32Array {
  const r = rng(seed);
  const lat = new Float32Array(fx * fy).map(() => r());
  const out = new Float32Array(n * n);
  const fade = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) {
    const gy = (y / n) * fy;
    const y0 = Math.floor(gy), ty = fade(gy - y0), y1 = (y0 + 1) % fy;
    for (let x = 0; x < n; x++) {
      const gx = (x / n) * fx;
      const x0 = Math.floor(gx), tx = fade(gx - x0), x1 = (x0 + 1) % fx;
      const a = lat[y0 * fx + x0] + (lat[y0 * fx + x1] - lat[y0 * fx + x0]) * tx;
      const b = lat[y1 * fx + x0] + (lat[y1 * fx + x1] - lat[y1 * fx + x0]) * tx;
      out[y * n + x] = a + (b - a) * ty;
    }
  }
  return out;
}

function add(h: Float32Array, src: Float32Array, amp: number, map: (v: number) => number = (v) => v - 0.5) {
  for (let i = 0; i < h.length; i++) h[i] += map(src[i]) * amp;
}

/** Short straight fibres rasterised with wrap-around (so the tile stays seamless). */
function fibres(h: Float32Array, n: number, count: number, len: number, amp: number, seed: number, spread = Math.PI) {
  const r = rng(seed);
  for (let k = 0; k < count; k++) {
    const x0 = r() * n, y0 = r() * n;
    const a = (r() - 0.5) * spread;
    const l = len * (0.4 + r() * 0.8);
    const s = amp * (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.6);
    const dx = Math.cos(a), dy = Math.sin(a);
    for (let t = 0; t < l; t++) {
      const x = ((Math.round(x0 + dx * t) % n) + n) % n;
      const y = ((Math.round(y0 + dy * t) % n) + n) % n;
      h[y * n + x] += s * Math.sin((Math.PI * t) / l);
    }
  }
}

/** Height field of a micro-surface kind (roughly centred on 0). */
export function heightField(kind: MicroKind, n = MICRO_SIZE): Float32Array {
  const h = new Float32Array(n * n);
  const fine = (s: number, amp: number) => add(h, valueNoise(n, n / 2, n / 2, s), amp);
  switch (kind) {
    case "paper":
      add(h, valueNoise(n, 16, 16, 11), 0.5);
      fibres(h, n, 900, 18, 0.35, 12);
      fine(13, 0.25);
      break;
    case "laid":
      add(h, valueNoise(n, 16, 16, 21), 0.4);
      fibres(h, n, 700, 18, 0.3, 22);
      // Laid lines (dense) and chain lines (sparse), as on vergé paper.
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        h[y * n + x] += 0.12 * Math.sin((2 * Math.PI * y * 48) / n) + 0.2 * Math.max(0, Math.cos((2 * Math.PI * x * 2) / n)) ** 24;
      }
      break;
    case "kraft":
      add(h, valueNoise(n, 8, 8, 31), 0.9);
      add(h, valueNoise(n, 32, 32, 32), 0.5);
      fibres(h, n, 1600, 30, 0.55, 33);
      fine(34, 0.3);
      break;
    case "coated":
      add(h, valueNoise(n, 24, 24, 41), 0.35);
      fine(42, 0.12);
      break;
    case "softtouch":
      add(h, valueNoise(n, 64, 64, 51), 0.35);
      fine(52, 0.35);
      break;
    case "plastic":
      // Orange peel: soft, rounded dimples.
      add(h, valueNoise(n, 20, 20, 61), 1, (v) => (v - 0.5) ** 3 * 4);
      add(h, valueNoise(n, 40, 40, 62), 0.2);
      break;
    case "brushed":
      // Long horizontal streaks: high frequency across, very low along.
      add(h, valueNoise(n, 2, n / 2, 71), 0.6);
      add(h, valueNoise(n, 4, n / 4, 72), 0.4);
      break;
    case "film":
      // Crinkles: ridged noise (sharp creases) at two scales.
      add(h, valueNoise(n, 5, 7, 81), 1.4, (v) => 0.5 - Math.abs(v - 0.5) * 2);
      add(h, valueNoise(n, 11, 9, 82), 0.6, (v) => 0.5 - Math.abs(v - 0.5) * 2);
      break;
  }
  return h;
}

/** Tangent-space normal map (RGBA, 8 bits) from a tileable height field. */
export function normalsFromHeight(h: Float32Array, n: number, strength: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(n * n * 4);
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * n + x) * 4;
    out[i] = ((-dx / len) * 0.5 + 0.5) * 255;
    // Canvas rows go down while UV v goes up: flip the green channel.
    out[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
    out[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
    out[i + 3] = 255;
  }
  return out;
}

/** Roughness multiplier map (green channel, three.js convention) in [lo, 1]. */
export function roughnessFromHeight(h: Float32Array, n: number, kind: MicroKind, lo: number): Uint8ClampedArray {
  const smudge = valueNoise(n, 4, 4, 91 + kind.length);
  const out = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = Math.min(1, Math.max(lo, lo + (1 - lo) * (0.55 + 0.35 * smudge[i] + 0.25 * h[i])));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v * 255;
    out[i * 4 + 3] = 255;
  }
  return out;
}

// ─── Browser side: cached textures ───────────────────────────────────────────

const STRENGTH: Record<MicroKind, number> = { paper: 3, laid: 3, kraft: 4, coated: 2, softtouch: 2, plastic: 2.5, brushed: 2, film: 5 };
const ROUGH_LO: Record<MicroKind, number> = { paper: 0.8, laid: 0.8, kraft: 0.75, coated: 0.85, softtouch: 0.85, plastic: 0.8, brushed: 0.55, film: 0.7 };

const cache = new Map<MicroKind, { normal: THREE.Texture; roughness: THREE.Texture }>();

function toTexture(px: Uint8ClampedArray, n: number) {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  img.data.set(px);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Normal + roughness maps for a surface of `wMm × hMm`. The returned textures are
 * clones (own repeat, shared image), so they can be disposed with the material.
 */
export function microSurface(kind: MicroKind, wMm = 100, hMm = 100) {
  let base = cache.get(kind);
  if (!base) {
    const h = heightField(kind);
    base = {
      normal: toTexture(normalsFromHeight(h, MICRO_SIZE, STRENGTH[kind]), MICRO_SIZE),
      roughness: toTexture(roughnessFromHeight(h, MICRO_SIZE, kind, ROUGH_LO[kind]), MICRO_SIZE),
    };
    cache.set(kind, base);
  }
  const rx = Math.max(1, Math.round(wMm / TILE_MM[kind]));
  const ry = Math.max(1, Math.round(hMm / TILE_MM[kind]));
  const normal = base.normal.clone();
  const roughness = base.roughness.clone();
  normal.repeat.set(rx, ry);
  roughness.repeat.set(rx, ry);
  return { normal, roughness };
}
