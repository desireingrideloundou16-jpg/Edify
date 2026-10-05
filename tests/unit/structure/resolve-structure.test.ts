import { describe, expect, it } from "vitest";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  BLEED_MM, MODEL_RULES, STRUCTURE_MODELS, materialThickness, resolveStructure, validatePackagingStructure,
  type ShapeModel, type StructureInput,
} from "@/lib/structure";
import { BLEED_MM as LAYOUT_BLEED, UnsupportedDielineError, flatLayout, resolveFlatLayout } from "@/lib/print/layout";

const ALL_MODELS: ShapeModel[] = [
  "box", "mailer", "rigid", "pillow", "tray", "bottle", "wine", "dropper", "pump", "spray", "jug",
  "jar", "tin", "tub", "pouch", "flatpouch", "sachet", "bag", "shopper", "tube", "papertube", "can", "cup", "carton",
  "pizza", "clamshell", "display", "moulded", "paperbag", "papertub",
];
// The gable-top carton (2C-4A), the rigid box (2C-4B), the postal mailer (2C-4C), the tray (2C-4D) and the film bags (2C-4E) have real templates.
const UNSUPPORTED: ShapeModel[] = ["pizza", "clamshell", "display", "moulded", "paperbag", "papertub", "jug", "shopper", "pillow", "cup"];

const input = (model: ShapeModel): StructureInput => ({ model, lengthMm: 70, widthMm: 50, heightMm: 160, material: "Carton couché 350g" });
const allNumbers = (v: unknown, out: number[] = []): number[] => {
  if (typeof v === "number") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allNumbers(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allNumbers(x, out));
  return out;
};

describe("resolveStructure — les 30 modèles", () => {
  it("couvre exactement les 30 ShapeModel", () => {
    expect([...STRUCTURE_MODELS].sort()).toEqual([...ALL_MODELS].sort());
  });

  it.each(ALL_MODELS)("%s : structure valide, finie, déterministe, entrée non mutée", (model) => {
    const shape = input(model);
    const before = structuredClone(shape);
    const a = resolveStructure(shape);
    expect(shape).toEqual(before);
    expect(resolveStructure(shape)).toEqual(a);
    expect(a.model).toBe(model);
    expect(a.outerMm).toEqual({ L: 70, W: 50, H: 160 });
    expect(["dieline", "profile", "flexible"]).toContain(a.family);
    expect(["supported", "unsupported"]).toContain(a.dieline);
    expect(a.printSurfaces.length).toBeGreaterThan(0);
    expect(new Set(a.printSurfaces.map((s) => s.id)).size).toBe(a.printSurfaces.length);
    expect(a.bleedMm).toBe(BLEED_MM);
    for (const n of allNumbers(a)) expect(Number.isFinite(n)).toBe(true);
    expect(validatePackagingStructure(a)).toEqual([]);
  });

  it("familles : cartons en dieline, contenants rigides en profil, sachets et sacs en souple", () => {
    for (const m of ["box", "mailer", "rigid", "pillow", "tray", "carton", "pizza", "clamshell", "display", "moulded"] as ShapeModel[]) expect(resolveStructure(input(m)).family).toBe("dieline");
    for (const m of ["bottle", "wine", "dropper", "pump", "spray", "jug", "jar", "tin", "tub", "papertub", "tube", "papertube", "can", "cup"] as ShapeModel[]) {
      const s = resolveStructure(input(m));
      expect(s.family).toBe("profile");
      expect(s.profile?.sectionMm).toEqual({ L: 70, W: 50 });
    }
    for (const m of ["pouch", "flatpouch", "sachet", "bag", "paperbag", "shopper"] as ShapeModel[]) expect(resolveStructure(input(m)).family).toBe("flexible");
  });

  it("toutes les formes du catalogue se résolvent sans erreur", () => {
    for (const [id, , , model, L, W, H, material] of SHAPE_ROWS) {
      const s = resolveStructure({ model, lengthMm: L, widthMm: W, heightMm: H, material });
      expect(validatePackagingStructure(s), id).toEqual([]);
    }
  });
});

describe("faux patrons refusés (non-régression critique)", () => {
  it.each(UNSUPPORTED)("%s : unsupported, sans gabarit, et flatLayout refuse au lieu d'inventer un étui", (model) => {
    const s = resolveStructure(input(model));
    expect(s.dieline).toBe("unsupported");
    expect(s.dielineNote).toMatch(/patron/i);
    expect(s.cut).toBeUndefined();
    expect(s.panels).toBeUndefined();
    expect(s.template).toBeUndefined();
    expect(() => flatLayout(input(model))).toThrow(UnsupportedDielineError);
    const r = resolveFlatLayout(input(model));
    expect(r.supported).toBe(false);
    if (!r.supported) expect(r.message).toBe(s.dielineNote);
  });

  it("aucun modèle non supporté ne retombe sur le gabarit d'étui à rabats", () => {
    for (const m of ALL_MODELS) {
      const s = resolveStructure(input(m));
      if (s.template === "tuckEndBox") expect(m).toBe("box");
    }
  });
});

describe("compatibilité layout.ts (adaptateur)", () => {
  const supported = ALL_MODELS.filter((m) => !UNSUPPORTED.includes(m));

  it.each(supported)("%s : FlatLayout complet, panneaux reliés aux surfaces", (model) => {
    const s = resolveStructure(input(model));
    const l = flatLayout(input(model));
    expect(l.width).toBe(s.flatMm!.width);
    expect(l.height).toBe(s.flatMm!.height);
    expect(l.cut.length).toBeGreaterThanOrEqual(4);
    expect(l.panels.length).toBeGreaterThan(0);
    for (const n of allNumbers(l)) expect(Number.isFinite(n)).toBe(true);
    for (const p of l.panels) {
      expect(p.w).toBeGreaterThan(0);
      expect(p.h).toBeGreaterThan(0);
      const surf = s.printSurfaces.find((x) => x.id === p.surfaceId)!;
      expect(surf).toBeDefined();
      const windows = l.panels.filter((x) => x.surfaceId === p.surfaceId);
      if (windows.length > 1) {
        // one surface over several panels (2C-4E-2, film bag back): the windows add up to the surface
        expect(windows.reduce((w, x) => w + x.w, 0)).toBeCloseTo(surf.wMm, 9);
        expect(p.h).toBeCloseTo(surf.hMm, 9);
      } else expect(p.quarterTurn ? [p.h, p.w] : [p.w, p.h]).toEqual([surf.wMm, surf.hMm]);
      expect(p.x + p.w).toBeLessThanOrEqual(l.width + 1e-9);
      expect(p.y + p.h).toBeLessThanOrEqual(l.height + 1e-9);
    }
    expect(LAYOUT_BLEED).toBe(3);
  });

  it("étui (NOCTA, 70×70×130) : même patron qu'avant la migration", () => {
    const l = flatLayout({ model: "box", lengthMm: 70, widthMm: 70, heightMm: 130 });
    // glue = min(15, 70·0.35) = 15 ; tuck = min(15, 70·0.45) = 15 ; flat = glue + 2L + 2W
    expect(l.width).toBe(15 + 70 * 4);
    expect(l.height).toBe(70 + 15 + 130 + 70 + 15);
    expect(l.panels.map((p) => [p.kind, p.label, p.flip ?? false])).toEqual([
      ["back", "Dos", false], ["side", "Côté gauche", false], ["front", "Face avant", false], ["side", "Côté droit", false],
      // 2C-3: the top shows what the 3D shows (brand strip), and the bottom tuck is printed like the 3D bottom.
      ["strip", "Dessus", true], ["plain", "Fond", false],
    ]);
    expect(l.panels.map((p) => p.surfaceId)).toEqual(["back", "left", "front", "right", "top", "bottom"]);
    expect(l.kindLabel).toBe("Étui à rabats inversés (4 faces + rabats)");
  });

  it("étiquettes et sachets : identifiants de surface stables", () => {
    expect(resolveStructure(input("bottle")).printSurfaces.map((s) => s.id)).toEqual(["label"]);
    expect(resolveStructure(input("can")).printSurfaces.map((s) => s.id)).toEqual(["wrap"]);
    expect(resolveStructure(input("pouch")).printSurfaces.map((s) => s.id)).toEqual(["front", "back", "gusset"]);
    expect(resolveStructure(input("sachet")).printSurfaces.map((s) => s.id)).toEqual(["front", "back"]);
    expect(flatLayout(input("can")).panels[0]).toMatchObject({ kind: "wrap", frontFraction: 0.3 });
  });
});

describe("matière, épaisseur, zone sûre", () => {
  it("épaisseur lue dans le nom de la matière, sinon valeur nominale déclarée comme telle", () => {
    expect(materialThickness("Carton rigide 1,5 mm")).toEqual({ thicknessMm: 1.5, thicknessSource: "material-name" });
    expect(materialThickness("Carton rigide 2 mm").thicknessMm).toBe(2);
    expect(materialThickness("Carton couché 350g").thicknessSource).toBe("default");
    expect(materialThickness("Carton ondulé E").thicknessMm).toBeGreaterThan(materialThickness("Carton couché 350g").thicknessMm);
    expect(materialThickness("").thicknessMm).toBeGreaterThan(0);
  });

  it("zone sûre bornée sur les petites surfaces", () => {
    const s = resolveStructure({ model: "box", lengthMm: 8, widthMm: 6, heightMm: 10 });
    for (const p of s.printSurfaces) expect(p.safeMm).toBeLessThanOrEqual(Math.min(p.wMm, p.hMm) / 4);
  });

  it("règles explicites pour chaque modèle (fermeture, constructeur de profil)", () => {
    for (const m of ALL_MODELS) expect(MODEL_RULES[m].closure).toBeTruthy();
    expect(resolveStructure(input("wine")).closure).toEqual({ kind: "capsule" });
    expect(resolveStructure(input("pump")).profile?.builder).toBe("bottle");
  });

  it("résolution rapide (< 2 ms par structure en moyenne)", () => {
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) for (const m of ALL_MODELS) resolveStructure(input(m));
    expect((performance.now() - t0) / (200 * ALL_MODELS.length)).toBeLessThan(2);
  });
});

describe("validatePackagingStructure", () => {
  it("détecte dimensions invalides, ids dupliqués, références cassées", () => {
    const s = resolveStructure(input("box"));
    expect(validatePackagingStructure({ ...s, outerMm: { L: 0, W: 1, H: Number.NaN } }).length).toBeGreaterThanOrEqual(2);
    expect(validatePackagingStructure({ ...s, printSurfaces: [...s.printSurfaces, s.printSurfaces[0]] })).toContain(`duplicate surface id "${s.printSurfaces[0].id}"`);
    expect(validatePackagingStructure({ ...s, hinges: [{ id: "h", from: "front", to: "nope", line: [[0, 0], [1, 0]], fold: "valley", foldedAngleDeg: 90 }] })).toContain('hinge "h": unknown panel');
    expect(validatePackagingStructure({ ...s, rootPanel: "nope" })).toContain('rootPanel "nope" is not a panel');
  });
});
