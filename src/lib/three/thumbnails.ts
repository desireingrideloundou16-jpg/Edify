/**
 * Renders catalog thumbnails with the same procedural models as the live
 * viewer, using a single offscreen WebGL context. Results are cached as data
 * URLs and delivered through a small subscribe API, one shape per frame so the
 * UI never stalls.
 */
import * as THREE from "three";
import { buildPackaging, disposeObject, neutralDesign } from "./packagingModels";
import { CAMERA_PRESETS, frameShot, resolveCamera, resolveLighting, type CameraPresetId, type CameraShotConfig, type LightingPresetId } from "./scenePresets";
import { StudioRig } from "./studioRig";
import { loadDesignFonts, type PackagingDesign } from "@/lib/artwork/draw";
import type { PackagingShape } from "@/components/workspace/Modals";
import { designIdentityKey } from "./designKey";

const SIZE = 320;
const cache = new Map<string, string>();
const listeners = new Map<string, Set<(url: string) => void>>();
const shapes = new Map<string, PackagingShape>();
/** Design shown on catalog thumbnails: the user's current pack, or the neutral mockup. */
let current: { design: PackagingDesign; key: string } | null = null;
const cacheKey = (shapeId: string) => `${shapeId}|${current?.key ?? "neutral"}`;
const queue: PackagingShape[] = [];
const queued = new Set<string>();

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let rig: StudioRig;
let running = false;

function init() {
  if (renderer) return true;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  rig = new StudioRig(renderer, resolveLighting("premium"), { shadowMapSize: 1024 });
  rig.attach(scene, renderer);

  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  return true;
}

/** Studio lighting preset for the next renders (catalog and showcase share one rig). */
function applyLighting(id: LightingPresetId) {
  if (rig.config.id === id) return;
  rig.detach(scene);
  rig.dispose();
  rig = new StudioRig(renderer!, resolveLighting(id), { shadowMapSize: 1024 });
  rig.attach(scene, renderer!);
}

/** Adds the pack to the scene, lights and frames it (automatic composition). */
function stage(obj: THREE.Object3D, shot: CameraShotConfig, aspect = 1) {
  scene.add(obj);
  rig.fit(renderer!, scene, obj);
  const box = new THREE.Box3().setFromObject(obj);
  const f = frameShot({ min: box.min.toArray(), max: box.max.toArray() }, shot, aspect);
  camera.fov = f.fov;
  camera.aspect = aspect;
  camera.near = f.near;
  camera.far = f.far;
  camera.position.set(...f.position);
  camera.lookAt(...f.target);
  camera.updateProjectionMatrix();
}

function renderOne(shape: PackagingShape) {
  if (!renderer || !shape.model) return;
  const obj = buildPackaging(
    { model: shape.model, lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material },
    current ? current.design : neutralDesign(shape.name, shape.material)
  );
  applyLighting("premium");
  stage(obj, CAMERA_PRESETS.catalog);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/webp", 0.9);
  scene.remove(obj);
  disposeObject(obj);

  cache.set(cacheKey(shape.id), url);
  // Keep memory bounded: the oldest designs are dropped first.
  if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  listeners.get(shape.id)?.forEach((fn) => fn(url));
}

function pump() {
  if (running) return;
  running = true;
  const step = () => {
    const next = queue.shift();
    if (!next) {
      running = false;
      return;
    }
    queued.delete(next.id);
    if (!cache.has(cacheKey(next.id))) renderOne(next);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Subscribe to a shape's thumbnail; calls back immediately when cached. */
export function requestThumbnail(shape: PackagingShape, onReady: (url: string) => void): () => void {
  shapes.set(shape.id, shape);
  let set = listeners.get(shape.id);
  if (!set) listeners.set(shape.id, (set = new Set()));
  set.add(onReady);
  const hit = cache.get(cacheKey(shape.id));
  if (hit) {
    onReady(hit);
    return () => set!.delete(onReady);
  }
  if (!init()) return () => set!.delete(onReady);
  if (!queued.has(shape.id)) {
    queued.add(shape.id);
    queue.push(shape);
  }
  pump();
  return () => set!.delete(onReady);
}

/**
 * Show the user's own design on every catalog thumbnail (null = neutral mockups).
 * Every mounted card is redrawn, the selected container first.
 */
export async function setThumbnailDesign(design: PackagingDesign | null, priorityShapeId?: string) {
  // Identity of the logo AND of the illustration by their source (phase 3C): a new image, a new key.
  const key = design ? designIdentityKey(design) : "neutral";
  if ((current?.key ?? "neutral") === key) return;
  if (design) await loadDesignFonts(design);
  current = design ? { design, key } : null;
  const ids = [...listeners.entries()].filter(([, set]) => set.size).map(([id]) => id);
  if (priorityShapeId) ids.sort((a, b) => (a === priorityShapeId ? -1 : b === priorityShapeId ? 1 : 0));
  queue.length = 0;
  queued.clear();
  for (const id of ids) {
    const hit = cache.get(cacheKey(id));
    if (hit) {
      listeners.get(id)?.forEach((fn) => fn(hit));
      continue;
    }
    const shape = shapes.get(id);
    if (shape) {
      queued.add(id);
      queue.push(shape);
    }
  }
  if (init()) pump();
}

/**
 * Render a designed pack (marketing showcase) with the shared renderer.
 * Transparent PNG so it can float over any background.
 */
export async function renderShowcase(
  shape: PackagingShape,
  design: PackagingDesign,
  size = 720,
  yaw = -0.55,
  opts: { camera?: CameraPresetId; lighting?: LightingPresetId } = {}
): Promise<string | null> {
  if (!shape.model || !init() || !renderer) return null;
  await loadDesignFonts(design);
  const obj = buildPackaging(
    { model: shape.model, lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material },
    design
  );
  // The pack turns (turntables, landing), the camera keeps the preset's height and lens.
  obj.rotation.y = yaw;
  applyLighting(opts.lighting ?? "premium");
  stage(obj, opts.camera ? resolveCamera(opts.camera) : { ...CAMERA_PRESETS.catalog, azimuth: 0 });
  renderer.setSize(size, size, false);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  renderer.setSize(SIZE, SIZE, false);
  scene.remove(obj);
  disposeObject(obj);
  return url;
}
