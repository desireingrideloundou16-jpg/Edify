import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createPouchGeometry } from "@/lib/three/geometry/pouchGeometry";

describe("Parametric Pouch & Doypack Geometry", () => {
  it("génère une géométrie flatpouch valide et non vide sans NaN", () => {
    const geo = createPouchGeometry({
      width: 200,
      height: 280,
      depth: 20,
      type: "flatpouch",
      seed: 42,
    });

    expect(geo).toBeDefined();
    const pos = geo.getAttribute("position");
    const norm = geo.getAttribute("normal");
    const uv = geo.getAttribute("uv");
    const index = geo.getIndex();

    expect(pos).toBeDefined();
    expect(norm).toBeDefined();
    expect(uv).toBeDefined();
    expect(index).toBeDefined();

    expect(pos.count).toBeGreaterThan(100);
    expect(index!.count).toBeGreaterThan(300);

    // Vérification de l'absence totale de NaN
    for (let i = 0; i < pos.array.length; i++) {
      expect(Number.isFinite(pos.array[i])).toBe(true);
    }
    for (let i = 0; i < norm.array.length; i++) {
      expect(Number.isFinite(norm.array[i])).toBe(true);
    }
    for (let i = 0; i < uv.array.length; i++) {
      expect(Number.isFinite(uv.array[i])).toBe(true);
    }
  });

  it("génère une géométrie doypack valide avec soufflet de fond", () => {
    const geo = createPouchGeometry({
      width: 130,
      height: 220,
      depth: 80,
      type: "doypack",
      seed: 42,
    });

    expect(geo).toBeDefined();
    const pos = geo.getAttribute("position");
    expect(pos.count).toBeGreaterThan(1000);

    // Bounding box vérifiée
    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    expect(bbox.min.y).toBeCloseTo(0, 1);
    expect(bbox.max.y).toBeCloseTo(220, 1);
    expect(bbox.max.x - bbox.min.x).toBeCloseTo(130, 0);
  });

  it("respecte les dimensions cibles du packaging", () => {
    const L = 160;
    const H = 230;
    const W = 30;

    const geo = createPouchGeometry({
      width: L,
      height: H,
      depth: W,
      type: "flatpouch",
      seed: 101,
    });

    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    expect(size.y).toBeCloseTo(H, 0.5);
    expect(size.x).toBeCloseTo(L, 1.0);
    expect(size.z).toBeGreaterThan(0);
    expect(size.z).toBeLessThanOrEqual(W * 1.25);
  });

  it("est rigoureusement déterministe avec la même graine (seed)", () => {
    const geoA = createPouchGeometry({
      width: 200,
      height: 280,
      depth: 25,
      type: "flatpouch",
      seed: 777,
    });

    const geoB = createPouchGeometry({
      width: 200,
      height: 280,
      depth: 25,
      type: "flatpouch",
      seed: 777,
    });

    const posA = geoA.getAttribute("position").array;
    const posB = geoB.getAttribute("position").array;

    expect(posA.length).toEqual(posB.length);
    for (let i = 0; i < posA.length; i++) {
      expect(posA[i]).toEqual(posB[i]);
    }
  });

  it("produit des micro-variations géométriques entre deux graines distinctes", () => {
    const geoA = createPouchGeometry({
      width: 200,
      height: 280,
      depth: 25,
      type: "flatpouch",
      seed: 111,
    });

    const geoB = createPouchGeometry({
      width: 200,
      height: 280,
      depth: 25,
      type: "flatpouch",
      seed: 999,
    });

    const posA = geoA.getAttribute("position").array;
    const posB = geoB.getAttribute("position").array;

    let differences = 0;
    for (let i = 0; i < posA.length; i++) {
      if (Math.abs(posA[i] - posB[i]) > 1e-4) {
        differences++;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("respecte les budgets de triangles cibles pour 60 FPS", () => {
    const flatpouch = createPouchGeometry({
      width: 200,
      height: 280,
      depth: 20,
      type: "flatpouch",
    });

    const doypack = createPouchGeometry({
      width: 130,
      height: 220,
      depth: 80,
      type: "doypack",
    });

    const flatTriangles = flatpouch.getIndex()!.count / 3;
    const doypackTriangles = doypack.getIndex()!.count / 3;

    // Budget Phase 2B-1 : ~4 000 - 6 000 triangles
    expect(flatTriangles).toBeGreaterThanOrEqual(2500);
    expect(flatTriangles).toBeLessThanOrEqual(6500);

    expect(doypackTriangles).toBeGreaterThanOrEqual(3000);
    expect(doypackTriangles).toBeLessThanOrEqual(7500);
  });

  it("gère les valeurs limites sans crasher ni déborder", () => {
    // Cas très petit (stick / sachet échantillon)
    const small = createPouchGeometry({
      width: 25,
      height: 70,
      depth: 5,
      type: "flatpouch",
    });
    expect(small).toBeDefined();

    // Cas très grand (sac 5 kg)
    const big = createPouchGeometry({
      width: 300,
      height: 500,
      depth: 120,
      type: "doypack",
    });
    expect(big).toBeDefined();
  });
});
