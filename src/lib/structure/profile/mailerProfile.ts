/**
 * Postal mailer, phase 2C-4C-0: roll end tuck front ("boîte postale à rabat d'insertion", FEFCO 0427
 * type). One sheet of board folded into a base tray with double front and side walls, a back wall,
 * and a lid hinged on the back wall whose tuck flap and side dust flaps go inside the walls.
 *
 * Pure data, millimetres, CLOSED state, three.js axes: x = L (right +), y = up (floor at 0),
 * z = W (front +). The catalog L × W × H stays the OUTER size: the board (thickness t) is inside it.
 * Every part is an axis-aligned slab of board; folds join two parts along a shared edge.
 * Used by resolveStructure (print surfaces, assembly) and by the 3D (three/packagingModels.ts).
 *
 *   top view (closed)                     front view
 *   ┌──┬──────────────┬──┐                ┌──┬──────────────┬──┐ ← rolled tops of the
 *   │  │     lid      │  │ side walls     │  │              │  │   double walls (y = H)
 *   │  │   (top)      │  │ (double, with  │  │    front     │  │
 *   │  ├──────────────┤  │  ears inside)  │  │  (double)    │  │
 *   └──┴──front roll──┴──┘                └──┴──────────────┴──┘
 */
import type { AssemblyFold, AssemblyPart, BoxFace, Vec3 } from "../types";
import type { PartMap } from "../develop";

/**
 * The flat sheet is developed from the bottom panel seen from below (its printed side), front at
 * the top — the convention of the rigid box base (2C-4B): flat x = 3D x, flat y = −3D z.
 */
export const MAILER_ROOT: { id: string; map: PartMap } = { id: "bottom", map: { 0: { flat: 0, sign: 1, off: 0 }, 2: { flat: 1, sign: -1, off: 0 } } };

/**
 * Edify construction rules — HYPOTHESES (not a board maker's specification, see
 * docs/phase2/structure.md), the only place where they are set:
 * - tuck: depth of the lid tuck flap, share of the inner height;
 * - dust: depth of the lid side dust flaps, share of the inner height;
 * - ear: length of the ears (front / back wall ends locked inside the side walls), share of the
 *   inner depth, so that the front and back ears of one side never meet.
 */
export const MAILER_RULES = { tuck: 0.5, dust: 0.5, ear: 0.45 } as const;

export interface MailerDims {
  /** Outer size (catalog), mm. */
  L: number;
  W: number;
  H: number;
  /** Board thickness, mm (structure material). */
  t: number;
  /** Inner space between the walls and under the lid, mm. */
  innerL: number;
  innerW: number;
  innerH: number;
  /** Tuck flap depth, lid dust flap depth, ear length, mm (MAILER_RULES). */
  tuck: number;
  dust: number;
  ear: number;
}

export function mailerDims(L: number, W: number, H: number, t: number): MailerDims {
  // Side walls: outer + ear + inner return (3 t); front: outer + inner return (2 t); back: single (t).
  const innerL = L - 6 * t, innerW = W - 3 * t, innerH = H - 2 * t;
  return {
    L, W, H, t, innerL, innerW, innerH,
    tuck: innerH * MAILER_RULES.tuck,
    dust: innerH * MAILER_RULES.dust,
    ear: (W - 2 * t) * MAILER_RULES.ear,
  };
}

const part = (id: string, label: string, group: AssemblyPart["group"], min: Vec3, max: Vec3, surface?: { id: string; face: BoxFace }): AssemblyPart =>
  ({ id, label, group, min, max, ...(surface ? { surface } : {}) });

/** Board parts and folds of the closed mailer. */
export function mailerAssembly(L: number, W: number, H: number, t: number): { dims: MailerDims; parts: AssemblyPart[]; folds: AssemblyFold[] } {
  const d = mailerDims(L, W, H, t);
  const a = L / 2, b = W / 2;
  const sides = (s: 1 | -1) => {
    const n = s > 0 ? "right" : "left";
    const N = s > 0 ? "droit" : "gauche";
    const x = (u: number, v: number): [number, number] => (s > 0 ? [u, v] : [-v, -u]); // mirror x ranges
    const [o0, o1] = x(a - t, a), [e0, e1] = x(a - 2 * t, a - t), [i0, i1] = x(a - 3 * t, a - 2 * t), [f0, f1] = x(a - 4 * t, a - 3 * t);
    return [
      part(n, `Côté ${N}`, "base", [o0, 0, -b], [o1, H, b], { id: n, face: s > 0 ? "+x" : "-x" }),
      part(`${n}-inner`, `Retour intérieur ${N}`, "base", [i0, t, -b + t], [i1, H, b - t]),
      part(`ear-front-${n}`, `Oreille avant ${N}`, "base", [e0, t, b - t - d.ear], [e1, H - t, b - t]),
      part(`ear-back-${n}`, `Oreille arrière ${N}`, "base", [e0, t, -b + t], [e1, H - t, -b + t + d.ear]),
      part(`dust-${n}`, `Rabat anti-poussière ${N}`, "lid", [f0, H - t - d.dust, -b + t], [f1, H - t, b - 3 * t]),
    ];
  };
  const parts: AssemblyPart[] = [
    part("bottom", "Fond", "base", [-a + t, 0, -b + t], [a - t, t, b - t], { id: "bottom", face: "-y" }),
    part("front", "Face avant", "base", [-a + t, 0, b - t], [a - t, H, b], { id: "front", face: "+z" }),
    part("front-inner", "Retour intérieur avant", "base", [-a + 3 * t, t, b - 2 * t], [a - 3 * t, H, b - t]),
    part("back", "Dos", "base", [-a + t, 0, -b], [a - t, H - t, -b + t], { id: "back", face: "-z" }),
    part("top", "Couvercle", "lid", [-a + 3 * t, H - t, -b], [a - 3 * t, H, b - 2 * t], { id: "top", face: "+y" }),
    part("tuck", "Rabat d'insertion", "lid", [-a + 3 * t, H - t - d.tuck, b - 3 * t], [a - 3 * t, H - t, b - 2 * t]),
    ...sides(-1),
    ...sides(1),
  ];
  const line = (p: Vec3, q: Vec3): [Vec3, Vec3] => [p, q];
  const folds: AssemblyFold[] = [
    // Walls up from the bottom.
    { id: "bottom-front", from: "bottom", to: "front", edge: line([-a + t, 0, b - t], [a - t, 0, b - t]), angleDeg: 90 },
    { id: "bottom-back", from: "bottom", to: "back", edge: line([-a + t, 0, -b + t], [a - t, 0, -b + t]), angleDeg: 90 },
    { id: "bottom-left", from: "bottom", to: "left", edge: line([-a + t, 0, -b + t], [-a + t, 0, b - t]), angleDeg: 90 },
    { id: "bottom-right", from: "bottom", to: "right", edge: line([a - t, 0, -b + t], [a - t, 0, b - t]), angleDeg: 90 },
    // Double walls rolled over their top edge (180°), inner returns locked on the bottom.
    { id: "front-roll", from: "front", to: "front-inner", edge: line([-a + 3 * t, H, b - t], [a - 3 * t, H, b - t]), angleDeg: 180 },
    { id: "left-roll", from: "left", to: "left-inner", edge: line([-a + 2 * t, H, -b + t], [-a + 2 * t, H, b - t]), angleDeg: 180 },
    { id: "right-roll", from: "right", to: "right-inner", edge: line([a - 2 * t, H, -b + t], [a - 2 * t, H, b - t]), angleDeg: 180 },
    // Ears: ends of the front and back walls, folded in between the side wall layers.
    { id: "front-ear-left", from: "front", to: "ear-front-left", edge: line([-a + t, t, b - t], [-a + t, H - t, b - t]), angleDeg: 90 },
    { id: "front-ear-right", from: "front", to: "ear-front-right", edge: line([a - t, t, b - t], [a - t, H - t, b - t]), angleDeg: 90 },
    { id: "back-ear-left", from: "back", to: "ear-back-left", edge: line([-a + t, t, -b + t], [-a + t, H - t, -b + t]), angleDeg: 90 },
    { id: "back-ear-right", from: "back", to: "ear-back-right", edge: line([a - t, t, -b + t], [a - t, H - t, -b + t]), angleDeg: 90 },
    // The lid: hinged on the top edge of the back wall (the only joint that opens).
    { id: "lid-hinge", from: "back", to: "top", edge: line([-a + 3 * t, H - t, -b], [a - 3 * t, H - t, -b]), angleDeg: 90, hinge: true },
    { id: "lid-tuck", from: "top", to: "tuck", edge: line([-a + 3 * t, H - t, b - 2 * t], [a - 3 * t, H - t, b - 2 * t]), angleDeg: 90 },
    { id: "lid-dust-left", from: "top", to: "dust-left", edge: line([-a + 3 * t, H - t, -b + t], [-a + 3 * t, H - t, b - 3 * t]), angleDeg: 90 },
    { id: "lid-dust-right", from: "top", to: "dust-right", edge: line([a - 3 * t, H - t, -b + t], [a - 3 * t, H - t, b - 3 * t]), angleDeg: 90 },
  ];
  return { dims: d, parts, folds };
}

/** Size of the outer face `face` of a part, as a print surface (width × height, upright), mm. */
export function partFaceSize(p: AssemblyPart, face: BoxFace): { wMm: number; hMm: number } {
  const [sx, sy, sz] = [p.max[0] - p.min[0], p.max[1] - p.min[1], p.max[2] - p.min[2]];
  if (face === "+z" || face === "-z") return { wMm: sx, hMm: sy };
  if (face === "+x" || face === "-x") return { wMm: sz, hMm: sy };
  return { wMm: sx, hMm: sz };
}
