/**
 * Phase 3B — the two P0 fixes.
 *
 * P0-1: Edify never draws a fake barcode. A valid EAN-13 is drawn as before; an absent or invalid
 *       code draws nothing printable (its place stays reserved), the flat preview may show a
 *       non-printable hint, and the preflight says the code is missing / invalid.
 * P0-2: on the 4 supported plastic tubs the smart layout correction is applied automatically
 *       (autoLayoutState): the current design, the 2D, the 3D, the PDF and the preflight all use it.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { resolveStructure, type PackagingStructure } from "@/lib/structure";
import { checkDigit } from "@/lib/print/ean13";
import { flatLayout } from "@/lib/print/layout";
import { drawSurface } from "@/lib/artwork/surface";
import { drawWrap, type PackagingDesign } from "@/lib/artwork/draw";
import { computeSmartLayout, elementsFromRecords, recordWrapElements, smartLayoutFromElements } from "@/lib/artwork/smartLayout";
import {
  BARCODE_INVALID, BARCODE_MISSING, autoLayoutState, barcodeSurfaces, contentPreflight, currentElements, exportAllowed, fullPreflight,
  sameState, stateFromResult, wrapPlacementFromState,
} from "@/lib/artwork/smartLayoutState";
import { renderFlatArtwork } from "@/lib/print/artwork";
import { mockContext, type DrawCall } from "./mockCanvas";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const JPG = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiigD//Z";
vi.mock("@/lib/print/artwork", async (orig) => ({
  ...(await orig<typeof import("@/lib/print/artwork")>()),
  canvasToBlob: async (_c: unknown, type = "image/png") => new Blob([Buffer.from(type === "image/jpeg" ? JPG : PNG, "base64")], { type }),
}));
let sheets: DrawCall[][] = [];
beforeAll(() => {
  vi.stubGlobal("document", {
    createElement: () => {
      const m = mockContext();
      sheets.push(m.calls);
      return { width: 0, height: 0, getContext: () => m.ctx };
    },
  });
});
afterAll(() => vi.unstubAllGlobals());

const first12 = "615123456789";
const VALID = first12 + checkDigit(first12);
const WRONG_CHECK = first12 + ((checkDigit(first12) + 1) % 10);
const DESIGN = {
  brandName: "Maison Kola", productName: "Jus de bissap", tagline: "Pressé à froid", volume: "250 g",
  palette: ["#fdf6ec", "#1b1b1b", "#b3261e", "#e6a700"], headingFont: "Inter", bodyFont: "Inter", finishing: "Vernis mat",
} as PackagingDesign;
const HINT = "Code-barres à ajouter";
/** The human-readable digits under a real EAN-13 (drawBarcode): their presence means a barcode was drawn. */
const DIGITS = VALID.slice(1, 7).split("").join(" ");

const structureOf = (id: string) => { const r = SHAPE_ROWS.find((x) => x[0] === id)!; return resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }); };
const draw = (p: PackagingStructure["printSurfaces"][number], d: PackagingDesign) => { const m = mockContext(); drawSurface(m.ctx, 0, 0, p.wMm * 3, p.hMm * 3, d, p); return m.calls; };
const hasBarcode = (calls: DrawCall[]) => calls.some((c) => c.text === DIGITS);
const hasHint = (calls: DrawCall[]) => calls.some((c) => c.text === HINT);

describe("P0-1 — jamais de faux code-barres", () => {
  const box = structureOf("ecom-mailer");
  const backs = barcodeSurfaces(box);

  it("un code valide est dessiné comme avant (chiffres sous les barres, plaque blanche)", () => {
    expect(backs.length).toBeGreaterThan(0);
    const calls = draw(backs[0], { ...DESIGN, barcode: VALID });
    expect(hasBarcode(calls)).toBe(true);
    expect(hasHint(calls)).toBe(false);
  });

  it.each([["absent", ""], ["format invalide", "12345"], ["clé de contrôle fausse", WRONG_CHECK]])("code %s : rien d'imprimable n'est dessiné — exactement le dessin du code valide, sans le code-barres", (_n, code) => {
    const valid = draw(backs[0], { ...DESIGN, barcode: VALID });
    const none = draw(backs[0], { ...DESIGN, barcode: code });
    expect(hasBarcode(none)).toBe(false);
    expect(hasHint(none)).toBe(false);
    // the barcode is the last thing drawn on the back: everything else is identical
    expect(none.length).toBeLessThan(valid.length);
    expect(valid.slice(0, none.length)).toEqual(none);
    // no bars of any kind: the only rectangles left are the ones the valid drawing has too
    expect(none.filter((c) => c.op === "fillRect").length).toBeLessThan(valid.filter((c) => c.op === "fillRect").length);
  });

  it("le repère « Code-barres à ajouter » n'existe que dans l'aperçu à plat (previewHints), jamais en 3D ni au PDF", async () => {
    const layout = flatLayout({ model: "mailer", lengthMm: 220, widthMm: 160, heightMm: 60, material: "Carton ondulé E" });
    sheets = [];
    renderFlatArtwork(layout, { ...DESIGN, barcode: "", previewHints: true }, 3);
    expect(hasHint(sheets[0])).toBe(true);
    expect(hasBarcode(sheets[0])).toBe(false);
    sheets = [];
    renderFlatArtwork(layout, { ...DESIGN, barcode: VALID, previewHints: true }, 3);
    expect(hasHint(sheets[0])).toBe(false);
    expect(hasBarcode(sheets[0])).toBe(true);
    // 3D textures: drawSurface without the flag
    expect(hasHint(draw(backs[0], { ...DESIGN, barcode: "" }))).toBe(false);
    // print PDF: even a design carrying the flag never prints the hint
    const { generatePrintPdf } = await import("@/lib/print/exportPrintPdf");
    sheets = [];
    await generatePrintPdf(ALL_CATALOG_SHAPES.find((s) => s.id === "ecom-mailer")!, { ...DESIGN, barcode: "", previewHints: true }, "P0");
    expect(sheets.length).toBeGreaterThan(0);
    for (const s of sheets) {
      expect(hasHint(s)).toBe(false);
      expect(hasBarcode(s)).toBe(false);
    }
  });

  it("une seule règle : une surface a un emplacement de code-barres ⇔ son artwork dessine un code valide (119 formats)", () => {
    for (const r of SHAPE_ROWS) {
      const s = resolveStructure({ model: r[3], lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      const slots = new Set(barcodeSurfaces(s).map((p) => p.id));
      for (const p of s.printSurfaces.filter((q) => q.printable)) expect(hasBarcode(draw(p, { ...DESIGN, barcode: VALID }))).toBe(slots.has(p.id));
    }
  });

  it("preflight : absent ou invalide → avertissement explicite, jamais « prêt à imprimer » ; valide → rien", () => {
    for (const id of ["ecom-mailer", "deli-container", "food-tray"]) {
      expect(barcodeSurfaces(structureOf(id)).length).toBeGreaterThan(0);
      const s = structureOf(id);
      expect(contentPreflight(s, { barcode: VALID })).toEqual([]);
      const missing = contentPreflight(s, { barcode: "" });
      expect(missing).toHaveLength(1);
      expect(missing[0]).toMatchObject({ severity: "warning", blocking: false, role: "barcode", fix: "content", message: BARCODE_MISSING });
      expect(contentPreflight(s, { barcode: WRONG_CHECK })[0].message).toBe(BARCODE_INVALID);
      expect(contentPreflight(s, { barcode: "12345" })[0].message).toBe(BARCODE_INVALID);
      const rep = fullPreflight(s, null, null, { barcode: "" });
      expect(rep.status).not.toBe("pass");
      expect(exportAllowed(rep)).toBe(true); // the file can be produced, without a barcode
      expect(fullPreflight(s, null, null, { barcode: VALID }).issues.filter((i) => i.elementId === "barcode")).toEqual([]);
    }
  });
});

describe("P0-2 — mise en page des pots appliquée automatiquement", () => {
  const TUBS = ["protein-tub", "yogurt-cup", "deli-container", "hair-cream-tub"];
  const design = { ...DESIGN, barcode: VALID } as PackagingDesign;
  const setup = (id: string, d: PackagingDesign = design) => {
    const s = structureOf(id);
    const surface = s.printSurfaces.find((p) => p.id === "wrap")!;
    const elements = elementsFromRecords(recordWrapElements(mockContext().ctx, d, surface), surface.printArea!);
    return { s, surface, elements, result: smartLayoutFromElements(s, elements)! };
  };

  it.each(TUBS)("%s : correction calculée puis appliquée d'office ; 2D, 3D, PDF et preflight utilisent l'état corrigé", (id) => {
    const { s, surface, elements, result } = setup(id);
    expect(result.plan.some((p) => p.status === "moved")).toBe(true); // the generated design needs it
    const state = autoLayoutState(result, null, true)!;
    expect(state).not.toBeNull();
    expect(sameState(state, stateFromResult(result))).toBe(true);
    const corrected = { ...design, wrapPlacement: wrapPlacementFromState(state) };
    // the corrected design is what every representation draws: same logical position in mm
    const k3 = 1536 / surface.wMm;
    const m3 = mockContext();
    drawSurface(m3.ctx, 0, 0, 1536, surface.hMm * k3, corrected, surface);
    const plain3 = mockContext();
    drawSurface(plain3.ctx, 0, 0, 1536, surface.hMm * k3, design, surface);
    const kp = 6;
    const layout = flatLayout({ model: "tub", lengthMm: s.outerMm.L, widthMm: s.outerMm.W, heightMm: s.outerMm.H, material: s.material.name });
    sheets = [];
    renderFlatArtwork(layout, corrected, kp);
    const sheet = sheets[0];
    expect(m3.calls.length).toBe(plain3.calls.length);
    let shifted = 0;
    m3.calls.forEach((c, i) => {
      const dx = (c.x - plain3.calls[i].x) / k3, dy = (c.y - plain3.calls[i].y) / k3;
      if (Math.hypot(dx, dy) > 1e-6) {
        shifted++;
        expect(state.placements.some((p) => Math.abs(p.delta[0] - dx) < 1e-6 && Math.abs(p.delta[1] - dy) < 1e-6)).toBe(true);
      }
    });
    expect(shifted).toBeGreaterThan(0);
    // 2D / PDF sheet = 3D texture, in surface mm
    const panel = layout.panels.find((p) => p.surfaceId === "wrap")!;
    const text = (calls: DrawCall[]) => calls.filter((c) => c.op === "fillText");
    const t3 = text(m3.calls), tp = text(sheet);
    expect(tp.length).toBe(t3.length);
    tp.forEach((c, i) => {
      expect(c.x / kp - 3 - panel.x).toBeCloseTo(t3[i].x / k3, 6);
      expect(c.y / kp - 3 - panel.y).toBeCloseTo(t3[i].y / k3, 6);
    });
    // the preflight checks the corrected state: nothing left to fix (valid barcode: ready to print)
    expect(fullPreflight(s, elements, state, design).status).toBe("pass");
    expect(fullPreflight(s, elements, null, design).status).not.toBe("pass");
  });

  it.each(TUBS)("%s : rien à corriger → rien n'est modifié ; appliqué deux fois → identique (pas de boucle)", (id) => {
    const { s, elements, result } = setup(id);
    const state = autoLayoutState(result, null, true)!;
    // the corrected artwork, planned again, needs nothing: no state is created
    const again = smartLayoutFromElements(s, currentElements(elements, state))!;
    expect(again.plan.filter((p) => p.status === "moved")).toEqual([]);
    expect(autoLayoutState(again, null, true)).toBeNull();
    // idempotent: fed with its own output, the same state (same object) — the effect stops at once
    let cur = state;
    for (let i = 0; i < 5; i++) {
      const next = autoLayoutState(result, cur, true);
      expect(next).toBe(cur);
      cur = next!;
    }
  });

  it("ajustement annulé puis réactivé : original, puis le même état corrigé ; résultat absent : état inchangé", () => {
    const { result } = setup("deli-container");
    const state = autoLayoutState(result, null, true)!;
    expect(autoLayoutState(result, state, false)).toBeNull();
    expect(autoLayoutState(result, null, false)).toBeNull();
    expect(sameState(autoLayoutState(result, null, true), state)).toBe(true);
    expect(autoLayoutState(null, state, true)).toBe(state);
    expect(autoLayoutState(null, null, true)).toBeNull();
  });

  it("correction impossible (mentions trop longues) : ce qui peut l'être est appliqué, l'état est stable, le blocage reste explicite", () => {
    const long = { ...design, ingredients: "Lait entier pasteurisé, ferments lactiques, sucre de canne, purée de mangue 12 %, arôme naturel, stabilisant : pectine. Contient : LAIT. Peut contenir des traces de FRUITS À COQUE. Conserver entre 0 et 6 °C après ouverture et consommer dans les 3 jours." } as PackagingDesign;
    const { s, elements, result } = setup("deli-container", long);
    expect(result.plan.some((p) => p.status === "invalid")).toBe(true);
    const state = autoLayoutState(result, null, true)!;
    expect(state.placements.length).toBeGreaterThan(0);
    expect(autoLayoutState(result, state, true)).toBe(state);
    const rep = fullPreflight(s, elements, state, long);
    expect(rep.status).toBe("blocking");
    expect(rep.issues.find((i) => i.role === "regulatory")).toMatchObject({ blocking: true, fix: "content" });
  });

  it("sans code valide, l'emplacement vide (rien d'imprimé) ne bloque pas : seul l'avertissement « absent » reste", () => {
    const empty = { ...DESIGN, barcode: "" } as PackagingDesign;
    const { s, elements } = setup("deli-container", empty);
    // original layout (adjustment cancelled): the empty place crosses the bottom arc
    const placementOnly = fullPreflight(s, elements, null, { barcode: VALID });
    expect(placementOnly.issues.some((i) => i.role === "barcode" && i.blocking)).toBe(true);
    const rep = fullPreflight(s, elements, null, empty);
    expect(rep.issues.filter((i) => i.role === "barcode")).toEqual([expect.objectContaining({ elementId: "barcode", message: BARCODE_MISSING, blocking: false })]);
    expect(exportAllowed(rep)).toBe(true);
  });

  it("le pot de glace reste refusé : pas de composition, pas de correction", () => {
    const s = structureOf("ice-cream-tub");
    expect(s.dieline).toBe("unsupported");
    expect(s.composition).toBeUndefined();
    expect(computeSmartLayout(s, design, mockContext().ctx)).toBeNull();
    expect(autoLayoutState(null, null, true)).toBeNull();
  });

  it("le dessin du pot corrigé ne contient jamais de faux code-barres sans code valide", () => {
    const { surface, result } = setup("yogurt-cup", { ...DESIGN, barcode: "" } as PackagingDesign);
    const state = autoLayoutState(result, null, true)!;
    const pa = surface.printArea!;
    const m = mockContext();
    drawWrap(m.ctx, 0, 0, pa.w * 3, pa.h * 3, { ...DESIGN, barcode: "", wrapPlacement: wrapPlacementFromState(state) }, 0.3);
    expect(hasBarcode(m.calls)).toBe(false);
    expect(hasHint(m.calls)).toBe(false);
  });
});
