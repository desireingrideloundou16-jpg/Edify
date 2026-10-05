/**
 * Food tray ("barquette"), phase 2C-4D-1: REFERENCE construction, an open rectangular tray folded
 * from one sheet with glued corners — not a claim to cover every industrial tray.
 *
 * Bottom + four vertical walls folded up from its edges, open top. Each end of the front and back
 * walls carries a corner flap that folds 90° inwards and is glued flat against the inner face of
 * the side wall: that closes the four corners (no diagonal gusset, no flared wall, no lock).
 *
 * Pure data, millimetres, three.js axes like every box: x = L (right +), y = up (floor at 0),
 * z = W (front +). The catalog L × W × H is the OUTER size; the board (thickness t, from the
 * structure material) is inside it. Used by resolveStructure (print surfaces, assembly) and the 3D.
 *
 *   top view (open)
 *   ┌─────────────── back ───────────────┐
 *   │▌flap                          flap▐│
 *   │                                    │  side walls run the full depth W;
 *   left           bottom             right front / back walls fit between them
 *   │                                    │
 *   │▌flap                          flap▐│
 *   └─────────────── front ──────────────┘
 */
import { glueFlapWidth } from "../dieline";
import type { AssemblyFold, AssemblyPart, BoxFace, Vec3 } from "../types";
import type { PartMap } from "../develop";

/**
 * The flat sheet is developed from the bottom seen from below (printed side), front at the top:
 * the convention of the mailer and of the rigid box base (flat x = 3D x, flat y = −3D z).
 */
export const TRAY_ROOT: { id: string; map: PartMap } = { id: "bottom", map: { 0: { flat: 0, sign: 1, off: 0 }, 2: { flat: 1, sign: -1, off: 0 } } };

export interface TrayDims {
  /** Outer size (catalog), mm. */
  L: number;
  W: number;
  H: number;
  /** Board thickness, mm (structure material). */
  t: number;
  /** Inner space: between the walls, above the bottom, mm. */
  innerL: number;
  innerW: number;
  innerH: number;
  /** Length of a corner flap along the side wall, mm. */
  flap: number;
}

/**
 * Corner flap length — HYPOTHESIS: the project's glue flap rule (dieline.ts glueFlapWidth, the
 * folding carton's), applied to the wall height that the flap is glued along.
 */
export function trayDims(L: number, W: number, H: number, t: number): TrayDims {
  const innerH = H - t;
  return { L, W, H, t, innerL: L - 2 * t, innerW: W - 2 * t, innerH, flap: glueFlapWidth(innerH) };
}

const part = (id: string, label: string, min: Vec3, max: Vec3, extra: Partial<AssemblyPart> = {}): AssemblyPart =>
  ({ id, label, group: "base", min, max, ...extra });

/** Board parts and folds of the open tray. */
export function trayAssembly(L: number, W: number, H: number, t: number): { dims: TrayDims; parts: AssemblyPart[]; folds: AssemblyFold[] } {
  const d = trayDims(L, W, H, t);
  const a = L / 2, b = W / 2;
  const wall = (id: "front" | "back" | "left" | "right", label: string, min: Vec3, max: Vec3, face: BoxFace) =>
    part(id, label, min, max, { surface: { id, face } });
  const parts: AssemblyPart[] = [
    part("bottom", "Fond", [-a + t, 0, -b + t], [a - t, t, b - t], { surface: { id: "bottom", face: "-y" } }),
    wall("front", "Face avant", [-a + t, 0, b - t], [a - t, H, b], "+z"),
    wall("back", "Dos", [-a + t, 0, -b], [a - t, H, -b + t], "-z"),
    wall("left", "Côté gauche", [-a, 0, -b], [-a + t, H, b], "-x"),
    wall("right", "Côté droit", [a - t, 0, -b], [a, H, b], "+x"),
  ];
  const folds: AssemblyFold[] = [
    { id: "bottom-front", from: "bottom", to: "front", edge: [[-a + t, 0, b - t], [a - t, 0, b - t]], angleDeg: 90 },
    { id: "bottom-back", from: "bottom", to: "back", edge: [[-a + t, 0, -b + t], [a - t, 0, -b + t]], angleDeg: 90 },
    { id: "bottom-left", from: "bottom", to: "left", edge: [[-a + t, 0, -b + t], [-a + t, 0, b - t]], angleDeg: 90 },
    { id: "bottom-right", from: "bottom", to: "right", edge: [[a - t, 0, -b + t], [a - t, 0, b - t]], angleDeg: 90 },
  ];
  // Corner flaps: ends of the front / back walls, standing on the bottom, glued to the side walls.
  for (const [w, zEdge, dir, W2] of [["front", b - t, -1, "avant"], ["back", -b + t, 1, "arrière"]] as const) {
    for (const [s, n, N] of [[-1, "left", "gauche"], [1, "right", "droit"]] as const) {
      const xEdge = s * (a - t), xIn = s * (a - 2 * t);
      const z1 = zEdge + dir * d.flap;
      parts.push(part(`flap-${w}-${n}`, `Patte d'angle ${W2} ${N}`,
        [Math.min(xEdge, xIn), t, Math.min(zEdge, z1)], [Math.max(xEdge, xIn), H, Math.max(zEdge, z1)], { glueTo: n }));
      folds.push({ id: `${w}-flap-${n}`, from: w, to: `flap-${w}-${n}`, edge: [[xEdge, t, zEdge], [xEdge, H, zEdge]], angleDeg: 90 });
    }
  }
  return { dims: d, parts, folds };
}
