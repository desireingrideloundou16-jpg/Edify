/**
 * Phase 2C-4E-2: the web (laize) of the film bags is DEVELOPED from their assembly (2C-4E-1) by
 * foldedSheet / develop.ts. Formed folds are not creases, welds are not folds, the back is one
 * surface shown through two windows.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  BAG_ROOT, FACE_RIGHT, FACE_UP, bagDims, bondContacts, developAssembly, flatDir, materialThickness, outerNormal, resolveStructure, rotationTowards, validatePackagingStructure,
  type BoxFace, type PackagingStructure, type Pt, type Vec3,
} from "@/lib/structure";
import { flatLayout, resolveFlatLayout } from "@/lib/print/layout";

const drawn: { id: string; x: number; w: number }[] = [];
vi.mock("@/lib/artwork/surface", () => ({
  drawSurface: (_c: unknown, x: number, _y: number, w: number, _h: number, _d: unknown, s: { id: string }) => drawn.push({ id: s.id, x, w }),
}));
vi.mock("@/lib/artwork/draw", async (orig) => ({
  ...(await orig<typeof import("@/lib/artwork/draw")>()),
  loadDesignFonts: async () => {},
  drawFace: () => { throw new Error("bag panels must be drawn through drawSurface"); },
  drawWrap: () => { throw new Error("bag panels must be drawn through drawSurface"); },
}));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
vi.mock("@/lib/print/artwork", async (orig) => ({
  ...(await orig<typeof import("@/lib/print/artwork")>()),
  canvasToBlob: async () => new Blob([Buffer.from(PNG, "base64")], { type: "image/png" }),
}));
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  const canvas = () => Object.defineProperties({ getContext: () => ctx }, { width: { get: () => 1, set: () => {} }, height: { get: () => 1, set: () => {} } });
  vi.stubGlobal("document", { createElement: canvas });
});

const row = (id: string) => SHAPE_ROWS.find((r) => r[0] === id)!;
const FILM = ["rice-bag", "gari-bag", "pet-food-bag", "coffee-bag-gusset"].map((id) => { const r = row(id); return [id, r[4], r[5], r[6], r[7]] as const; });
const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
type R = { x0: number; y0: number; x1: number; y1: number };
const box = (pts: Pt[]): R => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const R_ = (s: PackagingStructure, id: string) => box(s.panels!.find((p) => p.id === id)!.polygon);
const onBorder = ([a, b]: [Pt, Pt], r: R) =>
  (near(a[0], b[0]) && (near(a[0], r.x0) || near(a[0], r.x1)) && Math.min(a[1], b[1]) >= r.y0 - EPS && Math.max(a[1], b[1]) <= r.y1 + EPS) ||
  (near(a[1], b[1]) && (near(a[1], r.y0) || near(a[1], r.y1)) && Math.min(a[0], b[0]) >= r.x0 - EPS && Math.max(a[0], b[0]) <= r.x1 + EPS);
const FACE_N: Record<BoxFace, Vec3> = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
const ORDER = ["fin-left", "back-left", "gusset-left", "front", "gusset-right", "back-right", "fin-right"];

describe.each(FILM)("%s (%d × %d × %d, %s)", (_id, L, W, H, m) => {
  const input = { model: "bag" as const, lengthMm: L, widthMm: W, heightMm: H, material: m };
  const s = resolveStructure(input);
  const t = materialThickness(m).thicknessMm;
  const d = bagDims(L, W, H, t);
  const parts = s.assembly!.parts, folds = s.assembly!.folds;
  const dev = developAssembly(parts, folds, BAG_ROOT.id, BAG_ROOT.map);

  it("A. patron supporté, développé depuis l'assemblage (racine = face), structure valide", () => {
    expect(s.dieline).toBe("supported");
    expect(s.template).toBe("sideGussetBag");
    expect(s.rootPanel).toBe("front");
    expect(validatePackagingStructure(s)).toEqual([]);
    expect(resolveFlatLayout(input).supported).toBe(true);
  });

  it("B, K. une seule laize : un contour rectangulaire = feuille, aire = somme des panneaux, fond perdu à part", () => {
    expect(s.extraCuts).toBeUndefined();
    expect(s.cut!.length).toBe(4);
    const c = box(s.cut!);
    expect([c.x0, c.y0]).toEqual([0, 0]);
    expect(c.x1).toBeCloseTo(s.flatMm!.width, 9);
    expect(c.y1).toBeCloseTo(s.flatMm!.height, 9);
    const area = s.panels!.reduce((a, p) => { const r = box(p.polygon); return a + (r.x1 - r.x0) * (r.y1 - r.y0); }, 0);
    expect(area).toBeCloseTo(s.flatMm!.width * s.flatMm!.height, 6);
    // width = the developed widths of the 7 film parts; length = the film length of the 3D (not H)
    expect(s.flatMm!.width).toBeCloseTo(2 * L + 2 * d.gusset + 2 * d.fin, 9);
    expect(s.flatMm!.height).toBeCloseTo(d.flatH, 9);
    expect(s.flatMm!.height).toBeGreaterThan(H);
    expect(flatLayout(input).width).toBe(s.flatMm!.width); // bleed is added around, not in
  });

  it("C. panneaux : aileron | ½ dos | soufflet | face | soufflet | ½ dos | aileron, à leurs dimensions physiques", () => {
    const xs = ORDER.map((id) => R_(s, id));
    for (let i = 1; i < xs.length; i++) expect(xs[i].x0).toBeCloseTo(xs[i - 1].x1, 9); // contiguous, in this order
    const width = (id: string) => R_(s, id).x1 - R_(s, id).x0;
    expect(width("front")).toBeCloseTo(L, 9);
    expect(width("back-left")).toBeCloseTo(L / 2, 9);
    expect(width("back-right")).toBeCloseTo(L / 2, 9);
    expect(width("gusset-left")).toBeCloseTo(W - 2 * t, 9);
    expect(width("gusset-right")).toBeCloseTo(W - 2 * t, 9);
    expect(width("fin-left")).toBeCloseTo(d.fin, 9);
    expect(width("fin-right")).toBeCloseTo(d.fin, 9);
    for (const p of parts) { const r = R_(s, p.id); expect(r.y1 - r.y0).toBeCloseTo(p.max[1] - p.min[1], 9); }
  });

  it("D. plis : les 6 plis sont formés (aucun rainage), sur les frontières, sur toute la hauteur ; la soudure n'est pas un pli", () => {
    expect(s.creases).toEqual([]);
    // 2C-4E-3: + the centre fold of each gusset (inner folds, formed)
    expect(s.formedFolds!.length).toBe(folds.length + 2);
    expect(s.hinges!.every((h) => h.kind === "formed")).toBe(true);
    expect(s.hinges!.map((h) => h.id).sort()).toEqual(folds.map((f) => f.id).sort());
    for (const h of s.hinges!) {
      expect(s.formedFolds!.some((f) => onBorder(f, box(h.line)) && near(f[0][0], h.line[0][0]))).toBe(true);
      expect(onBorder(h.line, R_(s, h.from)) && onBorder(h.line, R_(s, h.to))).toBe(true);
      expect(Math.abs(h.line[1][1] - h.line[0][1])).toBeCloseTo(d.flatH, 9);
    }
    expect(s.hinges!.some((h) => [h.from, h.to].sort().join() === "fin-left,fin-right")).toBe(false);
  });

  it("E, F. soudures : dorsale (deux ailerons, faces intérieures), basse et haute (après remplissage), hors illustration, mêmes largeurs que la 3D", () => {
    const z = (id: string) => s.sealZones!.find((x) => x.id === id)!;
    expect(s.sealZones!.map((x) => x.id).sort()).toEqual(["bond-fin-left", "bond-fin-right", "seal-bottom", "seal-top"]);
    expect(s.sealZones!.every((x) => x.kind === "weld")).toBe(true);
    for (const f of ["fin-left", "fin-right"]) expect(box(z(`bond-${f}`).polygon)).toEqual(R_(s, f)); // the whole fin
    // welded by their inner faces (the sealable layer), never by the printed side
    for (const c of bondContacts(dev.panels)) expect(c.side).toBe("inner");
    const bottom = box(z("seal-bottom").polygon), top = box(z("seal-top").polygon);
    expect(bottom.y1 - bottom.y0).toBeCloseTo(d.sealBottom, 9);
    expect(top.y1 - top.y0).toBeCloseTo(d.sealTop, 9);
    expect([bottom.x0, bottom.x1, top.x0, top.x1]).toEqual([0, s.flatMm!.width, 0, s.flatMm!.width].map((v) => expect.closeTo(v, 9)));
    expect(near(top.y0, 0) && near(bottom.y1, s.flatMm!.height)).toBe(true); // mouth at the top of the web, bottom weld at its foot
    expect(z("seal-top").afterFilling).toBe(true);
    expect(z("seal-bottom").afterFilling).toBeUndefined();
    // the artwork stops at both welds
    for (const surf of s.printSurfaces) expect(surf.printArea).toEqual({ x: 0, y: d.sealTop, w: surf.wMm, h: d.flatH - d.sealTop - d.sealBottom });
    // no weld drawn as a fold
    for (const zz of s.sealZones!.filter((x) => x.id.startsWith("bond"))) {
      const zb = box(zz.polygon);
      for (const f of [...s.creases!, ...s.formedFolds!]) expect(f[0][0] > zb.x0 + EPS && f[0][0] < zb.x1 - EPS, zz.id).toBe(false);
    }
  });

  it("G, H. surfaces : le dos est une seule surface vue par deux fenêtres ; orientation = 3D, sans miroir", () => {
    expect(s.printSurfaces.map((x) => x.id)).toEqual(["front", "back", "gusset-left", "gusset-right"]);
    const backs = s.panels!.filter((p) => p.surfaceId === "back");
    expect(backs.map((p) => [p.id, p.surfaceOffsetMm])).toEqual([["back-left", L / 2], ["back-right", 0]]);
    for (const surf of s.printSurfaces) {
      expect(surf.draw.rotate ?? 0).toBe(0); // upright in the web, like on the reel
      for (const p of parts.filter((x) => x.surface?.id === surf.id)) {
        const map = dev.panels.find((x) => x.part.id === p.id)!.map;
        expect(outerNormal(map), `${p.id} miroir`).toEqual(FACE_N[p.surface!.face].map((v) => v + 0));
        expect(rotationTowards(flatDir(map, FACE_UP[p.surface!.face]))).toBe(0);
        // 3D ↔ web: a point of the part sits at the same place of the artwork in both
        const r = FACE_RIGHT[p.surface!.face], k = ([0, 1, 2] as const).find((i) => r[i] !== 0)!;
        const owners = parts.filter((x) => x.surface?.id === surf.id);
        const u0 = Math.min(...owners.map((x) => (r[k] > 0 ? x.min[k] : -x.max[k])));
        const panel = s.panels!.find((x) => x.id === p.id)!, pr = box(panel.polygon);
        const mid = (p.min[k] + p.max[k]) / 2 + 0.25 * (p.max[k] - p.min[k]);
        const u3d = r[k] * mid - u0;
        const flatX = map[k]!.sign * mid + map[k]!.off - Math.min(...dev.panels.map((x) => x.rect[0])); // same shift as the sheet
        const uFlat = (panel.surfaceOffsetMm ?? 0) + (flatX - pr.x0);
        expect(uFlat, `${p.id} position dans l'illustration`).toBeCloseTo(u3d, 9);
      }
    }
  });

  it("I, J. ni fente, ni colle : un film formé, soudé", () => {
    expect(s.slits ?? []).toEqual([]);
    expect(s.glueZones).toBeUndefined();
    expect(s.glue).toBeUndefined();
  });
});

describe("L. aperçu et PDF : la même laize, la même matière", () => {
  it("chaque surface dessinée via drawSurface ; le dos en deux fenêtres de la même illustration", async () => {
    const { renderFlatArtwork } = await import("@/lib/print/artwork");
    const [, L, W, H, m] = FILM[0];
    const input = { model: "bag" as const, lengthMm: L, widthMm: W, heightMm: H, material: m };
    const layout = flatLayout(input);
    drawn.length = 0;
    const k = 2;
    renderFlatArtwork(layout, { palette: ["#ffffff", "#000000", "#ff0000"] } as never, k);
    expect(drawn.map((x) => x.id).sort()).toEqual(["back", "back", "front", "gusset-left", "gusset-right"]);
    for (const p of layout.panels.filter((x) => x.surfaceId === "back")) {
      const call = drawn.find((x) => x.id === "back" && Math.abs(x.x - (p.x + 3 - (p.surfaceOffsetMm ?? 0)) * k) < 1e-6)!;
      expect(call, `fenêtre ${p.x}`).toBeDefined();
      expect(call.w).toBeCloseTo(L * k, 9); // the whole back artwork, clipped to the window
    }
    expect(layout.formedFolds!.length).toBe(8); // 6 tube folds + 2 gusset centre folds (2C-4E-3)
    expect(layout.creases).toEqual([]);
    expect(layout.sealZones!.filter((z) => z.afterFilling).length).toBe(1);
  });

  it.each(FILM)("PDF %s = laize de l'aperçu (matière transmise), page = laize + fonds perdus + marges, annotations", async (id, L, W, H, m) => {
    const line = vi.spyOn(PDFPage.prototype, "drawLine");
    const svg = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const r = row(id);
    const shape = { id, name: r[1], model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m, dimensions: "" } as never;
    const res = await generatePrintPdf(shape, { palette: ["#ffffff", "#000000", "#ff0000"], headingFont: "Inter", bodyFont: "Inter" } as never, "Test");
    const editor = flatLayout({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m });
    expect(res.layout).toEqual(editor);
    expect(res.layout).not.toEqual(flatLayout({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: "Carton couché 350g" })); // thickness not dropped
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(res.bytes);
    for (const page of doc.getPages()) {
      expect(page.getWidth() / (72 / 25.4)).toBeCloseTo(res.layout.width + 6 + 36, 6);
      expect(page.getHeight() / (72 / 25.4)).toBeCloseTo(res.layout.height + 6 + 36, 6);
    }
    const lines = line.mock.calls.map((c) => c[0]!);
    expect(lines.filter((l) => l.dashArray === undefined && l.thickness === 0.75).length).toBe(res.layout.cut.length); // cut, no slit
    expect(lines.filter((l) => JSON.stringify(l.dashArray) === "[4,3]").length).toBe(0); // no crease
    expect(lines.filter((l) => JSON.stringify(l.dashArray) === "[1,2]").length).toBe(8); // formed folds (6 + 2 gusset centres, 2C-4E-3)
    expect(svg.mock.calls.length).toBe(4 + 2); // weld zones + the two seam technical zones (2C-4E-3)
    line.mockRestore();
    svg.mockRestore();
  });
});

describe("M. non concernés", () => {
  it("sac de farine toujours refusé ; autres familles inchangées", () => {
    const f = row("flour-bag");
    expect(resolveFlatLayout({ model: f[3], lengthMm: f[4], widthMm: f[5], heightMm: f[6], material: f[7] }).supported).toBe(false);
    const expected: Record<string, string> = {
      "tea-box": "tuckEndBox", "ecom-mailer": "rollEndTuckFront", "luxury-rigid-box": "rigidSetUp", "milk-carton": "gableTop", "food-tray": "gluedCornerTray",
      "stand-up-pouch": "frontBack", "sauce-bottle": "wrapLabel", "squeeze-tube": "wrapLabel",
    };
    for (const [id, tpl] of Object.entries(expected)) {
      const r = row(id);
      const st = resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(st.template, id).toBe(tpl);
      expect(st.formedFolds, id).toBeUndefined();
      expect(st.sealZones, id).toBeUndefined();
    }
  });
});
