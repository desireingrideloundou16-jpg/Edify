/**
 * Flexible packs (phase 2C-3): heat-seal bands shared by the 3D mesh (three/geometry/
 * pouchGeometry.ts crimps exactly these bands) and the print structure (seals kept free of
 * artwork). Millimetres. Pure.
 */

export type PouchKind = "doypack" | "flatpouch" | "pillow";

/** Top and bottom seal band widths of a pouch of height H (a stand-up doypack has no bottom seal). */
export function pouchSeals(kind: PouchKind | "pouch" | "sachet", H: number) {
  const doypack = kind === "doypack" || kind === "pouch";
  return {
    top: Math.max(10, Math.min(22, H * 0.065)),
    bottom: doypack ? 0 : Math.max(8, Math.min(18, H * 0.055)),
  };
}
