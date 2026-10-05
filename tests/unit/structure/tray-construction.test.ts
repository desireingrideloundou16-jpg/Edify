/**
 * Phase 2C-4D-1: reference construction of the food tray ("barquette"): open rectangular tray with
 * glued corners, shared by the structure (assembly, print surfaces) and the 3D. Flat sheet: tray-dieline.test.ts.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { boxParts, materialThickness, resolveStructure, trayDims, validatePackagingStructure, type AssemblyPart, type PackagingStructure, type Vec3 } from "@/lib/structure";
import { resolveFlatLayout } from "@/lib/print/layout";

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));
const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

const row = (id: string) => SHAPE_ROWS.find((r) => r[0] === id)!;
const [, , , MODEL, L, W, H, MAT] = row("food-tray");
const s = resolveStructure({ model: MODEL, lengthMm: L, widthMm: W, heightMm: H, material: MAT });
const parts = s.assembly!.parts;
const P = (id: string) => parts.find((p) => p.id === id)!;
const t = materialThickness(MAT).thicknessMm;
const EPS = 1e-9;
const overlap = (a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }) =>
  [0, 1, 2].reduce((v, i) => v * Math.max(0, Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i])), 1);
const inBox = (p: Vec3, b: AssemblyPart) => [0, 1, 2].every((i) => p[i] >= b.min[i] - EPS && p[i] <= b.max[i] + EPS);
const onFace = (p: Vec3, b: AssemblyPart) => inBox(p, b) && [0, 1, 2].some((i) => Math.abs(p[i] - b.min[i]) < EPS || Math.abs(p[i] - b.max[i]) < EPS);
const WALLS = ["front", "back", "left", "right"];

describe("barquette (food-tray) : construction de référence", () => {
  it("1. résout vers la construction plateau : modèle tray, famille dieline, assemblage présent, valide", () => {
    expect(MODEL).toBe("tray");
    expect(s.family).toBe("dieline");
    expect(s.assembly).toBeDefined();
    expect(s.closure).toEqual({ kind: "none" });
    expect(validatePackagingStructure(s)).toEqual([]);
    expect(SHAPE_ROWS.filter((r) => r[3] === "tray").map((r) => r[0])).toEqual(["food-tray"]); // the only tray
  });

  it("2. dimensions : 180 × 120 × 40 = encombrement extérieur exact (x = L, y = H, z = W) ; intérieur < extérieur", () => {
    expect([L, W, H]).toEqual([180, 120, 40]);
    const min = [0, 1, 2].map((i) => Math.min(...parts.map((p) => p.min[i])));
    const max = [0, 1, 2].map((i) => Math.max(...parts.map((p) => p.max[i])));
    expect(min).toEqual([-L / 2, 0, -W / 2]);
    expect(max).toEqual([L / 2, H, W / 2]);
    const d = trayDims(L, W, H, t);
    expect([d.innerL, d.innerW, d.innerH]).toEqual([L - 2 * t, W - 2 * t, H - t]);
    expect(P("right").min[0] - P("left").max[0]).toBeCloseTo(d.innerL, 9);
    expect(P("front").min[2] - P("back").max[2]).toBeCloseTo(d.innerW, 9);
    expect(d.innerL).toBeLessThan(L);
    expect(d.innerW).toBeLessThan(W);
    expect(d.innerH).toBeLessThan(H);
  });

  it("3. plateau ouvert : aucune pièce au-dessus de l'intérieur, rien ne couvre le fond", () => {
    const d = trayDims(L, W, H, t);
    const opening = { min: [-d.innerL / 2, t, -d.innerW / 2] as Vec3, max: [d.innerL / 2, H + 1, d.innerW / 2] as Vec3 };
    // only the corner flaps (glued against the side walls) stand inside the walls, never across the opening
    for (const p of parts) {
      const horizontal = p.max[1] - p.min[1] < 2 * t;
      if (horizontal) expect(p.id).toBe("bottom");
      if (p.id !== "bottom" && !p.id.startsWith("flap-")) expect(overlap(p, opening), p.id).toBeLessThan(EPS);
    }
    expect(parts.filter((p) => p.min[1] >= H - t - EPS && p.max[1] - p.min[1] < 2 * t)).toEqual([]);
    expect(s.closure).toEqual({ kind: "none" });
  });

  it("4. pièces : fond + 4 parois + 4 pattes d'angle, chacune de l'épaisseur du carton, sans interpénétration", () => {
    expect(parts.map((p) => p.id).sort()).toEqual(["back", "bottom", "flap-back-left", "flap-back-right", "flap-front-left", "flap-front-right", "front", "left", "right"]);
    for (const p of parts) expect(Math.min(...[0, 1, 2].map((i) => p.max[i] - p.min[i]))).toBeCloseTo(t, 12);
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) expect(overlap(parts[i], parts[j]), `${parts[i].id} ∩ ${parts[j].id}`).toBeLessThan(EPS);
    // bottom horizontal on the floor, walls vertical, full height, standing on the floor
    expect([P("bottom").min[1], P("bottom").max[1]]).toEqual([0, t]);
    for (const w of WALLS) {
      expect(P(w).max[1] - P(w).min[1]).toBe(H);
      expect(P(w).min[1]).toBe(0);
    }
  });

  it("5. plis : les 4 plis principaux sur les arêtes du fond, plus un pli par patte ; un arbre depuis le fond", () => {
    const folds = s.assembly!.folds;
    for (const w of WALLS) {
      const f = folds.find((x) => x.from === "bottom" && x.to === w)!;
      expect(f, w).toBeDefined();
      expect(f.angleDeg).toBe(90);
      for (const pt of f.edge) {
        expect(onFace(pt, P("bottom"))).toBe(true);
        expect(onFace(pt, P(w))).toBe(true);
        expect(pt[1]).toBe(0); // bottom edge, on the floor
      }
      const len = Math.hypot(...[0, 1, 2].map((i) => f.edge[1][i] - f.edge[0][i]));
      expect(len).toBeCloseTo(w === "front" || w === "back" ? L - 2 * t : W - 2 * t, 9); // the bottom's edge length
    }
    expect(folds.length).toBe(parts.length - 1);
    const seen = new Set(["bottom"]);
    for (let k = 0; k < parts.length; k++) for (const f of folds) if (seen.has(f.from)) seen.add(f.to);
    expect(seen.size).toBe(parts.length);
    expect(folds.some((f) => f.hinge)).toBe(false); // nothing opens: no lid
  });

  it("coins : chaque patte part de l'extrémité de l'avant ou du dos, se replie de 90° et est collée à plat contre l'intérieur du côté", () => {
    const d = trayDims(L, W, H, t);
    for (const w of ["front", "back"]) for (const n of ["left", "right"]) {
      const flap = P(`flap-${w}-${n}`), side = P(n);
      const fold = s.assembly!.folds.find((f) => f.to === flap.id)!;
      expect(fold.from).toBe(w);
      for (const pt of fold.edge) {
        expect(onFace(pt, P(w))).toBe(true);
        expect(onFace(pt, flap)).toBe(true);
      }
      expect(flap.glueTo).toBe(n);
      expect(n === "left" ? flap.min[0] - side.max[0] : side.min[0] - flap.max[0]).toBeCloseTo(0, 12); // against the inner face
      expect(flap.max[2] - flap.min[2]).toBeCloseTo(d.flap, 12);
      expect(flap.min[1]).toBe(t); // stands on the bottom
      expect(flap.surface).toBeUndefined(); // hidden by the side wall: not printed
    }
    // front and back flaps of one side never meet
    for (const n of ["left", "right"]) expect(P(`flap-front-${n}`).min[2] - P(`flap-back-${n}`).max[2]).toBeGreaterThan(0);
  });

  it("6-7. surfaces : plus de faux dessus ; front, back, left, right, bottom = faces extérieures réelles, à leur taille", () => {
    expect(s.printSurfaces.map((x) => [x.id, x.draw.kind, x.printable])).toEqual([
      ["right", "side", true], ["left", "side", true], ["bottom", "plain", true], ["front", "front", true], ["back", "back", true],
    ]);
    expect(s.printSurfaces.some((x) => x.id === "top")).toBe(false);
    const axis = { x: 0, y: 1, z: 2 } as const;
    for (const surf of s.printSurfaces) {
      const owners = parts.filter((p) => p.surface?.id === surf.id);
      expect(owners.length).toBe(1);
      const p = owners[0], face = p.surface!.face, i = axis[face[1] as "x" | "y" | "z"];
      expect(face[0] === "+" ? p.max[i] : p.min[i]).toBe(face[0] === "+" ? [L / 2, H, W / 2][i] : [-L / 2, 0, -W / 2][i]); // outside
    }
    const size = (id: string) => { const x = s.printSurfaces.find((q) => q.id === id)!; return [x.wMm, x.hMm]; };
    expect(size("front")).toEqual([L - 2 * t, H]);
    expect(size("back")).toEqual([L - 2 * t, H]);
    expect(size("left")).toEqual([W, H]);
    expect(size("bottom")).toEqual([L - 2 * t, W - 2 * t]);
  });

  it("8. 3D : un maillage par pièce, ouvert en haut, texture sur la seule face extérieure, UV à l'endroit, intérieur en carton uni", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model: "tray", lengthMm: L, widthMm: W, heightMm: H, material: MAT }, design);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes.map((x) => x.name).sort()).toEqual(parts.map((p) => `tray:${p.id}`).sort());
    const FACES = ["+x", "-x", "+y", "-y", "+z", "-z"];
    const EXPECT: Record<string, { up: number[]; right: number[] }> = {
      "+z": { up: [0, 1, 0], right: [1, 0, 0] }, "-z": { up: [0, 1, 0], right: [-1, 0, 0] },
      "+x": { up: [0, 1, 0], right: [0, 0, -1] }, "-x": { up: [0, 1, 0], right: [0, 0, 1] },
      "-y": { up: [0, 0, 1], right: [1, 0, 0] },
    };
    const textured: string[] = [];
    for (const p of parts) {
      const me = meshes.find((x) => x.name === `tray:${p.id}`)!;
      me.geometry.computeBoundingBox();
      const bb = me.geometry.boundingBox!;
      for (let i = 0; i < 3; i++) {
        expect(bb.min.getComponent(i)).toBeCloseTo(p.min[i], 4);
        expect(bb.max.getComponent(i)).toBeCloseTo(p.max[i], 4);
      }
      (me.material as THREE.MeshStandardMaterial[]).forEach((mt, gi) => {
        if (!mt.map) return;
        expect(FACES[gi]).toBe(p.surface!.face);
        const surf = s.printSurfaces.find((x) => x.id === p.surface!.id)!;
        expect(mt.userData.surfaceId).toBe(surf.id);
        expect(mt.map.userData.mm).toEqual([surf.wMm, surf.hMm]); // same mm scale as the print
        textured.push(surf.id);
        const g = me.geometry, gr = g.groups[gi], pos = g.getAttribute("position"), uv = g.getAttribute("uv");
        const corner = (pick: (u: number, v: number) => number) => {
          let best = -Infinity, at = new THREE.Vector3();
          for (let k = gr.start; k < gr.start + gr.count; k++) {
            const vi = g.index ? g.index.getX(k) : k, sc = pick(uv.getX(vi), uv.getY(vi));
            if (sc > best) { best = sc; at = new THREE.Vector3().fromBufferAttribute(pos as THREE.BufferAttribute, vi); }
          }
          return at;
        };
        const dir = (v: THREE.Vector3) => [v.x, v.y, v.z].map((c) => Math.sign(Math.round(c * 1e6)));
        expect(dir(corner((_u, v) => v).sub(corner((_u, v) => -v))), `${surf.id} haut`).toEqual(EXPECT[p.surface!.face].up);
        expect(dir(corner((u) => u).sub(corner((u) => -u))), `${surf.id} droite`).toEqual(EXPECT[p.surface!.face].right);
        // valid UVs: the whole texture, no NaN
        for (let k = gr.start; k < gr.start + gr.count; k++) {
          const vi = g.index ? g.index.getX(k) : k;
          expect(uv.getX(vi) >= 0 && uv.getX(vi) <= 1 && uv.getY(vi) >= 0 && uv.getY(vi) <= 1).toBe(true);
        }
      });
    }
    expect(textured.sort()).toEqual(s.printSurfaces.map((x) => x.id).sort());
    // nothing above the opening: the highest part tops are the walls and flaps (vertical slabs)
    for (const me of meshes) {
      const p = parts.find((x) => `tray:${x.id}` === me.name)!;
      if (p.max[1] === H) expect(p.max[1] - p.min[1]).toBeGreaterThan(2 * t);
    }
  });

  it("9. épaisseur : celle de la matière (materialThickness), la construction suit la matière", () => {
    expect(t).toBe(materialThickness("Carton alimentaire").thicknessMm);
    const thick = resolveStructure({ model: "tray", lengthMm: L, widthMm: W, heightMm: H, material: "Carton ondulé E" });
    const tb = materialThickness("Carton ondulé E").thicknessMm;
    expect(tb).not.toBe(t);
    const f = thick.assembly!.parts.find((p) => p.id === "front")!;
    expect(f.max[2] - f.min[2]).toBeCloseTo(tb, 12);
    expect(thick.printSurfaces.find((x) => x.id === "front")!.wMm).toBeCloseTo(L - 2 * tb, 12);
  });

  it("patron : développé depuis cet assemblage en 2C-4D-2 (tray-dieline.test.ts)", () => {
    expect(s.dieline).toBe("supported");
    expect(resolveFlatLayout({ model: "tray", lengthMm: L, widthMm: W, heightMm: H, material: MAT }).supported).toBe(true);
  });
});

describe("modèles non concernés", () => {
  const same = (id: string, model: string) => {
    const [, , , m, l, w, h, mat] = row(id);
    expect(m).toBe(model);
    const st = resolveStructure({ model: m, lengthMm: l, widthMm: w, heightMm: h, material: mat });
    expect(st.assembly).toBeUndefined();
    expect(st.dieline).toBe("unsupported");
    // the former block, unchanged: the folding carton block and its six faces
    const [part] = boxParts(m as "display", l, w, h);
    expect(boxParts(m as "display", l, w, h).length).toBe(1);
    expect(st.printSurfaces.map((x) => [x.id, x.draw.kind, x.wMm, x.hMm])).toEqual(part.faces.map((f) => [f.id, f.kind, f.wMm, f.hMm]));
    expect(boxParts(m as "display", l, w, h)).toEqual(boxParts("box", l, w, h));
    return st;
  };
  it("10. boîte à œufs : modèle « moulded », bloc inchangé, toujours non supportée (pulpe moulée)", () => {
    const st = same("egg-carton", "moulded");
    expect(st.dielineNote).toMatch(/moulée/);
    expect(st.material.thicknessMm).toBe(0.45); // not corrected in this phase (dedicated phase)
  });
  it("présentoir comptoir : modèle « display », bloc inchangé, pas transformé en barquette", () => { same("display-box", "display"); });
  it("11-12. pizza et burger : modèles séparés, inchangés", () => {
    for (const [id, m] of [["pizza-box", "pizza"], ["burger-box", "clamshell"]] as const) {
      const [, , , model, l, w, h, mat] = row(id);
      expect(model).toBe(m);
      const st: PackagingStructure = resolveStructure({ model, lengthMm: l, widthMm: w, heightMm: h, material: mat });
      expect(st.assembly).toBeUndefined();
      expect(st.dieline).toBe("unsupported");
    }
  });
  it("13. autres familles : statut et gabarit inchangés", () => {
    const expected: Record<string, string> = {
      "tea-box": "tuckEndBox", "ecom-mailer": "rollEndTuckFront", "luxury-rigid-box": "rigidSetUp", "milk-carton": "gableTop", "sauce-bottle": "wrapLabel",
    };
    for (const [id, tpl] of Object.entries(expected)) {
      const r = row(id);
      expect(resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }).template, id).toBe(tpl);
    }
  });
});
