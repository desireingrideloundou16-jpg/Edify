/**
 * Phase 2C-2 invariant: the printable surface declared by the structure (die-line, PDF) is the
 * surface the 3D actually textures. Two paths are compared:
 *   - print: resolveStructure() → printSurfaces (pure, no three.js);
 *   - 3D:    buildPackaging() → the label / wrap mesh, its texture size in mm and its geometry.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { closurePreset, closureTop, type ClosureFamily } from "@/lib/structure/profile/closureProfile";
import { profileLabel, resolveStructure, type ShapeModel } from "@/lib/structure";
import { flatLayout } from "@/lib/print/layout";

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));

const PROFILED: ShapeModel[] = ["bottle", "wine", "dropper", "pump", "spray", "jar", "can", "tin", "papertube", "tube"];
const ROWS = SHAPE_ROWS.filter((r) => PROFILED.includes(r[3]));
const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;

/**
 * Tolerance: the print path is computed in float64; the 3D mesh is stored in Float32 buffers
 * (relative precision ≈ 6e-8). 1e-4 mm on sizes of ≤ 400 mm is far above float32 noise and far
 * below anything printable.
 */
const MM_TOL = 1e-4;

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

/** The printed label / wrap mesh of a built pack: the mesh whose texture is a wrap (mm on the map). */
async function printedWrapMesh(model: ShapeModel, L: number, W: number, H: number, material: string) {
  const { buildPackaging } = await import("@/lib/three/packagingModels");
  const obj = buildPackaging({ model, lengthMm: L, widthMm: W, heightMm: H, material }, design);
  const s = resolveStructure({ model, lengthMm: L, widthMm: W, heightMm: H, material });
  const surface = s.printSurfaces[0];
  let found: { mesh: THREE.Mesh; mm: [number, number] } | null = null;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || found) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const map = (mats[0] as THREE.MeshStandardMaterial).map;
    const mm = map?.userData.mm as [number, number] | undefined;
    if (mm && Math.abs(mm[1] - surface.hMm) < 1 && Math.abs(mm[0] - surface.wMm) < 1) found = { mesh: m, mm };
  });
  return { structure: s, surface, found: found as { mesh: THREE.Mesh; mm: [number, number] } | null };
}

describe("surface imprimable 3D = surface du patron (catalogue complet)", () => {
  it.each(ROWS.map((r) => [r[0], r[3], r[4], r[5], r[6], r[7]] as const))(
    "%s (%s) : la texture 3D et la géométrie de l'étiquette ont exactement les dimensions imprimées",
    async (_id, model, L, W, H, material) => {
      const { surface, found } = await printedWrapMesh(model, L, W, H, material);
      expect(found, "printed wrap mesh").not.toBeNull();
      const { mesh, mm } = found!;
      // texture size (what the artwork is drawn at) = print surface
      expect(Math.abs(mm[0] - surface.wMm)).toBeLessThan(MM_TOL);
      expect(Math.abs(mm[1] - surface.hMm)).toBeLessThan(MM_TOL);
      // label geometry height (mm, before normalisation) = printed height
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      expect(Math.abs(bb.max.y - bb.min.y - surface.hMm)).toBeLessThan(MM_TOL);
      // the flat die-line panel is the same surface
      const panel = flatLayout({ model, lengthMm: L, widthMm: W, heightMm: H, material }).panels[0];
      expect([panel.w, panel.h]).toEqual([surface.wMm, surface.hMm]);
      expect(panel.frontFraction).toBe(surface.draw.frontFraction);
    }
  );
});

describe("hauteur de verre : calcul analytique de la fermeture = géométrie réelle", () => {
  it.each(["round", "beverage", "oval", "perfume", "wine", "dropper", "pump", "spray"] as ClosureFamily[])("famille %s", async (family) => {
    const { createClosureGeometry } = await import("@/lib/three/geometry/closureLibrary");
    for (const H of [70, 95, 150, 300]) {
      const cfg = closurePreset(family, H, { width: 22, finishHeight: 3, finishScale: 1.08 }, H * 0.5);
      const real = createClosureGeometry(cfg).top;
      expect(Math.abs(closureTop(cfg) - real)).toBeLessThan(MM_TOL);
    }
  });
});

describe("surfaces profilées : propriétés", () => {
  it.each(PROFILED)("%s : dimensions finies, positives, déterministes, entrée non mutée", (model) => {
    const input = { model, lengthMm: 60, widthMm: 45, heightMm: 180, material: "PEHD" };
    const before = structuredClone(input);
    const a = resolveStructure(input);
    expect(input).toEqual(before);
    expect(resolveStructure(input)).toEqual(a);
    const s = a.printSurfaces[0];
    for (const v of [s.wMm, s.hMm]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
    expect(s.hMm).toBeLessThan(180);
    const l = profileLabel(model, 60, 45, 180, "PEHD")!;
    expect([s.wMm, s.hMm, s.draw.frontFraction]).toEqual([l.arcLengthMm, l.heightMm, l.frontFraction]);
  });

  it("largeur = périmètre physique de la section × couverture (ovale ≠ cercle)", () => {
    const oval = resolveStructure({ model: "bottle", lengthMm: 60, widthMm: 40, heightMm: 200, material: "PEHD" }).printSurfaces[0];
    // ellipse 60 × 40: perimeter ≈ 158.65 mm (Ramanujan), oval family covers 50 %
    expect(oval.wMm).toBeGreaterThan(158.4 * 0.5);
    expect(oval.wMm).toBeLessThan(158.7 * 0.5);
    const can = resolveStructure({ model: "can", lengthMm: 66, widthMm: 66, heightMm: 115 }).printSurfaces[0];
    expect(can.wMm).toBeCloseTo(Math.PI * 66, 9); // full circumference, π × D
  });

  it("cup et pot en carton restent sans patron ; le pot plastique (tub) a son secteur développé depuis 2C-4F-1", () => {
    for (const model of ["cup", "papertub"] as ShapeModel[]) {
      expect(resolveStructure({ model, lengthMm: 90, widthMm: 90, heightMm: 110 }).dieline).toBe("unsupported");
    }
    expect(resolveStructure({ model: "tub", lengthMm: 90, widthMm: 90, heightMm: 110 }).template).toBe("conicalWrap");
  });
});
