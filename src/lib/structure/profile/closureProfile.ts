/**
 * Pure closure data (moved from three/geometry/closureLibrary.ts in phase 2C-2): closure types,
 * the per-family preset, and the closure's height above the neck computed analytically from the
 * SAME profile formulas as the 3D builders. The bottle stops where its closure starts, so this
 * height decides the glass height and therefore the real printable label of every bottle.
 * Millimetres, y = 0 at the top of the neck. No three.js.
 */

export type ClosureType = "screwCap" | "ribbedCap" | "tamperRing" | "wineCapsule" | "pump" | "spray" | "dropper" | "canLid";

/** Material slot of a part; the renderer maps each slot to one of its existing materials. */
export type ClosureMaterialSlot = "primary" | "secondary" | "metal" | "rubber" | "glass";

export interface ClosureConfig {
  type: ClosureType;
  /** Outer diameter (X) of the main body of the closure, mm. */
  width: number;
  /** Outer depth (Z), mm (default: round, = width). */
  depth?: number;
  /** Total height, skirt included, mm. */
  height: number;
  /** Neck outer diameter the closure sits on, mm (default: 0.8 × width). */
  neckWidth?: number;
  /** How far the closure goes down over the neck finish, mm (default: 0). */
  skirt?: number;
  /** Ribbed / screw caps, collars. */
  ribCount?: number;
  /** Screw / ribbed caps: add a separate tamper-evident ring under the cap. */
  tamperRing?: boolean;
  /** Pump / spray: direction of the spout or nozzle, degrees (0 = front, 90 = right). */
  sprayDirection?: number;
  nozzleWidth?: number;
  actuatorWidth?: number;
  /** Dropper: length of the glass pipette inside the bottle, mm. */
  stemLength?: number;
  /** Wine capsule: radial scale of the neck finish bead it must clear. */
  finishScale?: number;
  /** Segments around (default per type). */
  resolution?: number;
  seed?: number;
}

export type ClosureFamily = "round" | "beverage" | "oval" | "perfume" | "wine" | "dropper" | "pump" | "spray";

/**
 * Closure for a bottle family. `packHeight` is the catalog height (closure included),
 * `neck` comes from the bottle geometry (finish bead to cover).
 */
export function closurePreset(
  family: ClosureFamily,
  packHeight: number,
  neck: { width: number; finishHeight: number; finishScale: number },
  bodyHeight = packHeight * 0.6
): ClosureConfig {
  const H = packHeight;
  const nw = neck.width;
  const cover = neck.finishHeight * 1.15;
  switch (family) {
    case "wine":
      return { type: "wineCapsule", width: nw * neck.finishScale * 1.04, height: H * 0.16, neckWidth: nw, skirt: H * 0.16 - H * 0.004, finishScale: neck.finishScale, seed: 7 };
    case "dropper":
      return { type: "dropper", width: nw * 1.3, height: H * 0.34 + cover, neckWidth: nw, skirt: cover, stemLength: bodyHeight * 0.8 };
    case "pump":
      return { type: "pump", width: nw * 1.4, height: H * 0.2 + cover, neckWidth: nw, skirt: cover, sprayDirection: 90 };
    case "spray":
    case "perfume":
      return { type: "spray", width: nw * 1.35, height: H * 0.2 + cover, neckWidth: nw, skirt: cover, sprayDirection: 0 };
    case "round":
      return { type: "ribbedCap", width: nw * 1.2, height: H * 0.1 + cover, neckWidth: nw, skirt: cover, ribCount: 24, tamperRing: true };
    case "oval":
    case "beverage":
    default:
      return { type: "screwCap", width: nw * 1.18, height: H * 0.1 + cover, neckWidth: nw, skirt: cover, ribCount: 32, tamperRing: true };
  }
}

/**
 * Highest point of the closure above the neck top, mm: the maximum y of the profiles built by
 * closureLibrary.ts (cap dome, capsule top, actuator, spout, nozzle, bulb). Mirrors those
 * formulas exactly; a test compares it with the bounding box of the real geometry.
 */
export function closureTop(c: ClosureConfig): number {
  const H = Math.max(0.5, c.height);
  const W = Math.max(0.5, c.width);
  const skirt = c.skirt ?? 0;
  switch (c.type) {
    case "screwCap":
    case "ribbedCap": {
      const top = H - Math.min(skirt, H * 0.8);
      return top + (c.type === "ribbedCap" ? H * 0.015 : H * 0.03); // domed top
    }
    case "wineCapsule":
      return H - Math.min(c.skirt ?? H * 0.95, H);
    case "pump": {
      const colTop = H * 0.24 - Math.min(skirt, H * 0.24 * 0.8);
      const stemTop = colTop + H * 0.3;
      const aR = (c.actuatorWidth ?? W * 0.8) / 2;
      const aH = H * 0.22;
      const a0 = stemTop - H * 0.02;
      const spoutTop = a0 + aH * 0.55 + (c.nozzleWidth ?? aR * 0.42) / 2;
      return Math.max(a0 + aH, spoutTop);
    }
    case "spray": {
      const colTop = H * 0.28 - Math.min(skirt, H * 0.28 * 0.8);
      const aR = (c.actuatorWidth ?? W * 0.72) / 2;
      const aH = H - skirt - colTop - 0.01;
      const nozzleTop = colTop + aH * 0.62 + (c.nozzleWidth ?? aR * 0.45) / 2;
      return Math.max(colTop + aH + H * 0.01, nozzleTop);
    }
    case "dropper":
      return H - skirt; // top of the rubber bulb
    case "tamperRing":
    case "canLid":
    default:
      return 0; // these sit at or below the reference plane
  }
}
