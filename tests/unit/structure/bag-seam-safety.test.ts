/**
 * Phase 2C-4E-3: technical zone of the dorsal fin seam (derived from the weld, not drawn by hand)
 * and the centre fold of each gusset (formed, inside its gusset, between the welds) of the film bags.
 * Nothing else of the web changes.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { BAG_ROOT, bagAssembly, bagDims, materialThickness, resolveStructure, validatePackagingStructure, type PackagingStructure, type Pt } from "@/lib/structure";
import { foldedSheet } from "@/lib/structure/dieline";
import { flatLayout } from "@/lib/print/layout";

vi.mock("@/lib/artwork/surface", () => ({ drawSurface: () => {} }));
vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), loadDesignFonts: async () => {}, drawFace: () => {}, drawWrap: () => {} }));
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
/** Web and PDF sizes validated in 2C-4E-2: must not move. */
const SIZES: Record<string, [number, number]> = {
  "rice-bag": [615.6, 348.6], "gari-bag": [530.4, 294.46], "pet-food-bag": [735.6, 420.67], "coffee-bag-gusset": [386.7, 264.41],
};
const EPS = 1e-6;
type R = { x0: number; y0: number; x1: number; y1: number };
const box = (pts: Pt[]): R => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const R_ = (s: PackagingStructure, id: string) => box(s.panels!.find((p) => p.id === id)!.polygon);
const within = (r: R, o: R) => r.x0 >= o.x0 - EPS && r.x1 <= o.x1 + EPS && r.y0 >= o.y0 - EPS && r.y1 <= o.y1 + EPS;
const overlaps = (a: R, b: R) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > EPS;

describe.each(FILM)("%s", (id, L, W, H, m) => {
  const s = resolveStructure({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m });
  const d = bagDims(L, W, H, materialThickness(m).thicknessMm);
  const seal = (zid: string) => box(s.sealZones!.find((z) => z.id === zid)!.polygon);

  it("1, 4. zone technique de couture : présente, sur le dos (une seule surface logique back), structure valide", () => {
    expect(validatePackagingStructure(s)).toEqual([]);
    const tz = s.technicalZones!;
    expect(tz.length).toBe(2);
    for (const z of tz) {
      expect(z.kind).toBe("seam");
      expect(z.surfaceId).toBe("back");
      expect(["back-left", "back-right"]).toContain(z.panel);
      expect(within(box(z.polygon), R_(s, z.panel))).toBe(true);
    }
    expect(new Set(tz.map((z) => z.panel)).size).toBe(2); // one on each half of the back
    expect(s.printSurfaces.map((x) => x.id)).toEqual(["front", "back", "gusset-left", "gusset-right"]);
    expect(s.printSurfaces.find((x) => x.id === "back")!.printable).toBe(true); // still printed
  });

  it("2, 3. largeur = celle de l'aileron soudé ; collée à la couture (bord du demi-dos côté aileron) ; entre les soudures", () => {
    for (const z of s.technicalZones!) {
      const r = box(z.polygon), panel = R_(s, z.panel);
      const fin = z.panel === "back-left" ? R_(s, "fin-left") : R_(s, "fin-right");
      expect(r.x1 - r.x0).toBeCloseTo(fin.x1 - fin.x0, 9);
      expect(r.x1 - r.x0).toBeCloseTo(d.fin, 9);
      // the seam edge of the half back is the one it shares with its fin
      const seamX = Math.abs(panel.x0 - fin.x1) < EPS ? panel.x0 : panel.x1;
      expect(Math.abs(r.x0 - seamX) < EPS || Math.abs(r.x1 - seamX) < EPS).toBe(true);
      // the printable length of the back (between the top and bottom welds)
      expect(r.y0).toBeCloseTo(seal("seal-top").y1, 9);
      expect(r.y1).toBeCloseTo(seal("seal-bottom").y0, 9);
      const area = s.printSurfaces.find((x) => x.id === "back")!.printArea!;
      expect(r.y1 - r.y0).toBeCloseTo(area.h, 9);
    }
  });

  it("5. fenêtres du dos inchangées", () => {
    expect(s.panels!.filter((p) => p.surfaceId === "back").map((p) => [p.id, p.surfaceOffsetMm])).toEqual([["back-left", L / 2], ["back-right", 0]]);
  });

  it("6-9. exactement deux plis centraux, formés, dans leur soufflet, au milieu, sans toucher soudures ni ailerons", () => {
    const inner = s.innerFolds!;
    expect(inner.map((f) => [f.id, f.panel, f.kind])).toEqual([["gusset-left-centre", "gusset-left", "formed"], ["gusset-right-centre", "gusset-right", "formed"]]);
    for (const f of inner) {
      const r = box(f.line), g = R_(s, f.panel);
      expect(r.x0).toBeCloseTo(r.x1, 12); // along the gusset
      expect(r.x0).toBeCloseTo((g.x0 + g.x1) / 2, 9); // its centre
      expect(r.x0 > g.x0 + EPS && r.x1 < g.x1 - EPS).toBe(true); // inside the gusset, not on its edges
      // printable length: from the bottom weld to the top weld, crossing none
      expect(r.y0).toBeCloseTo(seal("seal-top").y1, 9);
      expect(r.y1).toBeCloseTo(seal("seal-bottom").y0, 9);
      for (const z of s.sealZones!) expect(overlaps({ x0: r.x0 - 1e-3, x1: r.x1 + 1e-3, y0: r.y0 + 1e-3, y1: r.y1 - 1e-3 }, box(z.polygon)), z.id).toBe(false);
      for (const fin of ["fin-left", "fin-right"]) expect(overlaps({ x0: r.x0 - 1e-3, x1: r.x1 + 1e-3, y0: r.y0, y1: r.y1 }, R_(s, fin))).toBe(false);
      // drawn as formed folds, never as creases
      expect(s.formedFolds!.some((x) => JSON.stringify(x) === JSON.stringify(f.line))).toBe(true);
      expect(s.creases!.some((x) => JSON.stringify(x) === JSON.stringify(f.line))).toBe(false);
    }
    expect(s.creases).toEqual([]);
  });

  it("10-13. laize inchangée : mêmes dimensions, un seul contour à 4 sommets, aucune fente, aucune colle", () => {
    expect([+s.flatMm!.width.toFixed(2), +s.flatMm!.height.toFixed(2)]).toEqual(SIZES[id]);
    expect(s.cut!.length).toBe(4);
    expect(s.extraCuts).toBeUndefined();
    expect(s.slits ?? []).toEqual([]);
    expect(s.glueZones).toBeUndefined();
  });
});

describe("2. la largeur suit la soudure physique (aileron élargi dans une copie de l'assemblage)", () => {
  it("aileron de 30 mm au lieu de la règle : la zone technique fait 30 mm", () => {
    const { parts, folds, endSeals } = bagAssembly(200, 90, 330, 0.1);
    const wide = parts.map((p) => (p.id.startsWith("fin-") ? { ...p, min: [p.min[0], p.min[1], p.max[2] - 30] as typeof p.min } : p));
    const sheet = foldedSheet(wide, folds, BAG_ROOT, "test", endSeals);
    expect(sheet.technicalZones!.length).toBe(2);
    for (const z of sheet.technicalZones!) expect(box(z.polygon).x1 - box(z.polygon).x0).toBeCloseTo(30, 9);
    // and the regular one is the rule's
    const regular = foldedSheet(parts, folds, BAG_ROOT, "test", endSeals);
    for (const z of regular.technicalZones!) expect(box(z.polygon).x1 - box(z.polygon).x0).toBeCloseTo(bagDims(200, 90, 330, 0.1).fin, 9);
  });
});

describe("14. aperçu et PDF : mêmes données", () => {
  it.each(FILM)("%s : le PDF trace les zones techniques et les plis centraux du même FlatLayout", async (id, L, W, H, m) => {
    const line = vi.spyOn(PDFPage.prototype, "drawLine");
    const svg = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const r = row(id);
    const res = await generatePrintPdf({ id, name: r[1], model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m, dimensions: "" } as never, { palette: ["#ffffff", "#000000", "#ff0000"] } as never, "T");
    const layout = flatLayout({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m });
    expect(res.layout).toEqual(layout);
    const s = resolveStructure({ model: "bag", lengthMm: L, widthMm: W, heightMm: H, material: m });
    expect(layout.technicalZones).toEqual(s.technicalZones!.map((z) => ({ polygon: z.polygon, kind: z.kind })));
    for (const f of s.innerFolds!) expect(layout.formedFolds).toContainEqual(f.line);
    // the PDF draws those very polygons / lines (green dotted zones, dotted formed folds)
    const MM = 72 / 25.4, ox = 18 + 3, oy = 18 + 3;
    const zoneCalls = svg.mock.calls.filter((c) => JSON.stringify(c[1]?.borderDashArray) === "[1,1.5]");
    expect(zoneCalls.map((c) => c[0])).toEqual(layout.technicalZones!.map(({ polygon: z }) => z.map(([x, y], i) => `${i ? "L" : "M"} ${(ox + x) * MM} ${-(oy + y) * MM}`).join(" ") + " Z"));
    expect(line.mock.calls.filter((c) => JSON.stringify(c[0]!.dashArray) === "[1,2]").length).toBe(layout.formedFolds!.length);
    line.mockRestore();
    svg.mockRestore();
  });
});

describe("non-régression", () => {
  it("les autres familles n'ont ni zone technique ni pli intérieur", () => {
    for (const id of ["tea-box", "ecom-mailer", "luxury-rigid-box", "milk-carton", "food-tray", "stand-up-pouch", "sauce-bottle", "squeeze-tube"]) {
      const r = row(id);
      const st = resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(st.technicalZones, id).toBeUndefined();
      expect(st.innerFolds, id).toBeUndefined();
    }
  });
});
