/**
 * Material factory (phase 2B-5): the only place that turns a resolved packaging material into
 * a three.js material. Micro-surface, calibrated roughness, imperfections and the per-pack
 * variation all come from `materialPresets.ts`; this file only maps them onto
 * MeshPhysicalMaterial (three r169: clearcoat, sheen, transmission, dispersion, anisotropy).
 */
import * as THREE from "three";
import { microSurface, ROUGH_BASELINE } from "../surfaceDetail";
import { resolveMaterial, type MaterialRequest, type ResolvedMaterial } from "./materialPresets";

export interface MaterialSurfaceOptions {
  /** Artwork (sRGB), multiplied by the colour. */
  map?: THREE.Texture | null;
  /** Physical size of the surface in mm, for the micro-surface scale (default: from the map). */
  mm?: [number, number];
}

/** Physical size carried by artwork textures (set by the artwork helpers). */
function mmOf(map: THREE.Texture | null | undefined): [number, number] {
  return (map?.userData.mm as [number, number] | undefined) ?? [100, 100];
}

export function createMaterialFromResolved(m: ResolvedMaterial, opts: MaterialSurfaceOptions = {}): THREE.MeshPhysicalMaterial {
  const color = new THREE.Color(m.color).multiplyScalar(m.colorFactor);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    map: opts.map ?? null,
    roughness: m.roughness,
    metalness: m.metalness,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    sheen: m.sheen,
    sheenRoughness: m.sheenRoughness,
    sheenColor: new THREE.Color("#ffffff"),
    specularIntensity: m.specularIntensity,
    transmission: m.transmission,
    thickness: m.thickness,
    ior: m.ior,
    attenuationColor: new THREE.Color(m.attenuationColor),
    attenuationDistance: m.attenuationDistance,
    dispersion: m.dispersion,
    anisotropy: m.anisotropy,
    side: m.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: m.transparentFallback,
    opacity: m.opacity,
  });
  if (m.transparentFallback) mat.depthWrite = false;
  if (m.micro) {
    const [w, h] = opts.mm ?? mmOf(opts.map);
    const s = microSurface(m.micro.kind, w, h, {
      variant: m.variant,
      offset: m.offset,
      roughness: { variation: m.micro.variation, scratches: m.micro.scratches, smudges: m.micro.smudges },
    });
    mat.normalMap = s.normal;
    mat.normalScale = new THREE.Vector2(m.micro.normalScale, m.micro.normalScale);
    mat.roughnessMap = s.roughness;
    // The calibrated map is centred on ROUGH_BASELINE: keep the preset's average roughness.
    mat.roughness = Math.min(1, m.roughness / ROUGH_BASELINE);
  }
  mat.userData.packagingMaterial = m.preset;
  mat.userData.quality = m.quality;
  return mat;
}

/** Resolve + create in one call. */
export function createPackagingMaterial(req: MaterialRequest, opts: MaterialSurfaceOptions = {}): THREE.MeshPhysicalMaterial {
  return createMaterialFromResolved(resolveMaterial(req), opts);
}
