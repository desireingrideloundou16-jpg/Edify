/**
 * High-resolution advertising visual: the designed pack staged in a studio
 * scene (podium, arch, props, soft shadows) and composed with ad copy.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildPackaging, disposeObject, type PackagingSpec } from "./packagingModels";
import { fontCss, fontWeight, loadDesignFonts, resolveColors, luminance, type PackagingDesign } from "@/lib/artwork/draw";
import { colorName } from "@/lib/ai/colorNames";

/**
 * Photographic sets for the ad visual, written from the pack itself (its hero ingredient, its
 * colours) like a real campaign: colour-drenched sets, hard sun and palm shadows, ingredients
 * around the product, Cameroonian nature… (see Behance "product advertising" references).
 */
export const AD_DECORS: { id: string; label: string; prompt: (d: PackagingDesign) => string }[] = [
  {
    id: "ingredients",
    label: "Ingrédients en vedette",
    prompt: (d) => {
      const { bg } = resolveColors(d.palette);
      return `table-top scene: ${subjectOf(d)} placed on the left and right of an empty centre spot on a ${colorName(bg)} table, fresh and glistening with droplets, colour-drenched ${colorName(bg)} wall behind, soft directional daylight`;
    },
  },
  {
    id: "sun",
    label: "Soleil et ombres de palmes",
    prompt: (d) => {
      const { bg, accent } = resolveColors(d.palette);
      return `sunlit studio set, ${colorName(mixHex(bg, accent, 0.25))} seamless backdrop and a matching cylindrical plinth in the centre, hard afternoon sunlight casting sharp palm leaf shadows, a few ${subjectOf(d)} at the foot of the plinth`;
    },
  },
  {
    id: "podium",
    label: "Podium aux couleurs de la marque",
    prompt: (d) => {
      const { bg, accent } = resolveColors(d.palette);
      return `minimal premium studio, ${colorName(accent)} backdrop, stacked ${colorName(bg)} and ${colorName(accent)} geometric plinths with an empty top in the centre, soft shadows, clean composition`;
    },
  },
  { id: "nature", label: "Nature camerounaise", prompt: (d) => `flat volcanic stone slab in the foreground of a lush tropical garden, morning light, green bokeh, mist of Mount Cameroon, ${subjectOf(d)} on the stone` },
  { id: "kitchen", label: "Cuisine africaine chic", prompt: () => "modern African kitchen counter in warm wood, woven baskets and wax print fabric blurred in the background, morning sunlight through a window" },
  { id: "luxe", label: "Marbre et lumière dorée", prompt: () => "polished dark marble slab with thin gold veins, deep moody background, warm rim light, luxurious atmosphere" },
  { id: "beach", label: "Plage au coucher du soleil", prompt: () => "smooth sand in the foreground, palm trees blurred in the background, golden hour sunset light, warm tones" },
];

function subjectOf(d: PackagingDesign) {
  return (d.artSubject || `${d.productName} ingredients`).replace(/\.$/, "");
}

/** "1500" → "1 500 FCFA" (a bare number on an ad reads as a mistake). */
export function formatPrice(v?: string) {
  const t = (v ?? "").trim();
  if (!t) return "";
  if (/^\d[\d\s.]*$/.test(t)) return `${Number(t.replace(/[\s.]/g, "")).toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} FCFA`;
  return t;
}

function contrastOk(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05) > 2.2;
}

function mixHex(a: string, b: string, t: number) {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

/** Radial "contact shadow" texture: grounds the pack on any photo. */
function contactShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(0.45, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Average luminance of a region of the rendered frame (to pick the copy colour). */
function regionLuminance(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const data = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4 * 16) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n++;
  }
  return n ? sum / n : 1;
}

/** Photo grade: vignette + fine grain, so the 3D pack and the photo read as one picture. */
function grade(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const v = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.hypot(w, h) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const n = Math.round((w * h) / 90);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.045)";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
  }
}

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
  /** Photographic backdrop (AI-generated): replaces the studio set, the pack keeps its real shadow. */
  backgroundUrl?: string | null;
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
  // Always release the WebGL context, even if the render fails (browsers allow only a few).
  try {
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
    const photo = opts.backgroundUrl ? await new THREE.TextureLoader().loadAsync(opts.backgroundUrl).catch(() => null) : null;
    if (photo) {
      // "cover" crop of the photo to the ad format
      photo.colorSpace = THREE.SRGBColorSpace;
      const img = photo.image as { width: number; height: number };
      const ia = img.width / img.height, va = fmt.w / fmt.h;
      if (ia > va) { photo.repeat.set(va / ia, 1); photo.offset.set((1 - va / ia) / 2, 0); }
      else { photo.repeat.set(1, ia / va); photo.offset.set(0, (1 - ia / va) / 2); }
      sceneObj.background = photo;
    } else {
      sceneObj.background = gradientTexture(...backdrop[scene]);
    }

    // Shadow catcher floor.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: scene === "luxe" ? 0.55 : 0.28 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    sceneObj.add(floor);

    const stage = new THREE.Group();
    sceneObj.add(stage);
    let productY = 0;

    if (scene !== "minimal" && !photo) {
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
    if (!photo && (scene === "pop" || scene === "nature" || scene === "podium")) {
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
    const foot = Math.max(size.x, size.z) * scale;
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(foot * 1.9, foot * 1.9),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: photo ? 0.75 : 0.5 })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = productY + 0.002;
    sceneObj.add(contact);

    // Lights
    const key = new THREE.DirectionalLight(scene === "luxe" || photo ? "#ffe9cf" : "#ffffff", scene === "luxe" ? 2.4 : photo ? 2.6 : 2.2);
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
    target.y = productY + productHeight * (withCopy && aspect <= 1 ? 0.84 : 0.48);
    const dist = (aspect < 1 ? 3.6 : 3.0) + (withCopy && aspect <= 1 ? 1.05 : 0);
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
    if (photo) grade(ctx, fmt.w, fmt.h);

    if (withCopy) {
      const landscape = aspect > 1;
      const cx = landscape ? fmt.w * 0.72 : fmt.w / 2;
      const top = landscape ? fmt.h * 0.3 : fmt.h * 0.07;
      const maxW = landscape ? fmt.w * 0.42 : fmt.w * 0.86;
      // Copy colour from what is really behind it; a soft scrim keeps it readable on photos.
      const zone = landscape ? [fmt.w * 0.5, 0, fmt.w * 0.5, fmt.h] : [0, 0, fmt.w, fmt.h * 0.3];
      const lum = regionLuminance(ctx, zone[0], zone[1], zone[2], zone[3]);
      const darkBg = lum < 0.5;
      if (photo) {
        const sg = landscape ? ctx.createLinearGradient(fmt.w * 0.45, 0, fmt.w, 0) : ctx.createLinearGradient(0, 0, 0, fmt.h * 0.42);
        const tone = darkBg ? "0,0,0" : "255,255,255";
        sg.addColorStop(landscape ? 0 : 1, `rgba(${tone},0)`);
        sg.addColorStop(landscape ? 1 : 0, `rgba(${tone},0.45)`);
        ctx.fillStyle = sg;
        ctx.fillRect(landscape ? fmt.w * 0.45 : 0, 0, landscape ? fmt.w * 0.55 : fmt.w, landscape ? fmt.h : fmt.h * 0.42);
      }
      const textColor = darkBg ? "#ffffff" : luminance(ink) < 0.4 ? ink : "#141414";
      const head = fontCss(design.headingFont);
      const body = fontCss(design.bodyFont);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = textColor;

      // Brand, small and letter-spaced, like a campaign signature.
      const bsz = fmt.w * (landscape ? 0.016 : 0.026);
      ctx.save();
      ctx.letterSpacing = `${bsz * 0.35}px`;
      ctx.font = `${fontWeight(design.bodyFont, 700)} ${bsz}px ${body}`;
      ctx.globalAlpha = 0.9;
      ctx.fillText((design.brandName || "").toUpperCase(), cx, top, maxW);
      ctx.restore();

      // Headline written by the AI designer (2 lines max).
      const headline = design.adHeadline || design.tagline || design.productName || design.brandName;
      let size = fmt.w * (landscape ? 0.05 : 0.085);
      const words = headline.split(/\s+/);
      let lines: string[] = [headline];
      for (;;) {
        ctx.font = `${fontWeight(design.headingFont, 800)} ${size}px ${head}`;
        lines = [];
        let line = "";
        for (const w of words) {
          const t = line ? `${line} ${w}` : w;
          if (ctx.measureText(t).width > maxW && line) {
            lines.push(line);
            line = w;
          } else line = t;
        }
        lines.push(line);
        if ((lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) || size < 14) break;
        size *= 0.92;
      }
      let y = top + bsz * 2.2;
      for (const l of lines) {
        ctx.fillText(l, cx, y);
        y += size * 1.04;
      }
      y += size * 0.3;
      // Product line
      const s2 = fmt.w * (landscape ? 0.02 : 0.032);
      ctx.font = `${fontWeight(design.bodyFont, 400)} ${s2}px ${body}`;
      ctx.globalAlpha = 0.92;
      const sameAsHeadline = (design.productName || "").trim().toLowerCase() === headline.trim().toLowerCase();
      ctx.fillText([sameAsHeadline ? "" : design.productName, design.volume].filter(Boolean).join(" · "), cx, y, maxW);
      ctx.globalAlpha = 1;
      y += s2 * 1.9;
      // CTA pill
      const cta = design.adCta || "Disponible maintenant";
      ctx.font = `${fontWeight(design.bodyFont, 700)} ${s2 * 0.85}px ${body}`;
      const pw = ctx.measureText(cta).width + s2 * 1.9;
      const ph = s2 * 1.75;
      const pill = contrastOk(accent, darkBg ? "#000000" : "#ffffff") ? accent : darkBg ? "#ffffff" : "#141414";
      ctx.fillStyle = pill;
      ctx.beginPath();
      ctx.roundRect(cx - pw / 2, y, pw, ph, ph / 2);
      ctx.fill();
      ctx.fillStyle = resolveColors([pill, "#ffffff", "#111111"]).ink;
      ctx.textBaseline = "middle";
      ctx.fillText(cta, cx, y + ph / 2);

      // Price sticker (bottom right) when the user gave a price.
      const price = formatPrice(design.price);
      if (price) {
        const r = fmt.w * (landscape ? 0.055 : 0.085);
        const px = fmt.w - r * 1.35, py = fmt.h - r * 1.35;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.16);
        ctx.fillStyle = contrastOk(extra, "#ffffff") ? extra : accent;
        ctx.beginPath();
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2, rr = i % 2 ? r : r * 0.9;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = resolveColors([ctx.fillStyle as string, "#ffffff", "#111111"]).ink;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let ps = r * 0.42;
        do {
          ctx.font = `${fontWeight(design.headingFont, 800)} ${ps}px ${head}`;
          if (ctx.measureText(price).width <= r * 1.5) break;
          ps *= 0.9;
        } while (ps > 8);
        ctx.fillText(price, 0, 0);
        ctx.restore();
      }
    }

    return out.toDataURL("image/png");
  } finally {
    disposeObject(sceneObj);
    (sceneObj.background as THREE.Texture | null)?.dispose();
    sceneObj.environment?.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
