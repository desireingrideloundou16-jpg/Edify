/**
 * Product-photography presets for the 3D mockup engine (phase 2A), in one place.
 *
 *   lighting  → studio environment (reflections) + key / fill / rim lights + shadows
 *   camera    → shot angle, focal length, margins, framing (computed from the pack's bounds)
 *   quality   → PREVIEW (interactive) or HD (accumulated, soft shadows, supersampled)
 *
 * Pure data + maths, no DOM and no three.js objects: every renderer (live viewer, catalog
 * thumbnails, HD render) reads the same values, and a future AI layer only has to produce a
 * `ShotRequest` ("hero shot premium" → { camera: "hero", lighting: "premium" }).
 *
 * Conventions: the pack is normalised by `buildPackaging` (largest side = 1 unit, standing on
 * y = 0, front facing +z). Angles are in degrees; azimuth 0 = in front, positive = to the right,
 * elevation positive = above.
 */

// ─── Lighting ────────────────────────────────────────────────────────────────

export const LIGHTING_IDS = ["soft", "premium", "dramatic", "ecommerce", "natural"] as const;
export type LightingPresetId = (typeof LIGHTING_IDS)[number];

/** Emissive softbox in the baked environment (what glossy surfaces reflect). */
export interface EnvPanel {
  azimuth: number;
  elevation: number;
  distance: number;
  width: number;
  height: number;
  intensity: number;
  color?: string;
}

export interface DirectionalSpec {
  azimuth: number;
  elevation: number;
  intensity: number;
  color: string;
}

export interface StudioLightingConfig {
  id: LightingPresetId;
  label: string;
  /** Renderer tone-mapping exposure. */
  exposure: number;
  environment: {
    /** Cyclorama brightness (linear, 0 = black studio, 1 = white room). */
    wall: number;
    floor: number;
    tint: string;
    /** scene.environmentIntensity */
    intensity: number;
    panels: EnvPanel[];
  };
  /** Shadow-casting key light; `softness` is the light's apparent size (HD soft shadows). */
  key: DirectionalSpec & { softness: number };
  fill: DirectionalSpec | null;
  rim: DirectionalSpec | null;
  /** Hemisphere light (sky, ground) intensity. */
  ambient: number;
  shadow: {
    /** Cast shadow opacity on the ground. */
    opacity: number;
    /** Contact shadow (ambient occlusion under the pack). */
    contactOpacity: number;
    contactBlur: number;
  };
  /** Suggested backdrop for exported images. */
  background: string;
}

export const LIGHTING_PRESETS: Record<LightingPresetId, StudioLightingConfig> = {
  soft: {
    id: "soft",
    label: "Studio doux",
    exposure: 1.05,
    environment: {
      wall: 0.32, floor: 0.55, tint: "#f6f7fb", intensity: 1,
      panels: [
        { azimuth: 0, elevation: 80, distance: 4.5, width: 4.5, height: 4.5, intensity: 3.2 },
        { azimuth: -40, elevation: 20, distance: 4.5, width: 3.2, height: 3.2, intensity: 2.6 },
        { azimuth: 50, elevation: 15, distance: 4.5, width: 3, height: 3, intensity: 1.8 },
      ],
    },
    key: { azimuth: -30, elevation: 64, intensity: 1.1, color: "#ffffff", softness: 0.35 },
    fill: { azimuth: 55, elevation: 20, intensity: 0.35, color: "#ffffff" },
    rim: null,
    ambient: 0.35,
    shadow: { opacity: 0.22, contactOpacity: 0.5, contactBlur: 2.8 },
    background: "#f3f4f6",
  },
  premium: {
    id: "premium",
    label: "Studio premium",
    exposure: 1.1,
    environment: {
      wall: 0.05, floor: 0.3, tint: "#ffffff", intensity: 1.15,
      panels: [
        { azimuth: 0, elevation: 82, distance: 4.5, width: 3.2, height: 3.2, intensity: 5 },
        { azimuth: -62, elevation: 12, distance: 3.6, width: 0.9, height: 4, intensity: 9 },
        { azimuth: 64, elevation: 12, distance: 3.6, width: 0.9, height: 4, intensity: 4 },
        { azimuth: 180, elevation: 22, distance: 4.2, width: 4.5, height: 0.7, intensity: 5 },
        { azimuth: 0, elevation: 8, distance: 4.6, width: 2.4, height: 1.2, intensity: 1.4 },
      ],
    },
    key: { azimuth: -40, elevation: 58, intensity: 1.7, color: "#ffffff", softness: 0.25 },
    fill: { azimuth: 60, elevation: 18, intensity: 0.3, color: "#eef2ff" },
    rim: { azimuth: 165, elevation: 32, intensity: 1.2, color: "#ffffff" },
    ambient: 0.15,
    shadow: { opacity: 0.26, contactOpacity: 0.62, contactBlur: 2.4 },
    background: "#eceae6",
  },
  dramatic: {
    id: "dramatic",
    label: "Contraste dramatique",
    exposure: 1.05,
    environment: {
      wall: 0.015, floor: 0.08, tint: "#ffffff", intensity: 1,
      panels: [
        { azimuth: -85, elevation: 18, distance: 3.4, width: 0.8, height: 4, intensity: 12 },
        { azimuth: 150, elevation: 28, distance: 4, width: 0.6, height: 3.5, intensity: 7 },
        { azimuth: 0, elevation: 6, distance: 4.6, width: 1.6, height: 0.8, intensity: 0.5 },
      ],
    },
    key: { azimuth: -78, elevation: 26, intensity: 2.6, color: "#fff4e8", softness: 0.12 },
    fill: null,
    rim: { azimuth: 150, elevation: 30, intensity: 1.8, color: "#ffffff" },
    ambient: 0.04,
    shadow: { opacity: 0.55, contactOpacity: 0.75, contactBlur: 1.8 },
    background: "#16171b",
  },
  ecommerce: {
    id: "ecommerce",
    label: "E-commerce",
    exposure: 1.02,
    environment: {
      wall: 0.85, floor: 1, tint: "#ffffff", intensity: 0.9,
      panels: [
        { azimuth: 0, elevation: 75, distance: 4.5, width: 5, height: 5, intensity: 2.2 },
        { azimuth: 0, elevation: 12, distance: 4.6, width: 4, height: 2.2, intensity: 1.6 },
        { azimuth: -70, elevation: 12, distance: 3.8, width: 0.8, height: 3.6, intensity: 3 },
        { azimuth: 70, elevation: 12, distance: 3.8, width: 0.8, height: 3.6, intensity: 3 },
      ],
    },
    key: { azimuth: -10, elevation: 70, intensity: 0.7, color: "#ffffff", softness: 0.45 },
    fill: { azimuth: 30, elevation: 15, intensity: 0.25, color: "#ffffff" },
    rim: null,
    ambient: 0.4,
    shadow: { opacity: 0.12, contactOpacity: 0.42, contactBlur: 3 },
    background: "#ffffff",
  },
  natural: {
    id: "natural",
    label: "Lumière naturelle",
    exposure: 1.08,
    environment: {
      wall: 0.2, floor: 0.35, tint: "#fff3e3", intensity: 1,
      panels: [
        // A large window on the left, bluish sky bounce on the right.
        { azimuth: -55, elevation: 25, distance: 4, width: 2.8, height: 3.4, intensity: 5.5, color: "#fff1dc" },
        { azimuth: 70, elevation: 45, distance: 4.5, width: 4, height: 3, intensity: 1.4, color: "#dfe9ff" },
        { azimuth: 0, elevation: 80, distance: 4.5, width: 3, height: 3, intensity: 1.2 },
      ],
    },
    key: { azimuth: -50, elevation: 46, intensity: 2.1, color: "#ffe7c7", softness: 0.18 },
    fill: { azimuth: 70, elevation: 40, intensity: 0.3, color: "#dce7ff" },
    rim: null,
    ambient: 0.22,
    shadow: { opacity: 0.4, contactOpacity: 0.55, contactBlur: 2.2 },
    background: "#efe7dc",
  },
};

/** Former viewer presets, kept as aliases so existing callers keep working. */
const LIGHTING_ALIASES: Record<string, LightingPresetId> = { studio: "premium", warm: "natural" };

export function resolveLighting(id: string | null | undefined): StudioLightingConfig {
  const key = id ? (LIGHTING_ALIASES[id] ?? id) : "premium";
  return (LIGHTING_PRESETS as Record<string, StudioLightingConfig>)[key] ?? LIGHTING_PRESETS.premium;
}

// ─── Camera ──────────────────────────────────────────────────────────────────

export const CAMERA_IDS = ["front", "threeQuarter", "hero", "top", "closeUp", "catalog", "back", "bottom"] as const;
export type CameraPresetId = (typeof CAMERA_IDS)[number];

export interface CameraShotConfig {
  id: CameraPresetId;
  label: string;
  azimuth: number;
  elevation: number;
  /** Full-frame equivalent focal length (mm): longer = flatter, more "catalogue". */
  focalMm: number;
  /** Empty space kept around the pack, as a fraction of the frame (0.1 = 10 %). */
  margin: number;
  /** 1 = the whole pack fits; > 1 crops in (close-up). */
  zoom: number;
  /** Aim point: fraction of the pack height, and how far toward its front face (0..1). */
  aimHeight: number;
  aimFront: number;
  /** HD only: lens aperture as a fraction of the camera distance (0 = everything sharp). */
  aperture: number;
  /** The camera may go below the ground plane (underside view). */
  allowBelowGround?: boolean;
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraShotConfig> = {
  front: { id: "front", label: "Face", azimuth: 0, elevation: 6, focalMm: 70, margin: 0.14, zoom: 1, aimHeight: 0.5, aimFront: 0, aperture: 0 },
  threeQuarter: { id: "threeQuarter", label: "¾", azimuth: 35, elevation: 18, focalMm: 60, margin: 0.14, zoom: 1, aimHeight: 0.5, aimFront: 0, aperture: 0 },
  hero: { id: "hero", label: "Hero", azimuth: 26, elevation: 3, focalMm: 50, margin: 0.1, zoom: 1, aimHeight: 0.46, aimFront: 0, aperture: 0.006 },
  top: { id: "top", label: "Plongée", azimuth: 25, elevation: 52, focalMm: 60, margin: 0.14, zoom: 1, aimHeight: 0.45, aimFront: 0, aperture: 0 },
  closeUp: { id: "closeUp", label: "Gros plan", azimuth: 18, elevation: 10, focalMm: 100, margin: 0, zoom: 2, aimHeight: 0.5, aimFront: 1, aperture: 0.012 },
  catalog: { id: "catalog", label: "Catalogue", azimuth: 22, elevation: 14, focalMm: 85, margin: 0.16, zoom: 1, aimHeight: 0.5, aimFront: 0, aperture: 0 },
  back: { id: "back", label: "Dos", azimuth: 200, elevation: 12, focalMm: 60, margin: 0.14, zoom: 1, aimHeight: 0.5, aimFront: 0, aperture: 0 },
  bottom: { id: "bottom", label: "Dessous", azimuth: 18, elevation: -55, focalMm: 60, margin: 0.14, zoom: 1, aimHeight: 0.5, aimFront: 0, aperture: 0, allowBelowGround: true },
};

export function resolveCamera(id: string | null | undefined): CameraShotConfig {
  return (CAMERA_PRESETS as Record<string, CameraShotConfig>)[id ?? ""] ?? CAMERA_PRESETS.threeQuarter;
}

/** Vertical field of view (degrees) of a full-frame (24 mm high) lens. */
export function fovFromFocal(focalMm: number): number {
  return (2 * Math.atan(24 / (2 * Math.max(1, focalMm))) * 180) / Math.PI;
}

type Vec3 = [number, number, number];

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface FramedShot {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view, degrees. */
  fov: number;
  distance: number;
  near: number;
  far: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Unit vector from the target toward the camera. */
export function shotDirection(azimuth: number, elevation: number): Vec3 {
  const az = rad(azimuth), el = rad(elevation);
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

/**
 * Automatic composition: the smallest camera distance at which every corner of the pack's
 * bounding box stays inside the frame minus the margin (exact for a pinhole camera), then
 * `zoom` for close-ups. Works for any pack proportions, so no per-product values are needed.
 */
export function frameShot(bounds: Bounds, shot: CameraShotConfig, aspect: number): FramedShot {
  const { min, max } = bounds;
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const target: Vec3 = [
    (min[0] + max[0]) / 2,
    min[1] + size[1] * shot.aimHeight,
    (min[2] + max[2]) / 2 + (size[2] / 2) * shot.aimFront,
  ];
  const dir = shotDirection(shot.azimuth, shot.elevation);
  const forward: Vec3 = [-dir[0], -dir[1], -dir[2]];
  // Straight up/down views need another reference for "up".
  const worldUp: Vec3 = Math.abs(dir[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0];
  const right = norm(cross(forward, worldUp));
  const up = cross(right, forward);

  const fov = fovFromFocal(shot.focalMm);
  const keep = Math.max(0.2, 1 - shot.margin);
  const tV = Math.tan(rad(fov) / 2) * keep;
  const tH = Math.tan(rad(fov) / 2) * Math.max(0.05, aspect) * keep;

  let distance = 0;
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const c: Vec3 = [x - target[0], y - target[1], z - target[2]];
    const need = Math.max(Math.abs(dot(c, right)) / tH, Math.abs(dot(c, up)) / tV) + dot(c, dir);
    distance = Math.max(distance, need);
  }
  distance /= Math.max(0.1, shot.zoom);
  // Never closer than the pack's own surface.
  const radius = Math.hypot(...size) / 2;
  distance = Math.max(distance, radius * 0.35);

  const position: Vec3 = [target[0] + dir[0] * distance, target[1] + dir[1] * distance, target[2] + dir[2] * distance];
  if (!shot.allowBelowGround) position[1] = Math.max(position[1], min[1] + size[1] * 0.04);
  return { position, target, fov, distance, near: Math.max(0.005, distance * 0.02), far: distance * 20 + radius * 4 };
}

// ─── Render quality and device capabilities ──────────────────────────────────

export interface GraphicsCaps {
  webgl: boolean;
  webgl2: boolean;
  webgpu: boolean;
  mobile: boolean;
  /** Few cores / little memory: keep the preview light. */
  lowEnd: boolean;
  maxTextureSize: number;
}

export type QualityTier = "preview" | "hd";

export interface RenderQualityConfig {
  tier: QualityTier;
  maxPixelRatio: number;
  shadowMapSize: number;
  /** HD: frames accumulated (antialiasing, soft shadows, depth of field). */
  samples: number;
  /** HD: largest output side in pixels. */
  maxSize: number;
}

const QUALITY: Record<QualityTier, RenderQualityConfig> = {
  preview: { tier: "preview", maxPixelRatio: 2, shadowMapSize: 1024, samples: 1, maxSize: 2048 },
  hd: { tier: "hd", maxPixelRatio: 1, shadowMapSize: 2048, samples: 48, maxSize: 3072 },
};

/** Quality for this device, or null when no WebGL at all (the UI shows its 2D fallback). */
export function chooseQuality(tier: QualityTier, caps: GraphicsCaps): RenderQualityConfig | null {
  if (!caps.webgl) return null;
  const q = { ...QUALITY[tier] };
  const weak = caps.lowEnd || caps.mobile || !caps.webgl2;
  if (tier === "preview" && weak) {
    q.maxPixelRatio = 1.5;
    q.shadowMapSize = 512;
  }
  if (tier === "hd" && weak) {
    q.samples = 20;
    q.shadowMapSize = 1024;
    q.maxSize = 2048;
  }
  q.maxSize = Math.min(q.maxSize, caps.maxTextureSize || 2048);
  return q;
}

// ─── Shot requests (what the AI layer will produce later) ────────────────────

/** Named combinations, e.g. "hero shot premium". */
export const SHOT_STYLES = {
  heroPremium: { camera: "hero", lighting: "premium" },
  catalogEcommerce: { camera: "catalog", lighting: "ecommerce" },
  closeUpDetail: { camera: "closeUp", lighting: "soft" },
  dramaticHero: { camera: "hero", lighting: "dramatic" },
  naturalLifestyle: { camera: "threeQuarter", lighting: "natural" },
} as const satisfies Record<string, { camera: CameraPresetId; lighting: LightingPresetId }>;
export type ShotStyleId = keyof typeof SHOT_STYLES;

export interface ShotRequest {
  style?: string;
  camera?: string;
  lighting?: string;
  quality?: QualityTier;
}

export interface ResolvedShot {
  camera: CameraShotConfig;
  lighting: StudioLightingConfig;
  quality: QualityTier;
}

/** Any request, even partial or invalid, resolves to a complete, valid setup. */
export function resolveShot(req: ShotRequest = {}): ResolvedShot {
  const style = (SHOT_STYLES as Record<string, { camera: string; lighting: string }>)[req.style ?? ""];
  return {
    camera: resolveCamera(req.camera ?? style?.camera),
    lighting: resolveLighting(req.lighting ?? style?.lighting),
    quality: req.quality === "hd" ? "hd" : "preview",
  };
}
