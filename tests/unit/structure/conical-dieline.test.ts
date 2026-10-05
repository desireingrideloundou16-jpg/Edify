/**
 * Phase 2C-4F-1: the 4 plastic tubs — print surface = developed wall (annular sector), 3D UVs from that
 * sector (no more 14 % squeeze at the bottom), band under the lid not printed, the same FlatLayout for
 * the preview and the PDF. The paper ice-cream tub stays refused.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PDFPage } from "pdf-lib";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { coneToSurface, cylinderWrap, resolveStructure, sectorOutline, tubWall, validatePackagingStructure, type Pt } from "@/lib/structure";
import { flatLayout, resolveFlatLayout } from "@/lib/print/layout";

const drawn: { id: string; x: number; y: number; w: number; h: number }[] = [];
vi.mock("@/lib/artwork/surface", async (orig) => {
  const real = await orig<typeof import("@/lib/artwork/surface")>();
  return {
    ...real,
    drawSurface: (...a: Parameters<typeof real.drawSurface>) => { drawn.push({ id: a[6].id, x: a[1], y: a[2], w: a[3], h: a[4] }); },
  };
});
vi.mock("@/lib/artwork/draw", async (orig) => ({ ...(await orig<typeof import("@/lib/artwork/draw")>()), loadDesignFonts: async () => {}, drawFace: () => {}, drawWrap: () => {} }));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
vi.mock("@/lib/print/artwork", async (orig) => ({
  ...(await orig<typeof import("@/lib/print/artwork")>()),
  canvasToBlob: async () => new Blob([Buffer.from(PNG, "base64")], { type: "image/png" }),
}));
const design = { brandName: "T", productName: "P", tagline: "", volume: "", palette: ["#ffffff", "#1f2937", "#b91c1c"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", logo: null } as never;
beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, k) => (k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  const canvas = () => Object.defineProperties({ getContext: () => ctx }, { width: { get: () => 1, set: () => {} }, height: { get: () => 1, set: () => {} } });
  vi.stubGlobal("document", { createElement: canvas });
});

const row = (id: string) => SHAPE_ROWS.find((r) => r[0] === id)!;
const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub").map((r) => [r[0], r[4], r[5], r[6], r[7]] as const);
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const area = (poly: Pt[]) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

describe.each(TUBS)("%s (%d × %d × %d, %s)", (_id, L, W, H, m) => {
  const input = { model: "tub" as const, lengthMm: L, widthMm: W, heightMm: H, material: m };
  const s = resolveStructure(input);
  const { wall, covered, coveredSlant, lidH } = tubWall(L, W, H);
  const surf = s.printSurfaces[0];
  const apex = [wall.width / 2, wall.rOut];

  it("statut : supporté par le secteur développé, structure valide, aucun pli / fente / colle / seconde pièce", () => {
    expect([s.dieline, s.template, s.family]).toEqual(["supported", "conicalWrap", "profile"]);
    expect(validatePackagingStructure(s)).toEqual([]);
    expect(s.creases).toEqual([]);
    expect(s.formedFolds).toBeUndefined();
    expect(s.slits ?? []).toEqual([]);
    expect(s.glueZones).toBeUndefined();
    expect(s.extraCuts).toBeUndefined();
    expect(resolveFlatLayout(input).supported).toBe(true);
  });

  it("10-14. contour : un seul secteur fermé, pas un rectangle, arcs exacts, aire = surface latérale du cône", () => {
    const cut = s.cut!;
    expect(cut).toEqual(sectorOutline(wall));
    expect(cut.length).toBeGreaterThan(8);
    const n = cut.length / 2;
    for (const p of cut.slice(0, n)) expect(dist(p, apex)).toBeCloseTo(wall.rOut, 9);
    for (const p of cut.slice(n)) expect(dist(p, apex)).toBeCloseTo(wall.rIn, 9);
    // no self-intersection
    const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    for (let i = 0; i < cut.length; i++) for (let j = i + 2; j < cut.length; j++) {
      if (i === 0 && j === cut.length - 1) continue;
      const [a, b, c, d] = [cut[i], cut[(i + 1) % cut.length], cut[j], cut[(j + 1) % cut.length]];
      expect(cross(a, b, c) * cross(a, b, d) < -1e-9 && cross(c, d, a) * cross(c, d, b) < -1e-9).toBe(false);
    }
    // physical lateral area of the frustum π(R + r)·g; the polygon is inscribed (chords ≤ 0.01 mm off)
    const lateral = Math.PI * (wall.R + wall.r) * wall.slant;
    expect(area(cut)).toBeLessThanOrEqual(lateral + 1e-6);
    expect(lateral - area(cut)).toBeLessThan(lateral * 1e-4);
    // the sheet is the sector's box, nothing around it
    expect([s.flatMm!.width, s.flatMm!.height]).toEqual([wall.width, wall.height]);
    expect(s.panels!.map((p) => [p.id, p.surfaceId])).toEqual([["wrap", "wrap"]]);
    expect(s.panels![0].polygon).toEqual(cut);
  });

  it("15-17. couture au dos (les deux côtés radiaux), face au centre, pas de miroir", () => {
    const cut = s.cut!, n = cut.length / 2;
    // the two radial sides join the arcs' ends: angle ±φ/2 from the axis = θ ±π on the pot
    for (const [a, b] of [[cut[0], cut[cut.length - 1]], [cut[n - 1], cut[n]]] as const) {
      expect(Math.atan2(a[0] - apex[0], apex[1] - a[1])).toBeCloseTo(Math.atan2(b[0] - apex[0], apex[1] - b[1]), 9);
      expect(Math.abs(Math.atan2(a[0] - apex[0], apex[1] - a[1]))).toBeCloseTo(wall.angle / 2, 9);
    }
    expect(coneToSurface(wall, -Math.PI, wall.h)).toEqual(cut[0].map((v) => expect.closeTo(v, 9)));
    expect(coneToSurface(wall, Math.PI, wall.h)).toEqual(cut[n - 1].map((v) => expect.closeTo(v, 9)));
    expect(coneToSurface(wall, 0.3, wall.h)[0]).toBeGreaterThan(wall.width / 2);
  });

  it("5, 18. surface imprimable = le secteur (forme native), zone imprimée sans la bande du couvercle", () => {
    expect(surf.id).toBe("wrap");
    expect([surf.wMm, surf.hMm]).toEqual([wall.width, wall.height]);
    expect(surf.shape!.outline).toEqual(s.cut);
    expect(surf.shape!.printOutline).toEqual(sectorOutline(wall, wall.rIn, wall.rOut - coveredSlant));
    const xs = surf.shape!.printOutline.map((p) => p[0]), ys = surf.shape!.printOutline.map((p) => p[1]);
    expect(surf.printArea).toEqual({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    expect(surf.printArea!.y).toBeCloseTo(coveredSlant, 9); // starts below the covered band
  });

  it("9, 19. bande sous le couvercle : dérivée de la jupe du couvercle 3D, zone technique non imprimée", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging(input, design);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const lid = meshes.find((x) => x.geometry.type === "CylinderGeometry" && !(x.geometry as THREE.CylinderGeometry).parameters.openEnded)!;
    const p = (lid.geometry as THREE.CylinderGeometry).parameters;
    const body = meshes.find((x) => (x.material as THREE.MeshStandardMaterial).userData.surfaceId === "wrap")!;
    // positions in the pack frame (mm): the skirt starts at its bottom, the wall stops at its top
    const lidBottom = lid.position.y - p.height / 2;
    const wallTop = body.position.y + (body.geometry as THREE.CylinderGeometry).parameters.height / 2;
    expect(p.height).toBeCloseTo(lidH, 9);
    expect(p.radiusTop).toBeGreaterThan(wall.R); // the skirt goes around the wall
    expect(lidBottom).toBeLessThan(wallTop);
    expect(covered).toBeCloseTo(wallTop - lidBottom, 9);
    expect(cylinderWrap("tub", L, W, H).bodyH).toBeCloseTo(wallTop, 9);
    const tz = s.technicalZones!;
    expect(tz.map((z) => [z.id, z.kind, z.panel, z.surfaceId])).toEqual([["covered-by-lid", "covered", "wrap", "wrap"]]);
    expect(tz[0].polygon).toEqual(sectorOutline(wall, wall.rOut - coveredSlant, wall.rOut));
    expect(coveredSlant).toBeCloseTo((covered / wall.h) * wall.slant, 12);
  });

  it("CRITIQUE — plus de compression : en 3D, 1 mm d'illustration = 1 mm de paroi, en haut comme en bas", async () => {
    const { buildPackaging } = await import("@/lib/three/packagingModels");
    const obj = buildPackaging(input, design);
    const meshes: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const body = meshes.find((x) => (x.material as THREE.MeshStandardMaterial).userData.surfaceId === "wrap")!;
    const g = body.geometry as THREE.CylinderGeometry;
    expect((body.material as THREE.MeshStandardMaterial).map!.userData.mm).toEqual([wall.width, wall.height]);
    const pos = g.getAttribute("position"), uv = g.getAttribute("uv");
    const seg = g.parameters.radialSegments;
    const at = (i: number) => [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const flat = (i: number) => [uv.getX(i) * wall.width, (1 - uv.getY(i)) * wall.height];
    // CylinderGeometry vertices: top ring 0..seg, then bottom ring seg+1..2seg+1
    for (const ring of [0, seg + 1]) {
      let ratio = 0;
      for (let k = 0; k < seg; k++) ratio += dist(flat(ring + k), flat(ring + k + 1)) / dist(at(ring + k), at(ring + k + 1));
      // 1 within the facet effect (chord of 1/96 turn vs its developed arc: Δθ²/24 ≈ 1.8e-4); was 0.86 at the bottom
      expect(Math.abs(ratio / seg - 1), ring ? "bas" : "haut").toBeLessThan(5e-4);
    }
    for (let k = 0; k <= seg; k++) {
      // float32 vertices and UVs: 1e-4 mm
      expect(dist(flat(k), flat(seg + 1 + k))).toBeCloseTo(dist(at(k), at(seg + 1 + k)), 4); // along the generatrix
      // every vertex lands inside the sector: on the outer (top) or inner (bottom) arc
      expect(dist(flat(k), [wall.width / 2, wall.rOut])).toBeCloseTo(wall.rOut, 3);
      expect(dist(flat(seg + 1 + k), [wall.width / 2, wall.rOut])).toBeCloseTo(wall.rIn, 3);
    }
    // the seam column is split: u = 0 on the left side, u = 1 on the right side of the sector
    expect(flat(0)[0]).toBeCloseTo(0, 3);
    expect(flat(seg)[0]).toBeCloseTo(wall.width, 3);
  });

  it("11. illustration : dessinée dans le repère du secteur, à sa taille, jamais redimensionnée", async () => {
    const { renderFlatArtwork } = await import("@/lib/print/artwork");
    drawn.length = 0;
    const layout = flatLayout(input), k = 2;
    renderFlatArtwork(layout, design, k);
    expect(drawn.map((d) => d.id)).toEqual(["wrap"]);
    expect(drawn[0].w).toBeCloseTo(wall.width * k, 9);
    expect(drawn[0].h).toBeCloseTo(wall.height * k, 9);
    expect(drawn[0].x).toBeCloseTo(3 * k, 9);
  });

  it("20. PDF = aperçu : même FlatLayout (matière transmise), contour vectoriel, zone sous couvercle, aucun pli", async () => {
    const line = vi.spyOn(PDFPage.prototype, "drawLine");
    const svg = vi.spyOn(PDFPage.prototype, "drawSvgPath");
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const r = row(_id);
    const res = await generatePrintPdf({ id: _id, name: r[1], model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m, dimensions: "" } as never, design, "T");
    expect(res.layout).toEqual(flatLayout(input));
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(res.bytes);
    expect(doc.getPage(0).getWidth() / (72 / 25.4)).toBeCloseTo(wall.width + 6 + 36, 6);
    expect(doc.getPage(0).getHeight() / (72 / 25.4)).toBeCloseTo(wall.height + 6 + 36, 6);
    const lines = line.mock.calls.map((c) => c[0]!);
    expect(lines.filter((l) => l.dashArray === undefined && l.thickness === 0.75).length).toBe(res.layout.cut.length);
    expect(lines.filter((l) => Array.isArray(l.dashArray) && l.thickness === 0.6).length).toBe(0);
    expect(svg.mock.calls.filter((c) => JSON.stringify(c[1]?.borderDashArray) === "[1,1.5]").length).toBe(1);
    line.mockRestore();
    svg.mockRestore();
  });
});

describe("non concernés", () => {
  it("pot de glace (carton) : refusé, ancienne surface rectangulaire, aucun gabarit", () => {
    const r = row("ice-cream-tub");
    expect(r[3]).toBe("papertub");
    const s = resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
    expect(s.dieline).toBe("unsupported");
    expect(s.dielineNote).toMatch(/carton/);
    expect(s.cut).toBeUndefined();
    expect(s.printSurfaces[0].shape).toBeUndefined();
    expect(s.printSurfaces[0].wMm).toBeCloseTo(Math.PI * r[4], 9);
  });

  it("autres formats refusés inchangés ; familles supportées inchangées", () => {
    for (const id of ["flour-bag", "pizza-box", "burger-box", "display-box", "egg-carton", "pillow-box", "fries-box", "jerrican-5l"]) {
      const r = row(id);
      expect(resolveFlatLayout({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }).supported, id).toBe(false);
    }
    const expected: Record<string, string> = {
      "sauce-bottle": "wrapLabel", "squeeze-tube": "wrapLabel", "tea-box": "tuckEndBox", "milk-carton": "gableTop", "luxury-rigid-box": "rigidSetUp",
      "ecom-mailer": "rollEndTuckFront", "food-tray": "gluedCornerTray", "rice-bag": "sideGussetBag",
    };
    for (const [id, tpl] of Object.entries(expected)) {
      const r = row(id);
      expect(resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }).template, id).toBe(tpl);
    }
  });
});
