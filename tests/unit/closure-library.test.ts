import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { closurePreset, createClosureGeometry, type ClosureConfig, type ClosureResult, type ClosureType } from "@/lib/three/geometry/closureLibrary";

const NECK = 22;

function part(r: ClosureResult, name: string) {
  const p = r.parts.find((x) => x.name === name);
  expect(p, `part ${name}`).toBeDefined();
  return p!;
}

/** Vertices of the ring with the largest radius variation (the ribbed band): [angle, radius]. */
function ribbedRing(g: THREE.BufferGeometry) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const rings = new Map<string, [number, number][]>();
  for (let i = 0; i < pos.count; i++) {
    const k = pos.getY(i).toFixed(4);
    if (!rings.has(k)) rings.set(k, []);
    rings.get(k)!.push([Math.atan2(pos.getX(i), pos.getZ(i)), Math.hypot(pos.getX(i), pos.getZ(i))]);
  }
  const spread = (r: [number, number][]) => Math.max(...r.map((p) => p[1])) - Math.min(...r.map((p) => p[1]));
  return [...rings.values()].sort((a, b) => spread(b) - spread(a))[0];
}

function box(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  return g.boundingBox!;
}

function assertValid(g: THREE.BufferGeometry) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  expect(pos).toBeDefined();
  expect(g.attributes.normal).toBeDefined();
  expect(g.attributes.uv).toBeDefined();
  expect(g.index).toBeTruthy();
  for (const a of [pos.array, g.attributes.normal.array, g.attributes.uv.array]) for (const v of a as Float32Array) expect(Number.isFinite(v)).toBe(true);
  const idx = g.index!.array;
  expect(idx.length % 3).toBe(0);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    for (const k of [0, 1, 2]) expect(idx[i + k]).toBeLessThan(pos.count);
    A.fromBufferAttribute(pos, idx[i]);
    B.fromBufferAttribute(pos, idx[i + 1]);
    C.fromBufferAttribute(pos, idx[i + 2]);
    expect(B.sub(A).cross(C.sub(A)).length()).toBeGreaterThan(1e-10);
  }
}

/** Fraction of triangles whose face normal points away from the part's centroid axis. */
function outwardRatio(g: THREE.BufferGeometry, axis: "y" | "path" = "y") {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const idx = g.index!.array;
  const c = box(g).getCenter(new THREE.Vector3());
  let ok = 0, n = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    A.fromBufferAttribute(pos, idx[i]);
    B.fromBufferAttribute(pos, idx[i + 1]);
    C.fromBufferAttribute(pos, idx[i + 2]);
    const nrm = B.clone().sub(A).cross(C.clone().sub(A));
    const mid = A.clone().add(B).add(C).divideScalar(3);
    const out = axis === "y" ? new THREE.Vector3(mid.x - c.x, 0, mid.z - c.z) : mid.clone().sub(c);
    // side faces only: horizontal faces (top, underside) have no radial direction to check
    if (out.length() < 1e-6 || (axis === "y" && Math.abs(nrm.clone().normalize().y) > 0.5)) continue;
    n++;
    if (nrm.dot(out) > 0) ok++;
  }
  return ok / n;
}

const make = (type: ClosureType, over: Partial<ClosureConfig> = {}) =>
  createClosureGeometry({ type, width: 26, height: 20, neckWidth: NECK, skirt: 4, seed: 3, ...over });

describe("bibliothèque de fermetures — général", () => {
  it.each(["screwCap", "ribbedCap", "tamperRing", "wineCapsule", "pump", "spray", "dropper", "canLid"] as ClosureType[])(
    "%s : pièces valides, sans NaN ni triangle dégénéré, déterministe, sous budget",
    (type) => {
      const a = make(type, { tamperRing: true });
      const b = make(type, { tamperRing: true });
      expect(a.parts.length).toBeGreaterThan(0);
      for (const p of a.parts) assertValid(p.geometry);
      a.parts.forEach((p, i) => expect(Array.from(p.geometry.attributes.position.array)).toEqual(Array.from(b.parts[i].geometry.attributes.position.array)));
      const complex = ["pump", "spray", "dropper", "canLid"].includes(type);
      expect(a.triangles).toBeLessThan(complex ? 3000 : 2000);
      for (const p of a.parts) expect(p.geometry.index!.count / 3).toBeLessThan(complex ? 3000 : 1500);
      expect(Number.isFinite(a.top) && Number.isFinite(a.bottom)).toBe(true);
    }
  );

  it("type inconnu → erreur explicite", () => {
    expect(() => createClosureGeometry({ type: "cork" as never, width: 10, height: 10 })).toThrow(/Unknown closure/);
  });
});

describe("bouchons", () => {
  it("bouchon à vis : dimensions, jupe sur le col, nervures réelles en géométrie", () => {
    const r = make("screwCap", { ribCount: 32 });
    const b = box(part(r, "screwCap").geometry);
    expect(b.max.x - b.min.x).toBeCloseTo(26, 0);
    expect(b.min.y).toBeCloseTo(-4, 5); // skirt covers the neck finish
    expect(r.top).toBeGreaterThan(20 - 4);
    expect(outwardRatio(part(r, "screwCap").geometry)).toBeGreaterThan(0.95);
    // ribs: the radius on the side varies around the cap
    const radii = ribbedRing(part(r, "screwCap").geometry).map((p) => p[1]);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.2);
    expect(part(r, "screwCap").geometry.index!.count / 3).toBeLessThan(1500);
  });

  it("bouchon nervuré : le nombre de nervures pilote la géométrie", () => {
    const count = (ribs: number) => {
      // ridges = vertices at the full radius on the ribbed band, one angle per rib
      const ring = ribbedRing(part(make("ribbedCap", { ribCount: ribs }), "ribbedCap").geometry);
      const max = Math.max(...ring.map((p) => p[1]));
      return new Set(ring.filter((p) => p[1] > max - 1e-3).map((p) => (Math.round(((p[0] + 2 * Math.PI) / (2 * Math.PI)) * ribs) % ribs))).size;
    };
    expect(count(18)).toBe(18);
    expect(count(30)).toBe(30);
    const b = box(part(make("ribbedCap"), "ribbedCap").geometry);
    expect(b.max.x - b.min.x).toBeCloseTo(26, 0);
  });

  it("bague d'inviolabilité : pièce séparée, sous le bouchon, plus fine, au diamètre du col", () => {
    const r = make("screwCap", { tamperRing: true });
    const ring = box(part(r, "tamperRing").geometry);
    const cap = box(part(r, "screwCap").geometry);
    expect(ring.max.y).toBeLessThan(cap.min.y);
    expect(ring.max.x).toBeLessThan(cap.max.x);
    expect(ring.max.y - ring.min.y).toBeLessThan((cap.max.y - cap.min.y) * 0.3);
    const pos = part(r, "tamperRing").geometry.attributes.position as THREE.BufferAttribute;
    let inner = Infinity;
    for (let i = 0; i < pos.count; i++) inner = Math.min(inner, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(inner).toBeGreaterThanOrEqual(NECK / 2 - 1e-6);
    expect(make("screwCap", { tamperRing: false }).parts.some((p) => p.name === "tamperRing")).toBe(false);
  });
});

describe("capsule de vin", () => {
  it("couvre le haut du col, dégage la bague, légère irrégularité déterministe selon le seed", () => {
    const r = createClosureGeometry({ type: "wineCapsule", width: 30, height: 48, neckWidth: 28, skirt: 47, finishScale: 1.1, seed: 7 });
    const b = box(part(r, "wineCapsule").geometry);
    expect(b.min.y).toBeCloseTo(-47, 5);
    expect(r.top).toBeLessThan(2);
    expect(b.max.x).toBeGreaterThanOrEqual(14 * 1.1); // clears the finish bead
    const other = createClosureGeometry({ type: "wineCapsule", width: 30, height: 48, neckWidth: 28, skirt: 47, finishScale: 1.1, seed: 8 });
    expect(Array.from(part(other, "wineCapsule").geometry.attributes.position.array)).not.toEqual(Array.from(part(r, "wineCapsule").geometry.attributes.position.array));
    expect(part(r, "wineCapsule").material).toBe("metal");
  });
});

describe("pompe, vaporisateur, pipette", () => {
  it("pompe : collerette → tige → poussoir → bec, empilés et orientés", () => {
    const r = make("pump", { height: 40, sprayDirection: 90 });
    const [collar, stem, act, spout] = ["collar", "stem", "actuator", "spout"].map((n) => box(part(r, n).geometry));
    expect(stem.min.y).toBeGreaterThanOrEqual(collar.max.y - 1e-6);
    expect(act.min.y).toBeLessThan(stem.max.y);
    expect(act.max.y).toBeGreaterThan(stem.max.y);
    expect(spout.max.x).toBeGreaterThan(act.max.x + 5); // points to +x (90°)
    expect(spout.min.y).toBeLessThan(act.max.y);
    expect(outwardRatio(part(r, "spout").geometry, "path")).toBeGreaterThan(0.6);
    const left = box(part(make("pump", { height: 40, sprayDirection: 270 }), "spout").geometry);
    expect(left.min.x).toBeLessThan(-act.max.x - 5);
  });

  it("vaporisateur : buse sur le côté du poussoir, dans la direction demandée", () => {
    const front = make("spray", { height: 40, sprayDirection: 0 });
    const act = box(part(front, "actuator").geometry);
    const nozzle = box(part(front, "nozzle").geometry);
    expect(nozzle.max.z).toBeGreaterThan(act.max.z);
    expect(nozzle.min.y).toBeGreaterThan(act.min.y);
    expect(nozzle.max.y).toBeLessThan(act.max.y);
    const right = box(part(make("spray", { height: 40, sprayDirection: 90 }), "nozzle").geometry);
    expect(right.max.x).toBeGreaterThan(act.max.x);
    expect(part(front, "collar").material).toBe("metal");
  });

  it("pipette : collerette, bulbe en caoutchouc, tige en verre qui plonge dans la bouteille", () => {
    const r = make("dropper", { height: 40, stemLength: 60 });
    const collar = box(part(r, "collar").geometry);
    const bulb = box(part(r, "bulb").geometry);
    const stem = box(part(r, "stem").geometry);
    expect(bulb.min.y).toBeGreaterThanOrEqual(collar.max.y - 1e-6);
    expect(stem.min.y).toBeCloseTo(-60, 5);
    expect(part(r, "bulb").material).toBe("rubber");
    expect(part(r, "stem").material).toBe("glass");
  });
});

describe("couvercle de canette", () => {
  it("bord roulé, panneau en retrait, rivet, vraie languette en géométrie", () => {
    const r = createClosureGeometry({ type: "canLid", width: 58, height: 3, seed: 1 });
    const lid = box(part(r, "lid").geometry);
    expect(lid.max.y).toBeCloseTo(0, 5); // the seam rim is the top
    expect(lid.max.x - lid.min.x).toBeCloseTo(58, 0);
    const pos = part(r, "lid").geometry.attributes.position as THREE.BufferAttribute;
    let centre = -Infinity;
    for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i), pos.getZ(i)) < 1) centre = Math.max(centre, pos.getY(i));
    expect(centre).toBeLessThan(-1); // recessed central panel
    const rivet = box(part(r, "rivet").geometry);
    expect(Math.abs(rivet.getCenter(new THREE.Vector3()).x)).toBeLessThan(0.5);
    const tab = box(part(r, "pullTab").geometry);
    expect(tab.max.z - tab.min.z).toBeGreaterThan(29 * 0.6); // a real tab, about half the lid
    expect(tab.max.y).toBeLessThan(0.5); // below the rim, on the panel
    expect(tab.min.y).toBeGreaterThan(centre - 1);
    expect(rivet.max.y).toBeGreaterThan(tab.max.y); // the rivet head holds the tab
    expect(part(r, "pullTab").geometry.index!.count / 3).toBeGreaterThan(50);
  });
});

describe("presets par famille de bouteille", () => {
  it("chaque famille reçoit la fermeture attendue", () => {
    const neck = { width: 24, finishHeight: 3, finishScale: 1.1 };
    expect(closurePreset("oval", 200, neck)).toMatchObject({ type: "screwCap", tamperRing: true });
    expect(closurePreset("round", 180, neck)).toMatchObject({ type: "ribbedCap", tamperRing: true });
    expect(closurePreset("wine", 300, neck).type).toBe("wineCapsule");
    expect(closurePreset("perfume", 110, neck)).toMatchObject({ type: "spray", sprayDirection: 0 });
    expect(closurePreset("pump", 170, neck)).toMatchObject({ type: "pump" });
    expect(closurePreset("dropper", 95, neck).type).toBe("dropper");
    // caps cover the neck finish
    expect(closurePreset("oval", 200, neck).skirt).toBeGreaterThanOrEqual(3);
  });
});

// ─── Integration through buildPackaging (fake 2D canvas: Node has none) ───────

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));

describe("intégration buildPackaging — fermetures en place", () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  });
  const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;

  it.each([
    ["VERDANT (shampoing)", "bottle", 60, 40, 200, "PEHD", ["screwCap", "tamperRing"]],
    ["SOLÈNE (parfum)", "spray", 60, 35, 110, "Verre épais", ["collar", "actuator", "nozzle"]],
    ["MAISON LUNE (vin)", "wine", 75, 75, 300, "Verre teinté", ["wineCapsule"]],
    ["PIMENTO (sauce)", "bottle", 55, 55, 180, "Verre transparent", ["ribbedCap", "tamperRing"]],
    ["LUMINA (pipette)", "dropper", 34, 34, 95, "Verre ambré", ["collar", "bulb", "stem"]],
    ["pompe", "pump", 55, 55, 170, "PET recyclé", ["collar", "stem", "actuator", "spout"]],
    ["canette", "can", 66, 66, 122, "Aluminium", ["lid", "rivet", "pullTab"]],
    ["pot", "jar", 75, 75, 80, "Verre transparent", []],
    ["brique", "carton", 70, 70, 190, "Carton aseptique", []],
    ["sachet", "pouch", 140, 80, 220, "Kraft + PE", []],
  ] as const)("%s", async (_n, model, L, W, H, material, expected) => {
    const { buildPackaging, disposeObject } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model: model as never, lengthMm: L, widthMm: W, heightMm: H, material }, design);
    const names = new Set<string>();
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name) names.add(m.name);
      for (const v of m.geometry.attributes.position.array as Float32Array) expect(Number.isFinite(v)).toBe(true);
    });
    for (const n of expected) expect(names.has(n), n).toBe(true);
    // The catalog proportions survive the new closures (pack height ≈ H).
    if (["bottle", "wine", "dropper"].includes(model)) {
      const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      expect(s.y / s.x).toBeCloseTo(H / L, 0);
      expect(Math.abs(s.y / s.x - H / L) / (H / L)).toBeLessThan(0.04);
    }
    disposeObject(obj);
  });
});
