/**
 * Flat (die-line) layouts in millimetres, y pointing down, origin at the
 * top-left of the cut contour. Used by the 2D preview and the print PDF.
 */
import type { ShapeModel } from "@/components/workspace/Modals";
import type { FaceKind } from "@/lib/artwork/draw";

export interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FaceKind | "wrap";
  /** Rotate artwork by 180° (lids that fold over). */
  flip?: boolean;
  /** For wraps: share of the width used by the front artwork. */
  frontFraction?: number;
  label?: string;
}

export type Pt = [number, number];

export interface FlatLayout {
  width: number;
  height: number;
  panels: Panel[];
  /** Closed cut contour. */
  cut: Pt[];
  /** Fold lines as [from, to] segments. */
  creases: [Pt, Pt][];
  kindLabel: string;
}

export const BLEED_MM = 3;

interface Dims {
  model: ShapeModel;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

/** Reverse tuck end carton: [glue][back][side][front][side]. */
function tuckEndBox(L: number, W: number, H: number): FlatLayout {
  const glue = Math.max(8, Math.min(15, W * 0.35));
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
    panels: [
      { x: g, y: yTop, w: L, h: H, kind: "back", label: "Dos" },
      { x: xa, y: yTop, w: W, h: H, kind: "side", label: "Côté" },
      { x: xb, y: yTop, w: L, h: H, kind: "front", label: "Face avant" },
      { x: xc, y: yTop, w: W, h: H, kind: "side", label: "Côté" },
      { x: g, y: yTop - T, w: L, h: T, kind: "top", flip: true, label: "Dessus" },
    ],
  };
}

function wrapLabel(circumference: number, labelH: number, frontFraction: number, label: string): FlatLayout {
  const overlap = 6;
  const w = circumference + overlap;
  return {
    width: w,
    height: labelH,
    kindLabel: label,
    cut: [[0, 0], [w, 0], [w, labelH], [0, labelH]],
    creases: [[[circumference, 0], [circumference, labelH]]],
    panels: [{ x: 0, y: 0, w: circumference, h: labelH, kind: "wrap", frontFraction, label: "Étiquette" }],
  };
}

function frontBack(L: number, H: number, gusset: number, label: string): FlatLayout {
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
      { x: 0, y: 0, w: L, h: H, kind: "front", label: "Face avant" },
      { x: L, y: 0, w: L, h: H, kind: "back", label: "Dos" },
      ...(gusset ? [{ x: 0, y: H, w, h: gusset, kind: "plain" as const, label: "Soufflet" }] : []),
    ],
  };
}

export function flatLayout({ model, lengthMm: L, widthMm: W, heightMm: H }: Dims): FlatLayout {
  const R = Math.min(L, W) / 2;
  const circ = Math.PI * 2 * R;
  switch (model) {
    case "box": case "mailer": case "rigid": case "pillow": case "tray": case "carton": case "jug": case "bag": case "shopper":
      return tuckEndBox(L, W, H);
    case "pouch":
      return frontBack(L, H, W, "Doypack — face, dos et soufflet");
    case "flatpouch": case "sachet":
      return frontBack(L, H, 0, "Sachet — face et dos");
    case "can": case "tin": case "papertube": case "tub": case "cup":
      return wrapLabel(circ, H * (model === "can" ? 0.84 : model === "papertube" ? 0.76 : 0.8), 0.3, "Étiquette enveloppante 360°");
    case "tube":
      return wrapLabel(circ, H * 0.88, 0.32, "Impression tube (à plat)");
    case "jar":
      return wrapLabel(R * Math.PI * 1.4, H * 0.8 * 0.62, 0.7, "Étiquette de pot");
    default: {
      // Bottles: label wraps 1.1π–1.3π of the body.
      const theta = model === "wine" ? Math.PI * 1.1 : Math.PI * 1.3;
      const shoulder = model === "wine" ? H * 0.58 : model === "dropper" ? H * 0.62 : H * 0.7;
      return wrapLabel(R * theta, shoulder * (model === "dropper" ? 0.72 : 0.62), 0.5, "Étiquette de flacon");
    }
  }
}
