/**
 * Browser graphics capabilities, detected once. Never throws: a device without WebGL gets
 * `webgl: false` and the UI shows its 2D fallback instead of a black canvas.
 */
import type { GraphicsCaps } from "./scenePresets";

let cached: GraphicsCaps | null = null;

export function detectGraphicsCaps(): GraphicsCaps {
  if (cached) return cached;
  const caps: GraphicsCaps = { webgl: false, webgl2: false, webgpu: false, mobile: false, lowEnd: false, maxTextureSize: 0 };
  if (typeof window === "undefined") return caps;
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl = gl2 ?? canvas.getContext("webgl");
    caps.webgl = !!gl;
    caps.webgl2 = !!gl2;
    if (gl) {
      caps.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // no WebGL
  }
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown; userAgentData?: { mobile?: boolean } };
  caps.webgpu = !!nav.gpu;
  caps.mobile = nav.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);
  caps.lowEnd = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  cached = caps;
  return caps;
}
