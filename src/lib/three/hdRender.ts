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
 */
import * as THREE from "three";
import { buildPackaging, disposeObject, type PackagingDesign, type PackagingSpec } from "./packagingModels";
import { chooseQuality, frameShot, resolveCamera, resolveLighting, type CameraPresetId, type LightingPresetId } from "./scenePresets";
import { detectGraphicsCaps } from "./capabilities";
import { StudioRig } from "./studioRig";

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

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const rig = new StudioRig(renderer, lighting, quality);
  rig.attach(scene, renderer);
  const bg = opts.background ?? "transparent";
  if (bg !== "transparent") scene.background = new THREE.Color(bg === "preset" ? lighting.background : bg);

  const object = buildPackaging(opts.spec, opts.design, { quality: quality.materialQuality });
  object.rotation.y = opts.yaw ?? 0;
  scene.add(object);
  rig.fit(renderer, scene, object);

  const box = new THREE.Box3().setFromObject(object);
  const f = frameShot({ min: box.min.toArray(), max: box.max.toArray() }, shot, w / h);
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

  const rt = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
  const frame = rt();
  let accA = rt();
  let accB = rt();
  const quadCam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const blend = new THREE.ShaderMaterial({
    uniforms: { tPrev: { value: null }, tFrame: { value: null }, weight: { value: 1 } },
    vertexShader: QUAD_VERT,
    fragmentShader: "uniform sampler2D tPrev, tFrame; uniform float weight; varying vec2 vUv; void main() { gl_FragColor = mix(texture2D(tPrev, vUv), texture2D(tFrame, vUv), weight); }",
    depthTest: false,
    toneMapped: false,
  });
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

  try {
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
    rig.detach(scene);
    rig.dispose();
    disposeObject(object);
    for (const t of [frame, accA, accB]) t.dispose();
    quad.geometry.dispose();
    blend.dispose();
    output.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
