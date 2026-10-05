/**
 * Flat development of a folded assembly (phase 2C-4C), pure, millimetres.
 *
 * The assembly (types.ts AssemblyPart / AssemblyFold) is a tree of board slabs joined by folds
 * along axis-parallel edges. Unfolding walks that tree from a root panel laid flat: each child
 * keeps the coordinate along the fold edge and extends away from the edge on the far side of its
 * parent, for its own length (ideal sharp folds, the same idealisation as the 3D). The sheet is seen
 * from the outside of the pack (the printed side), y down like every flat template.
 */
import type { AssemblyFold, AssemblyPart, BondKind, BoxFace, EndSeal, InnerFold, Pt, Vec3 } from "./types";

/** Where one 3D axis of a part goes in the flat sheet: flat axis (0 = x, 1 = y), sign, offset. */
export interface AxisMap {
  flat: 0 | 1;
  sign: 1 | -1;
  off: number;
}
export type PartMap = Partial<Record<0 | 1 | 2, AxisMap>>;

export interface DevelopedPanel {
  part: AssemblyPart;
  map: PartMap;
  /** Flat rectangle [x0, y0, x1, y1]. */
  rect: [number, number, number, number];
}
export interface DevelopedFold {
  fold: AssemblyFold;
  /** The fold edge in the flat sheet: the crease. */
  line: [Pt, Pt];
}

const EPS = 1e-6;
const AXES = [0, 1, 2] as const;
const extent = (p: AssemblyPart, i: number) => p.max[i] - p.min[i];
const thinAxis = (p: AssemblyPart) => AXES.reduce((m, i) => (extent(p, i) < extent(p, m) ? i : m), 0 as 0 | 1 | 2);
const inPlane = (p: AssemblyPart) => AXES.filter((i) => i !== thinAxis(p));
/** The axis a fold edge runs along (its two points differ on that axis only). */
export const edgeAxis = (f: AssemblyFold) => AXES.find((i) => Math.abs(f.edge[0][i] - f.edge[1][i]) > EPS)!;
const at = (m: AxisMap, v: number) => m.sign * v + m.off;

/** Unfold the assembly from `root`, laid with `rootMap`. Throws on a broken tree (structure bug). */
export function developAssembly(parts: AssemblyPart[], folds: AssemblyFold[], root: string, rootMap: PartMap): { panels: DevelopedPanel[]; folds: DevelopedFold[] } {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const maps = new Map<string, PartMap>([[root, rootMap]]);
  const lines: DevelopedFold[] = [];
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    for (const f of folds.filter((x) => x.from === id)) {
      if (maps.has(f.to)) throw new Error(`fold tree: "${f.to}" reached twice`);
      const P = byId.get(f.from)!, C = byId.get(f.to)!;
      const A = edgeAxis(f);
      const pa = inPlane(P).find((i) => i !== A)!, ca = inPlane(C).find((i) => i !== A)!;
      const pm = maps.get(id)!;
      if (!pm[A] || !pm[pa]) throw new Error(`fold "${f.id}": edge not in the plane of "${f.from}"`);
      // The edge sits on one side of the parent: the child continues beyond it.
      const ep = f.edge[0][pa];
      const s = Math.abs(ep - P.max[pa]) < Math.abs(ep - P.min[pa]) ? 1 : -1;
      const fe = at(pm[pa]!, ep);
      const d = (pm[pa]!.sign * s) as 1 | -1;
      // …and the child runs away from the edge along its own length.
      const ec = f.edge[0][ca];
      const sc = Math.abs(ec - C.min[ca]) < Math.abs(ec - C.max[ca]) ? 1 : -1;
      maps.set(f.to, { [A]: pm[A], [ca]: { flat: pm[pa]!.flat, sign: (d * sc) as 1 | -1, off: fe - d * sc * ec } });
      const pt = (q: Vec3): Pt => {
        const r: Pt = [0, 0];
        r[pm[A]!.flat] = at(pm[A]!, q[A]);
        r[pm[pa]!.flat] = fe;
        return r;
      };
      lines.push({ fold: f, line: [pt(f.edge[0]), pt(f.edge[1])] });
      queue.push(f.to);
    }
  }
  const panels = parts.map((part): DevelopedPanel => {
    const map = maps.get(part.id);
    if (!map) throw new Error(`fold tree: "${part.id}" is not connected to "${root}"`);
    const r: [number, number, number, number] = [0, 0, 0, 0];
    for (const i of inPlane(part)) {
      const m = map[i]!;
      const a = at(m, part.min[i]), b = at(m, part.max[i]);
      r[m.flat] = Math.min(a, b);
      r[m.flat + 2] = Math.max(a, b);
    }
    return { part, map, rect: r };
  });
  return { panels, folds: lines };
}

/** Direction of a 3D axis vector in the flat sheet. */
export function flatDir(map: PartMap, v: Vec3): Pt {
  const k = AXES.find((i) => v[i] !== 0)!;
  const m = map[k]!;
  const r: Pt = [0, 0];
  r[m.flat] = m.sign * Math.sign(v[k]);
  return r;
}

/**
 * Upright direction of the artwork on each box face (three.js BoxGeometry UVs: walls read upright,
 * the top face with its top towards the back, the bottom face with its top towards the front;
 * checked against the mesh UVs in tests/unit/structure/mailer-construction.test.ts).
 */
export const FACE_UP: Record<BoxFace, Vec3> = {
  "+x": [0, 1, 0], "-x": [0, 1, 0], "+z": [0, 1, 0], "-z": [0, 1, 0], "+y": [0, 0, -1], "-y": [0, 0, 1],
};

/** Clockwise flat rotation that turns an upright artwork towards `up` (y down). */
export function rotationTowards(up: Pt): 0 | 90 | 180 | 270 {
  if (up[1] < 0) return 0;
  if (up[0] > 0) return 90;
  if (up[1] > 0) return 180;
  return 270;
}

type Rect = [number, number, number, number];
const key = (v: number) => Math.round(v * 1e6);

/**
 * Outline(s) of the union of axis-aligned rectangles, as closed polygons without collinear points.
 * Rectangles that only touch along an edge are merged (see `contactSlits` for the knife cuts).
 */
export function rectUnionOutline(rects: Rect[]): Pt[][] {
  const uniq = (vs: number[]) => [...new Map(vs.map((v) => [key(v), v])).values()].sort((a, b) => a - b);
  const xs = uniq(rects.flatMap((r) => [r[0], r[2]])), ys = uniq(rects.flatMap((r) => [r[1], r[3]]));
  const covered = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return rects.some((r) => cx > r[0] && cx < r[2] && cy > r[1] && cy < r[3]);
  };
  // Directed boundary edges, covered side on the right (clockwise on screen).
  const edges = new Map<string, [number, number][]>();
  const add = (a: [number, number], b: [number, number]) => {
    const k = a.join();
    edges.set(k, [...(edges.get(k) ?? []), b]);
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    if (!covered(i, j)) continue;
    if (!covered(i, j - 1)) add([i, j], [i + 1, j]);
    if (!covered(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
    if (!covered(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
    if (!covered(i - 1, j)) add([i, j + 1], [i, j]);
  }
  const loops: Pt[][] = [];
  while (edges.size) {
    const startKey = edges.keys().next().value!;
    const start = startKey.split(",").map(Number) as [number, number];
    const loop: [number, number][] = [start];
    let cur = start;
    for (;;) {
      const k = cur.join();
      const next = edges.get(k)!;
      const nb = next.shift()!;
      if (!next.length) edges.delete(k);
      if (nb[0] === start[0] && nb[1] === start[1]) break;
      loop.push(nb);
      cur = nb;
    }
    // drop collinear vertices
    const pts = loop.filter((p, n) => {
      const a = loop[(n + loop.length - 1) % loop.length], c = loop[(n + 1) % loop.length];
      return !((a[0] === p[0] && p[0] === c[0]) || (a[1] === p[1] && p[1] === c[1]));
    });
    loops.push(pts.map(([i, j]) => [xs[i], ys[j]]));
  }
  return loops;
}

/**
 * Knife cuts inside the outline: edges shared by two touching rectangles that are not (or not
 * entirely) a fold between them, so the two flaps come apart when folded.
 */
export function contactSlits(rects: { id: string; rect: Rect }[], creases: { a: string; b: string; line: [Pt, Pt] }[]): [Pt, Pt][] {
  const slits: [Pt, Pt][] = [];
  const near = (u: number, v: number) => Math.abs(u - v) < EPS;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const A = rects[i], B = rects[j];
    for (const ax of [0, 1] as const) {
      const o = 1 - ax; // the contact line is at constant coordinate `ax`
      const c = near(A.rect[ax + 2], B.rect[ax]) ? A.rect[ax + 2] : near(B.rect[ax + 2], A.rect[ax]) ? B.rect[ax + 2] : null;
      if (c === null) continue;
      const lo = Math.max(A.rect[o], B.rect[o]), hi = Math.min(A.rect[o + 2], B.rect[o + 2]);
      if (hi - lo < EPS) continue;
      // Remove the part of the contact that is a fold between these two panels.
      let pieces: [number, number][] = [[lo, hi]];
      for (const cr of creases) {
        if (!((cr.a === A.id && cr.b === B.id) || (cr.a === B.id && cr.b === A.id))) continue;
        if (!near(cr.line[0][ax], c) || !near(cr.line[1][ax], c)) continue;
        const f0 = Math.min(cr.line[0][o], cr.line[1][o]), f1 = Math.max(cr.line[0][o], cr.line[1][o]);
        pieces = pieces.flatMap(([u, v]) => [[u, Math.min(v, f0)], [Math.max(u, f1), v]] as [number, number][]).filter(([u, v]) => v - u > EPS);
      }
      for (const [u, v] of pieces) {
        const p: Pt = [0, 0], q: Pt = [0, 0];
        p[ax] = c; q[ax] = c; p[o] = u; q[o] = v;
        slits.push([p, q]);
      }
    }
  }
  return slits;
}

/**
 * Normal (3D, unit axis vector) of the side of the board that faces the viewer of the flat sheet,
 * i.e. the printed / outer side. The sheet is seen from the printed side, y down: the viewer looks
 * along −(eX × eY), eX / eY being the 3D directions of the flat x / y axes on this panel. A mirrored
 * development would flip it, so it doubles as a "no mirror" check against the known outer faces.
 */
export function outerNormal(map: PartMap): Vec3 {
  const e = (flat: 0 | 1): Vec3 => {
    const v: Vec3 = [0, 0, 0];
    for (const i of AXES) if (map[i]?.flat === flat) v[i] = map[i]!.sign;
    return v;
  };
  const [x, y] = [e(0), e(1)];
  const c: Vec3 = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return c.map((v) => (v === 0 ? 0 : -v)) as Vec3;
}

/** Glue area of a part glued face to face on another (AssemblyPart.glueTo), in the flat sheet. */
export interface GlueContact {
  part: string;
  onto: string;
  /** Contact rectangle on the glued part, flat coordinates [x0, y0, x1, y1]. */
  rect: [number, number, number, number];
  /** Side of the sheet that carries the glue: "outer" = the printed side seen in the flat sheet. */
  side: "outer" | "inner";
}

/**
 * Where each glued part touches its target: the overlap of the two faces in contact, mapped into the
 * glued part's flat panel (not the whole flap unless the whole flap touches).
 */
export function glueContacts(panels: DevelopedPanel[], byId: (id: string) => AssemblyPart | undefined): GlueContact[] {
  const out: GlueContact[] = [];
  for (const dp of panels) {
    const p = dp.part, q = p.glueTo ? byId(p.glueTo) : undefined;
    if (!p.glueTo || !q) continue;
    const c = contact(dp, q);
    if (c) out.push({ part: p.id, onto: q.id, ...c });
  }
  return out;
}

/** Face-to-face contact of a developed part with another part: rectangle on the part, sheet side. */
function contact(dp: DevelopedPanel, q: AssemblyPart): { rect: [number, number, number, number]; side: "outer" | "inner" } | null {
  const p = dp.part;
  const n = AXES.find((i) => Math.abs(p.max[i] - q.min[i]) < EPS || Math.abs(q.max[i] - p.min[i]) < EPS);
  if (n === undefined) return null;
  const toward = Math.abs(p.max[n] - q.min[n]) < EPS ? 1 : -1; // from the part towards its target
  const r: [number, number, number, number] = [0, 0, 0, 0];
  for (const i of AXES.filter((k) => k !== n)) {
    const lo = Math.max(p.min[i], q.min[i]), hi = Math.min(p.max[i], q.max[i]);
    const m = dp.map[i]!;
    const a = at(m, lo), b = at(m, hi);
    r[m.flat] = Math.min(a, b);
    r[m.flat + 2] = Math.max(a, b);
  }
  return { rect: r, side: outerNormal(dp.map)[n] === toward ? "outer" : "inner" };
}

/** Weld / seam joint (AssemblyPart.bond): the joined area on BOTH parts (each is heat / stitched). */
export interface BondContact extends GlueContact {
  kind: BondKind;
}
export function bondContacts(panels: DevelopedPanel[]): BondContact[] {
  const out: BondContact[] = [];
  for (const dp of panels) {
    const bond = dp.part.bond;
    const other = bond && panels.find((x) => x.part.id === bond.to);
    if (!bond || !other) continue;
    for (const [a, b] of [[dp, other.part], [other, dp.part]] as const) {
      const c = contact(a, b);
      if (c) out.push({ part: a.part.id, onto: b.id, kind: bond.kind, ...c });
    }
  }
  return out;
}

/**
 * Band of an end seal (EndSeal, transverse across a tube along `axis`, y by default) on each sealed
 * part, flat rectangles: the bottom or top `widthMm` of the part along that axis, its full width.
 */
export function endSealBands(panels: DevelopedPanel[], seal: EndSeal, axis: 0 | 1 | 2 = 1): [number, number, number, number][] {
  return panels.filter((dp) => seal.parts.includes(dp.part.id)).map((dp) => {
    const p = dp.part;
    const r: [number, number, number, number] = [0, 0, 0, 0];
    for (const i of inPlane(p)) {
      const m = dp.map[i]!;
      const lo = i !== axis ? p.min[i] : seal.edge === "bottom" ? p.min[i] : p.max[i] - seal.widthMm;
      const hi = i !== axis ? p.max[i] : seal.edge === "bottom" ? p.min[i] + seal.widthMm : p.max[i];
      const a = at(m, lo), b = at(m, hi);
      r[m.flat] = Math.min(a, b);
      r[m.flat + 2] = Math.max(a, b);
    }
    return r;
  });
}

/** Direction of the artwork's "right" on each box face, seen from outside (BoxGeometry UVs, like FACE_UP). */
export const FACE_RIGHT: Record<BoxFace, Vec3> = {
  "+z": [1, 0, 0], "-z": [-1, 0, 0], "+x": [0, 0, -1], "-x": [0, 0, 1], "+y": [1, 0, 0], "-y": [1, 0, 0],
};

/**
 * A print surface carried by several parts (the back of a film tube, split by its fin seal): where
 * each part's window starts in the surface, mm along the artwork's "right" direction.
 */
export function surfaceWindows(parts: AssemblyPart[]): Map<string, number> {
  const out = new Map<string, number>();
  const bySurface = new Map<string, AssemblyPart[]>();
  for (const p of parts) if (p.surface) bySurface.set(p.surface.id, [...(bySurface.get(p.surface.id) ?? []), p]);
  for (const group of bySurface.values()) {
    if (group.length < 2) continue;
    const r = FACE_RIGHT[group[0].surface!.face];
    const k = AXES.find((i) => r[i] !== 0)!;
    const lo = (p: AssemblyPart) => (r[k] > 0 ? p.min[k] : -p.max[k]);
    const u0 = Math.min(...group.map(lo));
    for (const p of group) out.set(p.id, lo(p) - u0);
  }
  return out;
}

/** Folds inside a part (AssemblyPart.innerFolds), mapped into its flat panel. */
export function innerFoldLines(panels: DevelopedPanel[]): { id: string; panel: string; kind: InnerFold["kind"]; line: [Pt, Pt] }[] {
  return panels.flatMap((dp) => (dp.part.innerFolds ?? []).map((f) => {
    const pt = (q: Vec3): Pt => {
      const r: Pt = [0, 0];
      for (const i of inPlane(dp.part)) r[dp.map[i]!.flat] = at(dp.map[i]!, q[i]);
      return r;
    };
    return { id: f.id, panel: dp.part.id, kind: f.kind, line: [pt(f.edge[0]), pt(f.edge[1])] as [Pt, Pt] };
  }));
}

/**
 * Where a welded / sewn joint lies on the printed panels beside it: each joined flap (a fin) is
 * attached to its parent panel by a fold; laid flat over that panel it covers the mirror image of the
 * flap across the fold line. Both mirrors (the flaps may be laid either way) border the seam. Flat
 * rectangles [x0, y0, x1, y1] on the parent panels; axis-aligned fold lines.
 */
export function seamStrips(panels: DevelopedPanel[], folds: DevelopedFold[]): { bond: string; panel: string; rect: [number, number, number, number] }[] {
  const out: { bond: string; panel: string; rect: [number, number, number, number] }[] = [];
  for (const dp of panels) {
    const bond = dp.part.bond;
    if (!bond || bond.kind === "glue") continue;
    for (const flapId of [dp.part.id, bond.to]) {
      const flap = panels.find((x) => x.part.id === flapId);
      const fold = folds.find((f) => f.fold.to === flapId);
      const parent = fold && panels.find((x) => x.part.id === fold.fold.from);
      if (!flap || !fold || !parent) continue;
      const [a, b] = fold.line;
      const ax = Math.abs(a[0] - b[0]) < EPS ? 0 : 1; // the fold line is at constant flat coordinate `ax`
      const c = a[ax];
      const r: [number, number, number, number] = [...flap.rect];
      r[ax] = 2 * c - flap.rect[ax + 2];
      r[ax + 2] = 2 * c - flap.rect[ax];
      // keep it on the parent panel
      for (const k of [0, 1] as const) {
        r[k] = Math.max(r[k], parent.rect[k]);
        r[k + 2] = Math.min(r[k + 2], parent.rect[k + 2]);
      }
      if (r[2] - r[0] > EPS && r[3] - r[1] > EPS) out.push({ bond: `${dp.part.id}~${bond.to}`, panel: parent.part.id, rect: r });
    }
  }
  return out;
}
