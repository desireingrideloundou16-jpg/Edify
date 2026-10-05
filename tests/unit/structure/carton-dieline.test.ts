/**
 * Phase 2C-4A: the gable-top carton template is the flat development of the 3D carton, built from
 * the same dimensions (cartonProfile) and the same surfaces ("body", "roof-front", "roof-back").
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { cartonConfigFor, cartonDims, resolveStructure, validatePackagingStructure, type PackagingStructure, type Pt } from "@/lib/structure";
import { flatLayout } from "@/lib/print/layout";

const drawn: { id: string; x: number; w: number }[] = [];
vi.mock("@/lib/artwork/surface", () => ({
  drawSurface: (_ctx: unknown, x: number, _y: number, w: number, _h: number, _d: unknown, s: { id: string }) => drawn.push({ id: s.id, x, w }),
}));
vi.mock("@/lib/artwork/draw", async (orig) => ({
  ...(await orig<typeof import("@/lib/artwork/draw")>()),
  drawFace: () => { throw new Error("carton panels must be drawn through drawSurface"); },
  drawWrap: () => { throw new Error("carton panels must be drawn through drawSurface"); },
}));

const CARTONS = SHAPE_ROWS.filter((r) => r[3] === "carton").map((r) => [r[0], r[4], r[5], r[6], r[7]] as const);
const resolve = (L: number, W: number, H: number, material = "Carton aseptique") => resolveStructure({ model: "carton", lengthMm: L, widthMm: W, heightMm: H, material });
const poly = (s: PackagingStructure, id: string) => s.panels!.find((p) => p.id === id)!.polygon;
const box = (pts: Pt[]) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const hasCrease = (s: PackagingStructure, a: Pt, b: Pt) =>
  s.creases!.some(([p, q]) => [[p, q], [q, p]].some(([u, v]) => Math.hypot(u[0] - a[0], u[1] - a[1]) < 1e-9 && Math.hypot(v[0] - b[0], v[1] - b[1]) < 1e-9));

describe("brique à pignon : gabarit réel", () => {
  it("trois formats au catalogue, tous supportés et valides", () => {
    expect(CARTONS.length).toBe(3);
    for (const [, L, W, H, m] of CARTONS) {
      const s = resolve(L, W, H, m);
      expect(s.dieline).toBe("supported");
      expect(s.template).toBe("gableTop");
      expect(validatePackagingStructure(s)).toEqual([]);
    }
  });

  it.each(CARTONS)("%s : surfaces existantes, chaque surface imprimable a son panneau, dimensions finies et positives", (_id, L, W, H, m) => {
    const s = resolve(L, W, H, m);
    expect(s.printSurfaces.map((x) => [x.id, x.printable])).toEqual([["body", true], ["roof-front", true], ["roof-back", true], ["glue", false]]);
    for (const surf of s.printSurfaces) {
      expect(Number.isFinite(surf.wMm) && surf.wMm > 0).toBe(true);
      expect(Number.isFinite(surf.hMm) && surf.hMm > 0).toBe(true);
      const p = s.panels!.find((x) => x.surfaceId === surf.id);
      expect(p, surf.id).toBeDefined();
      const b = box(p!.polygon);
      if (surf.id !== "glue") expect([b.x1 - b.x0, b.y1 - b.y0].map((v) => +v.toFixed(9))).toEqual([surf.wMm, surf.hMm].map((v) => +v.toFixed(9)));
    }
    for (const v of [s.flatMm!.width, s.flatMm!.height, ...s.cut!.flat()]) expect(Number.isFinite(v)).toBe(true);
  });

  it.each(CARTONS)("%s : corps = tube 3D développé, toit = pans 3D, mêmes données que la géométrie", async (_id, L, W, H, m) => {
    const c = cartonDims(cartonConfigFor(L, W, H));
    const s = resolve(L, W, H, m);
    const body = box(poly(s, "body"));
    expect(body.x1 - body.x0).toBeCloseTo(c.perimeter, 9);
    expect(body.y1 - body.y0).toBeCloseTo(c.bodyPrintH, 9);
    for (const id of ["roof-front", "roof-back"]) {
      const r = box(poly(s, id));
      expect(r.x1 - r.x0).toBeCloseTo(L, 9);
      expect(r.y1 - r.y0).toBeCloseTo(c.roofSlant, 9);
      expect(r.y1).toBeCloseTo(body.y0, 9); // roof panels stand on the body top edge
    }
    // …and against the real 3D mesh: tube perimeter and height, roof panel length.
    const { createCartonGeometry } = await import("@/lib/three/geometry/cartonGeometry");
    const parts = createCartonGeometry(cartonConfigFor(L, W, H));
    const pos = parts.body.getAttribute("position") as THREE.BufferAttribute;
    const n = pos.count / 2; // bottom ring then top ring (seam column duplicated)
    let perim = 0;
    for (let i = 1; i < n; i++) perim += Math.hypot(pos.getX(i) - pos.getX(i - 1), pos.getZ(i) - pos.getZ(i - 1));
    expect(perim).toBeCloseTo(body.x1 - body.x0, 3);
    expect(pos.getY(n) - pos.getY(0)).toBeCloseTo(body.y1 - body.y0, 3);
    const rp = parts.roof.getAttribute("position") as THREE.BufferAttribute;
    expect(Math.hypot(rp.getY(3) - rp.getY(0), rp.getZ(3) - rp.getZ(0))).toBeCloseTo(c.roofSlant, 3);
  });

  it("plis : coins verticaux sous les bords des pans du toit, pli du toit, pli de crête, pli de collage, diagonales des pignons", () => {
    const L = 70, W = 70, H = 190;
    const c = cartonDims(cartonConfigFor(L, W, H));
    const s = resolve(L, W, H);
    const body = box(poly(s, "body")), rf = box(poly(s, "roof-front")), rb = box(poly(s, "roof-back"));
    expect(hasCrease(s, [0, body.y0], [body.x1, body.y0])).toBe(true); // roof fold
    expect(hasCrease(s, [0, rf.y0], [body.x1, rf.y0])).toBe(true); // fin fold
    for (const x of [rf.x0, rf.x1, rb.x0]) expect(hasCrease(s, [x, 0], [x, body.y1])).toBe(true); // corners
    expect(rb.x1).toBe(body.x1); // back ends at the glue seam
    expect(hasCrease(s, [body.x1, body.y0], [body.x1, body.y1])).toBe(true); // glue flap fold
    // Gable diagonals: body corner → apex, same length as the 3D triangle edge (corner → ridge).
    for (const g of ["gable-left", "gable-right"]) {
      const b = box(poly(s, g));
      const diag = s.creases!.filter(([p]) => p[1] === body.y0 && (p[0] === b.x0 || p[0] === b.x1) && Math.abs(p[0] - b.x0) + Math.abs(p[0] - b.x1) === b.x1 - b.x0);
      const ofGable = diag.filter(([, q]) => Math.abs(q[0] - (b.x0 + b.x1) / 2) < 1e-9);
      expect(ofGable.length).toBe(2);
      for (const [p, q] of ofGable) expect(Math.hypot(q[0] - p[0], q[1] - p[1])).toBeCloseTo(Math.hypot(c.hd, c.gableH), 9);
    }
  });

  it("contour : polygone fermé simple, englobe tous les panneaux, aucun chevauchement de panneaux", () => {
    const s = resolve(70, 70, 190);
    const cut = s.cut!;
    expect(cut.length).toBeGreaterThanOrEqual(6);
    // simple polygon: no two non-adjacent edges intersect
    const seg = (i: number) => [cut[i], cut[(i + 1) % cut.length]] as const;
    const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let i = 0; i < cut.length; i++) for (let j = i + 2; j < cut.length; j++) {
      if (i === 0 && j === cut.length - 1) continue;
      const [a, b] = seg(i), [c, d] = seg(j);
      const inter = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
      expect(inter).toBe(false);
    }
    const cb = box(cut);
    expect([cb.x1, cb.y1]).toEqual([s.flatMm!.width, s.flatMm!.height]);
    const rects = s.panels!.map((p) => ({ id: p.id, ...box(p.polygon) }));
    for (const r of rects) {
      expect(r.x0).toBeGreaterThanOrEqual(cb.x0 - 1e-9);
      expect(r.x1).toBeLessThanOrEqual(cb.x1 + 1e-9);
      expect(r.y1).toBeLessThanOrEqual(cb.y1 + 1e-9);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      expect(ox > 1e-9 && oy > 1e-9, `${a.id} overlaps ${b.id}`).toBe(false);
    }
  });

  it("couture sur l'arête dos/gauche : le panneau du corps montre la même enveloppe que la 3D, décalée d'un demi-dos", () => {
    const L = 70;
    const s = resolve(L, 70, 190);
    const body = s.panels!.find((p) => p.id === "body")!;
    const P = s.printSurfaces.find((x) => x.id === "body")!.wMm;
    expect(body.surfaceOffsetMm).toBe(L / 2);
    // front centre in the flat (middle of roof-front) ↦ surface position P/2 (front centre of the 3D wrap)
    const rf = box(poly(s, "roof-front"));
    expect(((rf.x0 + rf.x1) / 2 + body.surfaceOffsetMm!) % P).toBeCloseTo(P / 2, 9);
    // back centre ↦ surface origin (the 3D wrap starts at the back centre)
    const rb = box(poly(s, "roof-back"));
    expect(((rb.x0 + rb.x1) / 2 + body.surfaceOffsetMm!) % P).toBeCloseTo(0, 9);
  });

  it("épaisseur : lue dans le système existant, non appliquée au gabarit (pas de compensation de pli)", () => {
    const s = resolve(70, 70, 190);
    expect(s.material.thicknessSource).toBe("default");
    expect(s.material.thicknessMm).toBeGreaterThan(0);
  });
});

describe("dessin : le patron passe par drawSurface", () => {
  beforeAll(() => {
    const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  });

  it("corps dessiné deux fois (enveloppe fermée) dans sa fenêtre, toits une fois chacun, rien d'autre", async () => {
    const { renderFlatArtwork } = await import("@/lib/print/artwork");
    const layout = flatLayout({ model: "carton", lengthMm: 70, widthMm: 70, heightMm: 190 });
    expect(layout.panels.map((p) => p.surfaceId)).toEqual(["body", "roof-front", "roof-back"]);
    drawn.length = 0;
    const k = 2;
    renderFlatArtwork(layout, { palette: ["#ffffff", "#000000", "#ff0000"] } as never, k);
    expect(drawn.map((d) => d.id)).toEqual(["body", "body", "roof-front", "roof-back"]);
    const body = layout.panels[0];
    const bx = (body.x + 3) * k; // bleed offset
    expect(drawn[0].x).toBeCloseTo(bx - body.surfaceOffsetMm! * k, 9);
    expect(drawn[1].x).toBeCloseTo(bx - body.surfaceOffsetMm! * k + body.w * k, 9);
  });
});

describe("catalogue : non-régression", () => {
  it("toutes les formes se résolvent ; seules les briques (et les coffrets, 2C-4B) changent de statut", () => {
    const all = SHAPE_ROWS.map((r) => resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }));
    expect(all.length).toBe(119);
    for (const s of all) expect(validatePackagingStructure(s)).toEqual([]);
    // 32 before 2C-4A, 29 after the 3 cartons, 25 after the 4 rigid boxes (2C-4B), 21 after the 4 postal mailers (2C-4C), 20 after the food tray (2C-4D), 16 after the 4 film bags (2C-4E), 12 since the 4 plastic tubs (2C-4F).
    expect(all.filter((s) => s.dieline === "unsupported").length).toBe(12);
    expect(all.filter((s) => s.template === "gableTop").every((s) => s.model === "carton")).toBe(true);
    expect(all.filter((s) => s.model === "box").every((s) => s.template === "tuckEndBox")).toBe(true);
  });
});
