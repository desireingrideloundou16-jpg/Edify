/**
 * Phase 2C-4B: the rigid box template is the flat development of the two parts the 3D builds
 * (boxParts "rigid": an open base and a separate lid), with their own surfaces ("base-*", "lid-*").
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PDFPage } from "pdf-lib";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { boxParts, resolveStructure, validatePackagingStructure, type PackagingStructure, type Pt } from "@/lib/structure";
import { flatLayout, type FlatLayout } from "@/lib/print/layout";

const drawn: { id: string; x: number; y: number; w: number; h: number; turn: number }[] = [];
let turn = 0;
vi.mock("@/lib/artwork/surface", () => ({
  drawSurface: (_c: unknown, x: number, y: number, w: number, h: number, _d: unknown, s: { id: string }) => drawn.push({ id: s.id, x, y, w, h, turn }),
}));
vi.mock("@/lib/artwork/draw", async (orig) => ({
  ...(await orig<typeof import("@/lib/artwork/draw")>()),
  loadDesignFonts: async () => {},
  drawFace: () => { throw new Error("rigid panels must be drawn through drawSurface"); },
  drawWrap: () => { throw new Error("rigid panels must be drawn through drawSurface"); },
}));
// 1×1 PNG: the PDF test checks the vector die-line page, not the raster artwork.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
vi.mock("@/lib/print/artwork", async (orig) => ({
  ...(await orig<typeof import("@/lib/print/artwork")>()),
  canvasToBlob: async () => new Blob([Buffer.from(PNG, "base64")], { type: "image/png" }),
}));

// Canvas stub (fixed 1×1 size: the PDF then embeds the small PNG below).
const rotations: number[] = [];
beforeAll(() => {
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
      : k === "rotate" ? (a: number) => { rotations.push(a); turn = Math.round((a * 180) / Math.PI); }
      : k === "restore" ? () => { turn = 0; }
      : () => {}),
  });
  const canvas = () => Object.defineProperties({ getContext: () => ctx }, { width: { get: () => 1, set: () => {} }, height: { get: () => 1, set: () => {} } });
  vi.stubGlobal("document", { createElement: canvas });
});

const RIGIDS = SHAPE_ROWS.filter((r) => r[3] === "rigid").map((r) => [r[0], r[4], r[5], r[6], r[7]] as const);
const resolve = (L: number, W: number, H: number, material = "Carton rigide 1,5 mm") => resolveStructure({ model: "rigid", lengthMm: L, widthMm: W, heightMm: H, material });
const box = (pts: Pt[]) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const rectOf = (s: PackagingStructure, id: string) => box(s.panels!.find((p) => p.id === id)!.polygon);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const sameSeg = ([p, q]: [Pt, Pt], a: Pt, b: Pt) =>
  [[p, q], [q, p]].some(([u, v]) => near(u[0], a[0]) && near(u[1], a[1]) && near(v[0], b[0]) && near(v[1], b[1]));
const WALLS = ["front", "back", "left", "right"] as const;
const PARTS = [{ prefix: "base-", centre: "bottom", opening: "top" }, { prefix: "lid-", centre: "top", opening: "bottom" }] as const;

/** Edge of a panel rect that carries the TOP of its artwork, after the flat rotation (clockwise). */
function artworkTopEdge(r: ReturnType<typeof box>, rotate: number): [Pt, Pt] {
  const { x0, x1, y0, y1 } = r;
  switch (rotate) {
    case 90: return [[x1, y0], [x1, y1]];
    case 180: return [[x0, y1], [x1, y1]];
    case 270: return [[x0, y0], [x0, y1]];
    default: return [[x0, y0], [x1, y0]];
  }
}
const opposite = (r: ReturnType<typeof box>, rotate: number) => artworkTopEdge(r, (rotate + 180) % 360);
/** Shared edge of a wall and the centre panel (the hinge crease). */
function hinge(c: ReturnType<typeof box>, w: ReturnType<typeof box>): [Pt, Pt] {
  if (near(w.y1, c.y0)) return [[c.x0, c.y0], [c.x1, c.y0]];
  if (near(w.y0, c.y1)) return [[c.x0, c.y1], [c.x1, c.y1]];
  if (near(w.x1, c.x0)) return [[c.x0, c.y0], [c.x0, c.y1]];
  return [[c.x1, c.y0], [c.x1, c.y1]];
}

describe("coffret rigide : gabarit réel (fond + couvercle séparés)", () => {
  it("1. quatre coffrets au catalogue, tous supportés, gabarit rigidSetUp, structure valide", () => {
    expect(RIGIDS.map((r) => r[0])).toEqual(["luxury-rigid-box", "rigid-watch-box", "rigid-shoe-box", "gift-box-large"]);
    for (const [, L, W, H, m] of RIGIDS) {
      const s = resolve(L, W, H, m);
      expect(s.family).toBe("dieline");
      expect(s.dieline).toBe("supported");
      expect(s.template).toBe("rigidSetUp");
      expect(s.closure).toEqual({ kind: "none" });
      expect(s.hinges ?? []).toEqual([]); // separate lid: no hinge
      expect(validatePackagingStructure(s)).toEqual([]);
    }
  });

  it.each(RIGIDS)("2-3. %s : surfaces de la 3D, chaque surface imprimable a son panneau ; les ouvertures n'en ont pas", (_id, L, W, H, m) => {
    const s = resolve(L, W, H, m);
    const ids = boxParts("rigid", L, W, H).flatMap((p) => p.faces.map((f) => f.id));
    expect(s.printSurfaces.map((x) => x.id)).toEqual(ids); // no surface created for the flat sheet (no glue)
    expect(s.printSurfaces.filter((x) => !x.printable).map((x) => x.id)).toEqual(["base-top", "lid-bottom"]);
    for (const surf of s.printSurfaces) {
      const panels = s.panels!.filter((p) => p.surfaceId === surf.id);
      expect(panels.length, surf.id).toBe(surf.printable ? 1 : 0);
    }
    // every panel shows an existing surface (no board without a surface on a rigid box)
    for (const p of s.panels!) expect(s.printSurfaces.some((x) => x.id === p.surfaceId), p.id).toBe(true);
  });

  it.each(RIGIDS)("4. %s : dimensions finies, positives, égales aux pièces 3D (boxParts et maillage)", async (_id, L, W, H, m) => {
    const s = resolve(L, W, H, m);
    const parts = boxParts("rigid", L, W, H);
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging({ model: "rigid", lengthMm: L, widthMm: W, heightMm: H, material: m }, { palette: ["#fff", "#000", "#f00"] } as never);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    for (const [i, part] of PARTS.entries()) {
      const p = parts[i];
      const c = rectOf(s, part.prefix + part.centre);
      expect(c.x1 - c.x0).toBeCloseTo(p.L, 9);
      expect(c.y1 - c.y0).toBeCloseTo(p.W, 9);
      // the 3D mesh of this part: outer size L × H × W
      const mesh = meshes.find((x) => (x.material as THREE.Material[]).some((mt) => mt.userData.surfaceId === part.prefix + "front"))!;
      mesh.geometry.computeBoundingBox();
      const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
      // float32 vertices: 1e-4 mm
      expect(size.x).toBeCloseTo(c.x1 - c.x0, 4);
      expect(size.z).toBeCloseTo(c.y1 - c.y0, 4);
      for (const w of WALLS) {
        const r = rectOf(s, part.prefix + w);
        const wallH = w === "front" || w === "back" ? r.y1 - r.y0 : r.x1 - r.x0;
        expect(wallH).toBeCloseTo(size.y, 4); // wall height = part height
        for (const v of [r.x0, r.x1, r.y0, r.y1]) expect(Number.isFinite(v) && v >= 0).toBe(true);
      }
    }
    for (const v of [s.flatMm!.width, s.flatMm!.height]) expect(Number.isFinite(v) && v > 0).toBe(true);
  });

  it.each(RIGIDS)("5. %s : panneaux dans la feuille, sans chevauchement, deux croix disjointes", (_id, L, W, H, m) => {
    const s = resolve(L, W, H, m);
    const rects = s.panels!.map((p) => ({ id: p.id, ...box(p.polygon) }));
    expect(rects.length).toBe(10);
    for (const r of rects) {
      expect(r.x0).toBeGreaterThanOrEqual(0);
      expect(r.y0).toBeGreaterThanOrEqual(0);
      expect(r.x1).toBeLessThanOrEqual(s.flatMm!.width + 1e-9);
      expect(r.y1).toBeLessThanOrEqual(s.flatMm!.height + 1e-9);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      expect(ox > 1e-9 && oy > 1e-9, `${a.id} overlaps ${b.id}`).toBe(false);
    }
    // the two pieces are apart by twice the bleed (their bleeds never overlap)
    const base = box(s.cut!), lid = box(s.extraCuts![0]);
    expect(lid.x0 - base.x1).toBeCloseTo(2 * s.bleedMm, 9);
  });

  it("6. plis : exactement les 4 arêtes du panneau central de chaque pièce, aucune autre", () => {
    const s = resolve(120, 120, 70);
    expect(s.creases!.length).toBe(8);
    for (const part of PARTS) {
      const c = rectOf(s, part.prefix + part.centre);
      for (const w of WALLS) {
        const h = hinge(c, rectOf(s, part.prefix + w));
        expect(s.creases!.some((cr) => sameSeg(cr, h[0], h[1])), `${part.prefix}${w}`).toBe(true);
      }
    }
  });

  it("7. découpe : deux contours fermés simples en croix (coins dégagés), englobant leurs panneaux", () => {
    const s = resolve(120, 120, 70);
    expect(s.extraCuts!.length).toBe(1);
    const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const all = [s.cut!, s.extraCuts![0]];
    for (const [k, cut] of all.entries()) {
      expect(cut.length).toBe(12); // cross: 12 corners
      for (let i = 0; i < cut.length; i++) for (let j = i + 2; j < cut.length; j++) {
        if (i === 0 && j === cut.length - 1) continue;
        const [a, b] = [cut[i], cut[(i + 1) % cut.length]], [c, d] = [cut[j], cut[(j + 1) % cut.length]];
        expect(cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0).toBe(false);
      }
      // area of the cross = centre + 4 walls (corner squares cut away)
      let area = 0;
      for (let i = 0; i < cut.length; i++) area += cut[i][0] * cut[(i + 1) % cut.length][1] - cut[(i + 1) % cut.length][0] * cut[i][1];
      const part = PARTS[k];
      const panels = [part.centre, ...WALLS].map((w) => rectOf(s, part.prefix + w));
      expect(Math.abs(area) / 2).toBeCloseTo(panels.reduce((t, r) => t + (r.x1 - r.x0) * (r.y1 - r.y0), 0), 6);
      const b = box(cut);
      for (const r of panels) expect(r.x0 >= b.x0 - 1e-9 && r.x1 <= b.x1 + 1e-9 && r.y0 >= b.y0 - 1e-9 && r.y1 <= b.y1 + 1e-9).toBe(true);
    }
    expect(Math.max(...all.flat().map((p) => p[0]))).toBeCloseTo(s.flatMm!.width, 9);
    expect(Math.max(...all.flat().map((p) => p[1]))).toBeCloseTo(s.flatMm!.height, 9);
  });

  it("8. rabats / pattes / collage : aucun (habillage collé sur toute la surface, coins par bande d'angle)", () => {
    const s = resolve(120, 120, 70);
    expect(s.glue ?? []).toEqual([]);
    expect(s.printSurfaces.some((x) => x.id.startsWith("glue"))).toBe(false);
    expect(s.panels!.every((p) => p.surfaceId)).toBe(true);
  });

  it("orientation : chaque paroi lit à l'endroit une fois repliée (haut vers le dessus du couvercle, bas vers le fond)", () => {
    const s = resolve(120, 120, 70);
    const rot = (id: string) => s.printSurfaces.find((x) => x.id === id)!.draw.rotate ?? 0;
    for (const part of PARTS) {
      const c = rectOf(s, part.prefix + part.centre);
      for (const w of WALLS) {
        const id = part.prefix + w, r = rectOf(s, id);
        const h = hinge(c, r);
        // lid walls hang from the lid top: their top edge is the hinge; base walls stand on the bottom: their bottom edge is.
        const edge = part.prefix === "lid-" ? artworkTopEdge(r, rot(id)) : opposite(r, rot(id));
        expect(sameSeg(edge, h[0], h[1]), id).toBe(true);
      }
    }
  });

  it("orientation des panneaux centraux = UV de la 3D (couvercle : haut vers le dos ; fond : haut vers la face)", () => {
    const s = resolve(120, 120, 70);
    const [base, lid] = boxParts("rigid", 120, 120, 70);
    // RoundedBoxGeometry face groups follow the BoxGeometry material order (+x, -x, +y, -y, +z, -z).
    const vTowardsZ = (p: typeof base, group: number) => {
      const g = new RoundedBoxGeometry(p.L, p.H, p.W, 3, p.radius) as THREE.BufferGeometry;
      const gr = g.groups[group], pos = g.getAttribute("position"), uv = g.getAttribute("uv");
      let top = -Infinity, zTop = 0, bot = Infinity, zBot = 0;
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        const v = g.index ? g.index.getX(i) : i;
        if (uv.getY(v) > top) { top = uv.getY(v); zTop = pos.getZ(v); }
        if (uv.getY(v) < bot) { bot = uv.getY(v); zBot = pos.getZ(v); }
      }
      return Math.sign(zTop - zBot);
    };
    expect(vTowardsZ(lid, 2)).toBe(-1); // lid top: artwork top towards the back (−z)…
    const lt = rectOf(s, "lid-top"), lb = rectOf(s, "lid-back");
    expect(near(lb.y1, lt.y0)).toBe(true); // …so the lid back wall lies above it in the flat
    expect(vTowardsZ(base, 3)).toBe(1); // base bottom: artwork top towards the front (+z)…
    const bb = rectOf(s, "base-bottom"), bf = rectOf(s, "base-front");
    expect(near(bf.y1, bb.y0)).toBe(true); // …so the base front wall lies above it
    expect([rot("lid-top"), rot("base-bottom"), rot("lid-front"), rot("base-front")]).toEqual([0, 0, 0, 0]);
    function rot(id: string) { return s.printSurfaces.find((x) => x.id === id)!.draw.rotate ?? 0; }
  });

  it("épaisseur : lue dans le nom de la matière, non appliquée (développé de la peau extérieure 3D)", () => {
    const s = resolve(100, 100, 80, "Carton rigide 2 mm");
    expect(s.material).toMatchObject({ thicknessMm: 2, thicknessSource: "material-name" });
    expect(rectOf(s, "base-bottom").x1 - rectOf(s, "base-bottom").x0).toBeCloseTo(100, 9);
  });
});

describe("dessin et PDF : mêmes surfaces, via drawSurface", () => {
  it("9. chaque panneau imprimé dessine SA surface, à l'endroit (wMm × hMm), tournée selon draw.rotate", async () => {
    const { renderFlatArtwork } = await import("@/lib/print/artwork");
    const dims = { model: "rigid" as const, lengthMm: 120, widthMm: 120, heightMm: 70, material: "Carton rigide 1,5 mm" };
    const layout = flatLayout(dims);
    const s = resolveStructure(dims);
    drawn.length = 0;
    const k = 2;
    renderFlatArtwork(layout, { palette: ["#ffffff", "#000000", "#ff0000"] } as never, k);
    expect(drawn.map((d) => d.id).sort()).toEqual(s.printSurfaces.filter((x) => x.printable).map((x) => x.id).sort());
    for (const d of drawn) {
      const surf = s.printSurfaces.find((x) => x.id === d.id)!;
      expect(d.w).toBeCloseTo(surf.wMm * k, 9);
      expect(d.h).toBeCloseTo(surf.hMm * k, 9);
      expect(d.turn).toBe(surf.draw.rotate ?? 0);
      // centred on its panel
      const p = layout.panels.find((x) => x.surfaceId === d.id)!;
      expect(d.x + d.w / 2).toBeCloseTo((p.x + 3 + p.w / 2) * k, 9);
      expect(d.y + d.h / 2).toBeCloseTo((p.y + 3 + p.h / 2) * k, 9);
    }
  });

  it("10-11. PDF : même FlatLayout, deux contours de découpe vectoriels et les 8 plis", async () => {
    const spy = vi.spyOn(PDFPage.prototype, "drawLine");
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const shape = { id: "luxury-rigid-box", name: "Coffret rigide", model: "rigid", lengthMm: 120, widthMm: 120, heightMm: 70, dimensions: "120×120×70 mm" } as never;
    const res = await generatePrintPdf(shape, { palette: ["#ffffff", "#000000", "#ff0000"], headingFont: "Inter", bodyFont: "Inter" } as never, "Test");
    const layout: FlatLayout = res.layout;
    expect(layout.extraCuts!.length).toBe(1);
    const lines = spy.mock.calls.map((c) => c[0]!);
    const magenta = lines.filter((l) => l.dashArray === undefined && l.thickness === 0.75);
    expect(magenta.length).toBe(layout.cut.length + layout.extraCuts![0].length);
    const dashed = lines.filter((l) => Array.isArray(l.dashArray) && l.thickness === 0.6);
    expect(dashed.length).toBe(layout.creases.length);
    expect(layout.panels.map((p) => p.surfaceId).sort()).toEqual(resolveStructure({ model: "rigid", lengthMm: 120, widthMm: 120, heightMm: 70 }).printSurfaces.filter((x) => x.printable).map((x) => x.id).sort());
    spy.mockRestore();
  });
});
