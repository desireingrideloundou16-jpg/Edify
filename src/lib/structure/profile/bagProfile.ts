/**
 * Film bag with side gussets, phase 2C-4E-1: REFERENCE construction shared by the film bags of the
 * catalog (rice, gari, pet food, coffee). One printed web (laize) formed into a tube:
 *
 *   laize:  | fin | ½ back | gusset L | front | gusset R | ½ back | fin |
 *
 * the two edges are turned outwards and welded by their INNER faces (longitudinal FIN seal: only the
 * inner layer of a laminate is sealable), the fin then lies folded flat on the outside of the back, the gussets are folded in, the bottom is a FLAT transverse weld
 * across the whole tube; the top is open, its band is welded after filling. No quad seal, block
 * bottom, valve, zip, tin-tie or handle.
 *
 * Millimetres, three.js axes like every pack: x = L (front width), y = up, z = W (gusset depth,
 * front +z). The catalog L × W × H is the OUTER envelope of the filled bag (like every family).
 *
 * Two views of the same film, from the same numbers:
 * - `bagAssembly`: the FORMED TUBE (manufacturing state): flat panels folded at 90°, fins welded —
 *   axis-aligned slabs (types.ts AssemblyPart), the input of the future flat web (2C-4E-2).
 * - `bagShape`: the FILLED bag shown in 3D: each panel is the same rectangle of film, folded along
 *   straight lines without stretching (every 3D triangle has its flat lengths).
 */
import { pouchSeals } from "./flexibleProfile";
import type { AssemblyFold, AssemblyPart, EndSeal, Pt, Vec3 } from "../types";
import type { PartMap } from "../develop";

/**
 * The flat web is developed from the front seen from outside, upright (flat x = 3D x, flat y = −3D y):
 * the panels follow each other along the web like on the reel.
 */
export const BAG_ROOT: { id: string; map: PartMap } = { id: "front", map: { 0: { flat: 0, sign: 1, off: 0 }, 1: { flat: 1, sign: -1, off: 0 } } };

export interface BagDims {
  /** Catalog envelope, mm. */
  L: number;
  W: number;
  H: number;
  /** Film thickness, mm (structure material). */
  t: number;
  /** Flat width of a gusset (between the front and back layers), mm. */
  gusset: number;
  /** Bottom weld, top weld (made after filling) and longitudinal fin widths, mm. */
  sealBottom: number;
  sealTop: number;
  fin: number;
  /**
   * Bottom of the filled bag: under the walls, front and back slope down to the bottom weld over
   * `rise` (= gusset / 2: the gusset corners fold at 45°); `slope` is that strip's flat length.
   */
  rise: number;
  slope: number;
  /** Flat length of every panel (laize repeat), mm: longer than H by slope − rise. */
  flatH: number;
}

/**
 * Seal widths: the project's flat pouch rule (flexibleProfile.ts pouchSeals: top and bottom welds
 * of a sealed film pack of height H). HYPOTHESIS: the fin seal is as wide as the bottom weld.
 */
export function bagDims(L: number, W: number, H: number, t: number): BagDims {
  const seals = pouchSeals("flatpouch", H);
  const gusset = W - 2 * t;
  const rise = gusset / 2;
  const slope = rise * Math.SQRT2;
  return { L, W, H, t, gusset, sealBottom: seals.bottom, sealTop: seals.top, fin: seals.bottom, rise, slope, flatH: H - rise + slope };
}

/** The formed tube: 7 film parts, 6 folds, fins welded together, two transverse welds. */
export function bagAssembly(L: number, W: number, H: number, t: number): { dims: BagDims; parts: AssemblyPart[]; folds: AssemblyFold[]; endSeals: EndSeal[] } {
  const d = bagDims(L, W, H, t);
  const a = L / 2, b = W / 2, h = d.flatH;
  const part = (id: string, label: string, min: Vec3, max: Vec3, extra: Partial<AssemblyPart> = {}): AssemblyPart => ({ id, label, group: "base", min, max, ...extra });
  const parts: AssemblyPart[] = [
    part("front", "Face avant", [-a, 0, b - t], [a, h, b], { surface: { id: "front", face: "+z" } }),
    // Each gusset folds in along its centre line (formed by the machine) over the printable length.
    part("gusset-left", "Soufflet gauche", [-a, 0, -b + t], [-a + t, h, b - t], {
      surface: { id: "gusset-left", face: "-x" },
      innerFolds: [{ id: "gusset-left-centre", edge: [[-a, d.sealBottom, 0], [-a, h - d.sealTop, 0]], kind: "formed" }],
    }),
    part("gusset-right", "Soufflet droit", [a - t, 0, -b + t], [a, h, b - t], {
      surface: { id: "gusset-right", face: "+x" },
      innerFolds: [{ id: "gusset-right-centre", edge: [[a, d.sealBottom, 0], [a, h - d.sealTop, 0]], kind: "formed" }],
    }),
    // The back is one printed surface on two half panels, joined by the fin seal at its centre.
    part("back-left", "Dos (moitié gauche)", [-a, 0, -b], [0, h, -b + t], { surface: { id: "back", face: "-z" } }),
    part("back-right", "Dos (moitié droite)", [0, 0, -b], [a, h, -b + t], { surface: { id: "back", face: "-z" } }),
    // Fins stand outwards from the back, welded inner face to inner face.
    part("fin-left", "Aileron de soudure gauche", [-t, 0, -b - d.fin], [0, h, -b], { bond: { to: "fin-right", kind: "weld" } }),
    part("fin-right", "Aileron de soudure droit", [0, 0, -b - d.fin], [t, h, -b]),
  ];
  const v = (x: number, z: number): [Vec3, Vec3] => [[x, 0, z], [x, h, z]];
  const folds: AssemblyFold[] = [
    // Film: every fold is made by the forming machine, none is scored.
    { id: "front-gusset-left", from: "front", to: "gusset-left", edge: v(-a, b - t), angleDeg: 90, kind: "formed" },
    { id: "front-gusset-right", from: "front", to: "gusset-right", edge: v(a, b - t), angleDeg: 90, kind: "formed" },
    { id: "gusset-left-back", from: "gusset-left", to: "back-left", edge: v(-a, -b + t), angleDeg: 90, kind: "formed" },
    { id: "gusset-right-back", from: "gusset-right", to: "back-right", edge: v(a, -b + t), angleDeg: 90, kind: "formed" },
    { id: "back-left-fin", from: "back-left", to: "fin-left", edge: v(0, -b), angleDeg: 90, kind: "formed" },
    { id: "back-right-fin", from: "back-right", to: "fin-right", edge: v(0, -b), angleDeg: 90, kind: "formed" },
  ];
  const all = parts.map((p) => p.id);
  const endSeals: EndSeal[] = [
    { id: "seal-bottom", kind: "weld", edge: "bottom", widthMm: d.sealBottom, parts: all },
    { id: "seal-top", kind: "weld", edge: "top", widthMm: d.sealTop, parts: all, afterFilling: true },
  ];
  return { dims: d, parts, folds, endSeals };
}

/** A film triangle: flat coordinates in its panel (mm, y up) and its 3D position in the filled bag. */
export interface FilmTriangle {
  flat: [Pt, Pt, Pt];
  pos: [Vec3, Vec3, Vec3];
}
export interface FilmPanel {
  /** Print surface shown by the panel (absent for the fins, plain film inside the bag). */
  surfaceId?: string;
  /** Flat size, mm. */
  wMm: number;
  hMm: number;
  /** Plain film (no print surface, one layer): the welded fins. */
  plain?: boolean;
  /** Offset along the panel's inward normal, in film layers (negative = outwards: the fins on the back). */
  layer?: number;
  tris: FilmTriangle[];
}

/**
 * The filled bag: front, back and gussets as planar pieces of their flat rectangle (u across seen
 * from outside, v up from the bottom edge of the film). Front / back: bottom weld (vertical, pressed
 * at the centre plane), 45° bottom strip, wall. Gussets: wall, then two corner triangles per half
 * (one folds flat behind the front / back strip, one closes the bottom corner), then the gusset
 * folded in half inside the bottom weld; the fins lie on the back. Open at the top (y = H).
 */
export function bagShape(L: number, W: number, H: number, t: number): { dims: BagDims; panels: FilmPanel[] } {
  const d = bagDims(L, W, H, t);
  const a = L / 2, b = W / 2, s = d.sealBottom, v1 = s + d.slope, y1 = s + d.rise, g = d.gusset;
  const wall = (v: number) => y1 + v - v1;
  /** Front-like panel (front: side = 1, back: side = −1), u → x seen from outside. */
  const sheet = (side: 1 | -1) => (u: number, v: number): Vec3 => {
    const x = side * (u - a);
    if (v <= s) return [x, v, side * t];
    if (v <= v1) {
      const k = (v - s) / d.slope;
      return [x, s + k * d.rise, side * (t + k * (b - t))];
    }
    return [x, wall(v), side * b];
  };
  const rects = (f: (u: number, v: number) => Vec3, w: number, bands: number[]): FilmTriangle[] =>
    bands.slice(1).flatMap((v, i) => {
      const v0 = bands[i];
      const q: Pt[] = [[0, v0], [w, v0], [w, v], [0, v]];
      return [[q[0], q[1], q[2]], [q[0], q[2], q[3]]].map((tri) => ({ flat: tri as [Pt, Pt, Pt], pos: tri.map(([u, vv]) => f(u, vv)) as [Vec3, Vec3, Vec3] }));
    });
  const bands = [0, s, v1, d.flatH];
  /** Right gusset seen from +x: u = 0 at the front edge (z = +g/2), u = g at the back edge. */
  const gussetRight = (): FilmTriangle[] => {
    const tri = (flat: [Pt, Pt, Pt], pos: [Vec3, Vec3, Vec3]): FilmTriangle => ({ flat, pos });
    const out: FilmTriangle[] = [];
    // wall
    for (const tr of rects((u, v) => [a, wall(v), g / 2 - u], g, [v1, d.flatH])) out.push(tr);
    for (const half of [1, -1] as const) {
      const e = half === 1 ? 0 : g; // outer edge of this half (front / back)
      const z = half * (g / 2);
      const A: Pt = [g / 2, s], B: Pt = [e, s], D: Pt = [e, v1], C: Pt = [g / 2, v1];
      const pA: Vec3 = [a - g / 2, s, 0], pB: Vec3 = [a, s, 0], pD: Vec3 = [a, y1, z], pC: Vec3 = [a, y1, 0];
      out.push(tri([A, B, D], [pA, pB, pD])); // folded flat behind the front / back strip
      out.push(tri([A, D, C], [pA, pD, pC])); // closes the bottom corner
      // inside the bottom weld: the half lies folded towards the centre, edge at x = a
      const u0 = Math.min(e, g / 2), u1 = Math.max(e, g / 2);
      const fx = (u: number) => a - Math.abs(u - e);
      for (const [p, q, r] of [[[u0, 0], [u1, 0], [u1, s]], [[u0, 0], [u1, s], [u0, s]]] as [Pt, Pt, Pt][]) {
        out.push(tri([p, q, r], [p, q, r].map(([u, v]) => [fx(u), v, 0]) as [Vec3, Vec3, Vec3]));
      }
    }
    return out;
  };
  const mirrorLeft = (tris: FilmTriangle[]): FilmTriangle[] =>
    // Left gusset seen from −x: u runs from the back edge to the front edge (u_left = g − u_right).
    tris.map(({ flat, pos }) => ({
      flat: flat.map(([u, v]) => [g - u, v]) as [Pt, Pt, Pt],
      pos: pos.map(([x, y, z]) => [-x, y, z]) as [Vec3, Vec3, Vec3],
    }));
  const back = sheet(-1);
  // Fins: welded together, folded flat on the outside of the back beside its centre (two layers).
  const fin = (u0: number, layer: number): FilmPanel => ({
    wMm: d.fin, hMm: d.flatH, plain: true, layer,
    tris: rects((u, v) => back(a - d.fin + u0 + u, v), d.fin, bands).map((tr) => ({ ...tr })),
  });
  const right = gussetRight();
  return {
    dims: d,
    panels: [
      { surfaceId: "front", wMm: L, hMm: d.flatH, tris: rects(sheet(1), L, bands) },
      { surfaceId: "back", wMm: L, hMm: d.flatH, tris: rects(back, L, bands) },
      { surfaceId: "gusset-right", wMm: g, hMm: d.flatH, tris: right },
      { surfaceId: "gusset-left", wMm: g, hMm: d.flatH, tris: mirrorLeft(right) },
      fin(0, -1),
      fin(0, -2),
    ],
  };
}
