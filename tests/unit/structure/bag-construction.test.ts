/**
 * Phase 2C-4E-1: reference construction of the film bags with side gussets (rice, gari, pet food,
 * coffee): formed tube (assembly), welds (fin, bottom, top after filling), filled 3D whose film panels
 * are their flat rectangles folded without stretching. No flat web yet (2C-4E-2).
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { bagAssembly, bagDims, bagShape, boxParts, materialThickness, resolveStructure, validatePackagingStructure } from "@/lib/structure";
import { resolveFlatLayout } from "@/lib/print/layout";

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), drawFace: () => {}, drawWrap: () => {} }));
const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

const row = (id: string) => SHAPE_ROWS.find((r) => r[0] === id)!;
const FILM = ["rice-bag", "gari-bag", "pet-food-bag", "coffee-bag-gusset"].map((id) => { const r = row(id); return [id, r[4], r[5], r[6], r[7]] as const; });
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const SURFACES = ["front", "back", "gusset-left", "gusset-right"];

describe("catalogue", () => {
  it("les 4 sacs film partagent le modèle bag ; le sac de farine a son propre modèle (paperbag), inchangé et non supporté", () => {
    expect(SHAPE_ROWS.filter((r) => r[3] === "bag").map((r) => r[0]).sort()).toEqual(FILM.map((r) => r[0]).sort());
    const [, , , m, L, W, H, mat] = row("flour-bag");
    expect(m).toBe("paperbag");
    const s = resolveStructure({ model: m, lengthMm: L, widthMm: W, heightMm: H, material: mat });
    expect(s.assembly).toBeUndefined();
    expect(s.dieline).toBe("unsupported");
    expect(s.dielineNote).toMatch(/fond carré/);
    // the former bag block and surfaces, untouched
    expect(s.printSurfaces.map((x) => [x.id, x.wMm, x.hMm, x.printable])).toEqual(boxParts("paperbag", L, W, H)[0].faces.map((f) => [f.id, f.wMm, f.hMm, f.printable]));
  });
});

describe.each(FILM)("%s (%d × %d × %d, %s)", (_id, L, W, H, m) => {
  const s = resolveStructure({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m });
  const t = materialThickness(m).thicknessMm;
  const d = bagDims(L, W, H, t);
  const parts = s.assembly!.parts;
  const P = (id: string) => parts.find((p) => p.id === id)!;
  const shape = bagShape(L, W, H, t);

  it("A. construction : souple, assemblage, soudure en fermeture, structure valide ; laize développée (bag-dieline.test.ts)", () => {
    expect(s.family).toBe("flexible");
    expect(s.closure).toEqual({ kind: "heatSeal" });
    expect(validatePackagingStructure(s)).toEqual([]);
    expect(s.dieline).toBe("supported");
    expect(resolveFlatLayout({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m }).supported).toBe(true);
  });

  it("C. assemblage : face → soufflets → demi-dos, ailerons soudés (pas un pli), soudures haute et basse", () => {
    expect(parts.map((p) => p.id).sort()).toEqual(["back-left", "back-right", "fin-left", "fin-right", "front", "gusset-left", "gusset-right"]);
    const f = s.assembly!.folds;
    const link = (a: string, b: string) => f.some((x) => x.from === a && x.to === b && x.angleDeg === 90);
    expect(link("front", "gusset-left") && link("gusset-left", "back-left") && link("front", "gusset-right") && link("gusset-right", "back-right")).toBe(true);
    expect(f.length).toBe(parts.length - 1); // one tree from the front
    // longitudinal seal: a weld bond, never a fold
    expect(P("fin-left").bond).toEqual({ to: "fin-right", kind: "weld" });
    expect(f.some((x) => [x.from, x.to].sort().join() === "fin-left,fin-right")).toBe(false);
    expect(Math.abs(P("fin-left").max[0] - P("fin-right").min[0])).toBeLessThan(1e-12); // face to face
    // transverse welds across the whole tube
    const seals = s.assembly!.endSeals!;
    expect(seals.map((x) => [x.id, x.kind, x.edge, x.afterFilling ?? false])).toEqual([["seal-bottom", "weld", "bottom", false], ["seal-top", "weld", "top", true]]);
    for (const e of seals) expect([...e.parts].sort()).toEqual(parts.map((p) => p.id).sort());
    expect([seals[0].widthMm, seals[1].widthMm]).toEqual([d.sealBottom, d.sealTop]);
    // every part: film thickness, the flat length of the web
    for (const p of parts) {
      const ext = [0, 1, 2].map((i) => p.max[i] - p.min[i]);
      expect(Math.min(...ext)).toBeCloseTo(t, 12);
      expect(ext[1]).toBeCloseTo(d.flatH, 9);
    }
  });

  it("B. surfaces : front, back, gusset-left, gusset-right ; plus de top / bottom de boîte ; soudures sans illustration", () => {
    expect(s.printSurfaces.map((x) => x.id)).toEqual(SURFACES);
    for (const surf of s.printSurfaces) {
      expect(surf.printable).toBe(true);
      expect(surf.hMm).toBeCloseTo(d.flatH, 9);
      expect(surf.printArea).toEqual({ x: 0, y: d.sealTop, w: surf.wMm, h: d.flatH - d.sealTop - d.sealBottom });
      // the surface is the outer face of its film part(s), at the same size
      const owners = parts.filter((p) => p.surface?.id === surf.id);
      const width = owners.reduce((w, p) => w + (p.surface!.face[1] === "z" ? p.max[0] - p.min[0] : p.max[2] - p.min[2]), 0);
      expect(width).toBeCloseTo(surf.wMm, 9);
    }
    expect(s.printSurfaces.find((x) => x.id === "front")!.wMm).toBe(L);
    expect(s.printSurfaces.find((x) => x.id === "gusset-left")!.wMm).toBeCloseTo(W - 2 * t, 12);
    expect(s.printSurfaces.some((x) => x.id === "top" || x.id === "bottom" || x.id === "left" || x.id === "right")).toBe(false);
  });

  it("D. 3D : enveloppe = L × W × H, film sans étirement (chaque triangle garde ses longueurs à plat), ouvert en haut", () => {
    // envelope of the film panels; the welded fins lie folded flat on the outside of the back (2 layers)
    const all = shape.panels.filter((p) => !p.plain).flatMap((p) => p.tris.flatMap((tr) => tr.pos));
    for (const f of shape.panels.filter((p) => p.plain)) {
      expect(f.layer! < 0).toBe(true);
      for (const tr of f.tris) for (const q of tr.pos) expect(q[0] >= -1e-9 && q[0] <= d.fin + 1e-9).toBe(true); // beside the back centre
    }
    for (const i of [0, 1, 2]) {
      expect(Math.min(...all.map((p) => p[i]))).toBeCloseTo([-L / 2, 0, -W / 2][i], 9);
      expect(Math.max(...all.map((p) => p[i]))).toBeCloseTo([L / 2, H, W / 2][i], 9);
    }
    for (const p of shape.panels) {
      let area = 0;
      for (const tr of p.tris) {
        for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) expect(dist(tr.pos[i], tr.pos[j])).toBeCloseTo(dist(tr.flat[i], tr.flat[j]), 9);
        const [a, b, c] = tr.flat;
        area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
        for (const q of tr.flat) expect(q[0] >= -1e-9 && q[0] <= p.wMm + 1e-9 && q[1] >= -1e-9 && q[1] <= p.hMm + 1e-9).toBe(true);
      }
      expect(area).toBeCloseTo(p.wMm * p.hMm, 6); // the whole rectangle of film, once
    }
    // open mouth: no film lies across the top — every point at y = H is on the outline (walls), none inside
    const top = all.filter((q) => Math.abs(q[1] - H) < 1e-9);
    expect(top.length).toBeGreaterThan(0);
    for (const q of top) expect(Math.abs(Math.abs(q[0]) - L / 2) < 1e-9 || Math.abs(Math.abs(q[2]) - W / 2) < t + 1e-9).toBe(true);
    // gussets: a real side wall W − 2t wide at x = ±L/2, folded in half inside the bottom weld
    for (const [id, x] of [["gusset-right", L / 2], ["gusset-left", -L / 2]] as const) {
      const g = shape.panels.find((p) => p.surfaceId === id)!;
      const wallPts = g.tris.flatMap((tr) => tr.pos).filter((q) => q[1] > d.sealBottom + d.rise + 1e-9);
      for (const q of wallPts) expect(q[0]).toBeCloseTo(x, 9);
      expect(Math.max(...wallPts.map((q) => q[2])) - Math.min(...wallPts.map((q) => q[2]))).toBeCloseTo(W - 2 * t, 9);
      const sealPts = g.tris.flatMap((tr) => tr.pos).filter((q) => q[1] < d.sealBottom - 1e-9);
      expect(Math.min(...sealPts.map((q) => Math.abs(q[0])))).toBeCloseTo(L / 2 - (W - 2 * t) / 2, 9); // folded in by half its width
    }
  });

  it("E. 3D Three.js : 4 surfaces texturées à leur taille, UV dans [0, 1], à l'endroit, sans miroir", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m }, design);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const textured = meshes.filter((x) => (x.material as THREE.MeshStandardMaterial).map);
    expect(textured.map((x) => (x.material as THREE.MeshStandardMaterial).userData.surfaceId).sort()).toEqual([...SURFACES].sort());
    // expected outward normal and artwork "right" on the walls (seen from outside), artwork up = +y
    const EXPECT: Record<string, { n: number[]; right: number[] }> = {
      front: { n: [0, 0, 1], right: [1, 0, 0] }, back: { n: [0, 0, -1], right: [-1, 0, 0] },
      "gusset-right": { n: [1, 0, 0], right: [0, 0, -1] }, "gusset-left": { n: [-1, 0, 0], right: [0, 0, 1] },
    };
    for (const me of textured) {
      const mt = me.material as THREE.MeshStandardMaterial;
      const surf = s.printSurfaces.find((x) => x.id === mt.userData.surfaceId)!;
      expect(mt.map!.userData.mm).toEqual([surf.wMm, surf.hMm]);
      const g = me.geometry, pos = g.getAttribute("position"), uv = g.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) expect(uv.getX(i) >= -1e-6 && uv.getX(i) <= 1 + 1e-6 && uv.getY(i) >= -1e-6 && uv.getY(i) <= 1 + 1e-6).toBe(true);
      // on the wall triangles: ∂position/∂u and ∂position/∂v (UV gradient), and the face normal
      const wallTop = d.sealBottom + d.rise;
      let checked = 0;
      for (let k = 0; k < pos.count; k += 3) {
        const p = [0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pos as THREE.BufferAttribute, k + j));
        if (p.some((q) => q.y < wallTop - 1e-3)) continue; // float32 positions
        const u = [0, 1, 2].map((j) => uv.getX(k + j)), v = [0, 1, 2].map((j) => uv.getY(k + j));
        const e1 = p[1].clone().sub(p[0]), e2 = p[2].clone().sub(p[0]);
        const du1 = u[1] - u[0], dv1 = v[1] - v[0], du2 = u[2] - u[0], dv2 = v[2] - v[0];
        const r = 1 / (du1 * dv2 - du2 * dv1);
        const dPdu = e1.clone().multiplyScalar(dv2).sub(e2.clone().multiplyScalar(dv1)).multiplyScalar(r);
        const dPdv = e2.clone().multiplyScalar(du1).sub(e1.clone().multiplyScalar(du2)).multiplyScalar(r);
        const n = e1.clone().cross(e2).normalize();
        const sg = (w: THREE.Vector3) => [w.x, w.y, w.z].map((c) => Math.sign(Math.round(c * 1e6)) || 0);
        expect(sg(n), `${surf.id} normale`).toEqual(EXPECT[surf.id].n);
        expect(sg(dPdu), `${surf.id} droite`).toEqual(EXPECT[surf.id].right);
        expect(sg(dPdv), `${surf.id} haut`).toEqual([0, 1, 0]);
        expect(dPdu.length()).toBeCloseTo(surf.wMm, 3); // 1 mm of artwork = 1 mm of film
        expect(dPdv.length()).toBeCloseTo(surf.hMm, 3);
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    }
  });
});

describe("robustesse", () => {
  it("dimensions et matière différentes : même construction, mesures recalculées", () => {
    const a = resolveStructure({ model: "bag", lengthMm: 200, widthMm: 90, heightMm: 330, material: "Film PE" });
    const b = resolveStructure({ model: "bag", lengthMm: 120, widthMm: 50, heightMm: 200, material: "Film PE" });
    const c = resolveStructure({ model: "bag", lengthMm: 200, widthMm: 90, heightMm: 330, material: "Kraft + alu" });
    for (const x of [a, b, c]) {
      expect(validatePackagingStructure(x)).toEqual([]);
      expect(x.assembly!.parts.length).toBe(7);
    }
    expect(b.printSurfaces[0].hMm).not.toBe(a.printSurfaces[0].hMm);
    const ta = materialThickness("Film PE").thicknessMm, tc = materialThickness("Kraft + alu").thicknessMm;
    expect(ta).not.toBe(tc);
    expect(a.printSurfaces.find((s) => s.id === "gusset-left")!.wMm).toBeCloseTo(90 - 2 * ta, 12);
    expect(c.printSurfaces.find((s) => s.id === "gusset-left")!.wMm).toBeCloseTo(90 - 2 * tc, 12);
    const fa = a.assembly!.parts.find((p) => p.id === "front")!, fc = c.assembly!.parts.find((p) => p.id === "front")!;
    expect(fa.max[2] - fa.min[2]).toBeCloseTo(ta, 12);
    expect(fc.max[2] - fc.min[2]).toBeCloseTo(tc, 12);
  });

  it("validation : une liaison qui ne touche pas sa cible, ou une soudure vers une pièce absente, est refusée", () => {
    const s = resolveStructure({ model: "bag", lengthMm: 200, widthMm: 90, heightMm: 330, material: "Film PE" });
    const bad = structuredClone(s);
    bad.assembly!.parts.find((p) => p.id === "fin-left")!.bond = { to: "front", kind: "weld" };
    bad.assembly!.endSeals!.push({ id: "x", kind: "weld", edge: "top", widthMm: 10, parts: ["ghost"] });
    const errors = validatePackagingStructure(bad).join("\n");
    expect(errors).toMatch(/fin-left.*not joined face to face on "front"/);
    expect(errors).toMatch(/end seal "x": unknown part "ghost"/);
  });

  it("assemblage et 3D : mêmes panneaux (largeur de film identique dans le tube et dans le sac rempli)", () => {
    const { parts } = bagAssembly(200, 90, 330, 0.1);
    const { panels } = bagShape(200, 90, 330, 0.1);
    const width = (id: string) => panels.find((p) => p.surfaceId === id)!.wMm;
    expect(width("front")).toBeCloseTo(parts.find((p) => p.id === "front")!.max[0] - parts.find((p) => p.id === "front")!.min[0], 12);
    expect(width("gusset-right")).toBeCloseTo(parts.find((p) => p.id === "gusset-right")!.max[2] - parts.find((p) => p.id === "gusset-right")!.min[2], 12);
    expect(width("back")).toBeCloseTo(200, 12);
  });
});

describe("F. non-régression", () => {
  it("sachets, boîte postale, barquette, coffret, brique, étui, bouteille, tube : statut et modèle inchangés", () => {
    const expected: Record<string, [string, string | undefined]> = {
      "stand-up-pouch": ["supported", "frontBack"], "ecom-mailer": ["supported", "rollEndTuckFront"], "food-tray": ["supported", "gluedCornerTray"],
      "luxury-rigid-box": ["supported", "rigidSetUp"], "milk-carton": ["supported", "gableTop"], "tea-box": ["supported", "tuckEndBox"],
      "sauce-bottle": ["supported", "wrapLabel"], "squeeze-tube": ["supported", "wrapLabel"],
    };
    for (const [id, [status, tpl]] of Object.entries(expected)) {
      const r = row(id);
      const st = resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect([st.dieline, st.template], id).toEqual([status, tpl]);
    }
    for (const model of ["pouch", "flatpouch", "sachet"] as const) {
      const st = resolveStructure({ model, lengthMm: 140, widthMm: 80, heightMm: 210, material: "Film PE" });
      expect(st.assembly, model).toBeUndefined();
      expect(st.dieline, model).toBe("supported");
    }
  });
});
