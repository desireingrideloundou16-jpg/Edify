/**
 * Unit tests: Carton Geometry (Phase 2B-2)
 *
 * Validates the parametric gable-top carton geometry engine:
 * - All geometry parts are valid BufferGeometry objects
 * - Position counts are within budget (< 8 000 triangles total)
 * - Geometry stays within bounding box of the specified dimensions
 * - Determinism (same config → same output)
 * - Edge cases: square, very flat, very tall cartons
 */
import * as THREE from "three";
import { describe, it, expect } from "vitest";
import {
  createCartonGeometry,
  mergeCartonGeometry,
  type CartonGeometryConfig,
} from "../../src/lib/three/geometry/cartonGeometry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triangleCount(geo: THREE.BufferGeometry): number {
  const idx = geo.getIndex();
  return idx ? idx.count / 3 : (geo.getAttribute("position").count / 3);
}

function totalTriangles(config: CartonGeometryConfig): number {
  const parts = createCartonGeometry(config);
  return (
    triangleCount(parts.body)   +
    triangleCount(parts.roof)   +
    triangleCount(parts.ridge)  +
    triangleCount(parts.bottom)
  );
}

function boundingBoxOf(geo: THREE.BufferGeometry): THREE.Box3 {
  geo.computeBoundingBox();
  return geo.boundingBox!;
}

function allPartsValid(config: CartonGeometryConfig) {
  const parts = createCartonGeometry(config);
  for (const [name, geo] of Object.entries(parts) as [string, THREE.BufferGeometry][]) {
    const pos = geo.getAttribute("position");
    expect(pos, `${name}: position attribute missing`).toBeTruthy();
    expect(pos.count, `${name}: zero vertices`).toBeGreaterThan(0);
    const norm = geo.getAttribute("normal");
    expect(norm, `${name}: normal attribute missing`).toBeTruthy();
    const uv = geo.getAttribute("uv");
    expect(uv, `${name}: uv attribute missing`).toBeTruthy();
    const idx = geo.getIndex();
    expect(idx, `${name}: index missing`).toBeTruthy();
    expect(idx!.count % 3, `${name}: index count not divisible by 3`).toBe(0);
  }
}

function positionArray(geo: THREE.BufferGeometry): Float32Array {
  return (geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
}

function arraysEqual(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  }
  return true;
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT: CartonGeometryConfig = {
  width: 70,
  depth: 70,
  height: 190,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createCartonGeometry", () => {

  it("returns four valid BufferGeometry parts for default config", () => {
    allPartsValid(DEFAULT);
  });

  it("returns four valid BufferGeometry parts for small juice carton (60×40×105)", () => {
    allPartsValid({ width: 60, depth: 40, height: 105 });
  });

  it("returns four valid BufferGeometry parts for 1-litre carton (70×70×240)", () => {
    allPartsValid({ width: 70, depth: 70, height: 240 });
  });

  it("total triangle count stays within 8 000 budget for default config", () => {
    const tris = totalTriangles(DEFAULT);
    expect(tris).toBeLessThan(8000);
  });

  it("total triangle count stays within 8 000 budget for small carton", () => {
    const tris = totalTriangles({ width: 60, depth: 40, height: 105 });
    expect(tris).toBeLessThan(8000);
  });

  it("body bounding box does not exceed specified dimensions", () => {
    const parts = createCartonGeometry(DEFAULT);
    const bb = boundingBoxOf(parts.body);
    const size = bb.getSize(new THREE.Vector3());
    // Allow 2% tolerance for chamfer rounding
    expect(size.x).toBeLessThanOrEqual(DEFAULT.width  * 1.02);
    expect(size.z).toBeLessThanOrEqual(DEFAULT.depth  * 1.02);
    expect(size.y).toBeLessThanOrEqual(DEFAULT.height * 1.02);
  });

  it("body bottom is at or above y = 0", () => {
    const parts = createCartonGeometry(DEFAULT);
    const bb = boundingBoxOf(parts.body);
    expect(bb.min.y).toBeGreaterThanOrEqual(0);
  });

  it("ridge top y is less than or equal to total height", () => {
    const { height: H } = DEFAULT;
    const parts = createCartonGeometry(DEFAULT);
    const bb = boundingBoxOf(parts.ridge);
    expect(bb.max.y).toBeLessThanOrEqual(H * 1.02);
  });

  it("is deterministic: two calls with identical config produce identical positions", () => {
    const config = { width: 70, depth: 70, height: 190 };
    const a = createCartonGeometry(config);
    const b = createCartonGeometry(config);
    for (const key of ["body", "roof", "ridge", "bottom"] as const) {
      const pa = positionArray(a[key]);
      const pb = positionArray(b[key]);
      expect(arraysEqual(pa, pb), `${key}: positions differ between calls`).toBe(true);
    }
  });

  it("all parts have NaN-free positions", () => {
    const parts = createCartonGeometry(DEFAULT);
    for (const [name, geo] of Object.entries(parts) as [string, THREE.BufferGeometry][]) {
      const arr = positionArray(geo);
      const hasNaN = Array.from(arr).some(v => isNaN(v));
      expect(hasNaN, `${name}: contains NaN position values`).toBe(false);
    }
  });

  it("strawPatch: disabled produces fewer roof triangles than enabled", () => {
    const withPatch    = createCartonGeometry({ ...DEFAULT, strawPatch: true  });
    const withoutPatch = createCartonGeometry({ ...DEFAULT, strawPatch: false });
    expect(triangleCount(withPatch.roof)).toBeGreaterThan(triangleCount(withoutPatch.roof));
  });

  it("gableRatio clamping: very tall gable stays within height", () => {
    const parts = createCartonGeometry({ ...DEFAULT, gableRatio: 0.28 });
    const bb = boundingBoxOf(parts.ridge);
    expect(bb.max.y).toBeLessThanOrEqual(DEFAULT.height * 1.02);
  });

  it("flat carton (low height) does not crash", () => {
    expect(() => allPartsValid({ width: 150, depth: 110, height: 30 })).not.toThrow();
  });

  it("square carton has symmetric X and Z body extent", () => {
    const W = 90, D = 90;
    const parts = createCartonGeometry({ width: W, depth: D, height: 180 });
    const bb = boundingBoxOf(parts.body);
    const xExtent = bb.max.x - bb.min.x;
    const zExtent = bb.max.z - bb.min.z;
    expect(Math.abs(xExtent - zExtent)).toBeLessThan(2);
  });
});

describe("mergeCartonGeometry", () => {
  it("produces a single BufferGeometry with all attributes", () => {
    const parts = createCartonGeometry(DEFAULT);
    const merged = mergeCartonGeometry(parts);
    expect(merged.getAttribute("position")).toBeTruthy();
    expect(merged.getAttribute("uv")).toBeTruthy();
    expect(merged.getIndex()).toBeTruthy();
  });

  it("merged triangle count equals sum of individual parts", () => {
    const parts = createCartonGeometry(DEFAULT);
    const sumTris =
      triangleCount(parts.body)  + triangleCount(parts.roof) +
      triangleCount(parts.ridge) + triangleCount(parts.bottom);
    const merged = mergeCartonGeometry(parts);
    expect(triangleCount(merged)).toBe(sumTris);
  });

  it("merged has no NaN positions", () => {
    const parts = createCartonGeometry(DEFAULT);
    const merged = mergeCartonGeometry(parts);
    const arr = positionArray(merged);
    const hasNaN = Array.from(arr).some(v => isNaN(v));
    expect(hasNaN).toBe(false);
  });
});
