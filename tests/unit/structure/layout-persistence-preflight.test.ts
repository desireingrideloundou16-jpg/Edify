/**
 * Phase 2C-4F-4: persistent smart layout (save → reload → same render, idempotent APPLY, restore),
 * linked elements (follow their parent, never hide an invalidity) and the packaging preflight that
 * gates the print export. Everything is computed from the profile of the 4 plastic tubs.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  PREFLIGHT_NOT_APPLICABLE, ROLE_PRIORITY, placementOrder, planLayout, preflightLayout, rectInLayoutRegion, rectInRegion, resolveStructure,
  type ConicalSafeArea, type ElementRole, type PackagingElement, type Rect,
} from "@/lib/structure";
import { elementsFromRecords, placementFromPlan, recordWrapElements, smartLayoutFromElements } from "@/lib/artwork/smartLayout";
import {
  SMART_LAYOUT_STATE_VERSION, currentElements, exportAllowed, orphanPlacements, parseSmartLayoutState, runPackagingPreflight, sameState,
  stateFromResult, wrapPlacementFromState, type SmartLayoutState,
} from "@/lib/artwork/smartLayoutState";
import { drawWrap, type PackagingDesign } from "@/lib/artwork/draw";
import { drawSurface } from "@/lib/artwork/surface";
import { renderFlatArtwork } from "@/lib/print/artwork";
import { flatLayout } from "@/lib/print/layout";
import { mockContext } from "./mockCanvas";

const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub").map((r) => [r[0], r[4], r[5], r[6], r[7]] as const);
const DESIGN = {
  brandName: "Votre marque", productName: "Nom du produit", tagline: "Votre accroche", volume: "250 g",
  palette: ["#ffffff", "#111111", "#0a8a5f", "#e6007e"], headingFont: "Inter", bodyFont: "Inter", finishing: "matte",
} as PackagingDesign;
const LONG = "Lait entier pasteurisé, ferments lactiques, sucre de canne, purée de mangue 12 %, arôme naturel, stabilisant : pectine. Contient : LAIT. Peut contenir des traces de FRUITS À COQUE. Conserver entre 0 et 6 °C après ouverture et consommer dans les 3 jours.";

const structureOf = (L: number, W: number, H: number, m: string) => resolveStructure({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m });
function recorded(structure: ReturnType<typeof resolveStructure>, design: PackagingDesign = DESIGN) {
  const surface = structure.printSurfaces.find((s) => s.id === "wrap")!;
  return elementsFromRecords(recordWrapElements(mockContext().ctx, design, surface), surface.printArea!);
}
/** The draw calls of the wrap for a design (the logical positions the preview, 3D and PDF share). */
function drawCalls(structure: ReturnType<typeof resolveStructure>, design: PackagingDesign, k = 3) {
  const pa = structure.printSurfaces.find((s) => s.id === "wrap")!.printArea!;
  const m = mockContext();
  drawWrap(m.ctx, 0, 0, pa.w * k, pa.h * k, design, 0.3);
  return m.calls;
}
const at = (sa: ConicalSafeArea, rho: number, psi: number, w: number, h: number): Rect => {
  const cx = sa.wall.width / 2 + rho * Math.sin(psi), cy = sa.wall.rOut - rho * Math.cos(psi);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};
const el = (id: string, role: ElementRole, rect: Rect, parentId?: string): PackagingElement => ({ id, role, rect, ...(parentId ? { parentId } : {}) });
const reload = (s: SmartLayoutState, structure: ReturnType<typeof resolveStructure>) => parseSmartLayoutState(JSON.parse(JSON.stringify(s)), structure);

describe.each(TUBS)("%s", (id, L, W, H, m) => {
  const structure = structureOf(L, W, H, m);
  const sa = structure.composition!.safeArea;
  const elements = recorded(structure);
  const result = smartLayoutFromElements(structure, elements)!;
  const state = stateFromResult(result);

  it("1-2. APPLY persistant : sauvegarde JSON → rechargement → même état, même rendu", () => {
    expect(state.version).toBe(SMART_LAYOUT_STATE_VERSION);
    expect(state.placements.length).toBeGreaterThan(0);
    for (const p of state.placements) {
      expect(p.delta).toEqual([p.applied.x - p.original.x, p.applied.y - p.original.y]);
      expect([p.applied.w, p.applied.h]).toEqual([p.original.w, p.original.h]);
      expect(p.rotationDeg).toBe(0);
    }
    const back = reload(state, structure);
    expect(back.issues).toEqual([]);
    expect(sameState(back.state, state)).toBe(true);
    expect(wrapPlacementFromState(back.state!)).toEqual(placementFromPlan(result.plan, result.printArea));
    const direct = drawCalls(structure, { ...DESIGN, wrapPlacement: result.placement });
    expect(drawCalls(structure, { ...DESIGN, wrapPlacement: wrapPlacementFromState(back.state!) })).toEqual(direct);
    expect(direct).not.toEqual(drawCalls(structure, DESIGN)); // the applied layout is really different
  });

  it("3 / 22. APPLY idempotent : appliquer deux fois ne déplace rien de plus", () => {
    const designApplied = { ...DESIGN, wrapPlacement: wrapPlacementFromState(state) };
    const again = stateFromResult(smartLayoutFromElements(structure, recorded(structure, designApplied))!);
    expect(sameState(again, state)).toBe(true);
    // the applied layout planned again: nothing moves any more
    expect(planLayout(sa, currentElements(elements, state)).filter((p) => p.status === "moved")).toEqual([]);
  });

  it("4-5 / 23. restaurer l'original (avant et après rechargement), puis réappliquer → même état", () => {
    const original = drawCalls(structure, DESIGN);
    expect(drawCalls(structure, { ...DESIGN, wrapPlacement: undefined })).toEqual(original);
    const back = reload(state, structure).state!;
    expect(back).not.toBeNull();
    const restored = parseSmartLayoutState(null, structure); // « Revenir à la mise en page d'origine » = état retiré
    expect(restored).toEqual({ state: null, issues: [] });
    expect(drawCalls(structure, DESIGN)).toEqual(original);
    expect(sameState(stateFromResult(smartLayoutFromElements(structure, recorded(structure))!), back)).toBe(true);
  });

  it("8-12. preflight : sans APPLY le code-barres ou un P0 mal placé bloque ; après APPLY l'export passe", () => {
    const before = runPackagingPreflight(structure, elements, null);
    const after = runPackagingPreflight(structure, elements, state);
    expect(after.status).toBe("pass");
    expect(exportAllowed(after)).toBe(true);
    expect(after.passed.length).toBe(after.checked);
    const bar = before.issues.find((i) => i.role === "barcode");
    if (bar) {
      expect(bar).toMatchObject({ severity: "blocking", blocking: true, fix: "smart-layout", surfaceId: "wrap" });
      expect(bar.suggestedRect && rectInLayoutRegion(sa, "safe", bar.suggestedRect)).toBe(true);
      expect(before.status).toBe("blocking");
      expect(exportAllowed(before)).toBe(false);
    } else {
      expect(before.status).toBe("warning"); // protein-tub: only a P2 element near the seam
      expect(exportAllowed(before)).toBe(true);
    }
    for (const i of before.issues) expect(i.blocking).toBe(ROLE_PRIORITY[i.role] === 0);
  });

  it("13-14. preflight déterministe et sans effet sur l'artwork", () => {
    const snapshot = JSON.stringify(elements);
    const a = runPackagingPreflight(structure, elements, null);
    expect(runPackagingPreflight(structure, [...elements].reverse(), null).issues.map((i) => i.elementId)).toEqual(a.issues.map((i) => i.elementId));
    expect(runPackagingPreflight(structure, elements, null)).toEqual(a);
    expect(JSON.stringify(elements)).toBe(snapshot);
    runPackagingPreflight(structure, elements, state);
    expect(JSON.stringify(elements)).toBe(snapshot);
  });

  it("20-21. APPLY → rechargement → PDF et 3D : le même artwork que l'APPLY direct", () => {
    const back = reload(state, structure).state!;
    const designs = [{ ...DESIGN, wrapPlacement: result.placement }, { ...DESIGN, wrapPlacement: wrapPlacementFromState(back) }];
    // 3D: the texture is drawn by drawSurface (same as packagingModels.surfaceTexture)
    const surface = structure.printSurfaces.find((s) => s.id === "wrap")!;
    const tex = designs.map((d) => { const mk = mockContext(); drawSurface(mk.ctx, 0, 0, 1536, (1536 * surface.hMm) / surface.wMm, d, surface, { grain: false }); return mk.calls; });
    expect(tex[1]).toEqual(tex[0]);
    // PDF: the print sheet (renderFlatArtwork, what exportPrintPdf embeds)
    const layout = flatLayout({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m });
    const sheets = designs.map((d) => {
      const mk = mockContext();
      vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => mk.ctx }) });
      renderFlatArtwork(layout, d, 4);
      return mk.calls;
    });
    vi.unstubAllGlobals();
    expect(sheets[1]).toEqual(sheets[0]);
  });
});

describe("6-7. éléments liés", () => {
  const [, L, W, H, m] = TUBS.find((t) => t[0] === "deli-container")!;
  const structure = structureOf(L, W, H, m);
  const sa = structure.composition!.safeArea;
  const safeH = sa.safe.rho1 - sa.safe.rho0;

  it("le décor lié suit son parent : même décalage, même taille, aucune rotation", () => {
    const logo = at(sa, sa.safe.rho1 + 2, 0, safeH * 0.2, safeH * 0.2); // across the top edge: must move
    const badge = { x: logo.x + 20, y: logo.y + 2, w: 6, h: 4 };
    const plan = planLayout(sa, [el("logo#0", "logo", logo), el("decorative#0", "decorative", badge, "logo#0")]);
    const [pl, pb] = plan;
    expect(pl.status).toBe("moved");
    const dx = pl.rect.x - logo.x, dy = pl.rect.y - logo.y;
    expect(pb).toMatchObject({ status: "moved", parentId: "logo#0", rotationDeg: 0 });
    expect(pb.rect).toEqual({ x: badge.x + dx, y: badge.y + dy, w: badge.w, h: badge.h });
    // the state carries the link and the follower's delta
    const st = stateFromResult(smartLayoutFromElements(structure, [el("logo#0", "logo", logo), el("decorative#0", "decorative", badge, "logo#0")])!);
    expect(st.placements.find((p) => p.elementId === "decorative#0")).toMatchObject({ parentId: "logo#0", delta: [dx, dy] });
  });

  it("un enfant lié qui devient invalide n'est jamais masqué : enfant invalid, groupe signalé, preflight", () => {
    const logo = at(sa, sa.safe.rho1 + 2, 0, safeH * 0.2, safeH * 0.2);
    // a badge (constrained, P3) right at the bottom of the safe band: following the logo down breaks it
    const badge = at(sa, sa.safe.rho0 + 1.2, 0, 8, 2);
    const plan = planLayout(sa, [el("logo#0", "logo", logo), el("badge#0", "badge", badge, "logo#0")]);
    const pl = plan[0], pb = plan[1];
    expect(pl.status).toBe("moved");
    if (pl.rect.y > logo.y) {
      expect(pb.status).toBe("invalid");
      expect(pb.reason).toMatch(/en suivant « logo#0 »/);
      expect(pl.groupIssue).toMatch(/badge#0/);
    }
    // a decoration that leaves the printed sector after its parent moved: warned after APPLY
    const deco = { x: logo.x - 1, y: sa.wall.rOut - sa.printable.rho1 + 0.5, w: 4, h: 2 };
    const els = [el("logo#0", "logo", logo), el("decorative#0", "decorative", deco, "logo#0")];
    const res = smartLayoutFromElements(structure, els)!;
    const shifted = { ...deco, x: deco.x + (res.plan[0].rect.x - logo.x), y: deco.y + (res.plan[0].rect.y - logo.y) };
    if (rectInRegion(sa.wall, sa.printable, deco) && !rectInRegion(sa.wall, sa.printable, shifted)) {
      const pre = runPackagingPreflight(structure, els, stateFromResult(res));
      expect(pre.issues.find((i) => i.elementId === "decorative#0")).toMatchObject({ severity: "warning", blocking: false });
    }
  });

  it("emblème et médaillon : les décors des layouts sont déclarés liés à la marque", () => {
    for (const layout of ["emblem", "label"] as const) {
      const els = recorded(structure, { ...DESIGN, layout, origin: "Douala" });
      const linked = els.filter((e) => e.parentId);
      expect(linked.length).toBeGreaterThan(0);
      for (const c of linked) {
        expect(c.role).toBe("decorative");
        expect(els.some((e) => e.id === c.parentId && e.role === "brand")).toBe(true);
      }
    }
  });

  it("emblème sur la boîte traiteur : la marque déplacée emmène ses anneaux, signalés s'ils sortent de la zone imprimée", () => {
    const els = recorded(structure, { ...DESIGN, layout: "emblem" });
    const res = smartLayoutFromElements(structure, els)!;
    const brand = res.plan.find((p) => p.role === "brand")!;
    for (const c of res.plan.filter((p) => p.parentId === brand.id)) {
      expect(c.rect.x - c.original.x).toBeCloseTo(brand.rect.x - brand.original.x, 12);
      expect(c.rect.y - c.original.y).toBeCloseTo(brand.rect.y - brand.original.y, 12);
    }
    const pre = runPackagingPreflight(structure, els, stateFromResult(res));
    const out = res.plan.filter((p) => p.linkIssue).map((p) => p.id);
    expect(pre.issues.filter((i) => i.role === "decorative").map((i) => i.elementId)).toEqual(out);
    expect(pre.issues.every((i) => !i.blocking)).toBe(true);
    if (out.length) expect(brand.groupIssue).toBeTruthy();
  });
});

describe("collisions au preflight (même règle que le placement)", () => {
  const [, L, W, H, m] = TUBS[0];
  const structure = structureOf(L, W, H, m);
  const sa = structure.composition!.safeArea;
  it.each([["barcode", "netContent"], ["barcode", "logo"], ["regulatory", "barcode"], ["logo", "brand"]] as [ElementRole, ElementRole][])("%s puis %s au même endroit : le second est signalé « chevauche »", (a, b) => {
    const r = at(sa, (sa.safe.rho0 + sa.safe.rho1) / 2, 0, 20, 10);
    const els = [el(`${b}#0`, b, r), el(`${a}#0`, a, { ...r })];
    const rep = preflightLayout(sa, "wrap", els);
    const hit = rep.issues.find((i) => /^chevauche/.test(i.message))!;
    expect(hit).toBeTruthy();
    // the element placed later (placementOrder) is the one in the way, as in the smart layout
    expect(hit.elementId).toBe(placementOrder(els)[1].id);
    expect(hit.message).toBe(`chevauche « ${placementOrder(els)[0].id} »`);
    expect(hit.blocking).toBe(ROLE_PRIORITY[hit.role] === 0);
  });
});

describe("cas bloquant sans correction automatique possible : mentions trop longues (boîte traiteur)", () => {
  const [, L, W, H, m] = TUBS.find((t) => t[0] === "deli-container")!;
  const structure = structureOf(L, W, H, m);
  const els = recorded(structure, { ...DESIGN, ingredients: LONG });
  it("P0 impossible → BLOCKING, correction = contenu ; même après APPLY", () => {
    const st = stateFromResult(smartLayoutFromElements(structure, els)!);
    for (const s of [null, st]) {
      const pre = runPackagingPreflight(structure, els, s);
      const reg = pre.issues.find((i) => i.role === "regulatory")!;
      expect(reg).toMatchObject({ severity: "blocking", blocking: true, fix: "content" });
      expect(reg.suggestedRect).toBeUndefined();
      expect(exportAllowed(pre)).toBe(false);
    }
  });
});

describe("15. autres formats : aucun comportement nouveau", () => {
  const others = SHAPE_ROWS.filter((r) => r[3] !== "tub");
  it("preflight non applicable, état refusé proprement, rien d'enregistré", () => {
    const [, L, W, H, m] = TUBS[0];
    const st = stateFromResult(smartLayoutFromElements(structureOf(L, W, H, m), recorded(structureOf(L, W, H, m)))!);
    for (const r of others) {
      const s = resolveStructure({ model: r[3] as never, lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] });
      expect(runPackagingPreflight(s, [], null)).toEqual(PREFLIGHT_NOT_APPLICABLE);
      expect(parseSmartLayoutState(st, s).state).toBeNull();
      expect(exportAllowed(runPackagingPreflight(s, null, null))).toBe(true);
    }
  });
});

describe("24-25. robustesse de l'état enregistré", () => {
  const [, L, W, H, m] = TUBS.find((t) => t[0] === "deli-container")!;
  const structure = structureOf(L, W, H, m);
  const elements = recorded(structure);
  const good = stateFromResult(smartLayoutFromElements(structure, elements)!);
  // (fallback only so that the suite still loads if APPLY ever produced nothing: test 1-2 then fails)
  const p0 = good.placements[0] ?? { elementId: "logo#0", role: "logo" as const, surfaceId: "wrap", original: { x: 0, y: 0, w: 1, h: 1 }, applied: { x: 0, y: 0, w: 1, h: 1 }, delta: [0, 0] as [number, number], rotationDeg: 0 as const };
  const withPlacement = (p: unknown) => ({ ...good, placements: [p, ...good.placements.slice(1)] });
  const cases: [string, unknown, RegExp | null][] = [
    ["état absent", undefined, null],
    ["état null", null, null],
    ["état vide", {}, /version/],
    ["chaîne", "applied", /illisible/],
    ["tableau", [], /illisible/],
    ["version inconnue", { ...good, version: 2 }, /version/],
    ["statut inconnu", { ...good, status: "pending" }, /statut/],
    ["surface inconnue", { ...good, surfaceId: "front" }, /surface/],
    ["autre format", { ...good, frame: { ...good.frame, w: good.frame.w + 1 } }, /autre format/],
    ["placements absents", { ...good, placements: undefined }, /placements/],
    ["placement incomplet", withPlacement({ elementId: p0.elementId, role: p0.role }), /ignoré/],
    ["identifiant inexistant", withPlacement({ ...p0, elementId: "inconnu" }), /identifiant/],
    ["delta NaN", withPlacement({ ...p0, delta: [Number.NaN, 0] }), /décalage invalide/],
    ["position infinie", withPlacement({ ...p0, applied: { ...p0.applied, x: Infinity } }), /rectangle/],
    ["rôle inconnu", withPlacement({ ...p0, role: "sticker" }), /rôle inconnu/],
    ["surface de placement inconnue", withPlacement({ ...p0, surfaceId: "lid" }), /surface inconnue/],
    ["décalage incohérent", withPlacement({ ...p0, delta: [p0.delta[0] + 5, p0.delta[1]] }), /incohérent/],
    ["taille modifiée", withPlacement({ ...p0, applied: { ...p0.applied, w: p0.applied.w * 0.9 } }), /déformation/],
    ["rotation", withPlacement({ ...p0, rotationDeg: 90 }), /rotation/],
    ["hors secteur", withPlacement({ ...p0, applied: { ...p0.applied, y: p0.applied.y - 500 }, delta: [p0.delta[0], p0.delta[1] - 500] }), /hors du secteur/],
    ["parent invalide", withPlacement({ ...p0, parentId: p0.elementId }), /parent/],
    ["placement en double", { ...good, placements: [p0, p0, ...good.placements.slice(1)] }, /double/],
  ];
  it.each(cases)("%s → refusé ou ignoré proprement, jamais de coordonnées invalides", (_n, raw, issue) => {
    let parsed!: ReturnType<typeof parseSmartLayoutState>;
    expect(() => (parsed = parseSmartLayoutState(raw, structure))).not.toThrow();
    if (issue) expect(parsed.issues.join(" | ")).toMatch(issue);
    else expect(parsed).toEqual({ state: null, issues: [] });
    if (parsed.state) {
      const wp = wrapPlacementFromState(parsed.state);
      for (const [dx, dy] of Object.values(wp.offsets)) expect(Number.isFinite(dx) && Number.isFinite(dy)).toBe(true);
      expect(new Set(parsed.state.placements.map((p) => p.elementId)).size).toBe(parsed.state.placements.length);
      // whatever was refused, the drawing and the preflight still run
      expect(() => drawCalls(structure, { ...DESIGN, wrapPlacement: wp })).not.toThrow();
      expect(() => runPackagingPreflight(structure, elements, parsed.state)).not.toThrow();
    }
  });

  it("placement d'un élément qui n'existe plus : ignoré au rendu et au preflight, signalé comme orphelin", () => {
    const st = { ...good, placements: [...good.placements, { ...p0, elementId: "logo#9" }].sort((a, b) => (a.elementId < b.elementId ? -1 : 1)) };
    const parsed = parseSmartLayoutState(st, structure).state!;
    expect(orphanPlacements(parsed, elements)).toEqual(["logo#9"]);
    expect(currentElements(elements, parsed).map((e) => e.id)).toEqual(elements.map((e) => e.id));
  });

  it("lien vers un parent absent ou lui-même lié : planifié seul, lien signalé, jamais d'erreur", () => {
    const sa = structure.composition!.safeArea;
    const r = at(sa, (sa.safe.rho0 + sa.safe.rho1) / 2, 0, 5, 5);
    const plan = planLayout(sa, [el("a#0", "badge", r, "ghost#0"), el("b#0", "badge", { ...r, x: r.x + 10 }, "a#0")]);
    expect(plan[0].reason).toMatch(/lien ignoré/);
    expect(plan[1].parentId).toBe("a#0");
    expect(() => preflightLayout(sa, "wrap", [el("c#0", "decorative", r, "c#0")])).not.toThrow();
  });

  it("APPLY et restauration répétés : stables", () => {
    let raw: unknown = null;
    for (let i = 0; i < 3; i++) {
      raw = stateFromResult(smartLayoutFromElements(structure, elements)!);
      expect(sameState(parseSmartLayoutState(raw, structure).state, good)).toBe(true);
      raw = null;
      expect(parseSmartLayoutState(raw, structure).state).toBeNull();
    }
  });
});

let warn: ReturnType<typeof vi.spyOn>;
beforeAll(() => { warn = vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterAll(() => warn.mockRestore());
