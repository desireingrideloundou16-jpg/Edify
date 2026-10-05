/**
 * Phase 2C-4F-3: smart layout on the developed wall of the 4 plastic tubs. A deterministic geometric
 * layer on top of the composition regions of 2C-4F-2: elements keep their size, move only when they
 * must, never into the seam or under the lid, and an impossible element is reported, never forced.
 * Every region and size comes from the profile (resolveStructure → composition).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SHAPE_ROWS } from "@/lib/catalog/shapeData";
import {
  PLACEMENT_GRID_MM, ROLE_PRIORITY, ROLE_RULES, SAFE_MM, applyLayout, conicalSafeArea, findValidPlacement, layoutOffsets, placementOrder, planLayout,
  polarOf, rectInCircle, rectInLayoutRegion, rectInRegion, rectsOverlap, resolveStructure, tubWall, type ConicalSafeArea, type ElementRole,
  type PackagingElement, type Placement, type Rect,
} from "@/lib/structure";
import { elementsFromRecords, placementFromPlan, recordWrapElements, smartLayoutFromElements } from "@/lib/artwork/smartLayout";
import { drawWrap, type PackagingDesign } from "@/lib/artwork/draw";
import { mockContext } from "./mockCanvas";

const TUBS = SHAPE_ROWS.filter((r) => r[3] === "tub").map((r) => [r[0], r[4], r[5], r[6], r[7]] as const);
const DESIGN = {
  brandName: "Votre marque", productName: "Nom du produit", tagline: "Votre accroche", volume: "250 g",
  palette: ["#ffffff", "#111111", "#0a8a5f", "#e6007e"], headingFont: "Inter", bodyFont: "Inter", finishing: "matte",
} as PackagingDesign;

/** Upright rectangle of size w × h centred at (ρ, ψ) about the apex. */
const at = (sa: ConicalSafeArea, rho: number, psi: number, w: number, h: number): Rect => {
  const cx = sa.wall.width / 2 + rho * Math.sin(psi), cy = sa.wall.rOut - rho * Math.cos(psi);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
};
const corners = (r: Rect): [number, number][] => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
const el = (id: string, role: ElementRole, rect: Rect): PackagingElement => ({ id, role, rect });
const CRITICAL: ElementRole[] = ["barcode", "regulatory", "logo", "brand", "productName", "netContent"];

/** The default design of the editor recorded on the wall (mock canvas: 0.55 em per character). */
function recorded(structure: ReturnType<typeof resolveStructure>, design: PackagingDesign = DESIGN) {
  const surface = structure.printSurfaces.find((s) => s.id === "wrap")!;
  const { ctx } = mockContext();
  return elementsFromRecords(recordWrapElements(ctx, design, surface), surface.printArea!);
}

describe.each(TUBS)("%s", (id, L, W, H, m) => {
  const structure = resolveStructure({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m });
  const sa = structure.composition!.safeArea;
  const { wall, coveredSlant } = tubWall(L, W, H);
  const sector = { rho0: wall.rIn, rho1: wall.rOut, psiMax: wall.angle / 2 };
  const mid = (sa.safe.rho0 + sa.safe.rho1) / 2;
  const safeH = sa.safe.rho1 - sa.safe.rho0;
  const seamMarginPsi = wall.angle / 2 - sa.safe.psiMax;
  /** Every corner of a final rectangle is inside the printed sector, out of the covered band (+ margin) and away from the seam. */
  const physicallySafe = (r: Rect) => corners(r).every((p) => {
    const { rho, psi } = polarOf(wall, p);
    return rho <= wall.rOut - coveredSlant - SAFE_MM + 1e-6 && Math.abs(psi) <= wall.angle / 2 - seamMarginPsi + 1e-9;
  }) && rectInRegion(wall, sector, r);

  it("0. régions : celles de 2C-4F-2, issues du profil, sur la surface wrap", () => {
    expect(structure.composition!.surfaceId).toBe("wrap");
    expect(sa).toEqual(conicalSafeArea(wall, coveredSlant, { radialMarginMm: SAFE_MM }));
  });

  it("A. élément déjà valide → ne bouge pas", () => {
    for (const role of ["logo", "brand", "productName", "netContent", "barcode"] as ElementRole[]) {
      const r = at(sa, mid, 0, safeH * 0.2, safeH * 0.2);
      const p = findValidPlacement(sa, el("e", role, r), []);
      expect(p.status).toBe("valid");
      expect(p.rect).toEqual(r);
      expect(p.displacementMm).toBe(0);
      expect(p.score).toBe(1);
    }
  });

  it("B. logo hors zone sûre → placé dans la zone sûre, de préférence dans le cercle du logo conseillé", () => {
    const s = Math.min(sa.logo.r, safeH / 4);
    const r = at(sa, sa.safe.rho1 + s * 0.8, 0, s, s); // overlaps the top margin / covered band
    expect(rectInLayoutRegion(sa, "safe", r)).toBe(false);
    const p = findValidPlacement(sa, el("logo", "logo", r), []);
    expect(p.status).toBe("moved");
    expect(p.region).toBe("logo");
    expect(rectInCircle(p.rect, sa.logo)).toBe(true);
    expect(rectInLayoutRegion(sa, "primary", p.rect)).toBe(true);
    expect(physicallySafe(p.rect)).toBe(true);
  });

  it("C. nom du produit hors zone principale (mais dans la zone sûre) → recommandé dans la zone principale", () => {
    const h = safeH * 0.15, w = mid * sa.primary.psiMax * 0.5;
    const psi = (sa.primary.psiMax + sa.safe.psiMax) / 2;
    const r = at(sa, mid, psi, w, h);
    expect(rectInLayoutRegion(sa, "safe", r)).toBe(true);
    expect(rectInLayoutRegion(sa, "primary", r)).toBe(false);
    const p = findValidPlacement(sa, el("t", "productName", r), []);
    expect(p.status).toBe("moved");
    expect(p.region).toBe("primary");
    expect(rectInLayoutRegion(sa, "primary", p.rect)).toBe(true);
    // other text roles accept the safe area as it is
    expect(findValidPlacement(sa, el("t", "subtitle", r), []).status).toBe("valid");
  });

  it("D. contenu net hors zone sûre (sous l'arc du bas) → repositionné, taille conservée", () => {
    const r = at(sa, sa.safe.rho0, 0, safeH * 0.3, safeH * 0.08);
    expect(rectInLayoutRegion(sa, "safe", r)).toBe(false);
    const p = findValidPlacement(sa, el("n", "netContent", r), []);
    expect(p.status).toBe("moved");
    expect(rectInLayoutRegion(sa, "safe", p.rect)).toBe(true);
    expect([p.rect.w, p.rect.h]).toEqual([r.w, r.h]);
  });

  it("E-F. code-barres hors zone sûre ou à cheval sur la couture → repositionné dans la zone sûre", () => {
    const bw = safeH * 0.5, bh = safeH * 0.2;
    const outside = at(sa, sa.safe.rho0 - bh * 0.3, -sa.safe.psiMax * 0.5, bw, bh);
    const onSeam = at(sa, mid, wall.angle / 2 - (bw / 2 / mid) * 0.5, bw, bh);
    expect(corners(onSeam).some((p) => Math.abs(polarOf(wall, p).psi) > wall.angle / 2)).toBe(true); // really across the seam
    for (const r of [outside, onSeam]) {
      expect(rectInLayoutRegion(sa, "safe", r)).toBe(false);
      const p = findValidPlacement(sa, el("b", "barcode", r), []);
      expect(p.status).toBe("moved");
      expect(physicallySafe(p.rect)).toBe(true);
      expect(p.rotationDeg).toBe(0);
    }
  });

  it("G. code-barres impossible à placer → invalid, raison déterministe, jamais coupé ni réduit", () => {
    const r = at(sa, mid, 0, safeH * 0.5, safeH * 1.05); // taller than the safe band
    const p = findValidPlacement(sa, el("b", "barcode", r), []);
    expect(p.status).toBe("invalid");
    expect(p.reason).toMatch(/^trop grand/);
    expect(p.rect).toEqual(r);
    expect(p.score).toBe(0);
    expect(findValidPlacement(sa, el("b", "barcode", r), []).reason).toBe(p.reason);
  });

  it("H. logo sous le couvercle → sorti de la bande couverte", () => {
    const s = safeH * 0.2;
    const r = at(sa, wall.rOut - coveredSlant / 2, 0, s, s);
    expect(corners(r).some((c) => polarOf(wall, c).rho > wall.rOut - coveredSlant)).toBe(true);
    const p = findValidPlacement(sa, el("logo", "logo", r), []);
    expect(p.status).toBe("moved");
    expect(physicallySafe(p.rect)).toBe(true);
  });

  it("I. élément trop grand (plus large que la zone sûre) → invalid", () => {
    const r = at(sa, mid, 0, 2 * sa.safe.rho1 * Math.sin(sa.safe.psiMax) + 1, safeH * 0.1);
    for (const role of ["netContent", "logo", "regulatory"] as ElementRole[]) {
      const p = findValidPlacement(sa, el("x", role, r), []);
      expect(p.status).toBe("invalid");
      expect(p.reason).toMatch(/^trop grand/);
    }
  });

  it("J. collisions entre éléments critiques → résolution déterministe, P0 protégé", () => {
    const r = at(sa, mid, 0, safeH * 0.3, safeH * 0.2); // on the front: every role accepts it as it is
    const pairs: [ElementRole, ElementRole][] = [["barcode", "logo"], ["barcode", "productName"], ["barcode", "netContent"], ["regulatory", "barcode"], ["logo", "brand"]];
    for (const [a, b] of pairs) {
      const plan = planLayout(sa, [el("b", b, { ...r }), el("a", a, { ...r })]);
      const pa = plan.find((p) => p.id === "a")!, pb = plan.find((p) => p.id === "b")!;
      const firstId = placementOrder([el("a", a, r), el("b", b, r)])[0].id; // priority, then the fixed role order
      const [first, second] = firstId === "a" ? [pa, pb] : [pb, pa];
      expect(first.status).toBe("valid"); // the higher priority keeps its place
      expect(second.status).toBe("moved");
      expect(rectsOverlap(first.rect, second.rect)).toBe(false);
      expect(planLayout(sa, [el("a", a, { ...r }), el("b", b, { ...r })])).toEqual([pa, pb]);
    }
    // the barcode is never displaced by a lower priority, whatever the input order
    const bc = at(sa, mid, 0, safeH * 0.4, safeH * 0.2);
    for (const role of ["logo", "brand", "netContent", "badge", "secondary"] as ElementRole[]) {
      const plan = planLayout(sa, [el("z", role, { ...bc }), el("bar", "barcode", { ...bc })]);
      expect(plan[1].status).toBe("valid");
      expect(plan[1].rect).toEqual(bc);
    }
  });

  it("K-N. mise en page par défaut de l'éditeur : rien hors secteur, rien de critique sous le couvercle ni sur la couture, aucune déformation", () => {
    const elements = recorded(structure);
    expect(elements.map((e) => e.role)).toEqual(expect.arrayContaining(["logo", "brand", "productName", "netContent", "barcode"]));
    const plan = planLayout(sa, elements);
    for (const p of plan) {
      expect([p.rect.w, p.rect.h]).toEqual([p.original.w, p.original.h]); // N
      expect(p.rotationDeg).toBe(0);
      if (p.status === "invalid") continue;
      expect(rectInRegion(wall, sector, p.rect)).toBe(true); // K
      if (CRITICAL.includes(p.role)) expect(physicallySafe(p.rect)).toBe(true); // L-M
    }
    // protected elements never overlap after the plan
    const prot = plan.filter((p) => p.priority <= 2 && p.status !== "invalid");
    for (let i = 0; i < prot.length; i++) for (let j = i + 1; j < prot.length; j++) expect(rectsOverlap(prot[i].rect, prot[j].rect)).toBe(false);
    expect(plan.filter((p) => p.status === "invalid")).toEqual([]);
  });

  it("O. même entrée → même sortie, quel que soit l'ordre des éléments", () => {
    const elements = recorded(structure);
    const a = planLayout(sa, elements);
    const shuffled = [...elements].reverse();
    const b = planLayout(sa, shuffled);
    const byId = (pl: Placement[]) => Object.fromEntries(pl.map((p) => [p.id, p]));
    expect(byId(b)).toEqual(byId(a));
    expect(planLayout(sa, elements)).toEqual(a);
    expect(placementOrder(shuffled).map((e) => e.id)).toEqual(placementOrder(elements).map((e) => e.id));
    expect(JSON.stringify(recorded(structure))).toBe(JSON.stringify(elements));
  });

  it("P. déplacement minimal : à une maille près du plus petit déplacement valide (recherche fine indépendante)", () => {
    const r = at(sa, sa.safe.rho0, sa.safe.psiMax * 0.3, safeH * 0.25, safeH * 0.1);
    const p = findValidPlacement(sa, el("n", "netContent", r), []);
    let best = Infinity;
    for (let dy = -safeH; dy <= safeH; dy += 0.25) for (let dx = -safeH; dx <= safeH; dx += 0.25) {
      const c = { ...r, x: r.x + dx, y: r.y + dy };
      if (rectInRegion(wall, sa.safe, c)) best = Math.min(best, Math.hypot(dx, dy));
    }
    expect(p.status).toBe("moved");
    expect(p.displacementMm).toBeLessThanOrEqual(best + PLACEMENT_GRID_MM * Math.SQRT2 + 1e-9);
    expect(p.displacementMm).toBeGreaterThanOrEqual(best - 0.25 * Math.SQRT2 - 1e-9);
  });

  it("validité exacte sur le secteur, jamais sur la boîte englobante", () => {
    // inside the bounding box of the safe area, outside the safe area itself (a top corner of the box)
    const xs = [sa.wall.width / 2 - sa.safe.rho1 * Math.sin(sa.safe.psiMax)], y0 = sa.wall.rOut - sa.safe.rho1;
    const r = { x: xs[0] + 0.5, y: y0 + 0.5, w: safeH * 0.2, h: safeH * 0.1 };
    expect(rectInLayoutRegion(sa, "safe", r)).toBe(false);
    expect(findValidPlacement(sa, el("n", "netContent", r), []).status).toBe("moved");
  });

  it("RECOMMEND / APPLY : le plan ne modifie rien, APPLY déplace seulement les éléments « moved »", () => {
    const elements = recorded(structure);
    const before = JSON.stringify(elements);
    const plan = planLayout(sa, elements);
    expect(JSON.stringify(elements)).toBe(before);
    const applied = applyLayout(elements, plan);
    for (const [i, e] of applied.entries()) {
      const p = plan[i];
      expect(e.rect).toEqual(p.status === "moved" ? p.rect : elements[i].rect);
    }
    // a second plan on the applied layout keeps everything in place
    expect(planLayout(sa, applied).filter((p) => p.status === "moved")).toEqual([]);
    expect(Object.keys(layoutOffsets(plan)).sort()).toEqual(plan.filter((p) => p.status === "moved").map((p) => p.id).sort());
  });

  it("côté conservé : un élément du dos ou des côtés n'est jamais déplacé dans la zone principale (la face)", () => {
    const h = safeH * 0.15, w = safeH * 0.4;
    for (const sign of [-1, 1]) {
      // out of the safe area near the seam, on one side of the pot
      const r = at(sa, sa.safe.rho0 + h * 0.2, sign * (sa.safe.psiMax - (w / 4) / mid), w, h);
      expect(rectInLayoutRegion(sa, "safe", r)).toBe(false);
      for (const role of ["regulatory", "barcode", "netContent", "secondary"] as ElementRole[]) {
        const p = findValidPlacement(sa, el("x", role, r), []);
        expect(p.status).toBe("moved");
        for (const c of corners(p.rect)) expect(sign * polarOf(wall, c).psi).toBeGreaterThanOrEqual(sa.primary.psiMax - 1e-9);
      }
    }
    // the face's own roles may reach the face (rule C)
    const side = at(sa, mid, (sa.primary.psiMax + sa.safe.psiMax) / 2, safeH * 0.1, safeH * 0.1);
    expect(findValidPlacement(sa, el("l", "logo", side), []).region).not.toBeNull();
  });

  it("colonne : quand la place manque, la pile est réalignée — même ordre, même x, mêmes tailles, espacement réduit ; le filet décoratif suit", () => {
    // a centred stack taller than the safe band with its spacing, short enough without it
    const hs = [0.2, 0.14, 0.08, 0.05, 0.06].map((k) => k * safeH), gap = safeH * 0.12;
    const roles: ElementRole[] = ["logo", "brand", "productName", "subtitle", "netContent"];
    const top = sa.wall.rOut - sa.safe.rho1 + 1;
    const ws = [0.25, 0.6, 0.45, 0.35, 0.15].map((k) => k * mid * Math.sin(sa.primary.psiMax) * 2 * 0.8);
    let y = top;
    const els = roles.map((role, i) => {
      const e = el(`${role}#0`, role, { x: sa.wall.width / 2 - ws[i] / 2, y, w: ws[i], h: hs[i] });
      y += hs[i] + gap;
      return e;
    });
    const rule = el("decorative#0", "decorative", { x: sa.wall.width / 2 - ws[3] / 4, y: els[2].rect.y + hs[2] + gap / 2, w: ws[3] / 2, h: 0.4 });
    const all = [...els, rule];
    expect(all.some((e) => !rectInLayoutRegion(sa, "safe", e.rect))).toBe(true);
    const plan = planLayout(sa, all);
    const by = Object.fromEntries(plan.map((p) => [p.id, p]));
    const ordered = [...els.map((e) => e.id).slice(0, 3), "decorative#0", ...els.map((e) => e.id).slice(3)];
    const tops = ordered.map((id) => by[id].rect.y);
    expect(tops).toEqual([...tops].sort((a, b) => a - b)); // same top-to-bottom order
    for (const p of plan) {
      expect(p.status).not.toBe("invalid");
      expect(p.rect.x).toBeCloseTo(p.original.x, 9); // same horizontal alignment (no slide was needed here)
      expect([p.rect.w, p.rect.h]).toEqual([p.original.w, p.original.h]);
      if (p.role !== "decorative") expect(rectInLayoutRegion(sa, p.region!, p.rect)).toBe(true);
    }
    expect(plan.some((p) => p.status === "moved")).toBe(true);
    const prot = plan.filter((p) => p.role !== "decorative");
    for (let i = 0; i < prot.length; i++) for (let j = i + 1; j < prot.length; j++) expect(rectsOverlap(prot[i].rect, prot[j].rect)).toBe(false);
  });

  it("mise en page par défaut : la colonne de la face garde son ordre et son axe", () => {
    const elements = recorded(structure);
    const plan = planLayout(sa, elements);
    const face = ["logo#0", "brand#0", "productName#0", "subtitle#0", "netContent#0"].map((k) => plan.find((p) => p.id === k)!);
    const tops = face.map((p) => p.rect.y);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    for (const p of face) expect(p.rect.x + p.rect.w / 2).toBeCloseTo(p.original.x + p.original.w / 2, 9);
  });

  it("intégration : le rendu APPLY dessine chaque élément déplacé à sa position planifiée (même position pour aperçu, 3D, PDF)", () => {
    const surface = structure.printSurfaces.find((s) => s.id === "wrap")!;
    const res = smartLayoutFromElements(structure, recorded(structure))!;
    expect(res.placement.aspect).toBeCloseTo(surface.printArea!.w / surface.printArea!.h, 12);
    for (const k of [2, 7.5]) { // two resolutions (texture, print): offsets scale with the frame
      const fw = surface.printArea!.w * k, fh = surface.printArea!.h * k;
      const plain = mockContext(), placed = mockContext();
      drawWrap(plain.ctx, 0, 0, fw, fh, DESIGN, 0.3);
      drawWrap(placed.ctx, 0, 0, fw, fh, { ...DESIGN, wrapPlacement: res.placement }, 0.3);
      expect(placed.calls.length).toBe(plain.calls.length);
      const vol = (c: typeof plain.calls) => c.filter((x) => x.text === DESIGN.volume);
      const move = res.plan.find((p) => p.id === "netContent#0")!;
      const [a, b] = [vol(plain.calls)[0], vol(placed.calls)[0]];
      const dx = move.status === "moved" ? move.rect.x - move.original.x : 0, dy = move.status === "moved" ? move.rect.y - move.original.y : 0;
      expect(b.x - a.x).toBeCloseTo(dx * k, 6);
      expect(b.y - a.y).toBeCloseTo(dy * k, 6);
      // the background, motif and bands are not moved
      expect(placed.calls.filter((c) => c.op === "fillRect").slice(0, 3)).toEqual(plain.calls.filter((c) => c.op === "fillRect").slice(0, 3));
    }
    // another wrap (other proportions) never receives this plan
    const other = mockContext(), ref = mockContext();
    drawWrap(other.ctx, 0, 0, 1000, 300, { ...DESIGN, wrapPlacement: res.placement }, 0.3);
    drawWrap(ref.ctx, 0, 0, 1000, 300, DESIGN, 0.3);
    expect(other.calls).toEqual(ref.calls);
  });
});

describe("cas boîte traiteur (constaté en 2C-4F-2)", () => {
  const row = TUBS.find((t) => t[0] === "deli-container")!;
  const structure = resolveStructure({ model: "tub", lengthMm: row[1], widthMm: row[2], heightMm: row[3], material: row[4] });
  const sa = structure.composition!.safeArea;
  const elements = recorded(structure);
  const plan = planLayout(sa, elements);
  const get = (pl: { id: string }[], id: string) => pl.find((p) => p.id === id)!;

  it("avant : « Contenu net » (dos et face) et le code-barres sortent de la zone sûre, le code-barres traverse l'arc du bas", () => {
    for (const id of ["netContent#0", "netContent#1", "barcode#0"]) expect(rectInLayoutRegion(sa, "safe", (get(elements, id) as PackagingElement).rect)).toBe(false);
    const bar = (get(elements, "barcode#0") as PackagingElement).rect;
    expect(corners(bar).some((c) => polarOf(sa.wall, c).rho < sa.wall.rIn)).toBe(true);
  });

  it("la face ne tient pas avec son espacement : sa colonne est réalignée (ordre, axe, tailles), pas éparpillée", () => {
    const face = ["logo#0", "brand#0", "productName#0", "subtitle#0", "netContent#0"].map((id) => get(plan, id) as Placement);
    expect(face.every((p) => p.status === "moved" && /^réaligné avec sa colonne/.test(p.reason))).toBe(true);
    expect((get(plan, "decorative#0") as Placement).reason).toBe("décoratif : suit sa colonne");
    for (const p of face) expect(rectInLayoutRegion(sa, p.region!, p.rect)).toBe(true);
  });

  it("après APPLY : contenu net et code-barres repositionnés dans la zone sûre, hors couture et hors arc du bas", () => {
    const applied = applyLayout(elements, plan);
    for (const id of ["netContent#0", "netContent#1", "barcode#0"]) {
      expect(get(plan, id) as Placement).toMatchObject({ status: "moved" });
      const r = (get(applied, id) as PackagingElement).rect;
      expect(rectInLayoutRegion(sa, "safe", r)).toBe(true);
      for (const c of corners(r)) expect(polarOf(sa.wall, c).rho).toBeGreaterThan(sa.wall.rIn + SAFE_MM - 1e-9);
    }
  });
});

describe("élément trop grand dans l'éditeur : mentions longues sur la boîte traiteur", () => {
  const row = TUBS.find((t) => t[0] === "deli-container")!;
  const structure = resolveStructure({ model: "tub", lengthMm: row[1], widthMm: row[2], heightMm: row[3], material: row[4] });
  const sa = structure.composition!.safeArea;
  const design = { ...DESIGN, ingredients: "Lait entier pasteurisé, ferments lactiques, sucre de canne, purée de mangue 12 %, arôme naturel, stabilisant : pectine. Contient : LAIT. Peut contenir des traces de FRUITS À COQUE. Conserver entre 0 et 6 °C après ouverture et consommer dans les 3 jours." };
  const plan = planLayout(sa, recorded(structure, design));

  it("le bloc de mentions (P0) trop grand pour son côté → invalid, laissé en place, jamais poussé sur la face", () => {
    const reg = plan.find((p) => p.role === "regulatory")!;
    expect(reg.status).toBe("invalid");
    expect(reg.reason).toMatch(/^trop grand .* de son côté du pot$/);
    expect(reg.rect).toEqual(reg.original);
    for (const p of plan.filter((q) => ["logo", "brand", "productName"].includes(q.role))) expect(rectInLayoutRegion(sa, "primary", p.rect)).toBe(true);
    for (const p of plan.filter((q) => q.status === "moved" && polarOf(sa.wall, [q.original.x + q.original.w / 2, q.original.y + q.original.h / 2]).psi < -sa.primary.psiMax)) {
      for (const c of corners(p.rect)) expect(polarOf(sa.wall, c).psi).toBeLessThanOrEqual(-sa.primary.psiMax + 1e-9);
    }
    // the barcode and the net content are still placed in the safe area
    for (const id of ["barcode#0", "netContent#1"]) expect(rectInLayoutRegion(sa, "safe", plan.find((p) => p.id === id)!.rect)).toBe(true);
  });
});

describe("portée et garde-fous", () => {
  it("seuls les 4 pots coniques ont des régions de composition (aucune autre famille n'est concernée)", () => {
    const withComp = SHAPE_ROWS.filter((r) => resolveStructure({ model: r[3] as never, lengthMm: r[4], widthMm: r[5], heightMm: r[6], material: r[7] }).composition).map((r) => r[0]);
    expect(withComp.sort()).toEqual(TUBS.map((t) => t[0]).sort());
  });

  it("le code-barres est critique (P0), jamais décoratif ; motif et illustration ne sont pas contraints", () => {
    expect(ROLE_PRIORITY.barcode).toBe(0);
    expect(ROLE_PRIORITY.regulatory).toBe(0);
    expect(ROLE_RULES.barcode).not.toBeNull();
    expect(ROLE_RULES.decorative).toBeNull();
    expect(ROLE_RULES.image).toBeNull();
  });

  it("entrées invalides refusées ; offsets du plan = fractions du cadre imprimé", () => {
    const [, L, W, H, m] = TUBS[0];
    const s = resolveStructure({ model: "tub", lengthMm: L, widthMm: W, heightMm: H, material: m });
    const sa = s.composition!.safeArea;
    const r = { x: 1, y: 1, w: 1, h: 1 };
    expect(() => planLayout(sa, [el("a", "logo", r), el("a", "brand", r)])).toThrow(/duplicate/);
    expect(() => planLayout(sa, [el("a", "logo", { ...r, w: Number.NaN })])).toThrow(/invalid rectangle/);
    const plan = planLayout(sa, recorded(s));
    const pa = s.printSurfaces.find((p) => p.id === "wrap")!.printArea!;
    const pl = placementFromPlan(plan, pa);
    for (const [id, [fx, fy]] of Object.entries(pl.offsets)) {
      const p = plan.find((q) => q.id === id)!;
      expect(fx * pa.w).toBeCloseTo(p.rect.x - p.original.x, 9);
      expect(fy * pa.h).toBeCloseTo(p.rect.y - p.original.y, 9);
    }
  });

  it("le PDF commercial n'imprime ni guides ni conseils de mise en page (aperçu uniquement)", () => {
    const pdf = readFileSync("src/lib/print/exportPrintPdf.ts", "utf8");
    expect(pdf).not.toMatch(/drawLayoutAdvice|drawDieline\(/);
    expect(pdf).toMatch(/renderFlatArtwork/); // the artwork, with the applied placement, is what is printed
  });
});
