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

import { microSurface, type MicroKind } from "./surfaceDetail";
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

function glassMaterial(material: string) {
  const m = material.toLowerCase();
  const tint = m.includes("ambré") ? "#b8691f" : m.includes("teinté") ? "#2f4f2a" : "#ffffff";
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    transmission: 1,
    roughness: m.includes("dépoli") ? 0.42 : 0.06,
    thickness: 0.6,
    ior: 1.5,
    attenuationColor: new THREE.Color(tint),
    attenuationDistance: m.includes("ambré") || m.includes("teinté") ? 0.35 : 4,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  });
}

type Finish = "gloss" | "matte" | "soft" | "uncoated" | "laid" | "satin";

function finishFrom(finishing: string): Finish {
  if (/verg/i.test(finishing)) return "laid";
  if (/soft|velours/i.test(finishing)) return "soft";
  if (/non couch|recycl|kraft|washi|textur/i.test(finishing)) return "uncoated";
  if (/mat/i.test(finishing)) return "matte";
  if (/brillant|holograph|nacr|gloss|uv/i.test(finishing)) return "gloss";
  return "satin";
}

/** Surface size (mm) carried by artwork textures, so micro-detail keeps a physical scale. */
function mmOf(map: THREE.Texture | null): [number, number] {
  const mm = map?.userData.mm as [number, number] | undefined;
  return mm ?? [100, 100];
}

function withMicro(kind: MicroKind, map: THREE.Texture | null, normalScale: number) {
  const [w, h] = mmOf(map);
  const m = microSurface(kind, w, h);
  return { normalMap: m.normal, normalScale: new THREE.Vector2(normalScale, normalScale), roughnessMap: m.roughness };
}

function printed(map: THREE.Texture | null, finishing: string, surface: Surface, color?: string) {
  const fin = finishFrom(finishing);
  const base = { map, color: color ?? "#ffffff" };
  const gloss = fin === "gloss";
  const dull = fin === "matte" || fin === "soft" || fin === "uncoated" || fin === "laid";
  switch (surface) {
    case "metal":
      // Ink printed on aluminium under a varnish: brushed metal shows through the clear coat.
      return new THREE.MeshPhysicalMaterial({
        ...base, ...withMicro("brushed", map, 0.06), metalness: 0.6, roughness: dull ? 0.45 : 0.3,
        clearcoat: dull ? 0.3 : 1, clearcoatRoughness: dull ? 0.35 : 0.06,
      });
    case "film":
      return new THREE.MeshPhysicalMaterial({
        ...base, ...withMicro("film", map, 0.28), metalness: 0.25, roughness: dull ? 0.5 : 0.3,
        clearcoat: dull ? 0.2 : 0.9, clearcoatRoughness: dull ? 0.4 : 0.12, side: THREE.DoubleSide,
      });
    case "plastic":
    case "clearplastic":
      return new THREE.MeshPhysicalMaterial({
        ...base, ...withMicro("plastic", map, 0.12), roughness: dull ? 0.55 : 0.3,
        clearcoat: dull ? 0 : 0.7, clearcoatRoughness: 0.12,
      });
    case "kraft":
      return new THREE.MeshPhysicalMaterial({
        ...base, ...withMicro("kraft", map, 0.45), roughness: 0.9, sheen: 0.06, sheenRoughness: 0.9, sheenColor: new THREE.Color("#ffffff"),
      });
    default:
      switch (fin) {
        case "gloss":
          // Smooth varnish over coated board: sharp reflections, paper texture underneath.
          return new THREE.MeshPhysicalMaterial({ ...base, ...withMicro("coated", map, 0.15), roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 });
        case "soft":
          return new THREE.MeshPhysicalMaterial({
            ...base, ...withMicro("softtouch", map, 0.2), roughness: 0.88, sheen: 0.15, sheenRoughness: 0.75, sheenColor: new THREE.Color("#ffffff"),
          });
        case "matte":
          return new THREE.MeshPhysicalMaterial({ ...base, ...withMicro("coated", map, 0.2), roughness: 0.72, clearcoat: 0.15, clearcoatRoughness: 0.6 });
        case "uncoated":
          return new THREE.MeshPhysicalMaterial({ ...base, ...withMicro("paper", map, 0.35), roughness: 0.92, sheen: 0.08, sheenRoughness: 0.9, sheenColor: new THREE.Color("#ffffff") });
        case "laid":
          return new THREE.MeshPhysicalMaterial({ ...base, ...withMicro("laid", map, 0.18), roughness: 0.9 });
        default:
          return new THREE.MeshPhysicalMaterial({ ...base, ...withMicro("coated", map, 0.15), roughness: gloss ? 0.3 : 0.5, clearcoat: 0.4, clearcoatRoughness: 0.25 });
      }
  }
}

function solid(color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, ...opts });
}

const METAL_SILVER = () => {
  const m = microSurface("brushed", 200, 200);
  return solid("#d7dadd", { metalness: 1, roughness: 0.3, normalMap: m.normal, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: m.roughness });
};

/** Product seen through a glass or clear plastic container (juice, honey, oil…). */
function contentFill(d: PackagingDesign, surface: Surface) {
  const c = d.contentColor;
  if (!c || !/^#[0-9a-f]{6}$/i.test(c) || (surface !== "glass" && surface !== "clearplastic")) return null;
  // Opaque on purpose: three.js shows opaque objects through transmissive glass.
  return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, sheenColor: new THREE.Color(c) });
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
      const bodyH = H * 0.8;
      g.add(printedBox(L, bodyH, W, d, surface, { front: "front", top: "plain" }, 1));
      const roofH = H * 0.16;
      const tri = new THREE.Shape();
      tri.moveTo(-W / 2, 0);
      tri.lineTo(W / 2, 0);
      tri.lineTo(0, roofH);
      tri.closePath();
      const roof = new THREE.ExtrudeGeometry(tri, { depth: L, bevelEnabled: false });
      roof.translate(0, 0, -L / 2);
      roof.rotateY(Math.PI / 2);
      g.add(mesh(roof, solid(bg, { roughness: 0.6 }), bodyH));
      g.add(mesh(new THREE.BoxGeometry(L, H * 0.04, 1.2), solid(bg, { roughness: 0.6 }), bodyH + roofH + H * 0.02));
      g.add(mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, H * 0.03, 32), solid(accent), bodyH + roofH * 0.45).translateZ(W * 0.22).rotateX(Math.PI / 2 - 0.5));
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
      const geo = wrapCylinder(1, 1, H, Math.PI * 2, 60);
      const half = W / 2;
      deformY(geo, H, (v, t) => {
        v.x *= L / 2;
        let k: number;
        if (spec.model === "pouch") {
          // Bottom gusset, tapering to a flat heat seal at the top.
          k = t < 0.12 ? 1 : 1 - 0.97 * smooth(0.12, 0.9, t);
        } else {
          // Pillow pack crimped at both ends.
          k = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.05) / 0.9))), 0.55) * 0.98 + 0.02;
        }
        v.z *= half * k;
      });
      const wrap = wrapTexture(d, L * 2, H, 0.46);
      const s = surface === "paper" ? "kraft" : surface;
      g.add(mesh(geo, printed(wrap, fin, s), H / 2));
      if (spec.model === "pouch") {
        const bottom = new THREE.CircleGeometry(1, 64);
        bottom.rotateX(Math.PI / 2);
        bottom.scale(L / 2, 1, half);
        g.add(mesh(bottom, solid(bg, { roughness: 0.6, side: THREE.DoubleSide }), 0.2));
        // Tear notch seal line
        g.add(mesh(new THREE.BoxGeometry(L * 0.98, H * 0.05, 0.8), solid(bg, { roughness: 0.5 }), H * 0.975));
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
      g.add(mesh(lathe([[0, 0], [R * 0.75, 0], [R * 0.95, neck * 0.5], [R, neck], [R, H - neck], [R * 0.86, H - neck * 0.2], [R * 0.84, H], [0, H]]), METAL_SILVER()));
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
      g.add(mesh(wrapCylinder(R * 1.004, R * 1.004, bodyH * 0.62, Math.PI * 1.4), printed(wrapTexture(d, R * Math.PI * 1.4, bodyH * 0.62, 0.7), fin, "paper"), bodyH * 0.48));
      const lidMat = /pehd/i.test(material) ? solid("#ffffff", { roughness: 0.35 }) : solid(ink, { roughness: 0.3, metalness: /fer|alu/i.test(material) ? 0.9 : 0.2 });
      g.add(mesh(new THREE.CylinderGeometry(R * 0.96, R * 0.96, lidH, 96), lidMat, H - lidH / 2));
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

    // Bottles
    default: {
      const m = spec.model;
      const neckR = m === "dropper" || m === "pump" || m === "spray" ? R * 0.42 : m === "wine" ? R * 0.33 : R * 0.38;
      const shoulder = m === "wine" ? H * 0.58 : m === "dropper" ? H * 0.62 : m === "spray" || m === "pump" ? H * 0.72 : H * 0.66;
      const capH = m === "dropper" ? H * 0.34 : m === "pump" ? H * 0.2 : m === "spray" ? H * 0.2 : m === "wine" ? H * 0.12 : H * 0.1;
      const neckTop = H - capH * (m === "wine" ? 0.9 : 0.8);
      const neckStart = m === "wine" ? H * 0.75 : shoulder + (neckTop - shoulder) * 0.55;
      const profile: [number, number][] = [
        [0, 0], [R * 0.92, 0], [R, R * 0.08], [R, shoulder],
        [R * 0.82, shoulder + (neckStart - shoulder) * 0.45], [neckR * 1.05, neckStart], [neckR, neckStart + 1],
        [neckR, neckTop], [neckR * 1.12, neckTop], [neckR * 1.12, neckTop + 2], [0, neckTop + 2],
      ];
      const bodyMat = surface === "glass" ? glassMaterial(material)
        : surface === "clearplastic" ? new THREE.MeshPhysicalMaterial({ color: "#eef6ff", transmission: 0.95, roughness: 0.08, thickness: 0.3, side: THREE.DoubleSide })
        : surface === "metal" ? METAL_SILVER()
        : solid(bg, { roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
      g.add(mesh(lathe(profile), bodyMat));
      const bottleFill = contentFill(d, surface);
      if (bottleFill) {
        const fr = R * 0.93;
        g.add(mesh(lathe([[0, R * 0.06], [fr * 0.94, R * 0.06], [fr, R * 0.14], [fr, shoulder * 0.98], [fr * 0.8, shoulder + (neckStart - shoulder) * 0.35], [0, shoulder + (neckStart - shoulder) * 0.35]]), bottleFill));
      }

      const labelH = shoulder * (m === "dropper" ? 0.72 : 0.62);
      const labelY = shoulder * 0.46;
      const theta = m === "wine" ? Math.PI * 1.1 : Math.PI * 1.3;
      g.add(mesh(wrapCylinder(R * 1.006, R * 1.006, labelH, theta), printed(wrapTexture(d, R * theta, labelH, 0.5), fin, surface === "metal" ? "metal" : "paper"), labelY));

      const capMat = solid(m === "wine" ? accent : ink, { roughness: m === "wine" ? 0.35 : 0.25, metalness: m === "wine" ? 0.6 : 0.1, clearcoat: 0.6 });
      if (m === "dropper") {
        g.add(mesh(new THREE.CylinderGeometry(neckR * 1.25, neckR * 1.25, capH * 0.38, 48), capMat, neckTop + capH * 0.19));
        const bulb = mesh(new THREE.CapsuleGeometry(neckR * 0.85, capH * 0.35, 12, 32), solid(ink, { roughness: 0.55 }), neckTop + capH * 0.38 + capH * 0.34);
        g.add(bulb);
      } else if (m === "pump" || m === "spray") {
        g.add(mesh(new THREE.CylinderGeometry(neckR * 1.3, neckR * 1.3, capH * 0.3, 48), capMat, neckTop + capH * 0.15));
        g.add(mesh(new THREE.CylinderGeometry(neckR * 0.35, neckR * 0.35, capH * 0.35, 24), capMat, neckTop + capH * 0.47));
        const head = mesh(new THREE.CylinderGeometry(neckR * 0.9, neckR * 0.9, capH * 0.3, 48), capMat, neckTop + capH * 0.8);
        g.add(head);
        if (m === "pump") {
          const nozzle = mesh(new THREE.BoxGeometry(neckR * 1.8, capH * 0.12, neckR * 0.45), capMat, neckTop + capH * 0.86);
          nozzle.position.x = neckR * 1.2;
          g.add(nozzle);
        }
      } else {
        g.add(mesh(new THREE.CylinderGeometry(neckR * 1.16, neckR * 1.16, capH, 48), capMat, neckTop + capH / 2));
      }
      break;
    }
  }
  return g;
}

/** Build the model, normalised to a 1-unit largest dimension, standing on y = 0. */
export function buildPackaging(spec: PackagingSpec, design: PackagingDesign): THREE.Group {
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
