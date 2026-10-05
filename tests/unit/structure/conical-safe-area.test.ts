/**
 * Phase 2C-4F-2: composition constraints on the developed wall of the 4 plastic tubs — safe area,
 * primary (front) area, recommended text rectangle and logo circle, score and orientation advice —
 * all inside the exact sector of 2C-4F-1, which they never change. Values come from the profile.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  LEVEL_TOLERANCE_DEG, PRIMARY_ARC_DEG, SAFE_MM, compositionScore, conicalSafeArea, coneToSurface, distanceToSeam, pointInRegion, polarOf, rectInRegion,
  regionOutline, resolveStructure, sectorOutline, textOrientationAt, tubWall, validatePackagingStructure, type Pt,
} from "@/lib/structure";
import { flatLayout } from "@/lib/print/layout";

vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), loadDesignFonts: async () => {}, drawFace: () => {}, drawWrap: () => {} }));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
vi.mock("@/lib/print/artwork", async (orig) => ({
  ...(await orig<typeof import("@/lib/print/artwork")>()),
  canvasToBlob: async () => new Blob([Buffer.from(PNG, "base64")], { type: "image/png" }),
}));
const strokes: number[][] = [];
beforeAll(() => {
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
      : k === "setLineDash" ? (d: number[]) => strokes.push(d) : () => {}),
  });
  const canvas = () => Object.defineProperties({ getContext: () => ctx }, { width: { get: () => 1, set: () => {} }, height: { get: () => 1, set: () => {} } });
  vi.stubGlobal("document", { createElement: canvas });
});

const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub").map((r) => [r[0], r[4], r[5], r[6], r[7]] as const);
const deg = (r: number) => (r * 180) / Math.PI;

describe.each(TUBS)("%s", (id, L, W, H, m) => {
  const { wall, coveredSlant } = tubWall(L, W, H);
  const sa = conicalSafeArea(wall, coveredSlant, { radialMarginMm: SAFE_MM });
  const sector = { rho0: wall.rIn, rho1: wall.rOut, psiMax: wall.angle / 2 };
  const seamPsi = wall.angle / 2 - sa.safe.psiMax;
  const safeOutline = regionOutline(wall, sa.safe), primaryOutline = regionOutline(wall, sa.primary);
  const t = sa.textArea;
  const logoPts: Pt[] = Array.from({ length: 72 }, (_, i) => [sa.logo.cx + sa.logo.r * Math.cos((i * Math.PI) / 36), sa.logo.cy + sa.logo.r * Math.sin((i * Math.PI) / 36)]);

  it("1-4. zone sûre : dans le secteur et la zone imprimée, hors bande du couvercle, loin de la couture", () => {
    expect(sa.printable).toEqual({ rho0: wall.rIn, rho1: wall.rOut - coveredSlant, psiMax: wall.angle / 2 });
    for (const p of safeOutline) {
      expect(pointInRegion(wall, sector, p)).toBe(true);
      expect(pointInRegion(wall, sa.printable, p)).toBe(true);
      expect(polarOf(wall, p).rho).toBeLessThanOrEqual(wall.rOut - coveredSlant - SAFE_MM + 1e-9); // below the covered band
      expect(distanceToSeam(wall, p)).toBeGreaterThanOrEqual(polarOf(wall, p).rho * Math.sin(seamPsi) - 1e-9);
    }
    expect(sa.safe.rho1).toBeLessThan(sa.printable.rho1);
    expect(sa.safe.psiMax).toBeLessThan(wall.angle / 2);
    // the covered band of the structure (TechnicalZone) and the safe area never meet
    const zone = resolveStructure({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m }).technicalZones![0].polygon;
    const zr = Math.min(...zone.map((p) => polarOf(wall, p).rho));
    expect(zr).toBeCloseTo(wall.rOut - coveredSlant, 9);
    expect(sa.safe.rho1).toBeLessThan(zr);
  });

  it("10-11. marges : radiale = SAFE_MM du projet, angulaire = la même longueur sur le cercle du bas (par défaut)", () => {
    expect(sa.radialMarginMm).toBe(SAFE_MM);
    expect(sa.safe.rho0 - sa.printable.rho0).toBeCloseTo(SAFE_MM, 9);
    expect(sa.printable.rho1 - sa.safe.rho1).toBeCloseTo(SAFE_MM, 9);
    expect(sa.angularMarginDeg).toBeCloseTo(deg(SAFE_MM / wall.r), 9);
    expect(deg((seamPsi * 2 * Math.PI) / wall.angle)).toBeCloseTo(sa.angularMarginDeg, 9); // around the pot
    // the margin, measured along the bottom circle of the pot, is SAFE_MM
    expect(wall.r * ((sa.angularMarginDeg * Math.PI) / 180)).toBeCloseTo(SAFE_MM, 9);
    // explicit options win
    const custom = conicalSafeArea(wall, coveredSlant, { radialMarginMm: 5, angularMarginDeg: 10 });
    expect(custom.safe.rho0 - wall.rIn).toBeCloseTo(5, 9);
    expect(deg(((wall.angle / 2 - custom.safe.psiMax) * 2 * Math.PI) / wall.angle)).toBeCloseTo(10, 9);
  });

  it("5-6. zone principale : dans la zone sûre, centrée sur la face, 120° du pot (ou moins si la zone sûre l'impose)", () => {
    expect([sa.primary.rho0, sa.primary.rho1]).toEqual([sa.safe.rho0, sa.safe.rho1]);
    expect(sa.primary.psiMax).toBeLessThanOrEqual(sa.safe.psiMax);
    expect(deg((sa.primary.psiMax * 2 * Math.PI) / wall.angle) * 2).toBeCloseTo(Math.min(PRIMARY_ARC_DEG, 360 - 2 * sa.angularMarginDeg), 9);
    for (const p of primaryOutline) {
      expect(pointInRegion(wall, sa.safe, p)).toBe(true);
      expect(pointInRegion(wall, sector, p)).toBe(true);
    }
    // the front of the pot (θ = 0) is its axis
    expect(pointInRegion(wall, sa.primary, coneToSurface(wall, 0, wall.h / 2))).toBe(true);
  });

  it("7-9, 13. texte et logo recommandés : dans la zone principale, donc hors couture et hors bande du couvercle ; pas la boîte englobante", () => {
    expect(rectInRegion(wall, sa.primary, t)).toBe(true);
    expect(rectInRegion(wall, sa.safe, t)).toBe(true);
    expect(rectInRegion(wall, sa.printable, t)).toBe(true);
    expect(t.w).toBeLessThan(wall.width); // never the bounding box width
    expect(t.x + t.w / 2).toBeCloseTo(wall.width / 2, 9); // centred on the front
    for (const p of logoPts) expect(pointInRegion(wall, sa.primary, p, 1e-6)).toBe(true);
    expect(sa.logo.cx).toBeCloseTo(wall.width / 2, 9);
    // maximal: a slightly bigger text rect or logo leaves the primary area
    expect(rectInRegion(wall, sa.primary, { x: t.x - 0.5, y: t.y, w: t.w + 1, h: t.h })).toBe(false);
    expect(rectInRegion(wall, sa.primary, { x: t.x, y: t.y - 0.5, w: t.w, h: t.h + 0.5 })).toBe(false);
    const bigger = Array.from({ length: 72 }, (_, i): Pt => [sa.logo.cx + (sa.logo.r + 0.5) * Math.cos((i * Math.PI) / 36), sa.logo.cy + (sa.logo.r + 0.5) * Math.sin((i * Math.PI) / 36)]);
    expect(bigger.every((p) => pointInRegion(wall, sa.primary, p))).toBe(false);
  });

  it("rectInRegion : refuse un bloc qui touche la couture, la bande du couvercle, l'arc du bas ou un coin hors secteur", () => {
    const seam = coneToSurface(wall, Math.PI * 0.999, wall.h / 2);
    expect(rectInRegion(wall, sa.safe, { x: seam[0] - 4, y: seam[1] - 2, w: 4, h: 4 })).toBe(false);
    const top = coneToSurface(wall, 0, wall.h); // in the covered band
    expect(rectInRegion(wall, sa.safe, { x: top[0] - 5, y: top[1] + 0.2, w: 10, h: 3 })).toBe(false);
    const bottom = coneToSurface(wall, 0, 0); // crest of the inner arc
    expect(rectInRegion(wall, sa.safe, { x: bottom[0] - 5, y: bottom[1] - 3, w: 10, h: 3.5 })).toBe(false);
    expect(rectInRegion(wall, sector, { x: 0, y: 0, w: 5, h: 5 })).toBe(false); // bounding-box corner, outside the sector
    const mid = coneToSurface(wall, 0, wall.h / 2);
    expect(rectInRegion(wall, sa.safe, { x: mid[0] - 2, y: mid[1] - 2, w: 4, h: 4 })).toBe(true);
  });

  it("score et orientation : favorable à la face, défavorable près de la couture, du couvercle et des bords", () => {
    // test artwork elements, placed by their position on the pot
    const el = (theta: number, y: number) => coneToSurface(wall, theta, y);
    // the logo at the centre of the safe area (front, mid safe height): the best place
    const logo: Pt = [wall.width / 2, wall.rOut - (sa.safe.rho0 + sa.safe.rho1) / 2];
    const title = el(0, wall.h * 0.45), body = el(0.6, wall.h * 0.45); // same height: only the distance to the front differs
    const nearSeam = el(Math.PI * 0.98, wall.h / 2), nearTop = el(0, wall.h - 0.5 * (coveredSlant / wall.slant) * wall.h), nearBottom = el(0, 0.2);
    expect(compositionScore(sa, logo)).toBeCloseTo(1, 12);
    expect(compositionScore(sa, el(0, wall.h / 2))).toBeGreaterThan(0.85); // mid wall: still front, a bit low
    expect(compositionScore(sa, title)).toBeGreaterThan(compositionScore(sa, body));
    // near the seam: very low inside the margin's edge, 0 beyond the seam margin
    expect(compositionScore(sa, nearSeam)).toBeLessThan(0.05);
    expect(compositionScore(sa, el(Math.PI * (1 - sa.angularMarginDeg / 360), wall.h / 2))).toBe(0);
    for (const p of [nearTop, nearBottom]) expect(compositionScore(sa, p)).toBe(0);
    expect(textOrientationAt(wall, logo)).toEqual({ tiltDeg: 0, tangentRotationDeg: 0, recommended: "upright" });
    const side = textOrientationAt(wall, el(Math.PI * 0.8, wall.h / 2));
    expect(side.recommended).toBe("tangent");
    expect(side.tiltDeg).toBeCloseTo(deg(polarOf(wall, el(Math.PI * 0.8, wall.h / 2)).psi), 9);
    expect(Math.abs(side.tiltDeg)).toBeGreaterThan(LEVEL_TOLERANCE_DEG);
    expect(textOrientationAt(wall, el(-Math.PI * 0.8, wall.h / 2)).tiltDeg).toBeLessThan(0); // the left side tilts the other way
  });

  it("12. déterministe ; structure valide ; guides dans le panneau", () => {
    expect(conicalSafeArea(wall, coveredSlant, { radialMarginMm: SAFE_MM })).toEqual(sa);
    const s = resolveStructure({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m });
    expect(validatePackagingStructure(s)).toEqual([]);
    expect(s.compositionGuides!.map((g) => g.kind)).toEqual(["safe", "primary", "text", "logo"]);
    expect(s.compositionGuides![0].polygon).toEqual(safeOutline);
    expect(s.compositionGuides![1].polygon).toEqual(primaryOutline);
  });

  it("régression : secteur, contour et surface de 2C-4F-1 inchangés ; le PDF ne trace aucun guide", async () => {
    const s = resolveStructure({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m });
    expect(s.cut).toEqual(sectorOutline(wall));
    expect(s.printSurfaces[0].shape!.printOutline).toEqual(sectorOutline(wall, wall.rIn, wall.rOut - coveredSlant));
    const line = vi.spyOn(PDFPage.prototype, "drawLine"), svg = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const res = await generatePrintPdf({ id, name: id, model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m, dimensions: "" } as never, { palette: ["#fff", "#000", "#f00"] } as never, "T");
    expect(res.layout.guides!.length).toBe(4); // carried by the layout…
    expect(line.mock.calls.length).toBe(res.layout.cut.length + 8); // …but the PDF draws only the cut (+ 8 crop marks)
    expect(svg.mock.calls.length).toBe(1); // the covered band only
    line.mockRestore();
    svg.mockRestore();
  });

  it("aperçu : les guides sont tracés par drawDieline (pointillés distincts)", async () => {
    const { drawDieline } = await import("@/lib/print/artwork");
    strokes.length = 0;
    drawDieline(document.createElement("canvas").getContext("2d")!, flatLayout({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m }), 2);
    for (const dash of [[4, 3], [8, 3, 2, 3], [2, 2]]) expect(strokes).toContainEqual(dash);
  });
});

describe("garde-fou", () => {
  it("des marges qui ne laissent aucune zone sûre sont refusées", () => {
    const { wall, coveredSlant } = tubWall(70, 70, 75);
    expect(() => conicalSafeArea(wall, coveredSlant, { radialMarginMm: wall.slant })).toThrow();
  });
});
