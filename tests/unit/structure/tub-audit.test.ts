/**
 * Phase 2C-4F-0 (audit): physical invariants of the 5 tubs as Edify builds them, pinned so that later
 * phases start from measured facts. Since 2C-4F-1 the 4 plastic tubs have their developed wall
 * (conical-profile / conical-dieline tests); the paper ice-cream tub (model papertub) keeps the former
 * rectangular wrap and stays unsupported.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { cylinderWrap, resolveStructure } from "@/lib/structure";
import { resolveFlatLayout } from "@/lib/print/layout";

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));
const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub" || r[3] === "papertub").map((r) => [r[0], r[4], r[5], r[6], r[7], r[3] as "tub" | "papertub"] as const);
type CylParams = { radiusTop: number; radiusBottom: number; height: number; radialSegments: number; openEnded: boolean; thetaStart: number; thetaLength: number };

/** Lateral surface of a frustum developed flat: an annular sector (pure geometry, for the audit). */
function annularSector(R: number, r: number, h: number) {
  const slant = Math.hypot(h, R - r);
  const outer = (R * slant) / (R - r), inner = outer - slant;
  const angle = (2 * Math.PI * R) / outer;
  return { slant, outer, inner, angle };
}

describe("pots (tub) : inventaire et statut", () => {
  it("5 pots : 4 plastiques (tub, secteur développé depuis 2C-4F-1) et le pot de glace en carton (papertub, refusé)", () => {
    expect(TUBS.map((t) => t[0]).sort()).toEqual(["deli-container", "hair-cream-tub", "ice-cream-tub", "protein-tub", "yogurt-cup"]);
    expect(TUBS.filter((t) => t[5] === "papertub").map((t) => t[0])).toEqual(["ice-cream-tub"]);
    for (const [id, L, W, H, m, model] of TUBS) {
      const s = resolveStructure({ model, lengthMm: L, widthMm: W, heightMm: H, material: m });
      expect(s.family, id).toBe("profile");
      expect(s.profile, id).toEqual({ builder: model, sectionMm: { L, W } });
      expect(s.closure, id).toEqual({ kind: "lid" });
      const supported = resolveFlatLayout({ model, lengthMm: L, widthMm: W, heightMm: H, material: m }).supported;
      if (model === "tub") {
        expect([s.dieline, s.template, supported], id).toEqual(["supported", "conicalWrap", true]);
      } else {
        expect([s.dieline, s.template, supported], id).toEqual(["unsupported", undefined, false]);
        expect(s.dielineNote, id).toMatch(/carton/);
      }
    }
  });
});

describe.each(TUBS)("%s : géométrie mesurée", (id, L, W, H, m, model) => {
  const R = Math.min(L, W) / 2;
  const wrap = cylinderWrap("tub", L, W, H);
  const s = resolveStructure({ model, lengthMm: L, widthMm: W, heightMm: H, material: m });

  it("paroi = tronc de cône ouvert (96 facettes) : R haut = L/2, r bas = 0,86 R, hauteur = bodyH ; couture au dos", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model, lengthMm: L, widthMm: W, heightMm: H, material: m }, design);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const body = meshes.find((x) => ((x.material as THREE.MeshStandardMaterial).userData.surfaceId) === "wrap")!;
    const p = (body.geometry as THREE.CylinderGeometry).parameters as CylParams;
    expect(p.radiusTop).toBeCloseTo(R, 9);
    expect(p.radiusBottom).toBeCloseTo(0.86 * R, 9);
    expect(p.height).toBeCloseTo(wrap.bodyH, 9);
    expect([p.radialSegments, p.openEnded, p.thetaStart, p.thetaLength]).toEqual([96, true, -Math.PI, 2 * Math.PI]);
    // other parts: a plain bottom disc (radius r) and a plain closed lid, wider than the wall
    const others = meshes.filter((x) => x !== body).map((x) => [x.geometry.type, (x.geometry as THREE.CylinderGeometry).parameters] as const);
    expect(others.map((o) => o[0]).sort()).toEqual(["CircleGeometry", "CylinderGeometry"]);
    const lid = others.find((o) => o[0] === "CylinderGeometry")![1] as CylParams;
    expect(lid.radiusTop).toBeGreaterThan(R);
    expect(lid.height).toBeCloseTo(wrap.lidH, 9);
    for (const x of meshes.filter((q) => q !== body)) expect((x.material as THREE.MeshStandardMaterial).map ?? null).toBeNull();
  });

  it("surface imprimable : le secteur développé (tub) ; l'ancien rectangle 2πR × hauteur verticale pour le pot en carton", () => {
    expect(s.printSurfaces.map((x) => x.id)).toEqual(["wrap"]);
    const w = s.printSurfaces[0];
    // the lid skirt covers the top of the wall (same builder for both)
    expect(wrap.bodyH - (H - wrap.lidH)).toBeCloseTo(0.072 * H, 9);
    if (model === "tub") {
      expect(w.shape).toBeDefined(); // 2C-4F-1: annular sector, see conical-dieline.test.ts
      expect(w.wMm).toBeLessThan(2 * Math.PI * R); // the sector's chord, not the unrolled top circumference
      return;
    }
    expect(w.shape).toBeUndefined();
    expect(w.wMm).toBeCloseTo(2 * Math.PI * R, 9); // the TOP circumference only
    expect(w.hMm).toBeCloseTo(wrap.bodyH, 9); // vertical height, not the slant
    expect(w.draw).toEqual({ kind: "wrap", frontFraction: 0.3 });
  });

  it("développabilité : la paroi se développe exactement en secteur d'anneau (arcs = circonférences) ; le placage actuel ne l'est pas (−14 % en bas)", () => {
    const r = 0.86 * R, sec = annularSector(R, r, wrap.bodyH);
    expect(sec.angle * sec.outer).toBeCloseTo(2 * Math.PI * R, 9);
    expect(sec.angle * sec.inner).toBeCloseTo(2 * Math.PI * r, 9);
    expect(sec.outer - sec.inner).toBeCloseTo(sec.slant, 9);
    // current UV: u spreads the full texture width over every ring, so 1 mm of artwork covers
    // r / R mm at the bottom: a 14 % horizontal squeeze, and h / slant vertically
    expect(r / R).toBeCloseTo(0.86, 12);
    expect(wrap.bodyH / sec.slant).toBeLessThan(1);
  });
});
