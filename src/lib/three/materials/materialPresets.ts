/**
 * Packaging materials (phase 2B-5): one source of truth for every physical material.
 *
 * Pure data, no DOM, no three.js objects: a preset describes a real material (paper, kraft,
 * HDPE, PET, glass, aluminium, foil…) as physical parameters plus a micro-surface, and
 * `resolveMaterial()` applies the finish, the colour, the render quality and a deterministic
 * per-pack seed. `materialFactory.ts` turns the result into a MeshPhysicalMaterial.
 *
 * Units: thickness and attenuation distances are in millimetres (the packs are built in mm).
 */
import type { MicroKind } from "../surfaceDetail";

// ─── Quality ─────────────────────────────────────────────────────────────────

/**
 * LOW: plain PBR, glass without the transmission pass (weak GPUs).
 * MEDIUM: + micro-surface and roughness variation (interactive preview, thumbnails).
 * HIGH: + imperfections, anisotropic metal, dispersion, sheen (HD renders).
 * ULTRA: reserved for a future path-traced mode; resolves like HIGH today.
 */
export type MaterialQuality = "low" | "medium" | "high" | "ultra";

// ─── Presets ─────────────────────────────────────────────────────────────────

export const MATERIAL_PRESET_IDS = [
  "paper", "kraft", "laidPaper", "carton", "glossyCarton", "matteCarton", "softTouch",
  "mattePlastic", "glossyPlastic", "hdpe", "pet", "translucentPlastic", "plasticFilm", "metallizedFilm",
  "glass", "tintedGlass", "perfumeGlass", "frostedGlass",
  "aluminum", "brushedMetal", "paintedMetal", "printedMetal", "foil",
  "rubber", "labelMatte", "labelGlossy", "labelEdge",
] as const;
export type MaterialPresetId = (typeof MATERIAL_PRESET_IDS)[number];

export type MaterialFamily = "paper" | "plastic" | "film" | "glass" | "metal" | "rubber";

export interface MicroSpec {
  kind: MicroKind;
  normalScale: number;
  /** Low-frequency roughness variation (0..0.3). */
  variation: number;
  /** Fine scratches (0..1) — HIGH quality only. */
  scratches: number;
  /** Handling marks / smudges (0..1) — HIGH quality only. */
  smudges: number;
}

export interface MaterialPreset {
  family: MaterialFamily;
  color: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenRoughness: number;
  specularIntensity: number;
  transmission: number;
  /** mm */
  thickness: number;
  ior: number;
  /** mm; Infinity = clear. */
  attenuationDistance: number;
  attenuationColor: string;
  dispersion: number;
  anisotropy: number;
  doubleSide: boolean;
  micro: MicroSpec | null;
  /** Per-pack colour variation (relative lightness, e.g. 0.012 = ±1.2 %). */
  colorJitter: number;
}

const BASE: MaterialPreset = {
  family: "plastic", color: "#ffffff", roughness: 0.5, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.1,
  sheen: 0, sheenRoughness: 0.8, specularIntensity: 1, transmission: 0, thickness: 0, ior: 1.5,
  attenuationDistance: Infinity, attenuationColor: "#ffffff", dispersion: 0, anisotropy: 0, doubleSide: false,
  micro: null, colorJitter: 0,
};
const p = (o: Partial<MaterialPreset>): MaterialPreset => ({ ...BASE, ...o });
const micro = (kind: MicroKind, normalScale: number, variation: number, scratches = 0, smudges = 0): MicroSpec => ({ kind, normalScale, variation, scratches, smudges });

export const MATERIAL_PRESETS: Record<MaterialPresetId, MaterialPreset> = {
  // Paper & board: rough, fibrous, a little sheen at grazing angles.
  paper: p({ family: "paper", roughness: 0.9, sheen: 0.08, sheenRoughness: 0.9, specularIntensity: 0.6, micro: micro("paper", 0.35, 0.16), colorJitter: 0.012 }),
  kraft: p({ family: "paper", roughness: 0.9, sheen: 0.06, sheenRoughness: 0.9, specularIntensity: 0.5, micro: micro("kraft", 0.38, 0.2), colorJitter: 0.02 }),
  laidPaper: p({ family: "paper", roughness: 0.88, specularIntensity: 0.6, micro: micro("laid", 0.18, 0.14), colorJitter: 0.012 }),
  carton: p({ family: "paper", roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.25, micro: micro("coated", 0.15, 0.1, 0, 0.2), colorJitter: 0.008 }),
  glossyCarton: p({ family: "paper", roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05, micro: micro("coated", 0.15, 0.08, 0.15, 0.3), colorJitter: 0.006 }),
  matteCarton: p({ family: "paper", roughness: 0.72, clearcoat: 0.15, clearcoatRoughness: 0.6, specularIntensity: 0.8, micro: micro("coated", 0.2, 0.12, 0, 0.15), colorJitter: 0.008 }),
  softTouch: p({ family: "paper", roughness: 0.86, sheen: 0.15, sheenRoughness: 0.75, specularIntensity: 0.45, micro: micro("softtouch", 0.2, 0.08, 0, 0.35), colorJitter: 0.006 }),

  // Plastics.
  mattePlastic: p({ roughness: 0.6, specularIntensity: 0.8, micro: micro("plastic", 0.1, 0.1, 0.1, 0.2), colorJitter: 0.004 }),
  glossyPlastic: p({ roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.08, micro: micro("plastic", 0.08, 0.08, 0.2, 0.25), colorJitter: 0.004 }),
  // HDPE: waxy satin, soft highlight, slight sheen (no subsurface scattering in WebGL).
  hdpe: p({ roughness: 0.42, sheen: 0.2, sheenRoughness: 0.6, specularIntensity: 0.75, micro: micro("plastic", 0.1, 0.12, 0.12, 0.25), colorJitter: 0.005 }),
  pet: p({ roughness: 0.05, transmission: 0.95, thickness: 0.6, ior: 1.57, doubleSide: true, micro: micro("plastic", 0.03, 0.06, 0.15, 0.2) }),
  translucentPlastic: p({ roughness: 0.38, transmission: 0.6, thickness: 2, ior: 1.49, doubleSide: true, micro: micro("plastic", 0.06, 0.1, 0.1, 0.2) }),
  plasticFilm: p({ family: "film", roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, metalness: 0.1, doubleSide: true, micro: micro("film", 0.2, 0.1, 0, 0.1) }),
  metallizedFilm: p({ family: "film", roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, metalness: 0.35, doubleSide: true, micro: micro("film", 0.2, 0.1, 0, 0.1) }),

  // Glass: transmission + refraction through a physical thickness, almost no roughness.
  glass: p({ family: "glass", roughness: 0.03, transmission: 1, thickness: 2.5, ior: 1.5, doubleSide: true, dispersion: 0.2, micro: micro("plastic", 0.02, 0.05, 0.12, 0.3) }),
  tintedGlass: p({ family: "glass", roughness: 0.04, transmission: 1, thickness: 3, ior: 1.5, attenuationDistance: 2.5, attenuationColor: "#2f4f2a", doubleSide: true, dispersion: 0.15, micro: micro("plastic", 0.02, 0.05, 0.12, 0.3) }),
  // Heavy perfume glass: thick walls refract strongly, a touch of dispersion in HD.
  perfumeGlass: p({ family: "glass", roughness: 0.015, transmission: 1, thickness: 8, ior: 1.52, doubleSide: true, dispersion: 0.4, micro: micro("plastic", 0.015, 0.04, 0.08, 0.2) }),
  frostedGlass: p({ family: "glass", roughness: 0.4, transmission: 1, thickness: 2.5, ior: 1.5, doubleSide: true, micro: micro("softtouch", 0.08, 0.1) }),

  // Metals.
  aluminum: p({ family: "metal", color: "#d7dadd", metalness: 1, roughness: 0.26, anisotropy: 0.35, micro: micro("brushed", 0.1, 0.1, 0.25, 0.2) }),
  brushedMetal: p({ family: "metal", color: "#c9ccd0", metalness: 1, roughness: 0.32, anisotropy: 0.7, micro: micro("brushed", 0.15, 0.12, 0.3, 0.15) }),
  // Paint over metal: a dielectric coat with a hint of the metal under it.
  paintedMetal: p({ family: "metal", metalness: 0.3, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15, micro: micro("brushed", 0.05, 0.08, 0.15, 0.2) }),
  // Ink printed on aluminium under a varnish (cans, tins): the brushed metal shows through.
  printedMetal: p({ family: "metal", metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, anisotropy: 0.2, micro: micro("brushed", 0.06, 0.08, 0.15, 0.15) }),
  foil: p({ family: "metal", metalness: 0.85, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, micro: micro("film", 0.06, 0.1, 0.1, 0.1) }),

  rubber: p({ family: "rubber", roughness: 0.78, specularIntensity: 0.5, sheen: 0.25, sheenRoughness: 0.5, micro: micro("softtouch", 0.15, 0.1, 0, 0.3) }),

  // Labels: paper on a container, with their own edge (the white paper core).
  labelMatte: p({ family: "paper", roughness: 0.82, sheen: 0.06, specularIntensity: 0.7, micro: micro("paper", 0.25, 0.12, 0, 0.15), colorJitter: 0.006 }),
  labelGlossy: p({ family: "paper", roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.07, micro: micro("coated", 0.12, 0.08, 0.12, 0.25), colorJitter: 0.004 }),
  labelEdge: p({ family: "paper", color: "#f4f1ea", roughness: 0.92, specularIntensity: 0.5, colorJitter: 0.01 }),
};

// ─── Finishes ────────────────────────────────────────────────────────────────

/**
 * Finish system. Supported now: matte, glossy, satin, softTouch, uncoated, laid, varnish
 * (= glossy coat), metallic. Declared for later (production finishes on part of the artwork):
 * foil, spotUv, emboss, deboss — they resolve to the closest supported finish today.
 */
export type FinishId = "matte" | "glossy" | "satin" | "softTouch" | "uncoated" | "laid" | "varnish" | "metallic" | "foil" | "spotUv" | "emboss" | "deboss";

/** Finish of a catalog / AI "finishing" label (French or English). */
export function finishFromLabel(label: string | null | undefined): FinishId {
  const s = label ?? "";
  if (/verg/i.test(s)) return "laid";
  if (/soft|velours/i.test(s)) return "softTouch";
  if (/non couch|recycl|kraft|washi|textur/i.test(s)) return "uncoated";
  if (/vernis s[ée]lectif|spot/i.test(s)) return "spotUv";
  if (/dorure|foil|chaud/i.test(s)) return "foil";
  if (/gaufr|emboss/i.test(s)) return "emboss";
  if (/mat/i.test(s)) return "matte";
  if (/brillant|holograph|nacr|gloss|uv/i.test(s)) return "glossy";
  if (/vernis|varnish/i.test(s)) return "varnish";
  if (/m[ée]tal/i.test(s)) return "metallic";
  return "satin";
}

/** Finishes not rendered yet fall back to the closest one (documented, not silent). */
export const FINISH_FALLBACK: Record<FinishId, FinishId> = {
  matte: "matte", glossy: "glossy", satin: "satin", softTouch: "softTouch", uncoated: "uncoated", laid: "laid",
  varnish: "glossy", metallic: "metallic", foil: "satin", spotUv: "satin", emboss: "satin", deboss: "satin",
};

export type PrintSurface = "paper" | "kraft" | "glass" | "plastic" | "clearplastic" | "metal" | "film";

/** Preset for artwork printed on a surface with a finish (boxes, wraps, pouches, labels). */
export function printedPreset(surface: PrintSurface, finish: FinishId, label = false): MaterialPresetId {
  const f = FINISH_FALLBACK[finish];
  switch (surface) {
    case "metal": return "printedMetal";
    case "film": return f === "metallic" ? "metallizedFilm" : "plasticFilm";
    case "plastic":
    case "clearplastic":
      return f === "softTouch" ? "softTouch" : f === "matte" || f === "uncoated" ? "mattePlastic" : "glossyPlastic";
    case "kraft": return "kraft";
    default:
      if (label) return f === "glossy" ? "labelGlossy" : f === "laid" ? "laidPaper" : f === "softTouch" ? "softTouch" : f === "uncoated" ? "paper" : "labelMatte";
      return f === "glossy" ? "glossyCarton" : f === "softTouch" ? "softTouch" : f === "matte" ? "matteCarton" : f === "uncoated" ? "paper" : f === "laid" ? "laidPaper" : "carton";
  }
}

/** Glass preset from a catalog material name. */
export function glassPreset(material: string): { preset: MaterialPresetId; tint?: string } {
  const m = material.toLowerCase();
  if (m.includes("dépoli") || m.includes("depoli")) return { preset: "frostedGlass" };
  if (m.includes("ambré") || m.includes("ambre")) return { preset: "tintedGlass", tint: "#8a4a12" };
  if (m.includes("teinté") || m.includes("teinte")) return { preset: "tintedGlass", tint: "#2f4f2a" };
  if (m.includes("épais") || m.includes("epais") || m.includes("extra-blanc")) return { preset: "perfumeGlass" };
  return { preset: "glass" };
}

// ─── Determinism ─────────────────────────────────────────────────────────────

/** FNV-1a hash of the parts: same pack + material → same seed, different packs → different seeds. */
export function hashSeed(...parts: (string | number | null | undefined)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = String(part ?? "") + "\u0001";
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

/** Deterministic pseudo-random sequence in [0, 1). */
export function createDeterministicNoise(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ─── Resolution ──────────────────────────────────────────────────────────────

export interface MaterialRequest {
  preset: MaterialPresetId;
  /** Printed base colour (white when an artwork map carries the colour). */
  color?: string;
  /** Glass tint (attenuation colour). */
  tint?: string;
  seed?: number;
  quality?: MaterialQuality;
  /** Overrides for special cases (e.g. a darker cap). Clamped like everything else. */
  roughness?: number;
  metalness?: number;
}

export interface ResolvedMaterial extends MaterialPreset {
  preset: MaterialPresetId;
  quality: MaterialQuality;
  /** Glass rendered without the transmission pass (LOW quality). */
  transparentFallback: boolean;
  opacity: number;
  /** Micro-surface pattern variant and placement (deterministic per seed). */
  variant: number;
  offset: [number, number];
  /** Lightness factor applied to the colour (1 ± colorJitter). */
  colorFactor: number;
}

const clamp = (x: number, lo: number, hi: number) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);
const HEX = /^#[0-9a-f]{6}$/i;

export function resolveMaterial(req: MaterialRequest): ResolvedMaterial {
  const base = MATERIAL_PRESETS[req.preset] ?? MATERIAL_PRESETS.carton;
  const quality = req.quality ?? "medium";
  const high = quality === "high" || quality === "ultra";
  const seed = (req.seed ?? 0) >>> 0;
  const rnd = createDeterministicNoise(seed ^ 0x9e3779b9);
  const r = { ...base };
  if (req.color && HEX.test(req.color)) r.color = req.color;
  if (req.tint && HEX.test(req.tint)) {
    // Coloured glass: the tint both filters the transmitted light (colour) and deepens with
    // the path length through the glass (attenuation), like real bottle glass.
    r.attenuationColor = req.tint;
    if (r.family === "glass") r.color = req.tint;
  }
  if (req.roughness !== undefined) r.roughness = req.roughness;
  if (req.metalness !== undefined) r.metalness = req.metalness;

  // Quality gating: expensive or subtle features only where they pay off.
  let micro = r.micro ? { ...r.micro } : null;
  if (quality === "low") micro = null;
  else if (micro && !high) micro = { ...micro, scratches: 0, smudges: 0 };
  const transparentFallback = quality === "low" && r.transmission > 0;

  const out: ResolvedMaterial = {
    ...r,
    preset: base === MATERIAL_PRESETS[req.preset] ? req.preset : "carton",
    quality,
    micro,
    roughness: clamp(r.roughness, 0, 1),
    metalness: clamp(r.metalness, 0, 1),
    clearcoat: clamp(r.clearcoat, 0, 1),
    clearcoatRoughness: clamp(r.clearcoatRoughness, 0, 1),
    sheen: high ? clamp(r.sheen, 0, 1) : clamp(r.sheen * 0.5, 0, 1),
    sheenRoughness: clamp(r.sheenRoughness, 0, 1),
    specularIntensity: clamp(r.specularIntensity, 0, 1),
    transmission: transparentFallback ? 0 : clamp(r.transmission, 0, 1),
    thickness: clamp(r.thickness, 0, 50),
    ior: clamp(r.ior, 1, 2.333),
    attenuationDistance: r.attenuationDistance === Infinity ? Infinity : clamp(r.attenuationDistance, 0.01, 1e4),
    dispersion: high ? clamp(r.dispersion, 0, 1) : 0,
    anisotropy: quality === "low" ? 0 : high ? clamp(r.anisotropy, 0, 1) : clamp(r.anisotropy * 0.5, 0, 1),
    transparentFallback,
    opacity: transparentFallback ? 0.32 : 1,
    variant: Math.floor(rnd() * 4),
    offset: [rnd(), rnd()],
    colorFactor: 1 + (rnd() * 2 - 1) * r.colorJitter,
  };
  if (out.micro) {
    out.micro.normalScale = clamp(out.micro.normalScale, 0, 2);
    out.micro.variation = clamp(out.micro.variation, 0, 0.5);
    out.micro.scratches = clamp(out.micro.scratches, 0, 1);
    out.micro.smudges = clamp(out.micro.smudges, 0, 1);
  }
  return out;
}
