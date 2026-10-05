/**
 * Flat die-line templates, in millimetres (y down, origin at the top-left of the cut contour).
 * Moved from print/layout.ts unchanged (same numbers, same contours): the geometry now lives in
 * the structure module, and every panel carries a stable id and the id of its print surface.
 */
import { bondContacts, contactSlits, developAssembly, endSealBands, glueContacts, innerFoldLines, rectUnionOutline, seamStrips, surfaceWindows, type PartMap } from "./develop";
import type { AssemblyFold, AssemblyPart, CompositionGuide, EndSeal, FoldKind, GlueZone, Hinge, Panel, Pt, SealZone, TechnicalZone } from "./types";
import { sectorOutline, type FrustumWall } from "./profile/conicalProfile";
import type { ConicalSafeArea } from "./profile/conicalSafeArea";

export interface FlatTemplate {
  width: number;
  height: number;
  kindLabel: string;
  cut: Pt[];
  /** Other independent pieces of the same sheet (closed contours). */
  extraCuts?: Pt[][];
  creases: [Pt, Pt][];
  panels: Panel[];
  glue?: Pt[][];
  rootPanel?: string;
  /** Knife cuts inside the contour (folded assemblies). */
  slits?: [Pt, Pt][];
  /** Folds with their panels (folded assemblies). */
  hinges?: Hinge[];
  /** Glue areas (folded assemblies with glued parts). */
  glueZones?: GlueZone[];
  /** Machine-formed folds, apart from `creases` (folded assemblies). */
  formedFolds?: [Pt, Pt][];
  /** Weld / seam areas (folded assemblies with bonds or end seals). */
  sealZones?: SealZone[];
  /** Folds inside a panel (folded assemblies). */
  innerFolds?: { id: string; panel: string; kind: FoldKind; line: [Pt, Pt] }[];
  /** Printed areas to keep critical artwork out of (folded assemblies). */
  technicalZones?: TechnicalZone[];
  /** Composition guides (preview only). */
  compositionGuides?: CompositionGuide[];
  /** Composition regions behind the guides (developed cones): the smart layout's input. */
  composition?: { surfaceId: string; safeArea: ConicalSafeArea };
}

const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** Reverse tuck end carton: [glue][back][left][front][right], top tuck on the back panel. */
/** Glue flap width for a box of depth W (same rule for every folded board template). */
export function glueFlapWidth(W: number) {
  return Math.max(8, Math.min(15, W * 0.35));
}

export function tuckEndBox(L: number, W: number, H: number): FlatTemplate {
  const glue = glueFlapWidth(W);
  const tuck = Math.max(8, Math.min(15, W * 0.45));
  const dust = W * 0.75;
  const c = Math.min(3, L * 0.08); // tuck corner chamfer
  const T = W;
  const yTop = T + tuck;
  const yBot = yTop + H;
  const g = glue;
  const xa = g + L, xb = xa + W, xc = xb + L, xd = xc + W;
  const cut: Pt[] = [
    [g, yTop], [g, yTop - T], [g + c, yTop - T - tuck], [xa - c, yTop - T - tuck], [xa, yTop - T], [xa, yTop],
    [xa + 1, yTop - dust], [xb - W * 0.35, yTop - dust], [xb, yTop - dust * 0.35], [xb, yTop],
    [xc, yTop],
    [xc + 1, yTop - dust], [xd - W * 0.35, yTop - dust], [xd, yTop - dust * 0.35], [xd, yTop],
    [xd, yBot],
    [xd, yBot + dust * 0.35], [xd - W * 0.35, yBot + dust], [xc + 1, yBot + dust], [xc, yBot],
    [xc, yBot + T], [xc - c, yBot + T + tuck], [xb + c, yBot + T + tuck], [xb, yBot + T], [xb, yBot],
    [xb, yBot + dust * 0.35], [xb - W * 0.35, yBot + dust], [xa + 1, yBot + dust], [xa, yBot],
    [g, yBot], [0, yBot - 4], [0, yTop + 4],
  ];
  const creases: [Pt, Pt][] = [
    [[g, yTop], [g, yBot]], [[xa, yTop], [xa, yBot]], [[xb, yTop], [xb, yBot]], [[xc, yTop], [xc, yBot]],
    [[g, yTop], [xa, yTop]], [[g, yTop - T], [xa, yTop - T]],
    [[xa, yTop], [xb, yTop]], [[xc, yTop], [xd, yTop]],
    [[xb, yBot], [xc, yBot]], [[xb, yBot + T], [xc, yBot + T]],
    [[xa, yBot], [xb, yBot]], [[xc, yBot], [xd, yBot]],
  ];
  return {
    width: xd,
    height: yBot + T + tuck,
    kindLabel: "Étui à rabats inversés (4 faces + rabats)",
    cut,
    creases,
    // Panels with a surface (printed or not); tuck and dust flaps stay part of the cut contour.
    panels: [
      { id: "back", polygon: rect(g, yTop, L, H), surfaceId: "back" },
      { id: "left", polygon: rect(xa, yTop, W, H), surfaceId: "left" },
      { id: "front", polygon: rect(xb, yTop, L, H), surfaceId: "front" },
      { id: "right", polygon: rect(xc, yTop, W, H), surfaceId: "right" },
      { id: "top", polygon: rect(g, yTop - T, L, T), surfaceId: "top" },
      // Bottom tuck under the front: printed on the outside (phase 2C-3, same face as the 3D bottom).
      { id: "bottom", polygon: rect(xb, yBot, L, T), surfaceId: "bottom" },
      // Glue flap: physical, never printed.
      { id: "glue", polygon: [[g, yTop], [g, yBot], [0, yBot - 4], [0, yTop + 4]], surfaceId: "glue" },
    ],
    glue: [[[g, yTop], [g, yBot], [0, yBot - 4], [0, yTop + 4]]],
    rootPanel: "front",
  };
}

/** Wrap-around label: printed area + 6 mm overlap past the seam crease. */
export function wrapLabel(circumference: number, labelH: number, label: string, surfaceId: string): FlatTemplate {
  const overlap = 6;
  const w = circumference + overlap;
  return {
    width: w,
    height: labelH,
    kindLabel: label,
    cut: [[0, 0], [w, 0], [w, labelH], [0, labelH]],
    creases: [[[circumference, 0], [circumference, labelH]]],
    panels: [{ id: surfaceId, polygon: rect(0, 0, circumference, labelH), surfaceId }],
    glue: [rect(circumference, 0, overlap, labelH)],
  };
}

/** Pouch / sachet sheet: front and back side by side, optional bottom gusset below. */
export function frontBack(L: number, H: number, gusset: number, label: string): FlatTemplate {
  const w = L * 2;
  const h = H + gusset;
  const creases: [Pt, Pt][] = [[[L, 0], [L, H]]];
  if (gusset) creases.push([[0, H], [w, H]]);
  return {
    width: w,
    height: h,
    kindLabel: label,
    cut: [[0, 0], [w, 0], [w, h], [0, h]],
    creases,
    panels: [
      { id: "front", polygon: rect(0, 0, L, H), surfaceId: "front" },
      { id: "back", polygon: rect(L, 0, L, H), surfaceId: "back" },
      ...(gusset ? [{ id: "gusset", polygon: rect(0, H, w, gusset), surfaceId: "gusset" }] : []),
    ],
  };
}

/** Real dimensions of a gable-top carton, from structure/profile/cartonProfile.ts (the 3D's own numbers). */
export interface GableTopDims {
  /** Front width (roof panel width), mm. */
  L: number;
  /** Depth, mm (glue flap rule). */
  W: number;
  /** Developed body width = perimeter of the 3D body tube, mm. */
  perimeter: number;
  /** Printed body height (bottom seal to roof fold), mm. */
  bodyH: number;
  /** Roof panel length (body edge to ridge), mm. */
  roofSlant: number;
  /** Fin seal height above the ridge, mm. */
  finH: number;
}

/**
 * Gable-top carton (phase 2C-4A), developed from the 3D geometry:
 *
 *        fin  ┌──────┬──────────┬──────┬──────────┐
 *   top       │gable │ roof-    │gable │ roof-    │      (gable = folded side gusset,
 *   panels    │  /  │ front    │  /  │ back     │       diagonal creases to its apex)
 *   ──────────├──────┼──────────┼──────┼──────────┤┐
 *   body      │ left │  front   │right │  back    ││ glue
 *             └──────┴──────────┴──────┴──────────┘┘
 *
 * The body strip is the "body" surface (its developed width IS the 3D tube perimeter); front and
 * back spans are exactly the roof panel width L, so the vertical creases sit under the roof panel
 * edges; the sides take the rest. The glue seam is on the back/left corner (a seam through the
 * back would cut "roof-back" in two), so the body panel shows its surface shifted by half a back
 * (surfaceOffsetMm): the artwork is the same as on the 3D tube, which starts at the back centre.
 * The bottom closure is not modelled in 3D: the sheet stops at the bottom of the body.
 */
export function gableTopCarton(g: GableTopDims): FlatTemplate {
  const { L, perimeter: P, bodyH, roofSlant: S, finH } = g;
  const side = (P - 2 * L) / 2;
  const glue = glueFlapWidth(g.W);
  const yTop = finH; // fin / top-panel fold
  const yBody = finH + S; // body / top-panel fold (roof fold)
  const yBot = yBody + bodyH;
  const xs = [0, side, side + L, 2 * side + L, P]; // left | front | right | back
  // Gable apex: the visible triangle keeps its real edge length (body corner → ridge = roof slant).
  const apex = Math.sqrt(Math.max(0, S * S - (side / 2) * (side / 2)));
  const creases: [Pt, Pt][] = [
    [[0, yBody], [P, yBody]], // roof fold, all around
    [[0, yTop], [P, yTop]], // fin fold
    ...xs.slice(1, 4).map((x): [Pt, Pt] => [[x, 0], [x, yBot]]), // vertical corners, fin to bottom
    [[P, yBody], [P, yBot]], // glue flap fold
  ];
  for (const x0 of [xs[0], xs[2]]) {
    const cx = x0 + side / 2;
    const top: Pt = [cx, yBody - apex];
    creases.push([[x0, yBody], top], [[x0 + side, yBody], top], [top, [cx, yTop]]);
  }
  const cut: Pt[] = [[0, 0], [P, 0], [P, yBody], [P + glue, yBody + 4], [P + glue, yBot - 4], [P, yBot], [0, yBot]];
  return {
    width: P + glue,
    height: yBot,
    kindLabel: "Brique à pignon — corps, toit et crête (fond non inclus)",
    cut,
    creases,
    panels: [
      { id: "body", polygon: rect(0, yBody, P, bodyH), surfaceId: "body", surfaceOffsetMm: L / 2 },
      { id: "roof-front", polygon: rect(xs[1], yTop, L, S), surfaceId: "roof-front" },
      { id: "roof-back", polygon: rect(xs[3], yTop, L, S), surfaceId: "roof-back" },
      // Board without artwork of its own (plain background, like their 3D solid material).
      { id: "gable-left", polygon: rect(xs[0], yTop, side, S) },
      { id: "gable-right", polygon: rect(xs[2], yTop, side, S) },
      { id: "fin", polygon: rect(0, 0, P, finH) },
      { id: "glue", polygon: [[P, yBody], [P + glue, yBody + 4], [P + glue, yBot - 4], [P, yBot]], surfaceId: "glue" },
    ],
    glue: [[[P, yBody], [P + glue, yBody + 4], [P + glue, yBot - 4], [P, yBot]]],
    rootPanel: "body",
  };
}

/** One part of a rigid box (profile/boxProfile.ts boxParts): outer size and wall height, mm. */
export interface TrayPart {
  /** Surface id prefix ("base-" / "lid-"). */
  prefix: string;
  /** Panel the four walls fold up from ("bottom" for the base, "top" for the lid). */
  centre: "bottom" | "top";
  L: number;
  W: number;
  /** Wall height, mm. */
  h: number;
}

/**
 * Open tray developed flat (a cross): the centre panel and the four walls hinged on its edges.
 * The corner squares are cut away (corners closed by stay tape, no flap). `backUp`: the back wall
 * lies above the centre (the lid, seen from above) instead of the front (the base, seen from below).
 */
function trayCross(p: TrayPart, ox: number, oy: number, backUp: boolean) {
  const { L, W, h, prefix } = p;
  const x0 = ox + h, x1 = x0 + L, y0 = oy + h, y1 = y0 + W;
  const cut: Pt[] = [
    [x0, oy], [x1, oy], [x1, y0], [x1 + h, y0], [x1 + h, y1], [x1, y1],
    [x1, y1 + h], [x0, y1 + h], [x0, y1], [ox, y1], [ox, y0], [x0, y0],
  ];
  const creases: [Pt, Pt][] = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x0, y1], [x1, y1]], [[x0, y0], [x0, y1]]];
  const id = (s: string) => prefix + s;
  const panels: Panel[] = [
    { id: id(p.centre), polygon: rect(x0, y0, L, W), surfaceId: id(p.centre) },
    { id: id(backUp ? "back" : "front"), polygon: rect(x0, oy, L, h), surfaceId: id(backUp ? "back" : "front") },
    { id: id(backUp ? "front" : "back"), polygon: rect(x0, y1, L, h), surfaceId: id(backUp ? "front" : "back") },
    { id: id("left"), polygon: rect(ox, y0, h, W), surfaceId: id("left") },
    { id: id("right"), polygon: rect(x1, y0, h, W), surfaceId: id("right") },
  ];
  return { cut, creases, panels, width: 2 * h + L, height: 2 * h + W };
}

/**
 * Rigid set-up box (phase 2C-4B): base and lid are two separate parts in the 3D (boxParts "rigid"),
 * so the sheet carries two pieces, each developed as an open tray (outer skin, mm):
 *
 *        ┌front─┐               ┌─back─┐
 *   ┌────┼──────┼────┐     ┌────┼──────┼────┐
 *   │left│ fond │right│     │left│dessus│right│
 *   └────┼──────┼────┘     └────┼──────┼────┘
 *        └─back─┘               └front─┘
 *          base (vue de dessous)    couvercle (vue de dessus)
 *
 * The opening of each part (3D faces "base-top" / "lid-bottom", printable: false) is not board and
 * has no panel. `gap` separates the two pieces so that their bleeds do not overlap.
 */
export function rigidSetUpBox(base: TrayPart, lid: TrayPart, gap: number): FlatTemplate {
  const b = trayCross(base, 0, 0, false);
  const l = trayCross(lid, b.width + gap, 0, true);
  return {
    width: b.width + gap + l.width,
    height: Math.max(b.height, l.height),
    kindLabel: "Coffret rigide — fond et couvercle séparés (habillage extérieur, sans rempli)",
    cut: b.cut,
    extraCuts: [l.cut],
    creases: [...b.creases, ...l.creases],
    panels: [...b.panels, ...l.panels],
    rootPanel: base.prefix + base.centre,
  };
}

/**
 * Flat sheet of a folded assembly (phase 2C-4C): developed from the fold tree (develop.ts), nothing
 * drawn by hand. Panels = board parts (their print surface when printed); creases = the folds;
 * cut = outline of the panels; slits = knife cuts between touching flaps that are not folded together.
 * Every fold turns the board towards the inside of the pack: mountain folds seen from the printed side.
 */
export function foldedSheet(parts: AssemblyPart[], folds: AssemblyFold[], root: { id: string; map: PartMap }, kindLabel: string, endSeals: EndSeal[] = []): FlatTemplate {
  const dev = developAssembly(parts, folds, root.id, root.map);
  const x0 = Math.min(...dev.panels.map((p) => p.rect[0])), y0 = Math.min(...dev.panels.map((p) => p.rect[1]));
  const mv = ([x, y]: Pt): Pt => [x - x0, y - y0];
  const rects = dev.panels.map((p) => ({ id: p.part.id, rect: [p.rect[0] - x0, p.rect[1] - y0, p.rect[2] - x0, p.rect[3] - y0] as [number, number, number, number] }));
  const lines = dev.folds.map((f) => ({ a: f.fold.from, b: f.fold.to, line: [mv(f.line[0]), mv(f.line[1])] as [Pt, Pt], fold: f.fold }));
  const [cut, ...others] = rectUnionOutline(rects.map((r) => r.rect));
  const glueZones: GlueZone[] = glueContacts(dev.panels, (id) => parts.find((p) => p.id === id)).map((g) => {
    const [a, b, c, e] = g.rect;
    return { panel: g.part, onto: g.onto, side: g.side, polygon: rect(a - x0, b - y0, c - a, e - b) };
  });
  // Welds / seams: the joined faces (bonds) and the transverse end seals, as flat areas.
  const shift = ([a, b, c, e]: [number, number, number, number]): [number, number, number, number] => [a - x0, b - y0, c - x0, e - y0];
  const sealZones: SealZone[] = [
    ...bondContacts(dev.panels).map((c) => ({ id: `bond-${c.part}`, kind: c.kind, panels: [c.part], polygon: rect(c.rect[0] - x0, c.rect[1] - y0, c.rect[2] - c.rect[0], c.rect[3] - c.rect[1]) })),
    ...endSeals.flatMap((e) => rectUnionOutline(endSealBands(dev.panels, e).map(shift)).map((polygon, i) => ({
      id: i ? `${e.id}-${i + 1}` : e.id, kind: e.kind, panels: e.parts, polygon, ...(e.afterFilling ? { afterFilling: true } : {}),
    }))),
  ];
  const windows = surfaceWindows(parts);
  // Folds inside a panel (gusset centre folds…), in the sheet.
  const inner = innerFoldLines(dev.panels).map((f) => ({ ...f, line: [mv(f.line[0]), mv(f.line[1])] as [Pt, Pt] }));
  // Seam technical zones: beside a welded / sewn joint, between the end seals (the artwork's length).
  const bands = endSeals.flatMap((e) => endSealBands(dev.panels, e).map(shift));
  const technicalZones: TechnicalZone[] = seamStrips(dev.panels, dev.folds).map((z, i) => {
    const r0 = shift(z.rect);
    const a = r0[0], c = r0[2];
    let b = r0[1], e = r0[3];
    for (const [u0, v0, u1, v1] of bands) {
      if (u0 > a + 1e-9 || u1 < c - 1e-9) continue; // only a band across the whole strip trims it
      if (v0 <= b + 1e-9 && v1 > b) b = Math.min(e, v1);
      if (v1 >= e - 1e-9 && v0 < e) e = Math.max(b, v0);
    }
    const part = parts.find((p) => p.id === z.panel)!;
    return {
      id: `seam-${i + 1}`, kind: "seam" as const, panel: z.panel, ...(part.surface ? { surfaceId: part.surface.id } : {}),
      polygon: rect(a, b, c - a, e - b), note: "Zone technique — couture dorsale : éviter code-barres, QR code, textes et logos",
    };
  }).filter((z) => { const r = z.polygon; return r[2][0] - r[0][0] > 1e-9 && r[2][1] - r[0][1] > 1e-9; });
  const formed = [...lines.filter((l) => l.fold.kind === "formed").map((l) => l.line), ...inner.filter((f) => f.kind === "formed").map((f) => f.line)];
  return {
    width: Math.max(...rects.map((r) => r.rect[2])),
    height: Math.max(...rects.map((r) => r.rect[3])),
    kindLabel,
    cut,
    // A folded assembly is one sheet: other contours would mean a broken tree (refused by validate).
    ...(others.length ? { extraCuts: others } : {}),
    creases: [...lines.filter((l) => l.fold.kind !== "formed").map((l) => l.line), ...inner.filter((f) => f.kind !== "formed").map((f) => f.line)],
    ...(formed.length ? { formedFolds: formed } : {}),
    ...(inner.length ? { innerFolds: inner } : {}),
    ...(technicalZones.length ? { technicalZones } : {}),
    ...(sealZones.length ? { sealZones } : {}),
    slits: contactSlits(rects, lines),
    hinges: lines.map((l) => ({ id: l.fold.id, from: l.a, to: l.b, line: l.line, fold: "mountain" as const, foldedAngleDeg: l.fold.angleDeg, ...(l.fold.kind ? { kind: l.fold.kind } : {}) })),
    ...(glueZones.length ? { glueZones, glue: glueZones.map((z) => z.polygon) } : {}),
    panels: rects.map((r) => {
      const part = parts.find((p) => p.id === r.id)!;
      const [a, b, c, e] = r.rect;
      return {
        id: r.id, polygon: rect(a, b, c - a, e - b),
        ...(part.surface ? { surfaceId: part.surface.id } : {}),
        // one surface over several panels: each panel is a window on it
        ...(windows.has(r.id) ? { surfaceOffsetMm: windows.get(r.id)! } : {}),
      };
    }),
    rootPanel: root.id,
  };
}

/**
 * Developed conical wall (phase 2C-4F-1): one annular sector — outer arc = top of the wall, inner arc
 * = bottom, radial sides = the seam at the back, no overlap, no fold. `covered` (along the generatrix,
 * from the top) is the band hidden by the lid: a technical zone, not printed.
 */
export function conicalWrap(wall: FrustumWall, coveredSlant: number, kindLabel: string, surfaceId = "wrap"): FlatTemplate {
  const cut = sectorOutline(wall);
  return {
    width: wall.width,
    height: wall.height,
    kindLabel,
    cut,
    creases: [],
    panels: [{ id: surfaceId, polygon: cut, surfaceId }],
    ...(coveredSlant > 0 ? {
      technicalZones: [{
        id: "covered-by-lid", kind: "covered" as const, panel: surfaceId, surfaceId,
        polygon: sectorOutline(wall, wall.rOut - coveredSlant, wall.rOut), note: "Zone couverte par le couvercle — non imprimée",
      }],
    } : {}),
  };
}
