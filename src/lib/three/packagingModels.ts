/**
 * Procedural 3D packaging models (plain three.js, no React) shared by the
 * live viewer and the catalog thumbnail renderer.
 *
 * Conventions: millimetres while building, the returned group is scaled so its
 * largest dimension equals 1 unit, sits on y = 0 and faces +z. Cylindrical
 * wraps start at -θ/2 so the centre of every texture (u = 0.5) faces the camera.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ShapeModel } from "@/components/workspace/Modals";

import { createPackagingMaterial, type MaterialSurfaceOptions } from "./materials/materialFactory";
import { finishFromLabel, glassPreset, hashSeed, printedPreset, type MaterialQuality, type MaterialRequest, type PrintSurface } from "./materials/materialPresets";
import { createPouchGeometry } from "./geometry/pouchGeometry";
import { createCartonGeometry } from "./geometry/cartonGeometry";
import { bottleFamily, bottlePreset, bottleSection, createBottleFill, createBottleGeometry, createBottleLabel } from "./geometry/bottleGeometry";
import { closurePreset, createClosureGeometry, type ClosureMaterialSlot, type ClosureResult } from "./geometry/closureLibrary";
import { drawFace, drawWrap, resolveColors, type FaceKind, type PackagingDesign } from "@/lib/artwork/draw";
export type { PackagingDesign } from "@/lib/artwork/draw";
export { resolveColors } from "@/lib/artwork/draw";

export interface PackagingSpec {
  model: ShapeModel;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  material: string;
}

// ─── Artwork → textures ──────────────────────────────────────────────────────

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(16, Math.round(w));
  c.height = Math.max(16, Math.round(h));
  return c;
}

function toTexture(canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Canvas size for a surface of (wMm × hMm), longest side = maxPx. */
function pxFor(wMm: number, hMm: number, maxPx = 1024) {
  const k = maxPx / Math.max(wMm, hMm);
  return [Math.max(64, wMm * k), Math.max(64, hMm * k)] as const;
}

function faceTexture(d: PackagingDesign, wMm: number, hMm: number, kind: FaceKind, maxPx = 1024) {
  const [w, h] = pxFor(wMm, hMm, kind === "front" || kind === "top" || kind === "back" ? maxPx : maxPx / 2);
  const c = newCanvas(w, h);
  drawFace(c.getContext("2d")!, 0, 0, c.width, c.height, d, kind, { grain: true });
  const t = toTexture(c);
  t.userData.mm = [wMm, hMm];
  return t;
}

function wrapTexture(d: PackagingDesign, arcMm: number, hMm: number, frontFraction: number, maxPx = 1536) {
  const [w, h] = pxFor(arcMm, hMm, maxPx);
  const c = newCanvas(w, h);
  drawWrap(c.getContext("2d")!, 0, 0, c.width, c.height, d, frontFraction, { grain: true });
  const t = toTexture(c);
  t.userData.mm = [arcMm, hMm];
  return t;
}

// ─── Materials ───────────────────────────────────────────────────────────────

type Surface = "paper" | "kraft" | "glass" | "plastic" | "clearplastic" | "metal" | "film";

function surfaceFromMaterial(material: string): Surface {
  const m = material.toLowerCase();
  if (m.includes("verre")) return "glass";
  if (m.includes("alu") && !m.includes("kraft") && !m.includes("film")) return "metal";
  if (m.includes("fer blanc")) return "metal";
  if (m.includes("film") || m.includes("métallisé")) return "film";
  if (m.includes("transparent") || /^pet\b/.test(m)) return "clearplastic";
  if (/pehd|pp\b|pe\b|pet/.test(m)) return "plastic";
  if (m.includes("kraft")) return "kraft";
  return "paper";
}

/**
 * Build context, set by buildPackaging (synchronous): render quality and the pack's seed, so
 * every material of a pack gets its own deterministic micro-variation.
 */
const build = { quality: "medium" as MaterialQuality, seed: 0, n: 0 };

/** Label paper thickness (mm): thin enough to hug the container, thick enough for an edge highlight. */
const LABEL_THICKNESS_MM = 0.15;

/** Every material goes through the factory (src/lib/three/materials). */
function mat(req: Omit<MaterialRequest, "quality" | "seed">, opts?: MaterialSurfaceOptions) {
  return createPackagingMaterial({ ...req, quality: build.quality, seed: hashSeed(build.seed, req.preset, build.n++) }, opts);
}

function glassMaterial(material: string) {
  const g = glassPreset(material);
  return mat({ preset: g.preset, tint: g.tint });
}

/** Artwork printed on a surface, with the design's finish (labels get label papers). */
function printed(map: THREE.Texture | null, finishing: string, surface: Surface, color?: string, label = false) {
  return mat({ preset: printedPreset(surface as PrintSurface, finishFromLabel(finishing), label), color: color ?? "#ffffff" }, { map });
}

/** Plain part (cap, seal, lid, accent): plastic or painted metal from the factory, then overrides. */
function solid(color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  const { roughness, metalness, ...rest } = opts;
  const preset = (metalness ?? 0) > 0.5 ? "paintedMetal" : (roughness ?? 0.4) < 0.3 ? "glossyPlastic" : "mattePlastic";
  const m = mat({ preset, color, roughness: roughness ?? 0.4, metalness });
  m.setValues(rest);
  return m;
}

const METAL_SILVER = () => mat({ preset: "aluminum" });

/** Product seen through a glass or clear plastic container (juice, honey, oil…). */
function contentFill(d: PackagingDesign, surface: Surface) {
  const c = d.contentColor;
  if (!c || !/^#[0-9a-f]{6}$/i.test(c) || (surface !== "glass" && surface !== "clearplastic")) return null;
  // Opaque on purpose: three.js shows opaque objects through transmissive glass.
  const liquid = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, sheenColor: new THREE.Color(c) });
  liquid.userData.packagingMaterial = "liquid";
  return liquid;
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], y = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Lathe from [radius, y] pairs, bottom → top. */
function lathe(points: [number, number][], segments = 96) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments, -Math.PI, Math.PI * 2);
}

function wrapCylinder(rTop: number, rBottom: number, h: number, theta = Math.PI * 2, hSeg = 1) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, 96, hSeg, true, -theta / 2, theta);
}

function deformY(geo: THREE.BufferGeometry, h: number, fn: (v: THREE.Vector3, t: number) => void) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v, (v.y + h / 2) / h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Box with per-face artwork. Face order: +x, -x, +y, -y, +z, -z. */
function printedBox(
  L: number, H: number, W: number, d: PackagingDesign, surface: Surface,
  faces: { front: FaceKind; top: FaceKind; side?: FaceKind; back?: FaceKind }, radius?: number
) {
  const r = radius ?? Math.min(L, H, W) * 0.02;
  const geo = new RoundedBoxGeometry(L, H, W, 3, r);
  const fin = d.finishing;
  const mats = [
    printed(faceTexture(d, W, H, faces.side ?? "side"), fin, surface),
    printed(faceTexture(d, W, H, faces.side ?? "side"), fin, surface),
    printed(faceTexture(d, L, W, faces.top), fin, surface),
    printed(faceTexture(d, L, W, "plain"), fin, surface),
    printed(faceTexture(d, L, H, faces.front), fin, surface),
    printed(faceTexture(d, L, H, faces.back ?? "back"), fin, surface),
  ];
  return mesh(geo, mats, H / 2);
}

// ─── Model builders (millimetres) ────────────────────────────────────────────

function buildModel(spec: PackagingSpec, d: PackagingDesign): THREE.Group {
  const g = new THREE.Group();
  const { lengthMm: L, widthMm: W, heightMm: H, material } = spec;
  const surface = surfaceFromMaterial(material);
  const { ink, accent, bg } = resolveColors(d.palette);
  const R = Math.min(L, W) / 2;
  const fin = d.finishing;

  switch (spec.model) {
    case "box":
    case "pillow":
    case "tray":
      g.add(printedBox(L, H, W, d, surface, { front: "front", top: "strip" }, spec.model === "pillow" ? Math.min(L, H, W) * 0.45 : undefined));
      break;

    case "mailer":
      g.add(printedBox(L, H, W, d, surface, { front: "strip", top: "top", side: "plain" }));
      break;

    case "rigid": {
      const baseH = H * 0.78;
      g.add(printedBox(L, baseH, W, d, surface, { front: "plain", top: "plain", side: "plain", back: "plain" }, 1));
      const lid = printedBox(L * 1.015, H * 0.3, W * 1.015, d, surface, { front: "strip", top: "top", side: "plain", back: "plain" }, 1);
      lid.position.y = H - H * 0.15;
      g.add(lid);
      break;
    }

    case "carton": {
      // ── Parametric gable-top carton (Phase 2B-2) ──────────────────────────
      const cartonParts = createCartonGeometry({
        width: L,
        depth: W,
        height: H,
        gableRatio: Math.min(0.22, Math.max(0.13, W / H * 1.1)),
        edgeChamferRatio: 0.035,
        strawPatch: true,
      });

      // Body: full wrap texture covering 4 faces + chamfers
      const bodyWrapArc = (L * 2 + W * 2);
      const bodyTex = wrapTexture(d, bodyWrapArc, H * 0.83, L / bodyWrapArc);
      g.add(mesh(cartonParts.body, printed(bodyTex, fin, surface)));

      // Roof: top face material
      const roofTex = faceTexture(d, L, W, "top");
      g.add(mesh(cartonParts.roof, printed(roofTex, fin, surface)));

      // Ridge (fin seal): plain accent colour
      g.add(mesh(cartonParts.ridge, solid(bg, { roughness: 0.55, clearcoat: 0.2 })));

      // Bottom cap: plain
      g.add(mesh(cartonParts.bottom, solid(bg, { roughness: 0.7, side: THREE.DoubleSide })));
      break;
    }

    case "bag":
    case "shopper": {
      const geo = new THREE.BoxGeometry(L, H, W, 12, 30, 12);
      if (spec.model === "bag") {
        deformY(geo, H, (v, t) => {
          v.z *= 1 - 0.92 * smooth(0.82, 1, t);
          v.x *= 1 + 0.03 * Math.sin(Math.PI * t);
        });
      }
      const mats = [
        printed(faceTexture(d, W, H, "side"), fin, surface),
        printed(faceTexture(d, W, H, "side"), fin, surface),
        printed(faceTexture(d, L, W, "plain"), fin, surface),
        printed(faceTexture(d, L, W, "plain"), fin, surface),
        printed(faceTexture(d, L, H, "front"), fin, surface),
        printed(faceTexture(d, L, H, "back"), fin, surface),
      ];
      g.add(mesh(geo, mats, H / 2));
      if (spec.model === "shopper") {
        const handleMat = solid(ink, { roughness: 0.7 });
        for (const z of [W / 2 - 1, -W / 2 + 1]) {
          const handle = mesh(new THREE.TorusGeometry(L * 0.2, Math.max(1.5, L * 0.012), 12, 48, Math.PI), handleMat, H);
          handle.position.z = z;
          g.add(handle);
        }
      }
      break;
    }

    case "pouch":
    case "flatpouch":
    case "sachet": {
      const isDoypack = spec.model === "pouch";
      const pouchGeo = createPouchGeometry({
        width: L,
        height: H,
        depth: W,
        type: isDoypack ? "doypack" : "flatpouch",
        seed: d.seed ?? 42,
      });
      const wrap = wrapTexture(d, L * 2, H, 0.46);
      const s = surface === "paper" ? "kraft" : surface;
      g.add(mesh(pouchGeo, printed(wrap, fin, s), 0));

      if (isDoypack) {
        // Zip-lock heat seal accent line
        g.add(mesh(new THREE.BoxGeometry(L * 0.96, H * 0.015, 0.6), solid(bg, { roughness: 0.5 }), H * 0.91));
      }
      break;
    }

    case "tube": {
      const geo = wrapCylinder(R, R, H * 0.88, Math.PI * 2, 50);
      deformY(geo, H * 0.88, (v, t) => {
        const f = smooth(0.08, 1, t);
        v.x *= 1 + 0.35 * f;
        v.z *= 1 - 0.95 * f;
      });
      g.add(mesh(geo, printed(wrapTexture(d, 2 * Math.PI * R, H * 0.88, 0.32), fin, "plastic"), H * 0.12 + H * 0.44));
      g.add(mesh(new THREE.BoxGeometry(R * 2.7, H * 0.05, 1.2), solid(bg, { roughness: 0.35 }), H * 0.975));
      g.add(mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.95, H * 0.12, 48), solid(ink, { roughness: 0.3 }), H * 0.06));
      break;
    }

    case "can": {
      const neck = H * 0.08;
      const body = H - neck * 2;
      // Body necked in under the seam; the lid (seam, countersink, panel, rivet, pull tab) closes it.
      const seamH = neck * 0.32;
      g.add(mesh(lathe([[0, 0], [R * 0.75, 0], [R * 0.95, neck * 0.5], [R, neck], [R, H - neck], [R * 0.865, H - seamH]]), METAL_SILVER()));
      const lidMat = METAL_SILVER();
      addClosure(g, createClosureGeometry({ type: "canLid", width: R * 0.88 * 2, height: seamH, seed: 1 }), H, {
        primary: lidMat, secondary: lidMat, metal: lidMat, rubber: lidMat, glass: lidMat,
      });
      const label = mesh(wrapCylinder(R * 1.002, R * 1.002, body, Math.PI * 2), printed(wrapTexture(d, 2 * Math.PI * R, body, 0.3), fin, "metal"), neck + body / 2);
      g.add(label);
      break;
    }

    case "tin":
    case "papertube":
    case "tub":
    case "cup": {
      const tapered = spec.model === "tub" || spec.model === "cup";
      const rTop = spec.model === "cup" ? R : R;
      const rBot = spec.model === "cup" ? R * 0.72 : spec.model === "tub" ? R * 0.86 : R;
      const lidH = spec.model === "cup" ? H * 0.07 : spec.model === "papertube" ? H * 0.24 : H * 0.18;
      const bodyH = spec.model === "papertube" ? H - lidH * 0.8 : H - lidH * 0.6;
      const bodySurface = surface === "clearplastic" ? "plastic" : surface;
      g.add(mesh(wrapCylinder(rTop, rBot, bodyH, Math.PI * 2), printed(wrapTexture(d, 2 * Math.PI * R, bodyH, tapered ? 0.3 : 0.28), fin, bodySurface), bodyH / 2));
      const bottom = new THREE.CircleGeometry(rBot, 64);
      bottom.rotateX(Math.PI / 2);
      g.add(mesh(bottom, solid(bg, { side: THREE.DoubleSide }), 0.1));
      const lidR = spec.model === "cup" ? rTop * 1.04 : rTop * 1.025;
      const lidMat = spec.model === "tin" ? printed(null, fin, "metal", accent) : solid(spec.model === "cup" ? "#f4f4f4" : accent, { roughness: 0.35 });
      g.add(mesh(new THREE.CylinderGeometry(lidR, lidR, lidH, 96), lidMat, H - lidH / 2));
      if (spec.model === "cup") {
        g.add(mesh(new THREE.TorusGeometry(rTop * 1.01, H * 0.012, 12, 96).rotateX(Math.PI / 2), solid("#f4f4f4"), bodyH));
      }
      break;
    }

    case "jar": {
      const lidH = H * 0.2;
      const bodyH = H - lidH * 0.85;
      const bodyMat = surface === "glass" ? glassMaterial(material) : solid(bg, { roughness: 0.3, clearcoat: 0.6 });
      g.add(mesh(lathe([[0, 0], [R * 0.9, 0], [R, R * 0.12], [R, bodyH * 0.92], [R * 0.9, bodyH], [R * 0.88, bodyH + lidH * 0.3], [0, bodyH + lidH * 0.3]]), bodyMat));
      const jarFill = contentFill(d, surface);
      if (jarFill) g.add(mesh(lathe([[0, R * 0.05], [R * 0.86, R * 0.05], [R * 0.93, R * 0.14], [R * 0.93, bodyH * 0.86], [0, bodyH * 0.86]]), jarFill));
      // Physical label on the jar (same builder as the bottles: round section, 0.7 of the wrap).
      const jarLabel = createBottleLabel(bottleSection({ width: R * 2, depth: R * 2, bodyShape: "round" }), {
        yStart: bodyH * 0.48 - bodyH * 0.31, height: bodyH * 0.62, fraction: 0.7, thickness: LABEL_THICKNESS_MM,
      });
      g.add(mesh(jarLabel.geometry, [printed(wrapTexture(d, jarLabel.arcLength, bodyH * 0.62, 0.7), fin, "paper", undefined, true), mat({ preset: "labelEdge" })]));
      // Lid from the closure library: knurled plastic (PEHD) or smooth painted metal, rounded edge.
      const plasticLid = /pehd/i.test(material);
      const lidMat = plasticLid ? mat({ preset: "glossyPlastic", color: "#ffffff" }) : mat({ preset: /fer|alu/i.test(material) ? "paintedMetal" : "glossyPlastic", color: ink });
      addClosure(g, createClosureGeometry({ type: "screwCap", width: R * 1.92, height: lidH, neckWidth: R * 1.76, skirt: 0, ribCount: plasticLid ? 48 : 0 }), H - lidH, {
        primary: lidMat, secondary: lidMat, metal: lidMat, rubber: lidMat, glass: lidMat,
      });
      break;
    }

    case "jug": {
      g.add(printedBox(L, H * 0.88, W, d, surface === "paper" ? "plastic" : surface, { front: "front", top: "plain" }, Math.min(L, W) * 0.22));
      g.add(mesh(new THREE.CylinderGeometry(W * 0.2, W * 0.22, H * 0.12, 48), solid(accent, { roughness: 0.3 }), H * 0.94).translateX(-L * 0.25));
      const handle = mesh(new THREE.TorusGeometry(H * 0.14, W * 0.1, 16, 48, Math.PI), solid(bg, { roughness: 0.3, clearcoat: 0.5 }), H * 0.7);
      handle.position.x = L * 0.22;
      handle.rotation.z = -Math.PI / 2;
      g.add(handle);
      break;
    }

    // ── Bottles: parametric silhouette (section × profile), see geometry/bottleGeometry.ts ──
    default: {
      const m = spec.model;
      const family = bottleFamily(m, L, W, material);
      // Two passes: the closure's height above the neck decides where the bottle stops, so the
      // pack keeps its catalog height; the second pass fits the closure on the final neck finish.
      const closureFor = (b: ReturnType<typeof createBottleGeometry>) =>
        createClosureGeometry(closurePreset(family, H, { width: b.neck.width, finishHeight: b.finish.height, finishScale: b.finish.scale }, b.shoulderStartY));
      const draft = createBottleGeometry(bottlePreset(family, L, W, H * 0.85).config);
      const draftClosure = closureFor(draft);
      const glassH = Math.max(H * 0.5, H - draftClosure.top);
      for (const p of draftClosure.parts) p.geometry.dispose();
      draft.body.dispose();
      draft.bottom.dispose();
      const preset = bottlePreset(family, L, W, glassH);
      const bottle = createBottleGeometry(preset.config);

      const bodyMat = surface === "glass" ? glassMaterial(material)
        : surface === "clearplastic" ? mat({ preset: "pet" })
        : surface === "metal" ? METAL_SILVER()
        : mat({ preset: /pehd|hdpe/i.test(material) ? "hdpe" : "glossyPlastic", color: bg });
      g.add(mesh(bottle.body, bodyMat));
      g.add(mesh(bottle.bottom, bodyMat));

      // Liquid seen through glass / clear plastic: same section, up to the shoulder.
      const bottleFill = contentFill(d, surface);
      if (bottleFill) g.add(mesh(createBottleFill(bottle, bottle.shoulderStartY * 0.98), bottleFill));

      // Label on the real section (ellipse, rounded rectangle…), same wrap texture as before.
      const straight = bottle.shoulderStartY - bottle.bodyBottomY;
      const labelY = bottle.bodyBottomY + straight * preset.label.from;
      const labelH = straight * (preset.label.to - preset.label.from);
      // Physical label: 0.15 mm paper shell, printed face + white paper core on the edges and back.
      const label = createBottleLabel(bottle.section, { yStart: labelY, height: labelH, fraction: preset.label.fraction, thickness: LABEL_THICKNESS_MM });
      g.add(mesh(label.geometry, [printed(wrapTexture(d, label.arcLength, labelH, 0.5), fin, surface === "metal" ? "metal" : "paper", undefined, true), mat({ preset: "labelEdge" })]));

      // Closure from the library, one material per part slot (existing materials).
      const isWine = family === "wine";
      const closure = closureFor(bottle);
      addClosure(g, closure, bottle.neckTopY, {
        primary: mat({ preset: "glossyPlastic", color: ink }),
        secondary: mat({ preset: "mattePlastic", color: "#1f1f22" }),
        metal: isWine ? mat({ preset: "foil", color: accent }) : METAL_SILVER(),
        rubber: mat({ preset: "rubber", color: ink }),
        glass: mat({ preset: "glass" }),
      });
      break;
    }
  }
  return g;
}

/** Adds every part of a closure at height `y`, each with the material of its slot. */
function addClosure(g: THREE.Group, closure: ClosureResult, y: number, mats: Record<ClosureMaterialSlot, THREE.Material>) {
  for (const part of closure.parts) {
    const m = mesh(part.geometry, mats[part.material], y);
    m.name = part.name;
    g.add(m);
  }
}

/** Build the model, normalised to a 1-unit largest dimension, standing on y = 0. */
export function buildPackaging(spec: PackagingSpec, design: PackagingDesign, opts: { quality?: MaterialQuality } = {}): THREE.Group {
  build.quality = opts.quality ?? "medium";
  build.seed = hashSeed(design.brandName, design.productName, spec.model, spec.material);
  build.n = 0;
  const inner = buildModel(spec, design);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z);
  inner.position.set(-(box.min.x + size.x / 2), -box.min.y, -(box.min.z + size.z / 2));
  const outer = new THREE.Group();
  outer.add(inner);
  outer.scale.setScalar(k);
  return outer;
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      std.map?.dispose();
      std.normalMap?.dispose();
      std.roughnessMap?.dispose();
      mat.dispose();
    }
  });
}

/** Neutral "white mockup" artwork used for catalog thumbnails. */
export function neutralDesign(name: string, material: string): PackagingDesign {
  const kraft = /kraft/i.test(material);
  return {
    brandName: "MOCKUP",
    productName: name,
    volume: "",
    palette: kraft ? ["#c9a57b", "#3a2a1a", "#3a2a1a", "#b38d5f"] : ["#fbfbfa", "#1f2937", "#9ca3af", "#e5e7eb"],
    headingFont: "Outfit",
    bodyFont: "Outfit",
    finishing: "Offset mat",
  };
}
