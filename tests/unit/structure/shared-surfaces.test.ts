/**
 * Phase 2C-3: one physical surface = one id = one size = one drawing, for the 3D and the print.
 * The 3D materials carry the id of the surface they show (userData.surfaceId); the flat panels
 * carry the same id; both are checked against resolveStructure() on the whole catalog.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { boxParts, cartonConfigFor, cartonDims, pouchSeals, resolveStructure, validatePackagingStructure, type PrintSurface, type ShapeModel } from "@/lib/structure";
import { flatLayout } from "@/lib/print/layout";

const calls: { fn: string; args: unknown[] }[] = [];
vi.mock("@/lib/artwork/draw", async (orig) => ({
  ...(await orig<typeof import("@/lib/artwork/draw")>()),
  drawFace: (...args: unknown[]) => calls.push({ fn: "drawFace", args }),
  drawWrap: (...args: unknown[]) => calls.push({ fn: "drawWrap", args }),
}));

const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});

async function build(model: ShapeModel, L: number, W: number, H: number, material: string) {
  const { buildPackaging } = await import("@/lib/three/packagingModels");
  const obj = buildPackaging({ model, lengthMm: L, widthMm: W, heightMm: H, material }, design);
  const used: { mesh: THREE.Mesh; index: number; mat: THREE.MeshStandardMaterial }[] = [];
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt, index) => {
      if ((mt as THREE.MeshStandardMaterial).map) used.push({ mesh: m, index, mat: mt as THREE.MeshStandardMaterial });
    });
  });
  return used;
}

describe("aucune surface orpheline (catalogue complet, 119 formes)", () => {
  it.each(SHAPE_ROWS.map((r) => [r[0], r[3], r[4], r[5], r[6], r[7]] as const))("%s (%s)", async (_id, model, L, W, H, material) => {
    const s = resolveStructure({ model, lengthMm: L, widthMm: W, heightMm: H, material });
    expect(validatePackagingStructure(s)).toEqual([]);
    const byId = new Map(s.printSurfaces.map((x) => [x.id, x]));
    for (const surf of s.printSurfaces) if (surf.printable) {
      expect(surf.wMm).toBeGreaterThan(0);
      expect(surf.hMm).toBeGreaterThan(0);
    }
    // 3D → structure: every textured material shows a declared surface, at its exact size.
    const used = await build(model, L, W, H, material);
    expect(used.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const u of used) {
      const id = u.mat.userData.surfaceId as string;
      expect(byId.has(id), `3D material without surface: ${id}`).toBe(true);
      expect(u.mat.map!.userData.mm).toEqual([byId.get(id)!.wMm, byId.get(id)!.hMm]);
      seen.add(id);
    }
    // structure → 3D: every printable surface is shown by the 3D.
    for (const surf of s.printSurfaces) if (surf.printable) expect(seen.has(surf.id), `surface not in 3D: ${surf.id}`).toBe(true);
    // structure → print: every printable surface of a supported die-line is a panel, at the same size.
    if (s.dieline === "supported") {
      const panels = flatLayout({ model, lengthMm: L, widthMm: W, heightMm: H, material }).panels;
      for (const surf of s.printSurfaces) {
        const ps = panels.filter((x) => x.surfaceId === surf.id);
        const p = ps[0];
        if (!surf.printable) {
          expect(p, `non-printable surface drawn: ${surf.id}`).toBeUndefined();
          continue;
        }
        expect(p, `surface not in die-line: ${surf.id}`).toBeDefined();
        if (ps.length > 1) {
          // 2C-4E-2: one surface over several panels (film bag back): the windows add up to the surface.
          expect(ps.reduce((w, x) => w + x.w, 0)).toBeCloseTo(surf.wMm, 9);
          for (const x of ps) expect(x.h).toBeCloseTo(surf.hMm, 9);
          continue;
        }
        // Same size once upright (a quarter-turned wall lies hMm wide in the flat sheet).
        expect(p!.quarterTurn ? [p!.h, p!.w] : [p!.w, p!.h]).toEqual([surf.wMm, surf.hMm]);
      }
    }
  });
});

describe("identité stable des surfaces", () => {
  it("ids déterministes et attendus par famille", () => {
    const ids = (model: ShapeModel) => resolveStructure({ model, lengthMm: 80, widthMm: 50, heightMm: 160 }).printSurfaces.map((x) => x.id);
    expect(ids("box")).toEqual(["right", "left", "top", "bottom", "front", "back", "glue"]);
    expect(ids("rigid")).toEqual(["base-right", "base-left", "base-top", "base-bottom", "base-front", "base-back", "lid-right", "lid-left", "lid-top", "lid-bottom", "lid-front", "lid-back"]);
    expect(ids("pouch")).toEqual(["front", "back", "gusset"]);
    expect(ids("sachet")).toEqual(["front", "back"]);
    expect(ids("carton")).toEqual(["body", "roof-front", "roof-back", "glue"]); // glue flap: physical, not printed (2C-4A)
    expect(ids("bottle")).toEqual(["label"]);
    expect(ids("can")).toEqual(["wrap"]);
    expect(ids("box")).toEqual(ids("box"));
  });

  it("surfaces non imprimables : patte de collage, intérieurs, ouverture du sac", () => {
    const off = (model: ShapeModel) => resolveStructure({ model, lengthMm: 80, widthMm: 50, heightMm: 160 }).printSurfaces.filter((x) => !x.printable).map((x) => x.id);
    expect(off("box")).toEqual(["glue"]);
    expect(off("rigid")).toEqual(["base-top", "lid-bottom"]);
    // 2C-4E-1: the film bag has no box top; the paper bag keeps the former block (open top).
    expect(off("bag")).toEqual([]);
    expect(off("paperbag")).toEqual(["top"]);
    expect(off("sachet")).toEqual([]);
  });
});

describe("boîtes : strip / top / fond", () => {
  it("le dessus est UNE surface : face +y en 3D = panneau « top » du patron, contenu « strip » des deux côtés", async () => {
    const s = resolveStructure({ model: "box", lengthMm: 70, widthMm: 70, heightMm: 130 });
    const top = s.printSurfaces.find((x) => x.id === "top")!;
    expect(top).toMatchObject({ wMm: 70, hMm: 70, draw: { kind: "strip", rotate: 180 }, placement: { part: "body", face: "+y" } });
    const panel = flatLayout({ model: "box", lengthMm: 70, widthMm: 70, heightMm: 130 }).panels.find((p) => p.surfaceId === "top")!;
    expect(panel).toMatchObject({ kind: "strip", flip: true });
    const used = await build("box", 70, 70, 130, "Carton couché 350g");
    const face = used.find((u) => u.mat.userData.surfaceId === "top")!;
    expect(face.index).toBe(2); // +y in three.js material order
  });

  it("le fond existe en 3D (−y) et dans le patron (rabat sous la face avant)", () => {
    const l = flatLayout({ model: "box", lengthMm: 70, widthMm: 70, heightMm: 130 });
    const front = l.panels.find((p) => p.surfaceId === "front")!;
    const bottom = l.panels.find((p) => p.surfaceId === "bottom")!;
    expect(bottom).toMatchObject({ x: front.x, y: front.y + front.h, w: 70, h: 70, kind: "plain" });
  });

  it("côtés : +x = droite, −x = gauche (comme le patron vu côté imprimé)", () => {
    const faces = boxParts("box", 70, 50, 130)[0].faces;
    expect(faces.map((f) => [f.face, f.id])).toEqual([["+x", "right"], ["-x", "left"], ["+y", "top"], ["-y", "bottom"], ["+z", "front"], ["-z", "back"]]);
    const l = flatLayout({ model: "box", lengthMm: 70, widthMm: 50, heightMm: 130 });
    const x = (id: string) => l.panels.find((p) => p.surfaceId === id)!.x;
    expect(x("left")).toBeLessThan(x("front"));
    expect(x("right")).toBeGreaterThan(x("front"));
  });
});

describe("sachets : face, dos, soufflet, soudures, UV", () => {
  it("chaque groupe du maillage montre sa surface ; face devant (z > 0), dos derrière", async () => {
    const used = await build("pouch", 140, 80, 220, "Kraft + PE");
    expect(used.map((u) => u.mat.userData.surfaceId)).toEqual(["front", "back", "gusset"]);
    const { mesh } = used[0];
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = mesh.geometry.getIndex()!.array;
    for (const [gi, sign] of [[0, 1], [1, -1]] as const) {
      const g = mesh.geometry.groups[gi];
      let sum = 0;
      for (let i = g.start; i < g.start + g.count; i++) sum += pos.getZ(idx[i]);
      expect(Math.sign(sum)).toBe(sign);
    }
  });

  it("UV sur la longueur réelle : u de 0 à 1 sur chaque panneau, croissant de gauche à droite vu de face", async () => {
    const { createPouchGeometry } = await import("@/lib/three/geometry/pouchGeometry");
    const geo = createPouchGeometry({ width: 140, height: 220, depth: 80, type: "doypack", seed: 1 });
    const pos = geo.getAttribute("position") as THREE.BufferAttribute, uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    const idx = geo.getIndex()!.array;
    for (const [gi, dir] of [[0, 1], [1, -1]] as const) {
      const g = geo.groups[gi];
      const verts = new Set<number>();
      for (let i = g.start; i < g.start + g.count; i++) verts.add(idx[i]);
      let minU = 1, maxU = 0, ok = 0, n = 0;
      for (const v of verts) {
        minU = Math.min(minU, uv.getX(v));
        maxU = Math.max(maxU, uv.getX(v));
        // u follows x across the panel (front: left → right; back seen from behind: +x → −x)
        if (Math.abs(pos.getX(v)) > 20) { n++; if (Math.sign(uv.getX(v) - 0.5) === Math.sign(pos.getX(v)) * dir) ok++; }
      }
      expect(minU).toBeCloseTo(0, 9);
      expect(maxU).toBeCloseTo(1, 9);
      expect(ok).toBe(n);
    }
  });

  it("soudures : même largeur dans la structure, dans le patron et dans le maillage 3D", async () => {
    const H = 220;
    const sb = pouchSeals("flatpouch", H);
    const s = resolveStructure({ model: "flatpouch", lengthMm: 150, widthMm: 10, heightMm: H });
    expect(s.seals).toEqual([
      { id: "seal-top", surfaceIds: ["front", "back"], edge: "top", widthMm: sb.top, rect: [0, 0, 300, sb.top] },
      { id: "seal-bottom", surfaceIds: ["front", "back"], edge: "bottom", widthMm: sb.bottom, rect: [0, H - sb.bottom, 300, sb.bottom] },
    ]);
    const front = s.printSurfaces.find((x) => x.id === "front")!;
    expect(front.printArea).toEqual({ x: 0, y: sb.top, w: 150, h: H - sb.top - sb.bottom });
    // 3D: inside the seal bands the film is flat (crimp only, |z| ≤ crimp depth)
    const { createPouchGeometry } = await import("@/lib/three/geometry/pouchGeometry");
    const geo = createPouchGeometry({ width: 150, height: H, depth: 10, type: "flatpouch", seed: 1 });
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > H - sb.top + 1e-6 || y < sb.bottom - 1e-6) expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(0.33);
    }
    const doy = resolveStructure({ model: "pouch", lengthMm: 140, widthMm: 80, heightMm: H });
    expect(doy.seals?.map((x) => x.id)).toEqual(["seal-top"]); // a stand-up doypack has no bottom seal
  });

  it("drawSurface : l'illustration reste dans la zone imprimable, hors soudures", async () => {
    const { drawSurface } = await import("@/lib/artwork/surface");
    const s = resolveStructure({ model: "flatpouch", lengthMm: 150, widthMm: 10, heightMm: 220 }).printSurfaces.find((x) => x.id === "front") as PrintSurface;
    calls.length = 0;
    const ctx = { fillRect: () => {}, set fillStyle(_v: string) {} } as unknown as CanvasRenderingContext2D;
    drawSurface(ctx, 0, 0, 1500, 2200, design, s); // 10 px per mm
    const [, x, y, w, h] = calls[0].args as number[];
    expect(calls[0].fn).toBe("drawFace");
    expect([x, y, w, h]).toEqual([0, s.printArea!.y * 10, 1500, s.printArea!.h * 10]);
  });
});

describe("brique : surfaces à la taille réelle du maillage", () => {
  it("corps = périmètre chanfreiné × hauteur entre soudure et toit ; pans du toit = L × pente", async () => {
    const c = cartonDims(cartonConfigFor(70, 70, 190));
    const s = resolveStructure({ model: "carton", lengthMm: 70, widthMm: 70, heightMm: 190 });
    expect(s.printSurfaces.find((x) => x.id === "body")).toMatchObject({ wMm: c.perimeter, hMm: c.bodyPrintH });
    const { createCartonGeometry } = await import("@/lib/three/geometry/cartonGeometry");
    const parts = createCartonGeometry(cartonConfigFor(70, 70, 190));
    parts.body.computeBoundingBox();
    const bb = parts.body.boundingBox!;
    expect(bb.max.y - bb.min.y).toBeCloseTo(c.bodyPrintH, 4);
    // front roof panel: from (−hw, yRB, hd) to (−hw, yRT, 0)
    const p = parts.roof.getAttribute("position") as THREE.BufferAttribute;
    const slant = Math.hypot(p.getY(3) - p.getY(0), p.getZ(3) - p.getZ(0));
    expect(slant).toBeCloseTo(s.printSurfaces.find((x) => x.id === "roof-front")!.hMm, 4);
  });
});
