import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  FINISH_FALLBACK, MATERIAL_PRESET_IDS, MATERIAL_PRESETS, createDeterministicNoise, finishFromLabel, glassPreset, hashSeed,
  printedPreset, resolveMaterial, type FinishId, type MaterialQuality,
} from "@/lib/three/materials/materialPresets";

const QUALITIES: MaterialQuality[] = ["low", "medium", "high", "ultra"];
const unit = (x: number) => x >= 0 && x <= 1;

describe("presets de matières — valeurs physiques", () => {
  it("chaque preset × chaque qualité : paramètres finis et dans leurs bornes", () => {
    for (const preset of MATERIAL_PRESET_IDS) for (const quality of QUALITIES) {
      const m = resolveMaterial({ preset, quality, seed: 42 });
      for (const k of ["roughness", "metalness", "clearcoat", "clearcoatRoughness", "sheen", "sheenRoughness", "specularIntensity", "transmission", "dispersion", "anisotropy", "opacity"] as const) {
        expect(Number.isFinite(m[k]), `${preset}/${quality}/${k}`).toBe(true);
        expect(unit(m[k]), `${preset}/${quality}/${k}=${m[k]}`).toBe(true);
      }
      expect(m.ior).toBeGreaterThanOrEqual(1);
      expect(m.ior).toBeLessThanOrEqual(2.333);
      expect(Number.isFinite(m.thickness) && m.thickness >= 0).toBe(true);
      expect(m.attenuationDistance > 0).toBe(true); // Infinity allowed (clear)
      expect(m.colorFactor).toBeGreaterThan(0.9);
      expect(m.colorFactor).toBeLessThan(1.1);
      expect(m.offset.every((v) => v >= 0 && v < 1)).toBe(true);
      expect(m.variant).toBeGreaterThanOrEqual(0);
      expect(m.variant).toBeLessThan(4);
    }
  });

  it("familles cohérentes : métaux métalliques, verres transmissifs, papiers rugueux", () => {
    for (const id of MATERIAL_PRESET_IDS) {
      const p = MATERIAL_PRESETS[id];
      if (p.family === "glass") expect(p.transmission).toBe(1);
      if (["aluminum", "brushedMetal", "foil"].includes(id)) expect(p.metalness).toBeGreaterThan(0.8);
      if (["paper", "kraft", "laidPaper", "labelMatte", "labelEdge"].includes(id)) expect(p.roughness).toBeGreaterThan(0.75);
    }
    expect(MATERIAL_PRESETS.brushedMetal.anisotropy).toBeGreaterThan(MATERIAL_PRESETS.aluminum.anisotropy);
    expect(MATERIAL_PRESETS.perfumeGlass.thickness).toBeGreaterThan(MATERIAL_PRESETS.glass.thickness);
    expect(MATERIAL_PRESETS.labelGlossy.clearcoat).toBeGreaterThan(MATERIAL_PRESETS.labelMatte.clearcoat);
    expect(MATERIAL_PRESETS.softTouch.roughness).toBeGreaterThan(MATERIAL_PRESETS.glossyPlastic.roughness);
  });

  it("valeurs invalides ramenées dans les bornes, preset inconnu → carton", () => {
    const m = resolveMaterial({ preset: "glossyPlastic", roughness: 7, metalness: Number.NaN });
    expect(m.roughness).toBe(1);
    expect(m.metalness).toBe(0);
    expect(resolveMaterial({ preset: "nope" as never }).preset).toBe("carton");
  });
});

describe("qualité LOW / MEDIUM / HIGH / ULTRA", () => {
  it("LOW : pas de micro-surface ; le verre passe en transparence simple (sans passe de transmission)", () => {
    const g = resolveMaterial({ preset: "glass", quality: "low" });
    expect(g.micro).toBeNull();
    expect(g.transmission).toBe(0);
    expect(g.transparentFallback).toBe(true);
    expect(g.opacity).toBeLessThan(1);
  });
  it("MEDIUM : micro-surface et variation de rugosité, sans rayures ni traces", () => {
    const m = resolveMaterial({ preset: "glossyPlastic", quality: "medium" });
    expect(m.micro?.variation).toBeGreaterThan(0);
    expect(m.micro?.scratches).toBe(0);
    expect(m.micro?.smudges).toBe(0);
    expect(resolveMaterial({ preset: "perfumeGlass", quality: "medium" }).dispersion).toBe(0);
  });
  it("HIGH : imperfections, anisotropie complète, dispersion du verre ; ULTRA = HIGH aujourd'hui", () => {
    const m = resolveMaterial({ preset: "brushedMetal", quality: "high" });
    expect(m.micro?.scratches).toBeGreaterThan(0);
    expect(m.anisotropy).toBe(MATERIAL_PRESETS.brushedMetal.anisotropy);
    expect(resolveMaterial({ preset: "perfumeGlass", quality: "high" }).dispersion).toBeGreaterThan(0);
    expect(resolveMaterial({ preset: "brushedMetal", quality: "ultra", seed: 3 })).toEqual({ ...resolveMaterial({ preset: "brushedMetal", quality: "high", seed: 3 }), quality: "ultra" });
  });
});

describe("déterminisme", () => {
  it("même seed → même matière ; seeds différents → variation (motif, placement, teinte)", () => {
    expect(resolveMaterial({ preset: "kraft", seed: 7 })).toEqual(resolveMaterial({ preset: "kraft", seed: 7 }));
    const variants = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(resolveMaterial({ preset: "kraft", seed: hashSeed("pack", i) }).offset)));
    expect(variants.size).toBe(12);
  });
  it("hashSeed et bruit déterministe", () => {
    expect(hashSeed("TERRA", "pouch", "Kraft")).toBe(hashSeed("TERRA", "pouch", "Kraft"));
    expect(hashSeed("TERRA", "pouch")).not.toBe(hashSeed("NOCTA", "pouch"));
    const a = createDeterministicNoise(5), b = createDeterministicNoise(5);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x >= 0 && x < 1).toBe(true);
    }
  });
});

describe("finitions, impression, verre", () => {
  it("libellés du catalogue → finitions ; finitions futures → repli documenté", () => {
    expect(finishFromLabel("Vernis brillant")).toBe("glossy");
    expect(finishFromLabel("Vernis mat")).toBe("matte");
    expect(finishFromLabel("Soft touch")).toBe("softTouch");
    expect(finishFromLabel("Papier vergé")).toBe("laid");
    expect(finishFromLabel("Papier non couché")).toBe("uncoated");
    expect(finishFromLabel("Dorure or")).toBe("foil");
    expect(finishFromLabel(undefined)).toBe("satin");
    for (const f of ["foil", "spotUv", "emboss", "deboss"] as FinishId[]) expect(FINISH_FALLBACK[f]).not.toBe(f);
  });
  it("support + finition → preset imprimé ; les étiquettes ont leurs papiers", () => {
    expect(printedPreset("paper", "glossy")).toBe("glossyCarton");
    expect(printedPreset("paper", "glossy", true)).toBe("labelGlossy");
    expect(printedPreset("paper", "matte", true)).toBe("labelMatte");
    expect(printedPreset("kraft", "satin")).toBe("kraft");
    expect(printedPreset("metal", "matte")).toBe("printedMetal");
    expect(printedPreset("plastic", "softTouch")).toBe("softTouch");
    expect(printedPreset("film", "glossy")).toBe("plasticFilm");
  });
  it("verre : transparent, teinté (ambré, vert), épais de parfum, dépoli", () => {
    expect(glassPreset("Verre transparent").preset).toBe("glass");
    expect(glassPreset("Verre ambré")).toMatchObject({ preset: "tintedGlass" });
    expect(glassPreset("Verre teinté").preset).toBe("tintedGlass");
    expect(glassPreset("Verre épais").preset).toBe("perfumeGlass");
    expect(glassPreset("Verre dépoli").preset).toBe("frostedGlass");
    const amber = resolveMaterial({ preset: "tintedGlass", tint: "#8a4a12" });
    expect(amber.color).toBe("#8a4a12");
    expect(amber.attenuationColor).toBe("#8a4a12");
    expect(resolveMaterial({ preset: "glossyPlastic", tint: "#8a4a12" }).color).toBe("#ffffff"); // tint is for glass only
  });
});

// ─── Factory and full non-regression (fake 2D canvas: Node has none) ─────────

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));

describe("fabrique de matières et non-régression de tous les packagings", () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  });

  it("crée des MeshPhysicalMaterial complets, sans WebGL", async () => {
    const { createPackagingMaterial } = await import("@/lib/three/materials/materialFactory");
    for (const preset of MATERIAL_PRESET_IDS) {
      const m = createPackagingMaterial({ preset, quality: "high", seed: 1 }, { mm: [80, 120] });
      expect(m).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(m.userData.packagingMaterial).toBe(preset);
      expect(m.roughness).toBeLessThanOrEqual(1);
      if (MATERIAL_PRESETS[preset].micro) {
        expect(m.normalMap).toBeTruthy();
        expect(m.roughnessMap).toBeTruthy();
      }
      if (MATERIAL_PRESETS[preset].family === "glass") {
        expect(m.transmission).toBe(1);
        expect(m.side).toBe(THREE.DoubleSide);
      }
    }
    const low = createPackagingMaterial({ preset: "perfumeGlass", quality: "low" });
    expect(low.transmission).toBe(0);
    expect(low.transparent).toBe(true);
  });

  const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis brillant", contentColor: "#d97706", logo: null } as never;
  const MODELS: [string, number, number, number, string][] = [
    ["pouch", 140, 80, 220, "Kraft + PE"], ["flatpouch", 150, 10, 220, "Film métallisé"], ["sachet", 90, 8, 120, "Film PE"],
    ["box", 70, 70, 130, "Carton couché 350g"], ["rigid", 120, 120, 70, "Carton rigide 1,5 mm"], ["mailer", 220, 160, 60, "Carton ondulé E"],
    ["carton", 70, 70, 190, "Carton aseptique"], ["bottle", 60, 40, 200, "PEHD"], ["bottle", 55, 55, 180, "Verre transparent"],
    ["wine", 75, 75, 300, "Verre teinté"], ["spray", 60, 35, 110, "Verre épais"], ["spray", 45, 45, 150, "Verre transparent"],
    ["tube", 40, 40, 160, "PE souple"], ["jar", 75, 75, 80, "Verre transparent"], ["jar", 60, 60, 110, "PEHD blanc"],
    ["can", 66, 66, 122, "Aluminium"], ["tub", 90, 90, 110, "PP"], ["tin", 120, 120, 60, "Fer blanc"], ["cup", 80, 80, 100, "Carton"],
    ["dropper", 34, 34, 95, "Verre ambré"], ["pump", 55, 55, 170, "PET recyclé"], ["jug", 150, 80, 250, "PEHD"], ["bag", 200, 90, 300, "Kraft 120g"],
  ];

  it.each(MODELS)("%s (%s×%s×%s, %s) : construit, dimensions non nulles, sans NaN, matières de la fabrique", async (model, L, W, H, material) => {
    const { buildPackaging, disposeObject } = await import("@/lib/three/packagingModels");
    for (const quality of ["low", "high"] as const) {
      const obj = buildPackaging({ model: model as never, lengthMm: L, widthMm: W, heightMm: H, material }, design, { quality });
      const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      expect(Math.min(size.x, size.y, size.z)).toBeGreaterThan(0);
      let meshes = 0;
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        for (const v of m.geometry.attributes.position.array as Float32Array) expect(Number.isFinite(v)).toBe(true);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        expect(mats.length).toBeGreaterThan(0);
        for (const mt of mats) {
          expect(mt, `${model}: material missing`).toBeTruthy();
          expect(mt.userData.packagingMaterial, `${model}: material outside the factory`).toBeTruthy();
          if (quality === "low") expect((mt as THREE.MeshPhysicalMaterial).transmission ?? 0).toBe(0);
        }
      });
      expect(meshes).toBeGreaterThan(0);
      disposeObject(obj);
    }
  });

  it("buildPackaging expose le facteur exact mm par unité (taille réelle)", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    for (const [model, L, W, H, material] of MODELS) {
      const obj = buildPackaging({ model: model as never, lengthMm: L, widthMm: W, heightMm: H, material }, design);
      const mmPerUnit = obj.userData.mmPerUnit as number;
      expect(Number.isFinite(mmPerUnit) && mmPerUnit > 0).toBe(true);
      const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      // largest side in scene units × mmPerUnit = largest real side of the built model, mm
      expect(Math.max(size.x, size.y, size.z) * mmPerUnit).toBeGreaterThanOrEqual(Math.max(L, W, H) * 0.9);
    }
  });

  it("même pack → mêmes matières ; deux packs → variations légères", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const spec = { model: "pouch" as never, lengthMm: 140, widthMm: 80, heightMm: 220, material: "Kraft + PE" };
    const offsetOf = (o: THREE.Object3D) => {
      let off = "";
      o.traverse((x) => {
        const m = (x as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
        if (!off && m && !Array.isArray(m) && m.normalMap) off = m.normalMap.offset.toArray().join(",");
      });
      return off;
    };
    const a = offsetOf(buildPackaging(spec, design));
    expect(offsetOf(buildPackaging(spec, design))).toBe(a);
    expect(offsetOf(buildPackaging(spec, { ...(design as object), brandName: "Autre" } as never))).not.toBe(a);
  });

  it("étiquettes : film sur flacon plastique (VERDANT), papier sur verre ; toit de brique en deux matières", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const labelOf = (o: THREE.Object3D) => {
      let found: THREE.Material[] | null = null;
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        if (m.isMesh && Array.isArray(m.material) && m.material.length === 2 && m.geometry.groups.length === 2 && !found) found = m.material;
      });
      return found as THREE.Material[] | null;
    };
    const film = labelOf(buildPackaging({ model: "bottle" as never, lengthMm: 60, widthMm: 40, heightMm: 200, material: "PEHD" }, design))!;
    expect(String(film[0].userData.packagingMaterial)).toMatch(/^labelFilm/);
    const paper = labelOf(buildPackaging({ model: "wine" as never, lengthMm: 75, widthMm: 75, heightMm: 300, material: "Verre teinté" }, design))!;
    expect(String(paper[0].userData.packagingMaterial)).toMatch(/^label(Matte|Glossy)$/);
    expect(paper[1].userData.packagingMaterial).toBe("labelEdge");
    expect(printedPreset("film", "matte", true)).toBe("labelFilmMatte");
    const { createCartonGeometry } = await import("@/lib/three/geometry/cartonGeometry");
    const roof = createCartonGeometry({ width: 70, depth: 70, height: 190 }).roof;
    expect(roof.groups.map((g) => g.materialIndex)).toEqual([0, 1, 2]); // roof-front, roof-back, plain gussets
    expect(roof.groups.reduce((n, g) => n + g.count, 0)).toBe(roof.index!.count);
  });

  it("étiquette physique : face imprimée + chants et dos en papier (deux matières)", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model: "bottle" as never, lengthMm: 55, widthMm: 55, heightMm: 180, material: "Verre transparent" }, design);
    let label: THREE.Mesh | null = null;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && Array.isArray(m.material) && m.material.length === 2) label = m;
    });
    expect(label).toBeTruthy();
    const mats = (label! as THREE.Mesh).material as THREE.Material[];
    expect(mats[1].userData.packagingMaterial).toBe("labelEdge");
    expect((label! as THREE.Mesh).geometry.groups.length).toBe(2);
  });
});
