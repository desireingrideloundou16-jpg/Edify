/**
 * Phase 2C-4G — packaging engine final audit. One consolidated gate over the whole catalog (119
 * formats) and across the pipeline:
 *
 *   resolveStructure → PrintSurface → 3D (buildPackaging) → artwork (drawSurface) → FlatLayout /
 *   die-line → PDF (generatePrintPdf) → smart layout → persistence → preflight → export gate
 *
 * Nothing here redefines a rule: every check reads the engine's own sources of truth and compares
 * them with what each consumer actually produced.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { PDFDocument } from "pdf-lib";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import {
  BLEED_MM, MODEL_RULES, conicalSafeArea, rectInLayoutRegion, planLayout, preflightLayout, rectInRegion, resolveStructure, tubWall, validatePackagingStructure,
  SAFE_MM, type ElementRole, type PackagingElement, type PackagingStructure,
} from "@/lib/structure";
import { UnsupportedDielineError, flatLayout, resolveFlatLayout, type FlatLayout } from "@/lib/print/layout";
import { drawWrap, type PackagingDesign } from "@/lib/artwork/draw";
import { drawSurface } from "@/lib/artwork/surface";
import { renderFlatArtwork } from "@/lib/print/artwork";
import { elementsFromRecords, recordWrapElements, smartLayoutFromElements } from "@/lib/artwork/smartLayout";
import {
  currentElements, exportAllowed, parseSmartLayoutState, runPackagingPreflight, sameState, stateFromResult, wrapPlacementFromState, type SmartLayoutState,
} from "@/lib/artwork/smartLayoutState";
import { mockContext } from "./mockCanvas";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
// 1×1 baseline JPEG: large sheets (> 12 Mpx) are embedded as JPEG by exportPrintPdf.
const JPG = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z";
vi.mock("@/lib/print/artwork", async (orig) => ({
  ...(await orig<typeof import("@/lib/print/artwork")>()),
  canvasToBlob: async (_c: unknown, type = "image/png") => new Blob([Buffer.from(type === "image/jpeg" ? JPG : PNG, "base64")], { type }),
}));

/** Canvas stub: every created canvas draws into a fresh mock context (logs kept for inspection). */
let lastCalls: ReturnType<typeof mockContext>["calls"] = [];
beforeAll(() => {
  vi.stubGlobal("document", {
    createElement: () => {
      const m = mockContext();
      lastCalls = m.calls;
      return { width: 0, height: 0, getContext: () => m.ctx, toBlob: (cb: (b: Blob) => void) => cb(new Blob([Buffer.from(PNG, "base64")], { type: "image/png" })) };
    },
  });
});
afterAll(() => vi.unstubAllGlobals());

const DESIGN = {
  brandName: "Votre marque", productName: "Nom du produit", tagline: "Votre accroche", volume: "250 g",
  palette: ["#ffffff", "#111111", "#0a8a5f", "#e6007e"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat", barcode: "",
} as PackagingDesign;

const rectInLayoutRegionSafe = (sa: Parameters<typeof rectInLayoutRegion>[0], r: Parameters<typeof rectInLayoutRegion>[2]) => rectInLayoutRegion(sa, "safe", r);
const finiteDeep = (o: unknown): boolean =>
  typeof o === "number" ? Number.isFinite(o) : Array.isArray(o) ? o.every(finiteDeep) : o && typeof o === "object" ? Object.values(o).every(finiteDeep) : true;
const EPS = 1e-6;

type Row = (typeof SHAPE_ROWS)[number];
const input = (r: Row) => ({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });

interface AuditRow {
  id: string; model: string; family: string; supported: boolean;
  structureValid: boolean; surfacesValid: boolean; threeDValid: boolean; flatLayoutValid: boolean; dielineValid: boolean;
  artworkValid: boolean; pdfValid: boolean; smartLayoutApplicable: boolean; preflightApplicable: boolean; notes: string[];
}

const PDF_SLUG = (pageW: number, layout: FlatLayout) => pageW / (72 / 25.4) - layout.width;

async function audit(r: Row): Promise<AuditRow> {
  const notes: string[] = [];
  const note = (ok: boolean, what: string) => (ok ? true : (notes.push(what), false));
  const s = resolveStructure(input(r));
  const supported = s.dieline === "supported";

  // structure: valid, finite, deterministic
  const structureValid = note(validatePackagingStructure(s).length === 0, `structure: ${validatePackagingStructure(s).join("; ")}`)
    && note(finiteDeep(s), "structure: NaN/Infinity")
    && note(JSON.stringify(resolveStructure(input(r))) === JSON.stringify(s), "structure: non déterministe");

  // surfaces: one identity per physical surface, physical size never includes the bleed
  const ids = s.printSurfaces.map((p) => p.id);
  const surfacesValid = note(new Set(ids).size === ids.length, "surfaces: id en double")
    && note(s.printSurfaces.some((p) => p.printable), "surfaces: aucune surface imprimable")
    && note(s.printSurfaces.every((p) => !p.printArea || (p.printArea.w <= p.wMm + EPS && p.printArea.h <= p.hMm + EPS)), "surfaces: printArea > surface")
    && note(s.bleedMm === BLEED_MM, "surfaces: fond perdu ≠ BLEED_MM");

  // 3D: every printed texture is a structure surface, at that surface's size; geometry finite
  const { buildPackaging } = await import("@/lib/three/packagingModels");
  const obj = buildPackaging({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }, DESIGN);
  obj.updateMatrixWorld(true);
  let threeDValid = true;
  const used = new Set<string>();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count * 3; i++) if (!Number.isFinite(pos.array[i])) threeDValid = note(false, `3D: position NaN (${m.name})`);
    const uv = m.geometry.attributes.uv;
    if (uv) for (let i = 0; i < uv.count * 2; i++) if (!Number.isFinite(uv.array[i])) threeDValid = note(false, `3D: UV NaN (${m.name})`);
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
      const map = (mt as THREE.MeshStandardMaterial).map;
      if (!map?.userData.surfaceId) continue;
      const surf = s.printSurfaces.find((p) => p.id === map.userData.surfaceId);
      used.add(map.userData.surfaceId);
      if (!surf) threeDValid = note(false, `3D: texture d'une surface inconnue « ${map.userData.surfaceId} »`);
      else if (Math.abs(map.userData.mm[0] - surf.wMm) > EPS || Math.abs(map.userData.mm[1] - surf.hMm) > EPS) threeDValid = note(false, `3D: « ${surf.id} » à une autre taille`);
    }
  });
  const box = new THREE.Box3().setFromObject(obj);
  threeDValid = threeDValid && note(finiteDeep([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) && box.max.y > box.min.y, "3D: boîte englobante invalide");
  // every printable surface of the structure is shown by the 3D (no printed surface lost)
  threeDValid = threeDValid && note(s.printSurfaces.filter((p) => p.printable).every((p) => used.has(p.id)), `3D: surface imprimable absente du modèle (${s.printSurfaces.filter((p) => p.printable && !used.has(p.id)).map((p) => p.id)})`);

  // artwork: drawn on every surface without a single non-finite coordinate
  let artworkValid = true;
  for (const p of s.printSurfaces) {
    const m = mockContext();
    drawSurface(m.ctx, 0, 0, p.wMm * 2, p.hMm * 2, DESIGN, p);
    if (!m.calls.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y))) artworkValid = note(false, `artwork: coordonnée non finie sur « ${p.id} »`);
  }

  // FlatLayout / die-line: derived from the structure, refused (never faked) when unsupported
  const fr = resolveFlatLayout(input(r));
  let flatLayoutValid: boolean, dielineValid: boolean;
  if (!supported) {
    flatLayoutValid = note(!fr.supported && !!fr.message, "patron: non supporté mais présenté");
    dielineValid = note(s.template === undefined && s.cut === undefined && s.flatMm === undefined, "patron: gabarit sur un format non supporté");
  } else {
    const L = fr.supported ? fr.layout : null;
    flatLayoutValid = note(!!L && finiteDeep(L), "patron: FlatLayout absent ou non fini")
      && note(!!L && Math.abs(L.width - s.flatMm!.width) < EPS && Math.abs(L.height - s.flatMm!.height) < EPS, "patron: taille ≠ flatMm (fond perdu inclus ?)")
      && note(!!L && L.panels.every((p) => !p.surfaceId || s.printSurfaces.some((q) => q.id === p.surfaceId)), "patron: panneau sur une surface inconnue");
    const inSheet = (pts: [number, number][]) => pts.every(([x, y]) => x >= -EPS && y >= -EPS && x <= s.flatMm!.width + EPS && y <= s.flatMm!.height + EPS);
    dielineValid = note(!!s.cut && s.cut.length >= 3 && inSheet(s.cut), "découpe hors de la feuille")
      && note((s.extraCuts ?? []).every(inSheet), "découpe secondaire hors de la feuille")
      && note((s.glueZones ?? []).every((g) => inSheet(g.polygon)) && (s.sealZones ?? []).every((z) => inSheet(z.polygon)) && (s.technicalZones ?? []).every((z) => inSheet(z.polygon)), "zone technique hors de la feuille");
  }

  // PDF: the print file is the flat layout + constant bleed and slug (physical size untouched), or refused
  let pdfValid: boolean;
  const shape = ALL_CATALOG_SHAPES.find((x) => x.id === r[0])!;
  const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
  if (!supported) {
    const err = await generatePrintPdf(shape, DESIGN, "Audit").then(() => null, (e: unknown) => e);
    pdfValid = note(err instanceof UnsupportedDielineError, "PDF: produit pour un format non supporté");
  } else {
    const res = await generatePrintPdf(shape, DESIGN, "Audit");
    const doc = await PDFDocument.load(res.bytes);
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    const slugW = PDF_SLUG(w, res.layout), slugH = h / (72 / 25.4) - res.layout.height;
    pdfValid = note(doc.getPageCount() === 2, "PDF: pages ≠ 2")
      && note(Math.abs(slugW - slugH) < 1e-6 && Math.abs(slugW - 2 * (BLEED_MM + 18)) < 1e-6, `PDF: page ≠ patron + 2 × (fond perdu + marge) (${slugW})`)
      && note(Math.abs(res.layout.width - s.flatMm!.width) < EPS, "PDF: patron ≠ structure");
  }

  const smartLayoutApplicable = !!s.composition;
  const pre = smartLayoutApplicable
    ? runPackagingPreflight(s, elementsFromRecords(recordWrapElements(mockContext().ctx, DESIGN, s.printSurfaces.find((p) => p.id === s.composition!.surfaceId)!), s.printSurfaces.find((p) => p.id === s.composition!.surfaceId)!.printArea!), null)
    : runPackagingPreflight(s, null, null);
  return {
    id: r[0], model: r[3], family: s.family, supported, structureValid, surfacesValid, threeDValid, flatLayoutValid, dielineValid, artworkValid, pdfValid,
    smartLayoutApplicable, preflightApplicable: pre.applicable, notes,
  };
}

describe("C. audit des 119 formats du catalogue", () => {
  const rows: AuditRow[] = [];
  beforeAll(async () => {
    for (const r of SHAPE_ROWS) rows.push(await audit(r));
  }, 240000);

  it("le catalogue compte 119 formats, tous audités", () => {
    expect(SHAPE_ROWS.length).toBe(119);
    expect(rows.length).toBe(119);
  });

  it.each(SHAPE_ROWS.map((r) => r[0]))("%s : structure, surfaces, 3D, artwork, patron, PDF cohérents", (id) => {
    const row = rows.find((x) => x.id === id)!;
    expect(row.notes).toEqual([]);
    for (const k of ["structureValid", "surfacesValid", "threeDValid", "flatLayoutValid", "dielineValid", "artworkValid", "pdfValid"] as const) expect(row[k]).toBe(true);
    // smart layout and preflight only where the structure provides composition regions: the 4 plastic tubs
    expect(row.smartLayoutApplicable).toBe(row.model === "tub");
    expect(row.preflightApplicable).toBe(row.model === "tub");
  });

  it("répartition déterministe (supportés / refusés par modèle)", () => {
    const byModel: Record<string, [number, number]> = {};
    for (const r of rows) (byModel[r.model] ??= [0, 0])[r.supported ? 0 : 1]++;
    // unsupported models stay unsupported, every format of a model shares the same decision
    for (const [model, [ok, ko]] of Object.entries(byModel)) {
      expect(ok === 0 || ko === 0).toBe(true);
      expect(ko > 0).toBe(!!MODEL_RULES[model as keyof typeof MODEL_RULES].unsupported);
    }
    expect(rows.filter((r) => r.supported).length + rows.filter((r) => !r.supported).length).toBe(119);
  });
});

describe("E. formats hors périmètre : refusés proprement", () => {
  const unsupported = SHAPE_ROWS.filter((r) => MODEL_RULES[r[3]].unsupported);
  it("gobelets (cup) et pot de glace (papertub) restent refusés, avec leur raison, sans gabarit ni composition", () => {
    const ids = unsupported.map((r) => r[0]);
    expect(ids).toEqual(expect.arrayContaining(["ice-cream-tub"]));
    expect(SHAPE_ROWS.filter((r) => r[3] === "cup").every((r) => ids.includes(r[0]))).toBe(true);
    for (const r of unsupported) {
      const s = resolveStructure(input(r));
      expect(s.dieline).toBe("unsupported");
      expect(s.dielineNote).toBeTruthy();
      expect(s.composition).toBeUndefined();
      expect(() => flatLayout(input(r))).toThrow(UnsupportedDielineError);
      expect(parseSmartLayoutState({ version: 1, status: "applied", surfaceId: "wrap", frame: { x: 0, y: 0, w: 1, h: 1 }, placements: [] }, s).state).toBeNull();
    }
  });
});

describe("F. les 4 pots coniques : géométrie, surface, composition", () => {
  const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub");
  it("ce sont exactement protein-tub, yogurt-cup, deli-container et hair-cream-tub", () => {
    expect(TUBS.map((r) => r[0]).sort()).toEqual(["deli-container", "hair-cream-tub", "protein-tub", "yogurt-cup"]);
  });
  it.each(TUBS.map((r) => [r[0], r] as const))("%s : tronc de cône, secteur, longueurs d'arc, surface, zone sûre (1e-9)", (_id, r) => {
    const { wall, coveredSlant } = tubWall(r[4], r[5], r[6]);
    const g = Math.hypot(wall.h, wall.R - wall.r);
    expect(wall.slant).toBeCloseTo(g, 9);
    expect(wall.rOut - wall.rIn).toBeCloseTo(g, 9);
    expect(wall.angle * wall.rOut).toBeCloseTo(2 * Math.PI * wall.R, 9); // top arc = top circumference
    expect(wall.angle * wall.rIn).toBeCloseTo(2 * Math.PI * wall.r, 9); // bottom arc = bottom circumference
    expect(wall.R).toBe(Math.min(r[4], r[5]) / 2);
    expect(wall.width).toBeCloseTo(2 * wall.rOut * Math.sin(wall.angle / 2), 9);
    expect(wall.height).toBeCloseTo(wall.rOut - wall.rIn * Math.cos(wall.angle / 2), 9);
    const s = resolveStructure(input(r));
    const surf = s.printSurfaces.find((p) => p.id === "wrap")!;
    expect([surf.wMm, surf.hMm]).toEqual([wall.width, wall.height]); // the surface IS the developed sector
    expect(s.composition!.safeArea).toEqual(conicalSafeArea(wall, coveredSlant, { radialMarginMm: SAFE_MM }));
    const sa = s.composition!.safeArea;
    // a true annular sector strictly inside the printed sector, itself inside the sector
    expect(sa.safe.rho0).toBeGreaterThan(sa.printable.rho0);
    expect(sa.safe.rho1).toBeLessThan(sa.printable.rho1);
    expect(sa.printable.rho1).toBeCloseTo(wall.rOut - coveredSlant, 9);
    expect(sa.safe.psiMax).toBeLessThan(wall.angle / 2);
    // the print area is the box of the printed sector, never the safe area nor the bleed
    const pa = surf.printArea!;
    expect(rectInRegion(wall, { rho0: wall.rIn, rho1: wall.rOut, psiMax: wall.angle / 2 }, pa)).toBe(false); // a box, not the sector
    expect(pa.w).toBeLessThanOrEqual(surf.wMm + 1e-9);
  });
});

/** Same artwork logical position across consumers: the "250 g" of the face, in surface mm. */
describe("H / I / J. cohérence croisée : aperçu = PDF = 3D, smart layout, persistance, preflight", () => {
  const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub");
  const setup = (r: Row) => {
    const s = resolveStructure(input(r));
    const surface = s.printSurfaces.find((p) => p.id === "wrap")!;
    const elements = elementsFromRecords(recordWrapElements(mockContext().ctx, DESIGN, surface), surface.printArea!);
    return { s, surface, elements, result: smartLayoutFromElements(s, elements)! };
  };
  /** Positions (surface mm) of the face's net content in the 3D texture and in the print sheet. */
  const volumeMm = (s: PackagingStructure, design: PackagingDesign) => {
    const surface = s.printSurfaces.find((p) => p.id === "wrap")!;
    const m3 = mockContext();
    const texW = 1536, k3 = texW / surface.wMm;
    drawSurface(m3.ctx, 0, 0, texW, surface.hMm * k3, design, surface, { grain: true });
    const v3 = m3.calls.filter((c) => c.text === design.volume)[0];
    const layout = flatLayout({ model: s.model, lengthMm: s.outerMm.L, widthMm: s.outerMm.W, heightMm: s.outerMm.H, material: s.material.name });
    const kp = 7.3;
    renderFlatArtwork(layout, design, kp);
    const panel = layout.panels.find((p) => p.surfaceId === "wrap")!;
    const vp = lastCalls.filter((c) => c.text === design.volume)[0];
    return { tex: [v3.x / k3, v3.y / k3], pdf: [vp.x / kp - BLEED_MM - panel.x, vp.y / kp - BLEED_MM - panel.y] };
  };

  it.each(TUBS.map((r) => [r[0], r] as const))("%s : le même élément au même endroit (mm) dans la texture 3D et dans la feuille du PDF, avant et après APPLY", (_id, r) => {
    const { s, result } = setup(r);
    for (const design of [DESIGN, { ...DESIGN, wrapPlacement: wrapPlacementFromState(stateFromResult(result)) }]) {
      const v = volumeMm(s, design);
      expect(v.pdf[0]).toBeCloseTo(v.tex[0], 6);
      expect(v.pdf[1]).toBeCloseTo(v.tex[1], 6);
    }
  });

  it.each(TUBS.map((r) => [r[0], r] as const))("%s : le rendu APPLY ne déplace que les éléments de l'état, de leur décalage exact ; rien d'autre ne bouge", (_id, r) => {
    const { surface, result } = setup(r);
    const state = stateFromResult(result);
    const k = 3, pa = surface.printArea!;
    const plain = mockContext(), placed = mockContext();
    drawWrap(plain.ctx, 0, 0, pa.w * k, pa.h * k, DESIGN, 0.3);
    drawWrap(placed.ctx, 0, 0, pa.w * k, pa.h * k, { ...DESIGN, wrapPlacement: wrapPlacementFromState(state) }, 0.3);
    expect(placed.calls.length).toBe(plain.calls.length);
    const deltas = state.placements.map((p) => [p.delta[0] * k, p.delta[1] * k]);
    let moved = 0;
    plain.calls.forEach((c, i) => {
      const dx = placed.calls[i].x - c.x, dy = placed.calls[i].y - c.y;
      if (Math.hypot(dx, dy) < 1e-6) return;
      moved++;
      expect(deltas.some(([ex, ey]) => Math.abs(ex - dx) < 1e-6 && Math.abs(ey - dy) < 1e-6)).toBe(true);
    });
    expect(moved).toBeGreaterThan(0);
  });

  it.each(TUBS.map((r) => [r[0], r] as const))("%s : APPLY → reload → APPLY → restore → reload → APPLY : même état final", (_id, r) => {
    const { s, elements } = setup(r);
    const reload = (st: SmartLayoutState | null) => parseSmartLayoutState(JSON.parse(JSON.stringify(st)), s).state;
    const apply = () => stateFromResult(smartLayoutFromElements(s, elements)!);
    const a1 = apply();
    const r1 = reload(a1);
    const a2 = apply();
    const restored = reload(null);
    expect(restored).toBeNull();
    const a3 = apply();
    expect(sameState(r1, a1) && sameState(a2, a1) && sameState(a3, a1)).toBe(true);
  });

  it.each(TUBS.map((r) => [r[0], r] as const))("%s : APPLY puis contenu modifié : l'état recalculé remplace l'ancien, aucun placement obsolète ne survit", (_id, r) => {
    const { s, surface, result } = setup(r);
    const old = stateFromResult(result);
    const edited = { ...DESIGN, productName: "Un nom de produit nettement plus long", volume: "1 kg" };
    const els2 = elementsFromRecords(recordWrapElements(mockContext().ctx, edited, surface), surface.printArea!);
    const fresh = stateFromResult(smartLayoutFromElements(s, els2)!);
    expect(sameState(fresh, old)).toBe(false);
    const saved = parseSmartLayoutState(JSON.parse(JSON.stringify(fresh)), s).state!;
    expect(sameState(saved, fresh)).toBe(true);
    // the new state describes the new artwork: each placement's original is the element as now drawn
    for (const p of saved.placements) {
      const e = els2.find((x) => x.id === p.elementId)!;
      expect(e).toBeTruthy();
      expect(p.original).toEqual(e.rect);
    }
    expect(runPackagingPreflight(s, els2, saved).status).not.toBe("blocking");
  });

  it.each(TUBS.map((r) => [r[0], r] as const))("%s : le preflight examine exactement l'état exporté (aucun, appliqué, corrompu, d'un autre format)", (_id, r) => {
    const { s, elements, result } = setup(r);
    const good = stateFromResult(result);
    const other = resolveStructure(input(TUBS.find((x) => x[0] !== r[0])!));
    const otherState = stateFromResult(smartLayoutFromElements(other, elementsFromRecords(recordWrapElements(mockContext().ctx, DESIGN, other.printSurfaces.find((p) => p.id === "wrap")!), other.printSurfaces.find((p) => p.id === "wrap")!.printArea!))!);
    for (const raw of [null, good, { ...good, version: 9 }, otherState, { ...good, placements: [{ ...good.placements[0], delta: [NaN, 0] }] }]) {
      const st = parseSmartLayoutState(raw, s).state;
      // what the export draws: the original elements moved by the state's offsets (wrapPlacementFromState)
      const exported = st ? elements.map((e) => {
        const off = wrapPlacementFromState(st).offsets[e.id];
        return off ? { ...e, rect: { ...e.rect, x: e.rect.x + off[0] * st.frame.w, y: e.rect.y + off[1] * st.frame.h } } : e;
      }) : elements;
      const examined = currentElements(elements, st);
      examined.forEach((e, i) => {
        expect(e.rect.x).toBeCloseTo(exported[i].rect.x, 9);
        expect(e.rect.y).toBeCloseTo(exported[i].rect.y, 9);
      });
      expect(runPackagingPreflight(s, elements, st)).toEqual(preflightLayout(s.composition!.safeArea, "wrap", exported, elements));
    }
    expect(parseSmartLayoutState(otherState, s).state).toBeNull(); // another tub's layout is never applied
  });
});

describe("K. barrière d'export", () => {
  it("bloquant → refusé ; avertissement et pass → autorisés", () => {
    expect(exportAllowed({ applicable: true, status: "blocking", issues: [], checked: 0, passed: [] })).toBe(false);
    expect(exportAllowed({ applicable: true, status: "warning", issues: [], checked: 0, passed: [] })).toBe(true);
    expect(exportAllowed({ applicable: true, status: "pass", issues: [], checked: 0, passed: [] })).toBe(true);
  });
  it("contrat de l'atelier : PDF et ZIP passent par le preflight AVANT le contrôle d'abonnement (aucun crédit consommé si bloqué)", () => {
    const src = readFileSync("src/components/workspace/EdifyWorkspace.tsx", "utf8");
    const body = src.slice(src.indexOf("const handleExport = async"), src.indexOf("return (", src.indexOf("const handleExport = async")));
    const pre = body.indexOf("preflightNow()"), gate = body.indexOf("gateDownload()"), block = body.indexOf("if (!exportAllowed(checked.report))");
    expect(pre).toBeGreaterThan(0);
    expect(block).toBeGreaterThan(pre);
    expect(gate).toBeGreaterThan(block);
    expect(body).toMatch(/if \(a === "pdf" \|\| a === "zip"\)/);
    // phase 3B: the print files use the very design the preflight checked (automatic adjustment applied
    // to the fresh record), never a design computed elsewhere
    expect(body).toMatch(/handleDownloadPdf\(checked\)/);
    expect(body).toMatch(/handleDownloadZip\(checked\)/);
    expect(src).toMatch(/downloadPrintPdf\(shape, checked\?\.design \?\? fullDesign,/);
    expect(src).toMatch(/const design = checked\?\.design \?\? fullDesign;/);
    expect(src).toMatch(/generatePrintPdf\(shape, design,/);
    const now = src.slice(src.indexOf("const preflightNow = async"), src.indexOf("type Checked"));
    expect(now).toMatch(/const state = autoLayoutState\(res, smartState, smartLayoutAuto\);/);
    expect(now).toMatch(/wrapPlacement: wrapPlacementFromState\(state\)/);
    expect(now).toMatch(/report: fullPreflight\(structure, res\.elements, state, designAsDrawn\), design/);
  });
});

describe("L. corruptions des entrées du moteur", () => {
  const bad: [string, Record<string, unknown>][] = [
    ["modèle inconnu", { model: "spaceship", lengthMm: 100, widthMm: 50, heightMm: 30 }],
    ["longueur négative", { model: "box", lengthMm: -100, widthMm: 50, heightMm: 30 }],
    ["largeur nulle", { model: "mailer", lengthMm: 100, widthMm: 0, heightMm: 30 }],
    ["NaN (pot)", { model: "tub", lengthMm: Number.NaN, widthMm: 100, heightMm: 80 }],
    ["Infinity (bouteille)", { model: "bottle", lengthMm: 60, widthMm: Infinity, heightMm: 200 }],
    ["hauteur nulle (pot)", { model: "tub", lengthMm: 100, widthMm: 100, heightMm: 0 }],
    ["chaîne au lieu d'un nombre", { model: "bag", lengthMm: "120", widthMm: 60, heightMm: 200 }],
  ];
  it.each(bad)("%s : jamais d'erreur levée, jamais de patron ni de PDF, jamais de NaN", async (_n, i) => {
    let s!: PackagingStructure;
    expect(() => (s = resolveStructure(i as never))).not.toThrow();
    expect(s.dieline).toBe("unsupported");
    expect(s.dielineNote).toBeTruthy();
    expect(s.composition).toBeUndefined();
    expect(finiteDeep(s.printSurfaces)).toBe(true);
    const fr = resolveFlatLayout(i as never);
    expect(fr.supported).toBe(false);
    expect(() => flatLayout(i as never)).toThrow(UnsupportedDielineError);
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    const err = await generatePrintPdf({ id: "x", name: "x", dimensions: "", material: "", model: i.model, lengthMm: i.lengthMm, widthMm: i.widthMm, heightMm: i.heightMm } as never, DESIGN, "x").then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(UnsupportedDielineError);
    expect(runPackagingPreflight(s, null, null).applicable).toBe(false);
  });

  it("très grandes dimensions valides : résolues, finies (aucune limite inventée)", () => {
    const s = resolveStructure({ model: "box", lengthMm: 1e6, widthMm: 1e6, heightMm: 1e6 } as never);
    expect(s.dieline).toBe("supported");
    expect(finiteDeep(s)).toBe(true);
  });

  it("placement : coordonnées extrêmes, rôle inconnu → aucune erreur, aucun NaN, rien d'inventé", () => {
    const r = SHAPE_ROWS.find((x) => x[0] === "deli-container")!;
    const sa = resolveStructure(input(r)).composition!.safeArea;
    const els: PackagingElement[] = [
      { id: "far#0", role: "barcode", rect: { x: 1e12, y: -1e12, w: 10, h: 5 } },
      { id: "huge#0", role: "netContent", rect: { x: 0, y: 0, w: 1e9, h: 1e9 } },
      { id: "odd#0", role: "sticker" as ElementRole, rect: { x: 10, y: 10, w: 5, h: 5 } },
    ];
    const plan = planLayout(sa, els);
    expect(finiteDeep(plan)).toBe(true);
    // far away but small: brought back into the safe area (finite); far too large: invalid, left as is
    expect(plan[0].status === "invalid" || rectInLayoutRegionSafe(sa, plan[0].rect)).toBe(true);
    expect(plan[1].status).toBe("invalid");
    expect(plan[1].rect).toEqual(els[1].rect);
    expect(plan[2].rect).toEqual(els[2].rect); // unknown role: never moved
    const pre = preflightLayout(sa, "wrap", els);
    expect(finiteDeep(pre)).toBe(true);
    expect(pre.status).toBe("blocking");
  });
});

describe("M / N. déterminisme et performance", () => {
  it("structures, zones sûres, plans, preflights et états : identiques à chaque appel, quel que soit l'ordre des éléments", () => {
    for (const r of SHAPE_ROWS) expect(JSON.stringify(resolveStructure(input(r)))).toBe(JSON.stringify(resolveStructure(input(r))));
    for (const r of SHAPE_ROWS.filter((x) => x[3] === "tub")) {
      const s = resolveStructure(input(r));
      const surface = s.printSurfaces.find((p) => p.id === "wrap")!;
      const els = elementsFromRecords(recordWrapElements(mockContext().ctx, DESIGN, surface), surface.printArea!);
      const sa = s.composition!.safeArea;
      const byId = <T extends { id?: string; elementId?: string }>(l: T[]) => JSON.stringify([...l].sort((a, b) => ((a.id ?? a.elementId)! < (b.id ?? b.elementId)! ? -1 : 1)));
      expect(byId(planLayout(sa, [...els].reverse()))).toBe(byId(planLayout(sa, els)));
      expect(byId(preflightLayout(sa, "wrap", [...els].reverse()).issues)).toBe(byId(preflightLayout(sa, "wrap", els).issues));
      expect(JSON.stringify(stateFromResult(smartLayoutFromElements(s, [...els].reverse())!))).toBe(JSON.stringify(stateFromResult(smartLayoutFromElements(s, els)!)));
    }
  });

  it("temps : structure, zone sûre, placement et preflight bien sous 100 ms", () => {
    const t = (f: () => void, n = 1) => { const a = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - a) / n; };
    const all = t(() => SHAPE_ROWS.forEach((r) => resolveStructure(input(r))));
    const timings: Record<string, number> = { "119 structures": all };
    for (const r of SHAPE_ROWS.filter((x) => x[3] === "tub")) {
      const s = resolveStructure(input(r));
      const { wall, coveredSlant } = tubWall(r[4], r[5], r[6]);
      const surface = s.printSurfaces.find((p) => p.id === "wrap")!;
      const els = elementsFromRecords(recordWrapElements(mockContext().ctx, DESIGN, surface), surface.printArea!);
      timings[`${r[0]} zone sûre`] = t(() => conicalSafeArea(wall, coveredSlant, { radialMarginMm: SAFE_MM }), 50);
      timings[`${r[0]} placement`] = t(() => planLayout(s.composition!.safeArea, els), 3);
      timings[`${r[0]} preflight`] = t(() => runPackagingPreflight(s, els, null), 3);
    }
    console.log("timings (ms):", Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, +v.toFixed(2)])));
    for (const v of Object.values(timings)) expect(v).toBeLessThan(100);
  });
});
