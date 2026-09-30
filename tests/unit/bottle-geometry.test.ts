import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  bottleFamily, bottlePreset, bottleSection, createBottleFill, createBottleGeometry, createBottleLabel, shoulderCurve,
  type BottleGeometryConfig, type ShoulderStyle,
} from "@/lib/three/geometry/bottleGeometry";

const base: BottleGeometryConfig = {
  width: 60, depth: 40, height: 180, bodyShape: "oval", shoulderStyle: "soft",
  shoulderHeight: 25, neckWidth: 22, neckHeight: 20, baseStyle: "flat",
};

function bounds(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  return g.boundingBox!;
}

function assertValid(g: THREE.BufferGeometry) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  expect(pos).toBeDefined();
  expect(g.attributes.normal).toBeDefined();
  expect(g.attributes.uv).toBeDefined();
  for (const a of [pos.array, g.attributes.normal.array, g.attributes.uv.array]) {
    for (const v of a as Float32Array) expect(Number.isFinite(v)).toBe(true);
  }
  const idx = g.index!.array;
  expect(idx.length % 3).toBe(0);
  let degenerate = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    for (const k of [0, 1, 2]) expect(idx[i + k]).toBeLessThan(pos.count);
    A.fromBufferAttribute(pos, idx[i]);
    B.fromBufferAttribute(pos, idx[i + 1]);
    C.fromBufferAttribute(pos, idx[i + 2]);
    if (B.clone().sub(A).cross(C.clone().sub(A)).length() < 1e-9) degenerate++;
  }
  // Only the collapsed centre of a fan may be degenerate, never whole bands.
  expect(degenerate).toBe(0);
}

/** Lateral normals point away from the bottle axis on the straight body. */
function outwardOnBody(r: ReturnType<typeof createBottleGeometry>) {
  const pos = r.body.attributes.position as THREE.BufferAttribute;
  const nrm = r.body.attributes.normal as THREE.BufferAttribute;
  const yMid = (r.bodyBottomY + r.shoulderStartY) / 2;
  let checked = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y <= r.bodyBottomY || y > r.shoulderStartY || Math.abs(y - yMid) > (r.shoulderStartY - r.bodyBottomY)) continue;
    const dot = pos.getX(i) * nrm.getX(i) + pos.getZ(i) * nrm.getZ(i);
    expect(dot).toBeGreaterThan(0);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
}

describe("moteur paramétrique de bouteilles — validité", () => {
  it.each(["round", "oval", "rectangular", "square", "faceted"] as const)("%s : géométrie valide, sans NaN ni face dégénérée, normales vers l'extérieur", (bodyShape) => {
    const r = createBottleGeometry({ ...base, bodyShape, cornerRadius: 0.3, facetCount: 8 });
    assertValid(r.body);
    outwardOnBody(r);
    // Bottom faces the floor.
    const n = r.bottom.attributes.normal as THREE.BufferAttribute;
    expect(n.getY(0)).toBeLessThan(0);
  });

  it("déterministe : même configuration → mêmes sommets", () => {
    const a = createBottleGeometry({ ...base, bodyShape: "faceted", seed: 7 });
    const b = createBottleGeometry({ ...base, bodyShape: "faceted", seed: 7 });
    expect(Array.from(a.body.attributes.position.array)).toEqual(Array.from(b.body.attributes.position.array));
  });
});

describe("dimensions réellement respectées", () => {
  it.each([
    ["round", 60, 60],
    ["oval", 60, 40],
    ["oval", 35, 55],
    ["rectangular", 60, 35],
    ["square", 50, 48],
  ] as const)("%s %s × %s mm", (bodyShape, width, depth) => {
    const r = createBottleGeometry({ ...base, bodyShape, width, depth, neckWidth: Math.min(width, depth) * 0.4 });
    const b = bounds(r.body);
    expect(b.max.x - b.min.x).toBeCloseTo(width, 1);
    expect(b.max.z - b.min.z).toBeCloseTo(bodyShape === "round" ? width : depth, 1);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(base.height, 5);
  });

  it("ovale : largeur ≠ profondeur sur tout le corps, pas un cylindre mis à l'échelle", () => {
    const r = createBottleGeometry({ ...base, width: 60, depth: 40 });
    const s = r.section;
    const xs = s.points.map((p) => Math.abs(p[0]));
    const zs = s.points.map((p) => Math.abs(p[1]));
    expect(Math.max(...xs)).toBeCloseTo(30, 3);
    expect(Math.max(...zs)).toBeCloseTo(20, 3);
    // Every point lies on the ellipse x²/30² + z²/20² = 1.
    for (const [x, z] of s.points) expect((x * x) / 900 + (z * z) / 400).toBeCloseTo(1, 5);
  });

  it("rectangulaire : de vraies faces planes, le rayon de coin change la géométrie", () => {
    const sharp = bottleSection({ width: 60, depth: 35, bodyShape: "rectangular", cornerRadius: 0.1 });
    const soft = bottleSection({ width: 60, depth: 35, bodyShape: "rectangular", cornerRadius: 0.8 });
    // flat front face: several vertices exactly on z = depth / 2
    for (const s of [sharp, soft]) expect(s.points.filter(([, z]) => Math.abs(z - 17.5) < 1e-6).length).toBeGreaterThanOrEqual(3);
    // a larger radius pulls the contour further away from the theoretical corner (30, 17.5)
    const gap = (s: typeof sharp) => Math.min(...s.points.map(([x, z]) => Math.hypot(x - 30, z - 17.5)));
    expect(gap(soft)).toBeGreaterThan(gap(sharp) * 3);
    expect(sharp.perimeter).toBeGreaterThan(soft.perimeter);
    const faceted = bottleSection({ width: 50, depth: 50, bodyShape: "faceted", facetCount: 6 });
    expect(faceted.points.length).toBeGreaterThan(6);
  });
});

describe("profil : épaules, col, base", () => {
  it.each(["soft", "rounded", "sloped", "sharp", "none"] as ShoulderStyle[])("épaule %s : du corps (t=0) au col (t=1), hauteur croissante", (style) => {
    const c = shoulderCurve(style);
    expect(c[c.length - 1]).toMatchObject({ u: 1, t: 1 });
    for (let i = 1; i < c.length; i++) {
      expect(c[i].u).toBeGreaterThanOrEqual(c[i - 1].u - 1e-9);
      expect(c[i].t).toBeGreaterThanOrEqual(c[i - 1].t - 1e-9);
    }
    const r = createBottleGeometry({ ...base, shoulderStyle: style });
    assertValid(r.body);
  });

  it("les styles d'épaule donnent des silhouettes différentes", () => {
    const widthAt = (style: ShoulderStyle, frac: number) => {
      const r = createBottleGeometry({ ...base, bodyShape: "round", width: 60, depth: 60, shoulderStyle: style });
      const y = r.shoulderStartY + (r.neckStartY - r.shoulderStartY) * frac;
      const pos = r.body.attributes.position as THREE.BufferAttribute;
      let best = Infinity, w = 0;
      for (let i = 0; i < pos.count; i++) {
        const d = Math.abs(pos.getY(i) - y);
        if (d < best - 1e-6) { best = d; w = 0; }
        if (Math.abs(d - best) < 1e-6) w = Math.max(w, Math.hypot(pos.getX(i), pos.getZ(i)));
      }
      return w;
    };
    const mid = (["soft", "rounded", "sloped", "sharp"] as ShoulderStyle[]).map((s) => widthAt(s, 0.5).toFixed(1));
    expect(new Set(mid).size).toBe(4);
  });

  it("col distinct du corps, à la bonne taille, avec point d'attache pour la fermeture", () => {
    for (const neckWidth of [8, 22, 40]) {
      const r = createBottleGeometry({ ...base, bodyShape: "round", width: 60, depth: 60, neckWidth });
      expect(r.neck.width).toBeCloseTo(neckWidth, 5);
      expect(r.neckTopY).toBe(base.height);
      expect(r.neckStartY).toBeGreaterThan(r.shoulderStartY);
      const pos = r.body.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > r.neckStartY + 0.01 && pos.getY(i) < r.neckTopY - base.neckHeight * 0.4) {
          expect(Math.hypot(pos.getX(i), pos.getZ(i))).toBeCloseTo(neckWidth / 2, 3);
        }
      }
    }
  });

  it.each(["flat", "slightlyRounded", "recessed"] as const)("base %s : bord arrondi, fond fermé", (baseStyle) => {
    const r = createBottleGeometry({ ...base, baseStyle });
    assertValid(r.bottom);
    expect(r.bodyBottomY).toBeGreaterThan(0);
    const b = bounds(r.bottom);
    if (baseStyle === "recessed") expect(b.max.y).toBeGreaterThan(1); // punt rises into the bottle
    else expect(b.max.y).toBeCloseTo(0, 5);
  });

  it("base arrondie plus douce que la base plate", () => {
    expect(createBottleGeometry({ ...base, baseStyle: "slightlyRounded" }).bodyBottomY).toBeGreaterThan(createBottleGeometry(base).bodyBottomY);
  });
});

describe("budget et cas limites", () => {
  it("chaque famille reste sous le budget de triangles", () => {
    for (const f of ["round", "beverage", "oval", "perfume", "wine", "dropper", "pump", "spray"] as const) {
      const r = createBottleGeometry(bottlePreset(f, 60, 40, 200).config);
      expect(r.triangles).toBeGreaterThan(500);
      expect(r.triangles).toBeLessThan(f === "round" || f === "beverage" || f === "oval" ? 5000 : 8000);
    }
  });

  it.each([
    ["très basse", { height: 30, shoulderHeight: 6, neckHeight: 5 }],
    ["très haute", { height: 600, shoulderHeight: 60, neckHeight: 150 }],
    ["largeur > profondeur", { width: 90, depth: 30 }],
    ["profondeur > largeur", { width: 30, depth: 90, neckWidth: 12 }],
    ["presque carrée", { bodyShape: "square" as const, width: 50, depth: 49 }],
    ["petit col", { neckWidth: 2 }],
    ["col plus large que le corps", { neckWidth: 200 }],
    ["épaule plus haute que la bouteille", { shoulderHeight: 500, neckHeight: 500 }],
  ] as [string, Partial<BottleGeometryConfig>][])("%s", (_name, over) => {
    const r = createBottleGeometry({ ...base, ...over });
    assertValid(r.body);
    assertValid(r.bottom);
    const b = bounds(r.body);
    expect(b.max.y).toBeCloseTo(over.height ?? base.height, 5);
  });
});

describe("étiquette et contenu", () => {
  it("l'étiquette épouse la section réelle (ovale), centrée à l'avant, UV de gauche à droite", () => {
    const r = createBottleGeometry(base);
    const { geometry, arcLength } = createBottleLabel(r.section, { yStart: 40, height: 80, fraction: 0.5 });
    assertValid(geometry);
    expect(arcLength).toBeCloseTo(r.section.perimeter * 0.5, 5);
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const uv = geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // just outside the ellipse (no z-fighting, not floating)
      const e = Math.sqrt((x * x) / 900 + (z * z) / 400);
      expect(e).toBeGreaterThan(1);
      expect(e).toBeLessThan(1.03);
      expect(z).toBeGreaterThan(-1e-6); // half perimeter centred on the front
    }
    // u grows from the viewer's left (−x) to right (+x), v from bottom to top
    let left = 0, right = 0;
    for (let i = 0; i < pos.count; i++) {
      if (uv.getX(i) === 0) left = pos.getX(i);
      if (uv.getX(i) === 1) right = pos.getX(i);
    }
    expect(left).toBeLessThan(0);
    expect(right).toBeGreaterThan(0);
    expect(uv.getY(0)).toBe(0);
    expect(uv.getY(pos.count - 1)).toBe(1);
  });

  it("le liquide reste à l'intérieur du corps", () => {
    const r = createBottleGeometry(base);
    const fill = createBottleFill(r, r.shoulderStartY);
    assertValid(fill);
    const b = bounds(fill);
    expect(b.max.x).toBeLessThan(30);
    expect(b.max.z).toBeLessThan(20);
    expect(b.max.y).toBeCloseTo(r.shoulderStartY, 5);
  });
});

describe("familles", () => {
  it("shampoing ovale, parfum rectangulaire, vin, boissons PET, rond par défaut", () => {
    expect(bottleFamily("bottle", 60, 40, "PEHD")).toBe("oval"); // VERDANT
    expect(bottleFamily("spray", 60, 35, "Verre épais")).toBe("perfume"); // SOLÈNE
    expect(bottleFamily("wine", 75, 75)).toBe("wine"); // MAISON LUNE
    expect(bottleFamily("bottle", 65, 65, "PET")).toBe("beverage");
    expect(bottleFamily("bottle", 55, 55, "Verre transparent")).toBe("round");
    expect(bottleFamily("spray", 45, 45)).toBe("spray");
    expect(bottlePreset("oval", 60, 40, 180).config).toMatchObject({ bodyShape: "oval", width: 60, depth: 40 });
    expect(bottlePreset("perfume", 60, 35, 100).config).toMatchObject({ bodyShape: "rectangular", shoulderStyle: "sharp" });
    expect(bottlePreset("wine", 75, 75, 270).config).toMatchObject({ shoulderStyle: "sloped", baseStyle: "recessed" });
  });
});

// ─── Integration: the real buildPackaging dispatcher (fake 2D canvas, Node has none) ───

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));

describe("intégration buildPackaging(spec, design)", () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  });

  const design = {
    brandName: "Test", productName: "Produit", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#16a34a"],
    headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null,
  } as never;

  it.each([
    ["shampoo-bottle", "bottle", 60, 40, 200, "PEHD"],
    ["perfume-bottle", "spray", 60, 35, 110, "Verre épais"],
    ["wine-bottle", "wine", 75, 75, 300, "Verre teinté"],
    ["sauce-bottle", "bottle", 55, 55, 180, "Verre transparent"],
    ["water-bottle", "bottle", 65, 65, 220, "PET"],
    ["pump-bottle", "pump", 55, 55, 170, "PET recyclé"],
    ["spray-bottle", "spray", 45, 45, 150, "Verre transparent"],
    ["dropper-bottle", "dropper", 34, 34, 95, "Verre ambré"],
    ["can", "can", 66, 66, 115, "Aluminium"],
    ["jar", "jar", 75, 75, 80, "Verre transparent"],
    ["carton", "carton", 70, 70, 190, "Carton aseptique"],
    ["pouch", "pouch", 140, 80, 220, "Kraft + PE"],
  ] as const)("%s se construit, normalisé, sans NaN", async (_id, model, L, W, H, material) => {
    const { buildPackaging, disposeObject } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model: model as never, lengthMm: L, widthMm: W, heightMm: H, material }, design);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
    let meshes = 0;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      for (const v of m.geometry.attributes.position.array as Float32Array) expect(Number.isFinite(v)).toBe(true);
    });
    expect(meshes).toBeGreaterThan(1);
    if (model === "bottle" && W < L) {
      // the oval shampoo keeps its real footprint ratio (not a cylinder)
      expect(size.z / size.x).toBeCloseTo(W / L, 1);
    }
    disposeObject(obj);
  });
});
