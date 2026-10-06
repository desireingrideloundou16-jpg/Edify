/**
 * HD tier (phase 2A): a still image computed on the user's GPU, far more expensive than the
 * interactive preview and never run while editing.
 *
 * Progressive accumulation of N rasterised frames, each slightly different:
 *   - sub-pixel camera jitter        → clean anti-aliasing on text and edges
 *   - key light moved across its size → physically soft shadows (penumbra)
 *   - lens offset around the focus    → depth of field on hero / close-up shots
 * Same studio rig, presets and framing as the preview, so HD is the preview, only cleaner.
 * WebGL2 or WebGL1; returns null when the device has no WebGL (caller keeps the preview).
 *
 * Phase 3D-C (export): its own renderer and WebGL context, never the live viewer's; the design's fonts
 * are loaded first (the artwork is drawn with them); every GPU resource is released even when a step
 * fails (try / finally around the whole setup), so repeated exports leave no context behind.
 */
import * as THREE from "three";
import { buildPackaging, disposeObject, type PackagingDesign, type PackagingSpec } from "./packagingModels";
import { chooseQuality, frameShot, resolveCamera, resolveLighting, shotDirection, type CameraPresetId, type LightingPresetId, type StudioLightingConfig } from "./scenePresets";
import { detectGraphicsCaps } from "./capabilities";
import { StudioRig } from "./studioRig";
import { loadDesignFonts } from "@/lib/artwork/draw";

export interface HdRenderOptions {
  spec: PackagingSpec;
  design: PackagingDesign;
  camera?: CameraPresetId;
  lighting?: LightingPresetId;
  width?: number;
  height?: number;
  /** Accumulated frames (default: the device's HD quality). */
  samples?: number;
  /** "transparent", "preset" (the lighting preset's backdrop) or a CSS colour. */
  background?: string;
  /** Turns the pack (radians) without moving the studio. */
  yaw?: number;
  /**
   * What the shot must contain: "pack" (default, the preset framing) or "packAndShadow" (phase 3D-C
   * export: the cast shadow too, so a transparent PNG never ends on a shadow cut by the frame; the pack stays
   * the aim, in the centre, and the shadow only pushes the camera back as far as it needs).
   */
  frame?: "pack" | "packAndShadow";
  /**
   * With "packAndShadow" (phase 3D-D): room given to the shadow beyond the pack's footprint, as a fraction of
   * the pack's largest side. A longer shadow fades out within that room (StudioRig.setShadowFalloff) instead of
   * shrinking the product. Default: the whole shadow (3D-C).
   */
  shadowAllowance?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Low-discrepancy sequence: evenly spread samples, no clumping. */
export function halton(index: number, base: number): number {
  let f = 1, r = 0, i = index + 1;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

/** Point in the unit disc from two [0, 1) numbers (concentric mapping). */
function disc(u: number, v: number): [number, number] {
  const a = 2 * u - 1, b = 2 * v - 1;
  if (a === 0 && b === 0) return [0, 0];
  const [r, t] = Math.abs(a) > Math.abs(b) ? [a, (Math.PI / 4) * (b / a)] : [b, Math.PI / 2 - (Math.PI / 4) * (a / b)];
  return [r * Math.cos(t), r * Math.sin(t)];
}

/**
 * How far the pack's cast shadow reaches on the floor, measured from the pack's centre (framing only: the
 * light is unchanged). Its far end is the top of the pack's box projected along the key light, plus a soft
 * penumbra (6 % of the footprint). `allowance` (phase 3D-D) caps how far beyond the pack's own footprint the
 * shot gives the shadow room, as a fraction of the pack's largest side: the product decides the framing,
 * the shadow gets a controlled share of it. Infinity (default) = the whole shadow (3D-C behaviour).
 */
export function shadowReach(box: THREE.Box3, lighting: StudioLightingConfig, allowance = Infinity) {
  const [lx, ly, lz] = shotDirection(lighting.key.azimuth, lighting.key.elevation);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const footprint = Math.hypot(size.x, size.z) / 2;
  const t = (box.max.y - box.min.y) / Math.max(0.05, ly);
  const pad = 0.06 * Math.max(size.x, size.z);
  const eps = 1e-6;
  const tips: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
    const tip = new THREE.Vector3(x - lx * t, box.min.y, z - lz * t);
    // a shadow that stays under the pack (light from above) needs no room
    if (tip.x >= box.min.x - eps && tip.x <= box.max.x + eps && tip.z >= box.min.z - eps && tip.z <= box.max.z + eps) continue;
    tips.push(tip);
  }
  const natural = tips.reduce((m, p) => Math.max(m, Math.hypot(p.x - centre.x, p.z - centre.z) + pad), 0);
  const limit = footprint + allowance * Math.max(size.x, size.y, size.z);
  const end = Math.min(natural, limit);
  return { centre, footprint, tips, natural, end, clamped: tips.length > 0 && natural > limit };
}

/**
 * Points of the floor the export must keep in frame so its shadow is never cut: the shadow's far end in each
 * direction it goes, capped by the allowance (see shadowReach). Handed to frameShot as extra points: the aim
 * stays on the pack (centred), only the camera distance grows, and only as much as these points need.
 */
export function shadowFramePoints(box: THREE.Box3, lighting: StudioLightingConfig, allowance = Infinity): [number, number, number][] {
  const { centre, tips, end } = shadowReach(box, lighting, allowance);
  const points: [number, number, number][] = [];
  for (const raw of tips) {
    const dir = raw.clone().sub(centre).setY(0);
    if (dir.lengthSq() === 0) continue;
    const p = new THREE.Vector3(centre.x, box.min.y, centre.z).addScaledVector(dir.normalize(), end);
    points.push([p.x, p.y, p.z]);
  }
  return points;
}

const QUAD_VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

export async function renderHD(opts: HdRenderOptions): Promise<string | null> {
  const quality = chooseQuality("hd", detectGraphicsCaps());
  if (!quality) return null;
  const scale = Math.min(1, quality.maxSize / Math.max(opts.width ?? 2048, opts.height ?? 2048));
  const w = Math.round((opts.width ?? 2048) * scale);
  const h = Math.round((opts.height ?? 2048) * scale);
  const samples = Math.max(1, opts.samples ?? quality.samples);
  const lighting = resolveLighting(opts.lighting);
  const shot = resolveCamera(opts.camera ?? "hero");

  // The artwork textures are drawn with the design's fonts: they must be ready first.
  await loadDesignFonts(opts.design);
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  // Everything created below is released in `finally`, whatever fails.
  const scene = new THREE.Scene();
  let rig: StudioRig | null = null;
  let object: THREE.Object3D | null = null;
  const targets: THREE.WebGLRenderTarget[] = [];
  const disposables: { dispose(): void }[] = [];
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    rig = new StudioRig(renderer, lighting, quality);
    rig.attach(scene, renderer);
    const bg = opts.background ?? "transparent";
    if (bg !== "transparent") scene.background = new THREE.Color(bg === "preset" ? lighting.background : bg);

    object = buildPackaging(opts.spec, opts.design, { quality: quality.materialQuality });
    object.rotation.y = opts.yaw ?? 0;
    scene.add(object);
    rig.fit(renderer, scene, object);
    const box = new THREE.Box3().setFromObject(object);
    const allowance = opts.shadowAllowance ?? Infinity;
    const shadowPoints = opts.frame === "packAndShadow" ? shadowFramePoints(box, lighting, allowance) : [];
    if (opts.frame === "packAndShadow") {
      // A shadow longer than its room fades out over the outer part of it: never cut, never dominant.
      const reach = shadowReach(box, lighting, allowance);
      if (reach.clamped) rig.setShadowFalloff(reach.footprint + 0.35 * (reach.end - reach.footprint), reach.end);
    }
    const f = frameShot({ min: box.min.toArray(), max: box.max.toArray() }, shot, w / h, shadowPoints);
    const camera = new THREE.PerspectiveCamera(f.fov, w / h, f.near, f.far);
    const eye = new THREE.Vector3(...f.position);
    const target = new THREE.Vector3(...f.target);
    camera.position.copy(eye);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const forward = target.clone().sub(eye).normalize();
    // Depth of field focuses on the front of the pack (its nearest face to the lens), not its
    // axis: the label is sharp, the far side and the background fall off.
    const nearest = Math.min(...[box.min.x, box.max.x].flatMap((x) => [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) =>
      new THREE.Vector3(x, y, z).sub(eye).dot(forward)))));
    const focusDist = Math.max(f.near * 2, (nearest + target.clone().sub(eye).dot(forward)) / 2);
    const focalPx = h / (2 * Math.tan(THREE.MathUtils.degToRad(f.fov) / 2));

    const rt = () => {
      const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
      targets.push(t);
      return t;
    };
    const frame = rt();
    let accA = rt();
    let accB = rt();
    const quadCam = new THREE.Camera();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    disposables.push(quad.geometry);
    const blend = new THREE.ShaderMaterial({
      uniforms: { tPrev: { value: null }, tFrame: { value: null }, weight: { value: 1 } },
      vertexShader: QUAD_VERT,
      fragmentShader: "uniform sampler2D tPrev, tFrame; uniform float weight; varying vec2 vUv; void main() { gl_FragColor = mix(texture2D(tPrev, vUv), texture2D(tFrame, vUv), weight); }",
      depthTest: false,
      toneMapped: false,
    });
    disposables.push(blend);
    const output = new THREE.ShaderMaterial({
      uniforms: { tAccum: { value: null } },
      vertexShader: QUAD_VERT,
      // Tone mapping and sRGB output happen once, on the averaged linear image.
      fragmentShader: [
        "uniform sampler2D tAccum;",
        "varying vec2 vUv;",
        "void main() {",
        "  gl_FragColor = texture2D(tAccum, vUv);",
        "  #include <tonemapping_fragment>",
        "  #include <colorspace_fragment>",
        "}",
      ].join("\n"),
      depthTest: false,
    });
    disposables.push(output);

    for (let i = 0; i < samples; i++) {
      let sx = 0, sy = 0;
      if (shot.aperture > 0) {
        // Thin lens: move the eye across the aperture without turning the camera, and shear the
        // frustum so the focus plane stays still on screen (off-axis projection).
        const [lx, ly] = disc(halton(i, 5), halton(i, 7));
        const a = shot.aperture * f.distance;
        camera.position.copy(eye).addScaledVector(right, lx * a).addScaledVector(up, ly * a);
        sx = (-lx * a * focalPx) / focusDist;
        sy = (ly * a * focalPx) / focusDist;
      }
      camera.setViewOffset(w, h, halton(i, 2) - 0.5 + sx, halton(i, 3) - 0.5 + sy, w, h);
      const [kx, ky] = disc(halton(i, 11), halton(i, 13));
      rig.jitterKey(kx, ky);

      renderer.setRenderTarget(frame);
      renderer.clear();
      renderer.render(scene, camera);

      quad.material = blend;
      blend.uniforms.tPrev.value = accA.texture;
      blend.uniforms.tFrame.value = frame.texture;
      blend.uniforms.weight.value = 1 / (i + 1);
      renderer.setRenderTarget(accB);
      renderer.render(quad, quadCam);
      [accA, accB] = [accB, accA];

      if (i % 4 === 3) {
        opts.onProgress?.(i + 1, samples);
        await new Promise((ok) => requestAnimationFrame(ok));
      }
    }
    quad.material = output;
    output.uniforms.tAccum.value = accA.texture;
    renderer.setRenderTarget(null);
    renderer.render(quad, quadCam);
    opts.onProgress?.(samples, samples);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    if (rig) {
      rig.detach(scene);
      rig.dispose();
    }
    if (object) disposeObject(object);
    for (const t of targets) t.dispose();
    for (const d of disposables) d.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
