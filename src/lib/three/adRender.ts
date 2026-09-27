/**
 * High-resolution advertising visual: the designed pack staged in a studio
 * scene (podium, arch, props, soft shadows) and composed with ad copy.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildPackaging, disposeObject, type PackagingSpec } from "./packagingModels";
import { fontCss, fontWeight, loadDesignFonts, resolveColors, luminance, type PackagingDesign } from "@/lib/artwork/draw";

export type AdScene = "podium" | "luxe" | "nature" | "minimal" | "pop";
export type AdFormat = "square" | "portrait" | "story" | "landscape";

export const AD_SCENES: { id: AdScene; label: string }[] = [
  { id: "podium", label: "Podium studio" },
  { id: "luxe", label: "Luxe sombre" },
  { id: "nature", label: "Nature douce" },
  { id: "minimal", label: "Minimal" },
  { id: "pop", label: "Pop coloré" },
];

export const AD_FORMATS: { id: AdFormat; label: string; w: number; h: number }[] = [
  { id: "portrait", label: "Instagram 4:5", w: 1638, h: 2048 },
  { id: "square", label: "Carré 1:1", w: 2048, h: 2048 },
  { id: "story", label: "Story 9:16", w: 1152, h: 2048 },
  { id: "landscape", label: "Bannière 16:9", w: 2048, h: 1152 },
];

function mix(a: string, b: string, t: number) {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

function gradientTexture(top: string, bottom: string) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stoneTexture(base: string, vein: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  ctx.strokeStyle = vein;
  for (let v = 0; v < 6; v++) {
    ctx.globalAlpha = 0.18 + Math.random() * 0.2;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    let x = Math.random() * 512, y = 0;
    ctx.moveTo(x, y);
    while (y < 512) {
      x += (Math.random() - 0.5) * 40;
      y += 18 + Math.random() * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function archShape(w: number, h: number) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.closePath();
  return s;
}

export interface AdOptions {
  spec: PackagingSpec;
  design: PackagingDesign;
  scene: AdScene;
  format: AdFormat;
  withCopy: boolean;
  /** Variation seed: changes angle and props. */
  seed: number;
  /** Output scale (1 = full HD format size). */
  scale?: number;
}

export async function renderAd(opts: AdOptions): Promise<string> {
  const { spec, design, scene, format, withCopy, seed } = opts;
  await loadDesignFonts(design);
  const base = AD_FORMATS.find((f) => f.id === format) ?? AD_FORMATS[0];
  const k = opts.scale ?? 1;
  const fmt = { ...base, w: Math.round(base.w * k), h: Math.round(base.h * k) };
  const { bg, ink, accent, extra } = resolveColors(design.palette);
  const rand = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297) * 233280;
    return x - Math.floor(x);
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(fmt.w, fmt.h, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = scene === "luxe" ? 1.0 : 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const sceneObj = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  sceneObj.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  sceneObj.environmentIntensity = scene === "luxe" ? 0.55 : 1;

  // Backdrop colours derived from the pack palette.
  const lightBg = luminance(bg) > 0.35 ? bg : mix(bg, "#ffffff", 0.75);
  const backdrop: Record<AdScene, [string, string]> = {
    podium: [mix(lightBg, "#ffffff", 0.35), mix(lightBg, extra, 0.35)],
    luxe: ["#2a2622", "#0c0b0a"],
    nature: ["#eef1e8", "#c9d6bf"],
    minimal: ["#fbfbfa", "#e9e9e6"],
    pop: [mix(accent, "#ffffff", 0.45), accent],
  };
  sceneObj.background = gradientTexture(...backdrop[scene]);

  // Shadow catcher floor.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: scene === "luxe" ? 0.55 : 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  sceneObj.add(floor);

  const stage = new THREE.Group();
  sceneObj.add(stage);
  let productY = 0;

  if (scene !== "minimal") {
    const podMat =
      scene === "luxe" ? new THREE.MeshPhysicalMaterial({ color: "#141414", roughness: 0.25, metalness: 0.2, clearcoat: 1 })
      : scene === "pop" ? new THREE.MeshStandardMaterial({ color: mix(extra, "#ffffff", 0.2), roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ map: stoneTexture(scene === "nature" ? "#e8e2d4" : "#eeebe6", scene === "nature" ? "#a89f8a" : "#9a948c"), roughness: 0.7 });
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 96), podMat);
    podium.position.y = 0.08;
    podium.castShadow = podium.receiveShadow = true;
    stage.add(podium);
    productY = 0.16;
    if (scene === "podium" || scene === "nature") {
      const step = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 72), podMat);
      step.position.set(0.72, 0.045, 0.25);
      step.castShadow = step.receiveShadow = true;
      stage.add(step);
    }
    // Arch backdrop
    const arch = new THREE.Mesh(
      new THREE.ExtrudeGeometry(archShape(1.5, 2.1), { depth: 0.06, bevelEnabled: false, curveSegments: 48 }),
      new THREE.MeshStandardMaterial({ color: scene === "luxe" ? "#3a3129" : mix(backdrop[scene][1], accent, scene === "pop" ? 0.1 : 0.18), roughness: 0.9 })
    );
    arch.position.set(-0.15, 0, -0.95);
    arch.receiveShadow = true;
    stage.add(arch);
  }

  // Decorative spheres in the brand colours.
  if (scene === "pop" || scene === "nature" || scene === "podium") {
    const colors = scene === "nature" ? ["#9fb08f", "#d8cdb4"] : [accent, extra];
    for (let i = 0; i < 2; i++) {
      const r = 0.07 + rand(i) * 0.06;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshPhysicalMaterial({ color: colors[i], roughness: 0.35, clearcoat: 0.6 }));
      s.position.set(i === 0 ? -0.7 - rand(i + 3) * 0.2 : 0.62, r, 0.35 + rand(i + 5) * 0.2);
      s.castShadow = true;
      stage.add(s);
    }
  }

  // Product
  const product = buildPackaging(spec, design);
  product.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  const size = new THREE.Box3().setFromObject(product).getSize(new THREE.Vector3());
  const scale = 1 / Math.max(size.y, size.x * 0.9);
  product.scale.multiplyScalar(scale);
  product.position.y = productY;
  product.rotation.y = -0.35 + (rand(7) - 0.5) * 0.5;
  sceneObj.add(product);

  // Lights
  const key = new THREE.DirectionalLight(scene === "luxe" ? "#ffe2bf" : "#ffffff", scene === "luxe" ? 2.4 : 2.2);
  key.position.set(-2.2 + rand(9), 3.2, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 14;
  key.shadow.blurSamples = 24;
  key.shadow.bias = -0.0004;
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -2.5;
  sc.right = sc.top = 2.5;
  sceneObj.add(key);
  const rim = new THREE.DirectionalLight(scene === "luxe" ? "#ffcf8a" : "#ffffff", scene === "luxe" ? 2.2 : 0.9);
  rim.position.set(2.5, 2, -2.5);
  sceneObj.add(rim);
  sceneObj.add(new THREE.HemisphereLight("#ffffff", scene === "luxe" ? "#1a1612" : "#d8d4cc", scene === "luxe" ? 0.25 : 0.6));

  // Camera framing: product slightly lower when copy sits on top.
  const aspect = fmt.w / fmt.h;
  const camera = new THREE.PerspectiveCamera(aspect < 1 ? 32 : 26, aspect, 0.01, 100);
  const target = new THREE.Vector3(0, productY + 0.5 * (withCopy && aspect <= 1 ? 0.78 : 0.62), 0);
  const productHeight = size.y * scale;
  target.y = productY + productHeight * (withCopy && aspect <= 1 ? 0.62 : 0.48);
  const dist = (aspect < 1 ? 3.6 : 3.0) + (withCopy && aspect <= 1 ? 0.6 : 0);
  const yaw = 0.18 + (rand(11) - 0.5) * 0.25;
  camera.position.set(Math.sin(yaw) * dist, target.y + 0.35, Math.cos(yaw) * dist);
  camera.lookAt(target);
  if (aspect > 1) camera.position.x += withCopy ? -0.55 : 0;

  renderer.render(sceneObj, camera);

  // Compose with ad copy.
  const out = document.createElement("canvas");
  out.width = fmt.w;
  out.height = fmt.h;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(renderer.domElement, 0, 0);

  if (withCopy) {
    const darkBg = scene === "luxe" || luminance(backdrop[scene][0]) < 0.3;
    const textColor = darkBg ? "#ffffff" : ink;
    const head = fontCss(design.headingFont);
    const body = fontCss(design.bodyFont);
    const landscape = aspect > 1;
    const cx = landscape ? fmt.w * 0.72 : fmt.w / 2;
    const top = landscape ? fmt.h * 0.36 : fmt.h * 0.085;
    const maxW = landscape ? fmt.w * 0.42 : fmt.w * 0.84;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = textColor;
    let size = fmt.w * (landscape ? 0.055 : 0.09);
    const brand = design.brandName || "";
    do {
      ctx.font = `${fontWeight(design.headingFont, 800)} ${size}px ${head}`;
      if (ctx.measureText(brand).width <= maxW) break;
      size *= 0.92;
    } while (size > 12);
    ctx.fillText(brand, cx, top);
    let y = top + size * 1.15;
    ctx.globalAlpha = 0.92;
    const sub = design.tagline || design.productName;
    let s2 = fmt.w * (landscape ? 0.022 : 0.036);
    do {
      ctx.font = `${fontWeight(design.bodyFont, 400)} ${s2}px ${body}`;
      if (ctx.measureText(sub).width <= maxW) break;
      s2 *= 0.92;
    } while (s2 > 10);
    ctx.fillText(sub, cx, y);
    ctx.globalAlpha = 1;
    y += s2 * 1.9;
    // CTA pill
    const cta = design.productName && sub !== design.productName ? design.productName : "Disponible maintenant";
    ctx.font = `${fontWeight(design.bodyFont, 700)} ${s2 * 0.8}px ${body}`;
    const pw = ctx.measureText(cta).width + s2 * 1.8;
    const ph = s2 * 1.7;
    ctx.fillStyle = darkBg ? accent : ink;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, y, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = resolveColors([darkBg ? accent : ink]).ink;
    ctx.textBaseline = "middle";
    ctx.fillText(cta, cx, y + ph / 2);
  }

  const url = out.toDataURL("image/png");
  disposeObject(sceneObj);
  (sceneObj.background as THREE.Texture | null)?.dispose();
  sceneObj.environment?.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return url;
}
