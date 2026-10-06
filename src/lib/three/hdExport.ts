/**
 * HD export (phase 3D-C): the 3D picture shipped in the export ZIP (`<projet>-apercu-3d.png`).
 *
 * One source of truth for that picture, independent of the live viewer:
 *   applied design (fullDesign) → renderHD (its own renderer and WebGL context, same models,
 *   materials, studio rig and presets as the viewer) → transparent PNG, fixed hero framing.
 * It never reads nor touches the interactive canvas (camera, controls, renderer, render loop), so the
 * picture no longer depends on where the user left the camera or on the size of the screen.
 * Without WebGL (or if the HD render fails) it falls back to the former catalog render (renderShowcase,
 * same models and rig, 1400 px), never to a capture of the live canvas.
 *
 * Phase 3D-D: the shot is resolved by resolveShot() (the camera authority) from an optional ShotRequest,
 * e.g. MasterDesignIntent → shotRequestFromIntent → { style: "catalogEcommerce" }. Without a style the export
 * keeps its 3D-C default request ({ style: "heroPremium" }). The framing gives the product the frame and the
 * shadow a controlled share of it (shadowAllowance); a longer shadow fades out instead of shrinking the pack.
 */
import type { PackagingShape } from "@/components/workspace/Modals";
import type { PackagingDesign, PackagingSpec } from "./packagingModels";
import { SHOT_STYLES, resolveShot, type CameraPresetId, type LightingPresetId, type ShotRequest, type ShotStyleId } from "./scenePresets";

export const HD_EXPORT = {
  /** The export's request when none (or no resolved style) is given: the system's HD shot. */
  defaultStyle: "heroPremium" as ShotStyleId,
  /** The system's HD shot ("heroPremium"): the hero ¾ angle under the studio lighting of the viewer. */
  camera: SHOT_STYLES.heroPremium.camera as CameraPresetId,
  lighting: SHOT_STYLES.heroPremium.lighting as LightingPresetId,
  /** Square, like the former ZIP picture; renderHD caps it to the device's HD size. */
  size: 2048,
  /** Transparent PNG (the ZIP picture's contract): the cast and contact shadows keep their alpha. */
  background: "transparent",
  /** The cast shadow is framed too: a transparent export never ends on a shadow cut by its edge. */
  frame: "packAndShadow",
  /**
   * Room given to the shadow beyond the pack's footprint: a quarter of the pack's largest side. The product
   * fills the frame first (a pot is no longer shrunk by its own shadow); a longer shadow fades out within it.
   */
  shadowAllowance: 0.25,
  /** Fallback size (the former ZIP picture). */
  fallbackSize: 1400,
} as const;

export interface HdExportResult {
  /** PNG data URL. */
  dataUrl: string;
  /** "hd": renderHD; "showcase": the fallback catalog render. */
  engine: "hd" | "showcase";
  ms: number;
  /** The shot resolveShot() produced (the fallback catalog render keeps its own camera). */
  shot: { style: ShotStyleId | null; camera: CameraPresetId; lighting: LightingPresetId };
}

/** The export's shot: resolveShot() on the request, the export's default style when it names none. */
export function resolveExportShot(request: ShotRequest = {}) {
  const style = request.style && request.style in SHOT_STYLES ? (request.style as ShotStyleId) : null;
  const resolved = resolveShot({ style: HD_EXPORT.defaultStyle, ...request, ...(style ? {} : { style: HD_EXPORT.defaultStyle }), quality: "hd" });
  return { style: style ?? HD_EXPORT.defaultStyle, resolved };
}

/** Renders the export picture of the applied design. Null only when no 3D render is possible at all. */
export async function renderExportPreview(
  shape: PackagingShape,
  spec: PackagingSpec,
  design: PackagingDesign,
  opts: { size?: number; onProgress?: (done: number, total: number) => void; shot?: ShotRequest } = {}
): Promise<HdExportResult | null> {
  const t0 = performance.now();
  const size = opts.size ?? HD_EXPORT.size;
  const { style, resolved } = resolveExportShot(opts.shot);
  const shot = { style, camera: resolved.camera.id, lighting: resolved.lighting.id };
  const { renderHD } = await import("./hdRender");
  const hd = await renderHD({
    spec, design, camera: shot.camera, lighting: shot.lighting,
    width: size, height: size, background: HD_EXPORT.background, frame: HD_EXPORT.frame, shadowAllowance: HD_EXPORT.shadowAllowance,
    onProgress: opts.onProgress,
  }).catch((e: unknown) => {
    console.warn("HD export render failed, falling back to the catalog render", e);
    return null;
  });
  if (hd) return { dataUrl: hd, engine: "hd", ms: performance.now() - t0, shot };
  const { renderShowcase } = await import("./thumbnails");
  const fallback = await renderShowcase(shape, design, HD_EXPORT.fallbackSize, -0.5).catch(() => null);
  return fallback ? { dataUrl: fallback, engine: "showcase", ms: performance.now() - t0, shot: { style: null, camera: "catalog", lighting: "premium" } } : null;
}
