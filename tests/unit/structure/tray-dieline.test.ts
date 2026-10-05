/**
 * Phase 2C-4D-2: the food tray sheet is DEVELOPED from its assembly (2C-4D-1) by foldedSheet /
 * develop.ts — no coordinate written by hand. Checked against the assembly and the 3D conventions.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  FACE_UP, TRAY_ROOT, developAssembly, flatDir, materialThickness, outerNormal, resolveStructure, rotationTowards, trayDims, validatePackagingStructure,
  type AssemblyPart, type BoxFace, type PackagingStructure, type Pt, type Vec3,
} from "@/lib/structure";
import { flatLayout, resolveFlatLayout } from "@/lib/print/layout";

let turn = 0;
const drawn: { id: string; x: number; y: number; w: number; h: number; turn: number }[] = [];
vi.mock("@/lib/artwork/surface", () => ({
  drawSurface: (_c: unknown, x: number, y: number, w: number, h: number, _d: unknown, s: { id: string }) => drawn.push({ id: s.id, x, y, w, h, turn }),
}));
vi.mock("@/lib/artwork/draw", async (orig) => ({
  ...(await orig<typeof import("@/lib/artwork/draw")>()),
  loadDesignFonts: async () => {},
  drawFace: () => { throw new Error("tray panels must be drawn through drawSurface"); },
  drawWrap: () => { throw new Error("tray panels must be drawn through drawSurface"); },
}));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
vi.mock("@/lib/print/artwork", async (orig) => ({
  ...(await orig<typeof import("@/lib/print/artwork")>()),
  canvasToBlob: async () => new Blob([Buffer.from(PNG, "base64")], { type: "image/png" }),
}));
beforeAll(() => {
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
      : k === "rotate" ? (a: number) => { turn = Math.round((a * 180) / Math.PI); }
      : k === "restore" ? () => { turn = 0; }
      : () => {}),
  });
  const canvas = () => Object.defineProperties({ getContext: () => ctx }, { width: { get: () => 1, set: () => {} }, height: { get: () => 1, set: () => {} } });
  vi.stubGlobal("document", { createElement: canvas });
});

const row = (id: string) => SHAPE_ROWS.find((r) => r[0] === id)!;
const [, NAME, , MODEL, L, W, H, MAT] = row("food-tray");
const input = { model: MODEL, lengthMm: L, widthMm: W, heightMm: H, material: MAT };
const s = resolveStructure(input);
const parts = s.assembly!.parts, folds = s.assembly!.folds;
const t = materialThickness(MAT).thicknessMm;
const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
type R = { x0: number; y0: number; x1: number; y1: number };
const box = (pts: Pt[]): R => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const R_ = (st: PackagingStructure, id: string) => box(st.panels!.find((p) => p.id === id)!.polygon);
const rects = s.panels!.map((p) => ({ id: p.id, ...box(p.polygon) }));
const segLen = ([a, b]: [Pt, Pt]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const onBorder = ([a, b]: [Pt, Pt], r: R) =>
  (near(a[0], b[0]) && (near(a[0], r.x0) || near(a[0], r.x1)) && Math.min(a[1], b[1]) >= r.y0 - EPS && Math.max(a[1], b[1]) <= r.y1 + EPS) ||
  (near(a[1], b[1]) && (near(a[1], r.y0) || near(a[1], r.y1)) && Math.min(a[0], b[0]) >= r.x0 - EPS && Math.max(a[0], b[0]) <= r.x1 + EPS);
const sameSeg = (u: [Pt, Pt], v: [Pt, Pt]) =>
  [[u[0], u[1]], [u[1], u[0]]].some(([p, q]) => near(p[0], v[0][0]) && near(p[1], v[0][1]) && near(q[0], v[1][0]) && near(q[1], v[1][1]));
const within = (sg: [Pt, Pt], e: [Pt, Pt]) => sg.every((p) => {
  const cr = (e[1][0] - e[0][0]) * (p[1] - e[0][1]) - (e[1][1] - e[0][1]) * (p[0] - e[0][0]);
  return Math.abs(cr) < EPS && p[0] >= Math.min(e[0][0], e[1][0]) - EPS && p[0] <= Math.max(e[0][0], e[1][0]) + EPS && p[1] >= Math.min(e[0][1], e[1][1]) - EPS && p[1] <= Math.max(e[0][1], e[1][1]) + EPS;
});
function artworkTopEdge(r: R, rotate: number): [Pt, Pt] {
  switch (rotate) {
    case 90: return [[r.x1, r.y0], [r.x1, r.y1]];
    case 180: return [[r.x0, r.y1], [r.x1, r.y1]];
    case 270: return [[r.x0, r.y0], [r.x0, r.y1]];
    default: return [[r.x0, r.y0], [r.x1, r.y0]];
  }
}
const inPlaneSizes = (p: AssemblyPart) => [0, 1, 2].map((i) => p.max[i] - p.min[i]).sort((a, b) => a - b).slice(1);
const FACE_N: Record<BoxFace, Vec3> = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
const FLAPS = ["flap-front-left", "flap-front-right", "flap-back-left", "flap-back-right"];

describe("barquette : patron développé depuis l'assemblage", () => {
  it("1. food-tray supporté, gabarit plié, structure valide", () => {
    expect([MODEL, NAME]).toEqual(["tray", "Barquette"]);
    expect(s.dieline).toBe("supported");
    expect(s.template).toBe("gluedCornerTray");
    expect(validatePackagingStructure(s)).toEqual([]);
    expect(resolveFlatLayout(input).supported).toBe(true);
  });

  it("2. racine = fond, au centre de la feuille (les 4 parois autour)", () => {
    expect(s.rootPanel).toBe("bottom");
    const b = R_(s, "bottom");
    expect(near(R_(s, "front").y1, b.y0)).toBe(true); // front above (bottom seen from below, front at the top)
    expect(near(R_(s, "back").y0, b.y1)).toBe(true);
    expect(near(R_(s, "left").x1, b.x0)).toBe(true);
    expect(near(R_(s, "right").x0, b.x1)).toBe(true);
  });

  it("3, 11. 9 panneaux = les 9 pièces de carton, aux dimensions de la construction 3D", () => {
    expect(s.panels!.length).toBe(9);
    expect(s.panels!.map((p) => p.id).sort()).toEqual(parts.map((p) => p.id).sort());
    for (const p of parts) {
      const r = R_(s, p.id);
      expect([r.x1 - r.x0, r.y1 - r.y0].sort((a, b) => a - b).map((v) => +v.toFixed(6)), p.id).toEqual(inPlaneSizes(p).map((v) => +v.toFixed(6)));
    }
    const d = trayDims(L, W, H, t);
    for (const f of FLAPS) expect(Math.min(R_(s, f).x1 - R_(s, f).x0, R_(s, f).y1 - R_(s, f).y0)).toBeCloseTo(d.flap, 9); // 13.8 mm from the construction
  });

  it("4-6, 15. 8 plis : un par pli de l'assemblage, sur la frontière commune, à la longueur de l'arête 3D, jamais sur la découpe", () => {
    expect(s.creases!.length).toBe(8);
    expect(s.hinges!.map((h) => h.id).sort()).toEqual(folds.map((f) => f.id).sort());
    for (const w of ["front", "back", "left", "right"]) expect(s.hinges!.some((h) => h.from === "bottom" && h.to === w), w).toBe(true);
    for (const f of FLAPS) expect(s.hinges!.filter((h) => h.to === f).map((h) => h.from)).toEqual([f.includes("front") ? "front" : "back"]);
    for (const h of s.hinges!) {
      const f = folds.find((x) => x.id === h.id)!;
      expect([h.from, h.to]).toEqual([f.from, f.to]);
      expect(s.creases!.some((c) => sameSeg(c, h.line))).toBe(true);
      expect(onBorder(h.line, R_(s, f.from))).toBe(true);
      expect(onBorder(h.line, R_(s, f.to))).toBe(true);
      expect(segLen(h.line)).toBeCloseTo(Math.hypot(...[0, 1, 2].map((i) => f.edge[1][i] - f.edge[0][i])), 9);
      const mid: Pt = [(h.line[0][0] + h.line[1][0]) / 2, (h.line[0][1] + h.line[1][1]) / 2];
      const onCut = s.cut!.some((a, i) => within([mid, mid], [a, s.cut![(i + 1) % s.cut!.length]]));
      expect(onCut, h.id).toBe(false);
    }
  });

  it("7. les quatre coins : chaque patte à l'extrémité de sa paroi, du côté de son côté, au même niveau que la paroi", () => {
    for (const f of FLAPS) {
      const flap = R_(s, f), wall = R_(s, f.includes("front") ? "front" : "back");
      const left = f.endsWith("left");
      expect(left ? near(flap.x1, wall.x0) : near(flap.x0, wall.x1), f).toBe(true);
      expect(flap.y0 >= wall.y0 - EPS && flap.y1 <= wall.y1 + EPS).toBe(true);
    }
  });

  it("8, 16. fentes : chaque contact sans pli est une fente (patte/côté et paroi/côté aux 4 coins), jamais un pli", () => {
    let contact = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const v = near(a.x1, b.x0) || near(b.x1, a.x0), hz = near(a.y1, b.y0) || near(b.y1, a.y0);
      const len = v ? Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) : hz ? Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) : 0;
      if (len <= EPS) continue;
      contact += len;
      const folded = s.hinges!.filter((h) => (h.from === a.id && h.to === b.id) || (h.from === b.id && h.to === a.id)).reduce((u, h) => u + segLen(h.line), 0);
      const cut = s.slits!.filter((sl) => onBorder(sl, a) && onBorder(sl, b)).reduce((u, sl) => u + segLen(sl), 0);
      expect(folded + cut, `${a.id} | ${b.id}`).toBeCloseTo(len, 6);
    }
    expect(contact).toBeGreaterThan(0);
    expect(s.slits!.length).toBe(8);
    for (const f of FLAPS) {
      const side = f.endsWith("left") ? "left" : "right";
      expect(s.slits!.some((sl) => onBorder(sl, R_(s, f)) && onBorder(sl, R_(s, side))), `${f} | ${side}`).toBe(true);
    }
    for (const sl of s.slits!) {
      expect(s.creases!.some((c) => sameSeg(c, sl))).toBe(false);
      for (const p of sl) expect(p[0] >= -EPS && p[0] <= s.flatMm!.width + EPS && p[1] >= -EPS && p[1] <= s.flatMm!.height + EPS).toBe(true);
    }
  });

  it("9. colle : une zone par glueTo, sur la patte, = contact réel avec le côté, côté imprimé (vers le côté une fois pliée)", () => {
    const glued = parts.filter((p) => p.glueTo);
    expect(glued.map((p) => p.id).sort()).toEqual([...FLAPS].sort());
    expect(s.glueZones!.length).toBe(glued.length);
    expect(s.glue).toEqual(s.glueZones!.map((z) => z.polygon));
    const dev = developAssembly(parts, folds, TRAY_ROOT.id, TRAY_ROOT.map);
    for (const p of glued) {
      const z = s.glueZones!.find((x) => x.panel === p.id)!;
      expect(z.onto).toBe(p.glueTo);
      const zr = box(z.polygon), pr = R_(s, p.id);
      expect(zr.x0 >= pr.x0 - EPS && zr.x1 <= pr.x1 + EPS && zr.y0 >= pr.y0 - EPS && zr.y1 <= pr.y1 + EPS).toBe(true); // on the flap
      // area = the 3D overlap of the two faces in contact
      const q = parts.find((x) => x.id === p.glueTo)!;
      const n = [0, 1, 2].find((i) => near(p.max[i], q.min[i]) || near(q.max[i], p.min[i]))!;
      const area = [0, 1, 2].filter((i) => i !== n).reduce((a, i) => a * (Math.min(p.max[i], q.max[i]) - Math.max(p.min[i], q.min[i])), 1);
      expect((zr.x1 - zr.x0) * (zr.y1 - zr.y0)).toBeCloseTo(area, 6);
      // glue side: the flap's outer (printed) side faces the side wall once folded
      const toward = near(p.max[n], q.min[n]) ? 1 : -1;
      const out = outerNormal(dev.panels.find((x) => x.part.id === p.id)!.map);
      expect(out[n]).toBe(toward);
      expect(z.side).toBe("outer");
    }
  });

  it("10, 17. surfaces : front/back/left/right/bottom, pas de top ; rotation = haut de l'illustration sur le bon pli ; pas de miroir", () => {
    expect(s.printSurfaces.map((x) => x.id).sort()).toEqual(["back", "bottom", "front", "left", "right"]);
    expect(s.printSurfaces.some((x) => x.id === "top")).toBe(false);
    expect(Object.fromEntries(s.printSurfaces.map((x) => [x.id, x.draw.rotate ?? 0]))).toEqual({ front: 0, back: 180, left: 270, right: 90, bottom: 0 });
    // the artwork top sits on: the free top edge of each wall (opposite its bottom fold), the front fold for the bottom
    const dev = developAssembly(parts, folds, TRAY_ROOT.id, TRAY_ROOT.map);
    for (const surf of s.printSurfaces) {
      const p = parts.find((x) => x.surface?.id === surf.id)!;
      const r = R_(s, p.id);
      const quarter = surf.draw.rotate === 90 || surf.draw.rotate === 270;
      expect(quarter ? [r.y1 - r.y0, r.x1 - r.x0] : [r.x1 - r.x0, r.y1 - r.y0]).toEqual([surf.wMm, surf.hMm].map((v) => expect.closeTo(v, 9)));
      const top = artworkTopEdge(r, surf.draw.rotate ?? 0);
      if (surf.id === "bottom") {
        expect(within(s.hinges!.find((h) => h.id === "bottom-front")!.line, top)).toBe(true);
      } else {
        const base = s.hinges!.find((h) => h.from === "bottom" && h.to === surf.id)!.line;
        expect(within(base, artworkTopEdge(r, ((surf.draw.rotate ?? 0) + 180) % 360)), `${surf.id} : bas sur le pli du fond`).toBe(true);
      }
      // no mirror: the printed face of the 3D is the face seen in the flat sheet
      const m = dev.panels.find((x) => x.part.id === p.id)!.map;
      expect(outerNormal(m)).toEqual(FACE_N[p.surface!.face].map((v) => v + 0));
      expect(rotationTowards(flatDir(m, FACE_UP[p.surface!.face]))).toBe(surf.draw.rotate ?? 0);
    }
  });

  it("12-14. aucun chevauchement, tout dans la feuille, un seul contour fermé simple dont l'aire = somme des panneaux", () => {
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      expect(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > EPS, `${a.id} ∩ ${b.id}`).toBe(false);
    }
    const all = box(rects.flatMap((r) => [[r.x0, r.y0], [r.x1, r.y1]] as Pt[]));
    expect([all.x0, all.y0]).toEqual([0, 0]);
    expect(all.x1).toBeCloseTo(s.flatMm!.width, 9);
    expect(all.y1).toBeCloseTo(s.flatMm!.height, 9);
    expect(s.extraCuts).toBeUndefined();
    const cut = s.cut!, n = cut.length;
    expect(new Set(cut.map((p) => p.join())).size).toBe(n);
    const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const [a, b, c, d] = [cut[i], cut[(i + 1) % n], cut[j], cut[(j + 1) % n]];
      expect(cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0).toBe(false);
    }
    let area = 0;
    for (let i = 0; i < n; i++) area += cut[i][0] * cut[(i + 1) % n][1] - cut[(i + 1) % n][0] * cut[i][1];
    expect(Math.abs(area) / 2).toBeCloseTo(rects.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0), 6);
    const c = box(cut);
    expect([c.x0, c.y0, c.x1, c.y1]).toEqual([all.x0, all.y0, all.x1, all.y1]);
  });

  it("18. épaisseur : la matière change le patron ; rien n'est réglé par une constante 0,45", () => {
    const thick = resolveStructure({ ...input, material: "Carton ondulé E" });
    const t2 = materialThickness("Carton ondulé E").thicknessMm;
    expect(t2).not.toBe(t);
    expect(thick.flatMm).not.toEqual(s.flatMm);
    expect(validatePackagingStructure(thick)).toEqual([]);
    // the bottom panel is (L − 2t) × (W − 2t) for the material's t, whatever it is
    for (const [st, tt] of [[s, t], [thick, t2]] as const) {
      const b = R_(st, "bottom");
      expect(b.x1 - b.x0).toBeCloseTo(L - 2 * tt, 9);
      expect(b.y1 - b.y0).toBeCloseTo(W - 2 * tt, 9);
      expect(st.flatMm!.height).toBeCloseTo(W - 2 * tt + 2 * H, 9); // back + bottom + front
    }
  });
});

describe("aperçu et PDF : le même patron", () => {
  it("chaque surface est dessinée une fois via drawSurface, à l'endroit, tournée selon draw.rotate", async () => {
    const { renderFlatArtwork } = await import("@/lib/print/artwork");
    const layout = flatLayout(input);
    drawn.length = 0;
    const k = 2;
    renderFlatArtwork(layout, { palette: ["#ffffff", "#000000", "#ff0000"] } as never, k);
    expect(drawn.map((d) => d.id).sort()).toEqual(s.printSurfaces.map((x) => x.id).sort());
    for (const d of drawn) {
      const surf = s.printSurfaces.find((x) => x.id === d.id)!;
      expect(d.w).toBeCloseTo(surf.wMm * k, 9);
      expect(d.h).toBeCloseTo(surf.hMm * k, 9);
      expect(d.turn).toBe(surf.draw.rotate ?? 0);
    }
    expect(layout.glueZones).toEqual(s.glueZones!.map((z) => z.polygon));
  });

  it("19. PDF = patron de l'aperçu (matière transmise), page = feuille + fonds perdus + marges, colle et fentes tracées", async () => {
    const spy = vi.spyOn(PDFPage.prototype, "drawLine");
    const svg = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const shape = { id: "food-tray", name: NAME, model: MODEL, lengthMm: L, widthMm: W, heightMm: H, material: MAT, dimensions: "" } as never;
    const res = await generatePrintPdf(shape, { palette: ["#ffffff", "#000000", "#ff0000"], headingFont: "Inter", bodyFont: "Inter" } as never, "Test");
    expect(res.layout).toEqual(flatLayout(input));
    // with another material the sheet differs: the PDF does not fall back on a default thickness
    expect(res.layout).not.toEqual(flatLayout({ ...input, material: "Carton ondulé E" }));
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(res.bytes);
    for (const page of doc.getPages()) {
      expect(page.getWidth() / (72 / 25.4)).toBeCloseTo(res.layout.width + 6 + 36, 6);
      expect(page.getHeight() / (72 / 25.4)).toBeCloseTo(res.layout.height + 6 + 36, 6);
    }
    const lines = spy.mock.calls.map((c) => c[0]!);
    expect(lines.filter((l) => l.dashArray === undefined && l.thickness === 0.75).length).toBe(res.layout.cut.length + res.layout.slits!.length);
    expect(lines.filter((l) => Array.isArray(l.dashArray) && l.thickness === 0.6).length).toBe(res.layout.creases.length);
    expect(svg.mock.calls.length).toBe(s.glueZones!.length);
    spy.mockRestore();
    svg.mockRestore();
  });
});

describe("20. modèles non concernés", () => {
  it("présentoir, boîte à œufs, pizza, burger : toujours refusés, avec un message propre", () => {
    for (const id of ["display-box", "egg-carton", "pizza-box", "burger-box"]) {
      const r = row(id);
      const res = resolveFlatLayout({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(res.supported, id).toBe(false);
      if (!res.supported) expect(res.message.length, id).toBeGreaterThan(10);
      expect(res.structure.glueZones, id).toBeUndefined();
    }
    const egg = row("egg-carton");
    expect(resolveStructure({ model: egg[3], lengthMm: egg[4], widthMm: egg[5], heightMm: egg[6], material: egg[7] }).dielineNote).toMatch(/moulée/);
  });

  it("anciens patrons : pas de zone de colle tracée ajoutée (étui, brique) ; boîte postale sans colle", () => {
    for (const id of ["tea-box", "milk-carton", "ecom-mailer", "luxury-rigid-box", "sauce-bottle"]) {
      const r = row(id);
      const l = flatLayout({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(l.glueZones, id).toBeUndefined();
    }
  });
});
