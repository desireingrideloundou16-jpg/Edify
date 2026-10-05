/**
 * Box-like parts and their printed faces (phase 2C-3): one definition used by the 3D builders
 * (three/packagingModels.ts builds each part with these sizes and draws each face as its surface)
 * and by resolveStructure() (print surfaces, die-line panels). Millimetres, front = +z, top = +y.
 */
import type { BoxFace, FaceKind, PrintSurface, ShapeModel } from "../types";

export interface BoxPartFace {
  id: string;
  face: BoxFace;
  kind: FaceKind;
  wMm: number;
  hMm: number;
  printable: boolean;
}

export interface BoxPart {
  part: "body" | "base" | "lid";
  /** Size along x (L), y (H), z (W), mm. */
  L: number;
  H: number;
  W: number;
  /** Corner radius, mm (0 = sharp box). */
  radius: number;
  /** Centre height above the floor, mm. */
  y: number;
  /** In three.js BoxGeometry material order: +x, -x, +y, -y, +z, -z. */
  faces: BoxPartFace[];
}

type Kinds = { front: FaceKind; top: FaceKind; side?: FaceKind; back?: FaceKind; bottom?: FaceKind };

function part(
  name: BoxPart["part"], L: number, H: number, W: number, radius: number, y: number,
  kinds: Kinds, prefix = "", hidden: BoxFace[] = []
): BoxPart {
  const f = (face: BoxFace, id: string, kind: FaceKind, wMm: number, hMm: number): BoxPartFace => ({
    id: prefix + id, face, kind, wMm, hMm, printable: !hidden.includes(face),
  });
  return {
    part: name, L, H, W, radius, y,
    faces: [
      f("+x", "right", kinds.side ?? "side", W, H),
      f("-x", "left", kinds.side ?? "side", W, H),
      f("+y", "top", kinds.top, L, W),
      f("-y", "bottom", kinds.bottom ?? "plain", L, W),
      f("+z", "front", kinds.front, L, H),
      f("-z", "back", kinds.back ?? "back", L, H),
    ],
  };
}

export const BOX_MODELS = ["box", "pillow", "display", "moulded", "pizza", "clamshell", "rigid", "jug", "paperbag", "shopper"] as const;
export type BoxModel = (typeof BOX_MODELS)[number];

/** The rigid box parts of a box-like model, with the kind of artwork on each face. */
export function boxParts(model: BoxModel, L: number, W: number, H: number): BoxPart[] {
  const small = Math.min(L, H, W);
  switch (model) {
    // Pizza box, burger clamshell: their construction is not defined yet; closed block (the former
    // mailer block). The postal mailer has its own folded construction (profile/mailerProfile.ts).
    case "pizza":
    case "clamshell":
      return [part("body", L, H, W, small * 0.02, H / 2, { front: "strip", top: "top", side: "plain" })];
    case "rigid": {
      // Base (open box, hidden top) and a slightly larger lid over its top 30 %.
      const baseH = H * 0.78, lidH = H * 0.3;
      return [
        part("base", L, baseH, W, 1, baseH / 2, { front: "plain", top: "plain", side: "plain", back: "plain" }, "base-", ["+y"]),
        part("lid", L * 1.015, lidH, W * 1.015, 1, H - H * 0.15, { front: "strip", top: "top", side: "plain", back: "plain" }, "lid-", ["-y"]),
      ];
    }
    case "jug":
      return [part("body", L, H * 0.88, W, Math.min(L, W) * 0.22, (H * 0.88) / 2, { front: "front", top: "plain" })];
    // Paper bag (flour): former bag block. The film bags have their own construction (bagProfile.ts).
    case "paperbag":
    case "shopper":
      // Paper bag: open at the top (no artwork there), printed bottom.
      return [part("body", L, H, W, 0, H / 2, { front: "front", top: "plain" }, "", ["+y"])];
    case "pillow":
      return [part("body", L, H, W, small * 0.45, H / 2, { front: "front", top: "strip" })];
    // Counter display, moulded pulp egg box: construction not defined; the former "tray" block (=
    // the folding carton block). The food tray has its own open construction (profile/trayProfile.ts).
    case "box":
    case "display":
    case "moulded":
    default:
      return [part("body", L, H, W, small * 0.02, H / 2, { front: "front", top: "strip" })];
  }
}

const LABELS: Record<string, string> = {
  front: "Face avant", back: "Dos", left: "Côté gauche", right: "Côté droit", top: "Dessus", bottom: "Fond",
};

/** Print surfaces of the faces of box parts (ids "front", "lid-top", "base-left"…). */
export function boxPartSurfaces(parts: BoxPart[], safe: (w: number, h: number) => number): PrintSurface[] {
  return parts.flatMap((p) => p.faces.map((f): PrintSurface => {
    const base = f.id.replace(/^(lid|base)-/, "");
    const prefix = f.id === base ? "" : f.id.startsWith("lid-") ? "Couvercle — " : "Fond de boîte — ";
    return {
      id: f.id,
      label: prefix + (LABELS[base] ?? base),
      wMm: f.wMm,
      hMm: f.hMm,
      printable: f.printable,
      draw: { kind: f.kind },
      placement: { part: p.part, face: f.face },
      safeMm: safe(f.wMm, f.hMm),
    };
  }));
}

export function isBoxModel(model: ShapeModel): model is BoxModel {
  return (BOX_MODELS as readonly string[]).includes(model);
}
