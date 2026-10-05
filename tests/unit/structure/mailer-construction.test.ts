/**
 * Phase 2C-4C-0: reference construction of the postal mailer (roll end tuck front, FEFCO 0427 type),
 * shared by the structure (assembly, print surfaces) and the 3D. Its flat sheet: mailer-dieline.test.ts.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  MAILER_RULES, boxParts, mailerDims, materialThickness, resolveStructure, validatePackagingStructure,
  type AssemblyPart, type PackagingStructure, type Vec3,
} from "@/lib/structure";

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));
const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

const row = (id: string) => SHAPE_ROWS.find((r) => r[0] === id)!;
const POSTAL = ["ecom-mailer", "mailer-small", "mailer-large", "subscription-box"].map((id) => {
  const r = row(id);
  return [id, r[4], r[5], r[6], r[7]] as const;
});
const resolve = (L: number, W: number, H: number, m: string) => resolveStructure({ model: "mailer", lengthMm: L, widthMm: W, heightMm: H, material: m });
const P = (s: PackagingStructure, id: string) => s.assembly!.parts.find((p) => p.id === id)!;
const EPS = 1e-9;
/** Volume shared by two parts (0 = they touch at most). */
const overlap = (a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }) =>
  [0, 1, 2].reduce((v, i) => v * Math.max(0, Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i])), 1);
const inBox = (p: Vec3, b: AssemblyPart) => [0, 1, 2].every((i) => p[i] >= b.min[i] - EPS && p[i] <= b.max[i] + EPS);
const onFace = (p: Vec3, b: AssemblyPart) => inBox(p, b) && [0, 1, 2].some((i) => Math.abs(p[i] - b.min[i]) < EPS || Math.abs(p[i] - b.max[i]) < EPS);
/** Quarter turns of the lid about the hinge axis (x-parallel line at hinge y, z), opening up and back. */
function openLid(p: AssemblyPart, y0: number, z0: number, quarter: 1 | 2): AssemblyPart {
  const tr = ([x, y, z]: Vec3): Vec3 => {
    const dy = y - y0, dz = z - z0;
    return quarter === 1 ? [x, y0 + dz, z0 - dy] : [x, y0 - dy, z0 - dz];
  };
  const a = tr(p.min), b = tr(p.max);
  return { ...p, min: [0, 1, 2].map((i) => Math.min(a[i], b[i])) as Vec3, max: [0, 1, 2].map((i) => Math.max(a[i], b[i])) as Vec3 };
}

describe("catalogue : quels modèles sont des boîtes postales", () => {
  it("construction A (boîte postale à rabat d'insertion) : les 4 boîtes postales, et elles seules", () => {
    expect(SHAPE_ROWS.filter((r) => r[3] === "mailer").map((r) => r[0])).toEqual(POSTAL.map((r) => r[0]));
  });

  it("pizza et burger : modèles propres, NON convertis en boîte postale (bloc fermé inchangé, non supportés)", () => {
    for (const [id, model] of [["pizza-box", "pizza"], ["burger-box", "clamshell"]] as const) {
      const [, , , m, L, W, H, mat] = row(id);
      expect(m).toBe(model);
      const s = resolveStructure({ model, lengthMm: L, widthMm: W, heightMm: H, material: mat });
      expect(s.assembly).toBeUndefined();
      expect(s.closure).toEqual({ kind: "none" });
      expect(s.dieline).toBe("unsupported");
      // same block and surfaces as the former "mailer"
      const [part] = boxParts(model, L, W, H);
      expect(boxParts(model, L, W, H).length).toBe(1);
      expect(part.radius).toBeCloseTo(Math.min(L, W, H) * 0.02, 9);
      expect(s.printSurfaces.map((x) => [x.id, x.draw.kind, x.wMm, x.hMm])).toEqual(part.faces.map((f) => [f.id, f.kind, f.wMm, f.hMm]));
    }
  });
});

describe.each(POSTAL)("boîte postale %s (%d × %d × %d, %s)", (_id, L, W, H, m) => {
  const s = resolve(L, W, H, m);
  const t = materialThickness(m).thicknessMm;
  const d = mailerDims(L, W, H, t);
  const parts = s.assembly!.parts;

  it("structure valide, fermeture par rabat d'insertion (patron : mailer-dieline.test.ts, 2C-4C)", () => {
    expect(validatePackagingStructure(s)).toEqual([]);
    expect(s.closure).toEqual({ kind: "tuck" });
    expect(s.material.thicknessMm).toBe(t);
  });

  it("dimensions : L × W × H catalogue = encombrement extérieur exact ; intérieur = extérieur − parois", () => {
    const min = [0, 1, 2].map((i) => Math.min(...parts.map((p) => p.min[i])));
    const max = [0, 1, 2].map((i) => Math.max(...parts.map((p) => p.max[i])));
    expect(min).toEqual([-L / 2, 0, -W / 2]);
    expect(max).toEqual([L / 2, H, W / 2]);
    expect([d.innerL, d.innerW, d.innerH]).toEqual([L - 6 * t, W - 3 * t, H - 2 * t]);
    // inner space really free: between the inner returns, back wall and front return, bottom and lid
    expect(P(s, "right-inner").min[0] - P(s, "left-inner").max[0]).toBeCloseTo(d.innerL, 9);
    expect(P(s, "front-inner").min[2] - P(s, "back").max[2]).toBeCloseTo(d.innerW, 9);
    expect(P(s, "top").min[1] - P(s, "bottom").max[1]).toBeCloseTo(d.innerH, 9);
    for (const p of parts) for (const v of [...p.min, ...p.max]) expect(Number.isFinite(v)).toBe(true);
  });

  it("carton : chaque pièce a l'épaisseur de la matière ; aucune pièce n'en traverse une autre", () => {
    for (const p of parts) expect(Math.min(...[0, 1, 2].map((i) => p.max[i] - p.min[i]))).toBeCloseTo(t, 9);
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      expect(overlap(parts[i], parts[j]), `${parts[i].id} ∩ ${parts[j].id}`).toBeLessThan(1e-9);
    }
  });

  it("une seule feuille : les plis relient toutes les pièces en un arbre depuis le fond", () => {
    const folds = s.assembly!.folds;
    expect(folds.length).toBe(parts.length - 1);
    const seen = new Set(["bottom"]);
    for (let k = 0; k < parts.length; k++) for (const f of folds) if (seen.has(f.from)) seen.add(f.to);
    expect([...seen].sort()).toEqual(parts.map((p) => p.id).sort());
    expect(new Set(folds.map((f) => f.to)).size).toBe(folds.length); // each part has one parent
  });

  it("plis à 90° : l'arête est commune aux deux pièces ; plis roulés à 180° : doubles parois jusqu'en haut", () => {
    for (const f of s.assembly!.folds) {
      const a = P(s, f.from), b = P(s, f.to);
      if (f.angleDeg === 90) {
        for (const pt of f.edge) {
          expect(onFace(pt, a), `${f.id} sur ${a.id}`).toBe(true);
          expect(onFace(pt, b), `${f.id} sur ${b.id}`).toBe(true);
        }
      } else {
        // rolled double wall: both layers reach the top, parallel, at most one layer (the ear) between them
        expect(a.max[1]).toBe(H);
        expect(b.max[1]).toBe(H);
        const axis = [0, 2].find((i) => Math.abs(a.max[i] - a.min[i] - t) < EPS)!;
        expect(Math.abs(b.max[axis] - b.min[axis] - t)).toBeLessThan(EPS);
        const gap = Math.max(a.min[axis], b.min[axis]) - Math.min(a.max[axis], b.max[axis]);
        expect(gap).toBeGreaterThanOrEqual(-EPS);
        expect(gap).toBeLessThanOrEqual(t + EPS);
      }
    }
  });

  it("charnière : une seule, entre le haut du dos et l'arrière du couvercle ; le couvercle s'ouvre sans traverser le fond", () => {
    const hinges = s.assembly!.folds.filter((f) => f.hinge);
    expect(hinges.map((f) => [f.from, f.to])).toEqual([["back", "top"]]);
    const [p0, p1] = hinges[0].edge;
    expect([p0[1], p0[2], p1[1], p1[2]]).toEqual([H - t, -W / 2, H - t, -W / 2]); // back top edge
    expect(parts.filter((p) => p.group === "lid").map((p) => p.id).sort()).toEqual(["dust-left", "dust-right", "top", "tuck"]);
    const base = parts.filter((p) => p.group === "base");
    for (const q of [1, 2] as const) {
      for (const lid of parts.filter((p) => p.group === "lid").map((p) => openLid(p, H - t, -W / 2, q))) {
        for (const b of base) expect(overlap(lid, b), `ouvert ${q * 90}° : ${lid.id} ∩ ${b.id}`).toBeLessThan(1e-9);
      }
    }
  });

  it("rabat d'insertion : sous l'avant du couvercle, derrière la double paroi avant, profondeur = paramètre", () => {
    const tuck = P(s, "tuck"), fi = P(s, "front-inner"), top = P(s, "top");
    expect(tuck.max[1]).toBe(top.min[1]);
    expect(tuck.max[2]).toBe(top.max[2]);
    expect(tuck.max[2]).toBe(fi.min[2]); // against the inner return of the front
    expect(tuck.max[1] - tuck.min[1]).toBeCloseTo(MAILER_RULES.tuck * d.innerH, 9);
    expect(tuck.min[1]).toBeGreaterThan(P(s, "bottom").max[1]); // stops above the bottom
    for (const n of ["left", "right"]) {
      const dust = P(s, `dust-${n}`), inner = P(s, `${n}-inner`);
      expect(dust.max[1] - dust.min[1]).toBeCloseTo(MAILER_RULES.dust * d.innerH, 9);
      expect(n === "left" ? dust.min[0] - inner.max[0] : inner.min[0] - dust.max[0]).toBeCloseTo(0, 9); // inside the side wall
    }
  });

  it("côtés : doubles parois (extérieur + oreilles + retour) ; oreilles avant/arrière sans se croiser", () => {
    for (const n of ["left", "right"]) {
      const front = P(s, `ear-front-${n}`), back = P(s, `ear-back-${n}`);
      expect(front.min[2] - back.max[2]).toBeGreaterThan(0);
      expect(front.max[2] - front.min[2]).toBeCloseTo(MAILER_RULES.ear * (W - 2 * t), 9);
      const layers = [n, `ear-front-${n}`, `${n}-inner`].map((id) => P(s, id));
      const xs = layers.map((p) => p.min[0]);
      expect(n === "left" ? xs : xs.reverse()).toEqual([...xs].sort((u, v) => u - v)); // outer → ear → inner
    }
  });

  it("surfaces : les 6 faces extérieures (mêmes ids qu'avant), chacune sur la face extérieure d'une pièce, à sa taille", () => {
    expect(s.printSurfaces.map((x) => [x.id, x.draw.kind, x.printable])).toEqual([
      ["right", "plain", true], ["left", "plain", true], ["top", "top", true], ["bottom", "plain", true], ["front", "strip", true], ["back", "back", true],
    ]);
    const axis = { x: 0, y: 1, z: 2 } as const;
    for (const surf of s.printSurfaces) {
      const owners = parts.filter((p) => p.surface?.id === surf.id);
      expect(owners.length).toBe(1);
      const p = owners[0], face = p.surface!.face, i = axis[face[1] as "x" | "y" | "z"];
      // the printed face IS on the outside of the closed box
      expect(face[0] === "+" ? p.max[i] : p.min[i]).toBe(face[0] === "+" ? [L / 2, H, W / 2][i] : [-L / 2, 0, -W / 2][i]);
      expect(surf.placement).toEqual({ part: p.group, face });
    }
    expect([P(s, "front"), P(s, "top")].map((p) => p.surface!.id)).toEqual(["front", "top"]);
    const top = s.printSurfaces.find((x) => x.id === "top")!;
    expect([top.wMm, top.hMm]).toEqual([L - 6 * t, W - 2 * t]);
  });

  it("3D : une pièce = un maillage à la taille de la pièce ; texture sur la seule face extérieure imprimée, UV à l'endroit", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model: "mailer", lengthMm: L, widthMm: W, heightMm: H, material: m }, design);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes.map((x) => x.name).sort()).toEqual(parts.map((p) => `mailer:${p.id}`).sort());
    const textured: string[] = [];
    const FACES = ["+x", "-x", "+y", "-y", "+z", "-z"];
    for (const p of parts) {
      const me = meshes.find((x) => x.name === `mailer:${p.id}`)!;
      me.geometry.computeBoundingBox();
      const bb = me.geometry.boundingBox!;
      for (let i = 0; i < 3; i++) {
        expect(bb.min.getComponent(i)).toBeCloseTo(p.min[i], 4);
        expect(bb.max.getComponent(i)).toBeCloseTo(p.max[i], 4);
      }
      const mats = me.material as THREE.MeshStandardMaterial[];
      mats.forEach((mt, gi) => {
        if (!mt.map) return;
        expect(FACES[gi]).toBe(p.surface!.face); // only the printed face carries artwork
        const surf = s.printSurfaces.find((x) => x.id === p.surface!.id)!;
        expect(mt.userData.surfaceId).toBe(surf.id);
        expect(mt.map.userData.mm).toEqual([surf.wMm, surf.hMm]);
        textured.push(surf.id);
        // UV: v grows towards the artwork's top, u towards its right, seen from outside.
        const g = me.geometry, gr = g.groups[gi], pos = g.getAttribute("position"), uv = g.getAttribute("uv"), idx = g.index!;
        const corner = (pick: (u: number, v: number) => number) => {
          let best = -Infinity, at = new THREE.Vector3();
          for (let k = gr.start; k < gr.start + gr.count; k++) {
            const vi = idx.getX(k), sc = pick(uv.getX(vi), uv.getY(vi));
            if (sc > best) { best = sc; at = new THREE.Vector3().fromBufferAttribute(pos as THREE.BufferAttribute, vi); }
          }
          return at;
        };
        const up = corner((_u, v) => v).sub(corner((_u, v) => -v)), right = corner((u) => u).sub(corner((u) => -u));
        const dir = (v: THREE.Vector3) => [v.x, v.y, v.z].map((c) => Math.sign(Math.round(c * 1e6)));
        const EXPECT: Record<string, { up: number[]; right: number[] }> = {
          "+z": { up: [0, 1, 0], right: [1, 0, 0] }, "-z": { up: [0, 1, 0], right: [-1, 0, 0] },
          "+x": { up: [0, 1, 0], right: [0, 0, -1] }, "-x": { up: [0, 1, 0], right: [0, 0, 1] },
          "+y": { up: [0, 0, -1], right: [1, 0, 0] }, "-y": { up: [0, 0, 1], right: [1, 0, 0] },
        };
        expect(dir(up), `${surf.id} haut`).toEqual(EXPECT[p.surface!.face].up);
        expect(dir(right), `${surf.id} droite`).toEqual(EXPECT[p.surface!.face].right);
      });
    }
    expect(textured.sort()).toEqual(s.printSurfaces.filter((x) => x.printable).map((x) => x.id).sort()); // no orphan, no duplicate
  });
});

describe("épaisseur du carton ondulé", () => {
  it("cannelure B = 3 mm nominal (était 1,5) ; E et ondulé sans lettre inchangés (1,5)", () => {
    expect(materialThickness("Carton ondulé B")).toEqual({ thicknessMm: 3, thicknessSource: "default" });
    expect(materialThickness("Carton ondulé E")).toEqual({ thicknessMm: 1.5, thicknessSource: "default" });
    expect(materialThickness("Carton ondulé")).toEqual({ thicknessMm: 1.5, thicknessSource: "default" });
    expect(materialThickness("Carton rigide 2 mm")).toEqual({ thicknessMm: 2, thicknessSource: "material-name" });
  });

  it("la Grande boîte postale (ondulé B) a des parois de 3 mm, les autres de 1,5 mm", () => {
    for (const [id, L, W, H, m] of POSTAL) {
      const s = resolve(L, W, H, m);
      expect(P(s, "front").max[2] - P(s, "front").min[2], id).toBe(id === "mailer-large" ? 3 : 1.5);
    }
  });
});

describe("validation de l'assemblage", () => {
  it("refuse pièce dupliquée, surface inconnue, pli vers une pièce absente, deux charnières", () => {
    const s = resolve(220, 160, 60, "Carton ondulé E");
    const bad = structuredClone(s);
    bad.assembly!.parts.push({ ...bad.assembly!.parts[0] });
    bad.assembly!.parts[1] = { ...bad.assembly!.parts[1], surface: { id: "nope", face: "+z" } };
    bad.assembly!.folds.push({ id: "x", from: "bottom", to: "ghost", edge: [[0, 0, 0], [1, 0, 0]], angleDeg: 90, hinge: true });
    const errors = validatePackagingStructure(bad).join("\n");
    expect(errors).toMatch(/duplicate assembly part "bottom"/);
    expect(errors).toMatch(/unknown surface "nope"/);
    expect(errors).toMatch(/fold "x": unknown part/);
    expect(errors).toMatch(/more than one hinge/);
  });
});

describe("non-régression des autres familles", () => {
  it("bouteille, tube, pot, canette, sachet, brique, coffret, étui : pas d'assemblage, statut et fermeture inchangés", () => {
    const cases: [string, string, PackagingStructure["closure"]][] = [
      ["sauce-bottle", "supported", { kind: "cap" }], ["squeeze-tube", "supported", { kind: "cap" }],
      ["milk-carton", "supported", { kind: "none" }], ["luxury-rigid-box", "supported", { kind: "none" }],
    ];
    for (const [id, status, closure] of cases) {
      const r = row(id);
      if (!r) continue;
      const s = resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(s.assembly, id).toBeUndefined();
      expect(s.dieline, id).toBe(status);
      expect(s.closure, id).toEqual(closure);
    }
    for (const model of ["bottle", "tube", "jar", "can", "sachet", "carton", "rigid", "box"] as const) {
      const s = resolveStructure({ model, lengthMm: 70, widthMm: 50, heightMm: 160, material: "Carton couché 350g" });
      expect(s.assembly, model).toBeUndefined();
      expect(s.dieline, model).toBe("supported");
    }
  });
});
