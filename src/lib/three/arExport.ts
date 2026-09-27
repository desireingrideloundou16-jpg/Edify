/** Real-scale AR files of the designed pack: GLB (Android / web) and USDZ (iOS Quick Look). */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";
import { buildPackaging, disposeObject, type PackagingSpec } from "./packagingModels";
import { loadDesignFonts, type PackagingDesign } from "@/lib/artwork/draw";

/** Model at real size in metres (AR viewers use 1 unit = 1 m). */
async function realScaleModel(spec: PackagingSpec, design: PackagingDesign) {
  await loadDesignFonts(design);
  const obj = buildPackaging(spec, design);
  const maxMm = Math.max(spec.lengthMm, spec.widthMm, spec.heightMm);
  obj.scale.multiplyScalar(maxMm / 1000);
  const scene = new THREE.Scene();
  scene.add(obj);
  scene.updateMatrixWorld(true);
  return scene;
}

export async function exportGlb(spec: PackagingSpec, design: PackagingDesign): Promise<Blob> {
  const scene = await realScaleModel(spec, design);
  try {
    const result = await new GLTFExporter().parseAsync(scene, { binary: true });
    return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
  } finally {
    disposeObject(scene);
  }
}

export async function exportUsdz(spec: PackagingSpec, design: PackagingDesign): Promise<Blob> {
  const scene = await realScaleModel(spec, design);
  try {
    const bytes = await new USDZExporter().parseAsync(scene);
    return new Blob([bytes as BlobPart], { type: "model/vnd.usdz+zip" });
  } finally {
    disposeObject(scene);
  }
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
