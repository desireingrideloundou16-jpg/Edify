/**
 * Phase 2C-4C: the postal mailer sheet is DEVELOPED from its assembly (fold tree of 2C-4C-0),
 * never drawn by hand. Checked here against the assembly itself, not against fixed coordinates.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { MAILER_RULES, mailerDims, materialThickness, resolveStructure, validatePackagingStructure, type AssemblyPart, type PackagingStructure, type Pt } from "@/lib/structure";
import { flatLayout, resolveFlatLayout } from "@/lib/print/layout";

let turn = 0;
const drawn: { id: string; x: number; y: number; w: number; h: number; turn: number }[] = [];
vi.mock("@/lib/artwork/surface", () => ({
  drawSurface: (_c: unknown, x: number, y: number, w: number, h: number, _d: unknown, s: { id: string }) => drawn.push({ id: s.id, x, y, w, h, turn }),
}));
vi.mock("@/lib/artwork/draw", async (orig) => ({
  ...(await orig<typeof import("@/lib/artwork/draw")>()),
  loadDesignFonts: async () => {},
  drawFace: () => { throw new Error("mailer panels must be drawn through drawSurface"); },
  drawWrap: () => { throw new Error("mailer panels must be drawn through drawSurface"); },
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

const MAILERS = SHAPE_ROWS.filter((r) => r[3] === "mailer").map((r) => [r[0], r[4], r[5], r[6], r[7]] as const);
const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;
type R = { x0: number; y0: number; x1: number; y1: number };
const box = (pts: Pt[]): R => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const panelRect = (s: PackagingStructure, id: string) => box(s.panels!.find((p) => p.id === id)!.polygon);
const segLen = ([a, b]: [Pt, Pt]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** Is segment [a, b] on the border of rect r (along one of its sides, within its extent)? */
const onBorder = ([a, b]: [Pt, Pt], r: R) =>
  (near(a[0], b[0]) && (near(a[0], r.x0) || near(a[0], r.x1)) && Math.min(a[1], b[1]) >= r.y0 - EPS && Math.max(a[1], b[1]) <= r.y1 + EPS) ||
  (near(a[1], b[1]) && (near(a[1], r.y0) || near(a[1], r.y1)) && Math.min(a[0], b[0]) >= r.x0 - EPS && Math.max(a[0], b[0]) <= r.x1 + EPS);
const sameSeg = (s: [Pt, Pt], t: [Pt, Pt]) =>
  [[s[0], s[1]], [s[1], s[0]]].some(([p, q]) => near(p[0], t[0][0]) && near(p[1], t[0][1]) && near(q[0], t[1][0]) && near(q[1], t[1][1]));
/** Edge of a panel carrying the TOP of its artwork, after the flat rotation (clockwise). */
function artworkTopEdge(r: R, rotate: number): [Pt, Pt] {
  switch (rotate) {
    case 90: return [[r.x1, r.y0], [r.x1, r.y1]];
    case 180: return [[r.x0, r.y1], [r.x1, r.y1]];
    case 270: return [[r.x0, r.y0], [r.x0, r.y1]];
    default: return [[r.x0, r.y0], [r.x1, r.y0]];
  }
}
/** Segment s lies on segment e (collinear, inside its extent). */
const within = (sg: [Pt, Pt], e: [Pt, Pt]) => sg.every((p) => {
  const cr = (e[1][0] - e[0][0]) * (p[1] - e[0][1]) - (e[1][1] - e[0][1]) * (p[0] - e[0][0]);
  return Math.abs(cr) < EPS && p[0] >= Math.min(e[0][0], e[1][0]) - EPS && p[0] <= Math.max(e[0][0], e[1][0]) + EPS && p[1] >= Math.min(e[0][1], e[1][1]) - EPS && p[1] <= Math.max(e[0][1], e[1][1]) + EPS;
});
const inPlaneSizes = (p: AssemblyPart) => [0, 1, 2].map((i) => p.max[i] - p.min[i]).sort((a, b) => a - b).slice(1);

describe("boîtes postales : patron développé depuis l'assemblage", () => {
  it("catalogue : les 4 boîtes postales sont supportées ; pizza et burger restent refusés proprement", () => {
    expect(MAILERS.map((r) => r[0])).toEqual(["ecom-mailer", "mailer-small", "mailer-large", "subscription-box"]);
    for (const id of ["pizza-box", "burger-box"]) {
      const r = SHAPE_ROWS.find((x) => x[0] === id)!;
      const res = resolveFlatLayout({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(res.supported, id).toBe(false);
      expect(() => flatLayout({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] })).toThrow();
    }
  });

  describe.each(MAILERS)("%s (%d × %d × %d, %s)", (_id, L, W, H, m) => {
    const s = resolveStructure({ model: "mailer", lengthMm: L, widthMm: W, heightMm: H, material: m });
    const parts = s.assembly!.parts, folds = s.assembly!.folds;
    const t = materialThickness(m).thicknessMm;
    const rects = s.panels!.map((p) => ({ id: p.id, ...box(p.polygon) }));

    it("structure : modèle mailer, assemblage présent, fermeture tuck, patron supporté et valide", () => {
      expect(s.model).toBe("mailer");
      expect(s.closure).toEqual({ kind: "tuck" });
      expect(s.dieline).toBe("supported");
      expect(s.template).toBe("rollEndTuckFront");
      expect(s.rootPanel).toBe("bottom");
      expect(validatePackagingStructure(s)).toEqual([]);
    });

    it("panneaux : une pièce de carton = un panneau, à ses dimensions, rien d'autre", () => {
      expect(s.panels!.map((p) => p.id).sort()).toEqual(parts.map((p) => p.id).sort());
      for (const p of parts) {
        const r = panelRect(s, p.id);
        expect([r.x1 - r.x0, r.y1 - r.y0].sort((a, b) => a - b).map((v) => +v.toFixed(6)), p.id).toEqual(inPlaneSizes(p).map((v) => +v.toFixed(6)));
        expect(s.panels!.find((x) => x.id === p.id)!.surfaceId).toBe(p.surface?.id);
      }
    });

    it("géométrie : aucun chevauchement, tout dans la feuille, feuille = boîte englobante des panneaux et du contour", () => {
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        expect(ox > EPS && oy > EPS, `${a.id} ∩ ${b.id}`).toBe(false);
      }
      const all = box(rects.flatMap((r) => [[r.x0, r.y0], [r.x1, r.y1]] as Pt[]));
      expect([all.x0, all.y0]).toEqual([0, 0]);
      expect(all.x1).toBeCloseTo(s.flatMm!.width, 9);
      expect(all.y1).toBeCloseTo(s.flatMm!.height, 9);
      const c = box(s.cut!);
      expect([c.x0, c.y0, c.x1, c.y1]).toEqual([all.x0, all.y0, all.x1, all.y1]);
    });

    it("découpe : un seul contour, fermé, simple, rectiligne, dont l'aire = somme des panneaux (pas de trou, pas de pièce en plus)", () => {
      expect(s.extraCuts).toBeUndefined();
      const cut = s.cut!;
      const n = cut.length;
      expect(new Set(cut.map((p) => p.join())).size).toBe(n); // no repeated vertex
      const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      for (let i = 0; i < n; i++) {
        const a = cut[i], b = cut[(i + 1) % n];
        expect(near(a[0], b[0]) || near(a[1], b[1])).toBe(true); // axis-aligned edges
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const c = cut[j], d = cut[(j + 1) % n];
          expect(cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0).toBe(false);
        }
      }
      let area = 0;
      for (let i = 0; i < n; i++) area += cut[i][0] * cut[(i + 1) % n][1] - cut[(i + 1) % n][0] * cut[i][1];
      expect(Math.abs(area) / 2).toBeCloseTo(rects.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0), 6);
    });

    it("plis : un pli par pli de l'assemblage, sur la frontière commune des deux panneaux, à la longueur de l'arête 3D", () => {
      expect(s.creases!.length).toBe(folds.length);
      expect(s.hinges!.map((h) => h.id).sort()).toEqual(folds.map((f) => f.id).sort()); // tree traversal order
      for (const h of s.hinges!) {
        const f = folds.find((x) => x.id === h.id)!;
        expect([h.from, h.to]).toEqual([f.from, f.to]);
        expect(h.foldedAngleDeg).toBe(f.angleDeg);
        expect(s.creases!.some((c) => sameSeg(c, h.line))).toBe(true); // no orphan crease / hinge
        expect(onBorder(h.line, panelRect(s, f.from)), `${f.id} / ${f.from}`).toBe(true);
        expect(onBorder(h.line, panelRect(s, f.to)), `${f.id} / ${f.to}`).toBe(true);
        expect(segLen(h.line)).toBeCloseTo(Math.hypot(...[0, 1, 2].map((i) => f.edge[1][i] - f.edge[0][i])), 9);
        // a crease is inside the sheet, never on the cut
        const mid: Pt = [(h.line[0][0] + h.line[1][0]) / 2, (h.line[0][1] + h.line[1][1]) / 2];
        const onCut = s.cut!.some((a, i) => {
          const b = s.cut![(i + 1) % s.cut!.length];
          return onBorder([a, b], { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) }) &&
            ((near(a[0], b[0]) && near(mid[0], a[0]) && mid[1] > Math.min(a[1], b[1]) && mid[1] < Math.max(a[1], b[1])) ||
              (near(a[1], b[1]) && near(mid[1], a[1]) && mid[0] > Math.min(a[0], b[0]) && mid[0] < Math.max(a[0], b[0])));
        });
        expect(onCut, h.id).toBe(false);
      }
      expect(s.hinges!.filter((h) => folds.find((f) => f.id === h.id)!.hinge).map((h) => [h.from, h.to])).toEqual([["back", "top"]]);
    });

    it("contacts : deux panneaux qui se touchent sont soit pliés ensemble (pli), soit séparés par une fente — jamais soudés par erreur", () => {
      const slits = s.slits!;
      let contact = 0;
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const v = near(a.x1, b.x0) || near(b.x1, a.x0), hz = near(a.y1, b.y0) || near(b.y1, a.y0);
        const len = v ? Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) : hz ? Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) : 0;
        if (len <= EPS) continue;
        contact += len;
        const folded = s.hinges!.filter((h) => (h.from === a.id && h.to === b.id) || (h.from === b.id && h.to === a.id)).reduce((t2, h) => t2 + segLen(h.line), 0);
        const cut = slits.filter((sl) => onBorder(sl, a) && onBorder(sl, b)).reduce((t2, sl) => t2 + segLen(sl), 0);
        expect(folded + cut, `${a.id} | ${b.id}`).toBeCloseTo(len, 6);
      }
      expect(contact).toBeGreaterThan(0);
      // the 4 corners of the bottom: side wall freed from the ear and from the front / back wall
      expect(slits.length).toBe(8);
      for (const sl of slits) expect(s.creases!.some((c) => sameSeg(c, sl))).toBe(false);
      for (const sl of slits) expect(segLen(sl)).toBeGreaterThan(0);
    });

    it("rabat d'insertion, rabats anti-poussière, oreilles : attachés au bon panneau, tailles = MAILER_RULES", () => {
      const d = mailerDims(L, W, H, t);
      const top = panelRect(s, "top"), back = panelRect(s, "back"), tuck = panelRect(s, "tuck");
      expect(near(top.y0, back.y1)).toBe(true); // lid beyond the back (hinge)
      expect(near(tuck.y0, top.y1)).toBe(true); // tuck beyond the lid, away from the hinge
      expect([tuck.x0, tuck.x1]).toEqual([top.x0, top.x1]);
      expect(tuck.y1 - tuck.y0).toBeCloseTo(MAILER_RULES.tuck * d.innerH, 9);
      for (const n of ["left", "right"]) {
        const dust = panelRect(s, `dust-${n}`);
        expect(n === "left" ? near(dust.x1, top.x0) : near(dust.x0, top.x1)).toBe(true);
        expect(dust.x1 - dust.x0).toBeCloseTo(MAILER_RULES.dust * d.innerH, 9);
        for (const w of ["front", "back"]) {
          const ear = panelRect(s, `ear-${w}-${n}`), wall = panelRect(s, w);
          expect(n === "left" ? near(ear.x1, wall.x0) : near(ear.x0, wall.x1)).toBe(true);
          expect(ear.x1 - ear.x0).toBeCloseTo(MAILER_RULES.ear * (W - 2 * t), 9);
        }
      }
    });

    it("pas de colle : aucune patte de collage", () => {
      expect(s.glue ?? []).toEqual([]);
      expect(s.printSurfaces.some((x) => x.id.startsWith("glue"))).toBe(false);
    });

    it("surfaces : chaque surface imprimée sur son panneau ; le haut de l'illustration est sur le bon pli physique", () => {
      const TOP_EDGE: Record<string, string> = {
        front: "front-roll", left: "left-roll", right: "right-roll", back: "lid-hinge", top: "lid-hinge", bottom: "bottom-front",
      };
      for (const surf of s.printSurfaces) {
        const p = s.panels!.find((x) => x.surfaceId === surf.id)!;
        const r = box(p.polygon);
        const quarter = surf.draw.rotate === 90 || surf.draw.rotate === 270;
        expect(quarter ? [r.y1 - r.y0, r.x1 - r.x0] : [r.x1 - r.x0, r.y1 - r.y0]).toEqual([surf.wMm, surf.hMm].map((v) => expect.closeTo(v, 9)));
        const hinge = s.hinges!.find((h) => h.id === TOP_EDGE[surf.id])!;
        // the crease lies on the edge that carries the top of the artwork
        expect(within(hinge.line, artworkTopEdge(r, surf.draw.rotate ?? 0)), `${surf.id} : haut sur ${hinge.id}`).toBe(true);
      }
    });
  });
});

describe("dessin et PDF", () => {
  it("chaque surface imprimée est dessinée une fois, à l'endroit, tournée selon draw.rotate, centrée sur son panneau", async () => {
    const { renderFlatArtwork } = await import("@/lib/print/artwork");
    const dims = { model: "mailer" as const, lengthMm: 220, widthMm: 160, heightMm: 60, material: "Carton ondulé E" };
    const layout = flatLayout(dims), s = resolveStructure(dims);
    drawn.length = 0;
    const k = 2;
    renderFlatArtwork(layout, { palette: ["#ffffff", "#000000", "#ff0000"] } as never, k);
    expect(drawn.map((d) => d.id).sort()).toEqual(s.printSurfaces.map((x) => x.id).sort());
    for (const d of drawn) {
      const surf = s.printSurfaces.find((x) => x.id === d.id)!;
      expect(d.w).toBeCloseTo(surf.wMm * k, 9);
      expect(d.h).toBeCloseTo(surf.hMm * k, 9);
      expect(d.turn).toBe(surf.draw.rotate ?? 0);
      const p = layout.panels.find((x) => x.surfaceId === d.id)!;
      expect(d.x + d.w / 2).toBeCloseTo((p.x + 3 + p.w / 2) * k, 9);
      expect(d.y + d.h / 2).toBeCloseTo((p.y + 3 + p.h / 2) * k, 9);
    }
  });

  it.each([["ecom-mailer"], ["mailer-large"]])("PDF %s : page = feuille + fonds perdus + marges ; contour, fentes et plis vectoriels", async (id) => {
    const r = SHAPE_ROWS.find((x) => x[0] === id)!;
    const spy = vi.spyOn(PDFPage.prototype, "drawLine");
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const shape = { id, name: r[1], model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7], dimensions: "" } as never;
    const res = await generatePrintPdf(shape, { palette: ["#ffffff", "#000000", "#ff0000"], headingFont: "Inter", bodyFont: "Inter" } as never, "Test");
    // the PDF uses exactly the editor sheet (material included: t drives the folded sheet)
    const editor = flatLayout({ model: "mailer", lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
    expect(res.layout).toEqual(editor);
    expect(res.layout).not.toEqual(flatLayout({ model: "mailer", lengthMm: r[4], widthMm: r[5], heightMm: r[6] }));
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(res.bytes);
    const MM = 72 / 25.4;
    for (const page of doc.getPages()) {
      expect(page.getWidth() / MM).toBeCloseTo(res.layout.width + 2 * 3 + 2 * 18, 6);
      expect(page.getHeight() / MM).toBeCloseTo(res.layout.height + 2 * 3 + 2 * 18, 6);
    }
    const lines = spy.mock.calls.map((c) => c[0]!);
    const magenta = lines.filter((l) => l.dashArray === undefined && l.thickness === 0.75);
    expect(magenta.length).toBe(res.layout.cut.length + res.layout.slits!.length);
    expect(lines.filter((l) => Array.isArray(l.dashArray) && l.thickness === 0.6).length).toBe(res.layout.creases.length);
    spy.mockRestore();
  });
});

describe("non-régression des autres familles", () => {
  it("bouteille, tube, pot, canette, doypack, sachet, brique, coffret, étui : patron inchangé dans son principe, sans fentes ni assemblage", () => {
    const expected: Record<string, string> = {
      "sauce-bottle": "wrapLabel", "squeeze-tube": "wrapLabel", "milk-carton": "gableTop", "luxury-rigid-box": "rigidSetUp",
    };
    for (const [id, tpl] of Object.entries(expected)) {
      const r = SHAPE_ROWS.find((x) => x[0] === id)!;
      const s = resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(s.template, id).toBe(tpl);
      expect(s.slits, id).toBeUndefined();
      expect(s.hinges, id).toBeUndefined();
    }
    for (const model of ["bottle", "tube", "jar", "can", "pouch", "sachet", "carton", "rigid", "box"] as const) {
      const s = resolveStructure({ model, lengthMm: 70, widthMm: 50, heightMm: 160, material: "Carton couché 350g" });
      expect(s.dieline, model).toBe("supported");
      expect(s.assembly, model).toBeUndefined();
      expect(s.slits, model).toBeUndefined();
    }
  });
});
