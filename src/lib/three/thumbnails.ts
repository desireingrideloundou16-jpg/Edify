/**
 * Renders catalog thumbnails with the same procedural models as the live
 * viewer, using a single offscreen WebGL context. Results are cached as data
 * URLs and delivered through a small subscribe API, one shape per frame so the
 * UI never stalls.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildPackaging, disposeObject, neutralDesign } from "./packagingModels";
import { loadDesignFonts, type PackagingDesign } from "@/lib/artwork/draw";
import type { PackagingShape } from "@/components/workspace/Modals";

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
let shadow: THREE.Mesh;
let running = false;

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.38)");
  g.addColorStop(0.55, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

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
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 3, 2.5);
  scene.add(key);

  shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
  return true;
}

function renderOne(shape: PackagingShape) {
  if (!renderer || !shape.model) return;
  const obj = buildPackaging(
    { model: shape.model, lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material },
    current ? current.design : neutralDesign(shape.name, shape.material)
  );
  obj.rotation.y = -0.55;
  scene.add(obj);

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  shadow.scale.set(size.x * 1.7 + 0.1, size.z * 1.7 + 0.25, 1);
  shadow.position.set(center.x, 0.001, center.z);

  const radius = size.length() / 2;
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.98;
  const dir = new THREE.Vector3(0, 0.38, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center);

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
  const { logo, ...rest } = design ?? ({} as PackagingDesign);
  const key = design ? JSON.stringify(rest) + (logo?.src ? `|logo:${logo.src.length}:${logo.src.slice(-32)}` : "") : "neutral";
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
export async function renderShowcase(shape: PackagingShape, design: PackagingDesign, size = 720, yaw = -0.55): Promise<string | null> {
  if (!shape.model || !init() || !renderer) return null;
  await loadDesignFonts(design);
  const obj = buildPackaging(
    { model: shape.model, lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material },
    design
  );
  obj.rotation.y = yaw;
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const dims = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  shadow.scale.set(dims.x * 1.7 + 0.1, dims.z * 1.7 + 0.25, 1);
  shadow.position.set(center.x, 0.001, center.z);
  const radius = dims.length() / 2;
  const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.95;
  camera.position.copy(center).addScaledVector(new THREE.Vector3(0, 0.3, 1).normalize(), dist);
  camera.lookAt(center);
  renderer.setSize(size, size, false);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  renderer.setSize(SIZE, SIZE, false);
  scene.remove(obj);
  disposeObject(obj);
  return url;
}
