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
import { bottleSection, createBottleFill, createBottleGeometry, createBottleLabel } from "./geometry/bottleGeometry";
import { bagShape, bottleLabel, boxParts, cartonConfigFor, coneToSurface, cylinderWrap, jarLabel, resolveStructure, tubWall, type BottleModel, type BoxModel, type BoxPart, type FilmPanel, type FrustumWall, type PrintSurface as StructSurface } from "@/lib/structure";
import { drawSurface } from "@/lib/artwork/surface";
import { closurePreset, createClosureGeometry, type ClosureMaterialSlot, type ClosureResult } from "./geometry/closureLibrary";
import { resolveColors, type PackagingDesign } from "@/lib/artwork/draw";
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

/**
 * Texture of a shared print surface (lib/structure): drawn by artwork/surface.ts, exactly like the
 * print sheet, at the surface's physical size. Same canvas sizes as the former face / wrap textures.
 */
function surfaceTexture(d: PackagingDesign, s: StructSurface) {
  const k = s.draw.kind;
  const [w, h] = pxFor(s.wMm, s.hMm, k === "wrap" ? 1536 : k === "front" || k === "top" || k === "back" ? 1024 : 512);
  const c = newCanvas(w, h);
  drawSurface(c.getContext("2d")!, 0, 0, c.width, c.height, d, s, { grain: true });
  const t = toTexture(c);
  t.userData.mm = [s.wMm, s.hMm];
  t.userData.surfaceId = s.id;
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
  const m = mat({ preset: printedPreset(surface as PrintSurface, finishFromLabel(finishing), label), color: color ?? "#ffffff" }, { map });
  // Which shared print surface this material shows (lib/structure), for the 3D ↔ print mapping.
  if (map?.userData.surfaceId) m.userData.surfaceId = map.userData.surfaceId;
  return m;
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

/**
 * UVs of a conical wall (wrapCylinder, thetaStart −π) from its developed sector: the vertex at angle θ
 * (from its original u) and height y gets its position in the sector, divided by the sector's box.
 */
function conicalUV(geo: THREE.CylinderGeometry, wall: FrustumWall) {
  const pos = geo.getAttribute("position"), uv = geo.getAttribute("uv");
  const half = geo.parameters.height / 2;
  for (let i = 0; i < uv.count; i++) {
    const theta = geo.parameters.thetaStart + uv.getX(i) * geo.parameters.thetaLength;
    const [sx, sy] = coneToSurface(wall, theta, pos.getY(i) + half);
    uv.setXY(i, sx / wall.width, 1 - sy / wall.height);
  }
  uv.needsUpdate = true;
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

/**
 * Film panel of a bag: its triangles (flat mm ↔ 3D), counter-clockwise in the flat panel seen from the
 * printed side so the normals point outwards; UV = flat position / panel size. `inset`: offset inwards
 * along −normal, mm (film layers); `inside`: reversed faces, the inner side of the film.
 */
function filmGeometry(p: FilmPanel, inset: number, inside = false) {
  const pos: number[] = [], uv: number[] = [];
  for (const tr of p.tris) {
    let idx = [0, 1, 2];
    const [a, b, c] = tr.flat;
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (area < 0) idx = [0, 2, 1];
    if (inside) idx = [idx[0], idx[2], idx[1]];
    const P = idx.map((i) => new THREE.Vector3(...tr.pos[i]));
    const n = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).normalize();
    // inside faces are reversed, so their normal already points inwards
    for (const i of [0, 1, 2]) {
      const q = P[i].clone().addScaledVector(n, inside ? inset : -inset);
      pos.push(q.x, q.y, q.z);
      uv.push(tr.flat[idx[i]][0] / p.wMm, tr.flat[idx[i]][1] / p.hMm);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Box-like part (lib/structure boxParts): rounded box whose six faces are shared print surfaces. */
function boxPartMesh(p: BoxPart, d: PackagingDesign, surfaces: Map<string, StructSurface>, surface: Surface) {
  const geo = new RoundedBoxGeometry(p.L, p.H, p.W, 3, p.radius);
  const mats = p.faces.map((f) => printed(surfaceTexture(d, surfaces.get(f.id)!), d.finishing, surface));
  return mesh(geo, mats, p.y);
}

// ─── Model builders (millimetres) ────────────────────────────────────────────

function buildModel(spec: PackagingSpec, d: PackagingDesign): THREE.Group {
  const g = new THREE.Group();
  const { lengthMm: L, widthMm: W, heightMm: H, material } = spec;
  const surface = surfaceFromMaterial(material);
  const { ink, accent, bg } = resolveColors(d.palette);
  const R = Math.min(L, W) / 2;
  const fin = d.finishing;
  // Shared print surfaces of this pack (one id, one size, one drawing for 3D and print).
  const structure = resolveStructure({ model: spec.model, lengthMm: L, widthMm: W, heightMm: H, material });
  const surfaces = new Map(structure.printSurfaces.map((x) => [x.id, x]));

  switch (spec.model) {
    case "box":
    case "pillow":
    case "display":
    case "moulded":
    case "pizza":
    case "clamshell":
    case "rigid":
      // Parts, sizes and the artwork of every face come from the structure (profile/boxProfile.ts).
      for (const part of boxParts(spec.model, L, W, H)) g.add(boxPartMesh(part, d, surfaces, surface));
      break;

    case "mailer":
    case "tray": {
      // Folded board construction (structure assembly, profile/mailerProfile.ts, trayProfile.ts): one
      // slab per board part; the outer face of a printed part shows its shared print surface, every
      // other face (inside, edges, flaps) is plain board.
      const board = printed(null, fin, surface, bg);
      for (const p of structure.assembly!.parts) {
        const size = [0, 1, 2].map((i) => p.max[i] - p.min[i]);
        const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
        geo.translate(...([0, 1, 2].map((i) => (p.min[i] + p.max[i]) / 2) as [number, number, number]));
        const faces = ["+x", "-x", "+y", "-y", "+z", "-z"] as const;
        const mats = faces.map((f) => (p.surface?.face === f ? printed(surfaceTexture(d, surfaces.get(p.surface.id)!), fin, surface) : board));
        const m = mesh(geo, mats);
        m.name = `${spec.model}:${p.id}`;
        g.add(m);
      }
      break;
    }

    case "carton": {
      // ── Parametric gable-top carton (Phase 2B-2) ──────────────────────────
      const cartonParts = createCartonGeometry(cartonConfigFor(L, W, H));

      // Body wrap and the two roof panels are shared print surfaces, at their real size.
      g.add(mesh(cartonParts.body, printed(surfaceTexture(d, surfaces.get("body")!), fin, surface)));
      g.add(mesh(cartonParts.roof, [
        printed(surfaceTexture(d, surfaces.get("roof-front")!), fin, surface),
        printed(surfaceTexture(d, surfaces.get("roof-back")!), fin, surface),
        solid(bg, { roughness: 0.6 }),
      ]));

      // Ridge (fin seal): plain accent colour
      g.add(mesh(cartonParts.ridge, solid(bg, { roughness: 0.55, clearcoat: 0.2 })));

      // Bottom cap: plain
      g.add(mesh(cartonParts.bottom, solid(bg, { roughness: 0.7, side: THREE.DoubleSide })));
      break;
    }

    case "bag": {
      // Film bag (structure/profile/bagProfile.ts): each film panel is its flat rectangle folded into
      // the filled bag; UV = flat mm, so the artwork keeps its print scale. Inside: plain film.
      const { panels } = bagShape(L, W, H, structure.material.thicknessMm);
      const film = printed(null, fin, surface, bg);
      const t = structure.material.thicknessMm;
      for (const p of panels) {
        const outer = filmGeometry(p, (p.layer ?? 0) * t);
        const map = p.surfaceId ? printed(surfaceTexture(d, surfaces.get(p.surfaceId)!), fin, surface) : film;
        const m = mesh(outer, p.plain ? film : map);
        m.name = `bag:${p.surfaceId ?? "fin"}`;
        g.add(m);
        // the inside face of the film, one thickness in
        if (!p.plain) g.add(mesh(filmGeometry(p, t, true), film));
      }
      break;
    }

    case "paperbag":
    case "shopper": {
      const geo = new THREE.BoxGeometry(L, H, W, 12, 30, 12);
      const bagFaces = boxParts(spec.model as BoxModel, L, W, H)[0].faces;
      if (spec.model === "paperbag") {
        deformY(geo, H, (v, t) => {
          v.z *= 1 - 0.92 * smooth(0.82, 1, t);
          v.x *= 1 + 0.03 * Math.sin(Math.PI * t);
        });
      }
      const mats = bagFaces.map((f) => printed(surfaceTexture(d, surfaces.get(f.id)!), fin, surface));
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
      // Front, back (and gusset) are separate print surfaces, drawn like the print sheet.
      const s = surface === "paper" ? "kraft" : surface;
      const panelIds = isDoypack ? ["front", "back", "gusset"] : ["front", "back"];
      g.add(mesh(pouchGeo, panelIds.map((id) => printed(surfaceTexture(d, surfaces.get(id)!), fin, s)), 0));

      if (isDoypack) {
        // Zip-lock heat seal accent line
        g.add(mesh(new THREE.BoxGeometry(L * 0.96, H * 0.015, 0.6), solid(bg, { roughness: 0.5 }), H * 0.91));
      }
      break;
    }

    case "tube": {
      const tubePrint = cylinderWrap("tube", L, W, H).label;
      const geo = wrapCylinder(R, R, tubePrint.heightMm, Math.PI * 2, 50);
      deformY(geo, tubePrint.heightMm, (v, t) => {
        const f = smooth(0.08, 1, t);
        v.x *= 1 + 0.35 * f;
        v.z *= 1 - 0.95 * f;
      });
      g.add(mesh(geo, printed(surfaceTexture(d, surfaces.get("wrap")!), fin, "plastic"), tubePrint.yStartMm + tubePrint.heightMm / 2));
      g.add(mesh(new THREE.BoxGeometry(R * 2.7, H * 0.05, 1.2), solid(bg, { roughness: 0.35 }), H * 0.975));
      g.add(mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.95, H * 0.12, 48), solid(ink, { roughness: 0.3 }), H * 0.06));
      break;
    }

    case "can": {
      const { neck, label: canPrint } = cylinderWrap("can", L, W, H);
      const body = canPrint.heightMm;
      // Body necked in under the seam; the lid (seam, countersink, panel, rivet, pull tab) closes it.
      const seamH = neck * 0.32;
      g.add(mesh(lathe([[0, 0], [R * 0.75, 0], [R * 0.95, neck * 0.5], [R, neck], [R, H - neck], [R * 0.865, H - seamH]]), METAL_SILVER()));
      const lidMat = METAL_SILVER();
      addClosure(g, createClosureGeometry({ type: "canLid", width: R * 0.88 * 2, height: seamH, seed: 1 }), H, {
        primary: lidMat, secondary: lidMat, metal: lidMat, rubber: lidMat, glass: lidMat,
      });
      const label = mesh(wrapCylinder(R * 1.002, R * 1.002, body, Math.PI * 2), printed(surfaceTexture(d, surfaces.get("wrap")!), fin, "metal"), canPrint.yStartMm + body / 2);
      g.add(label);
      break;
    }

    case "tin":
    case "papertube":
    case "tub":
    case "papertub":
    case "cup": {
      const rTop = R;
      const { lidH, bodyH, rBottom: rBot } = cylinderWrap(spec.model, L, W, H);
      const bodySurface = surface === "clearplastic" ? "plastic" : surface;
      const wallGeo = wrapCylinder(rTop, rBot, bodyH, Math.PI * 2);
      // Plastic tub: the texture is the DEVELOPED wall (annular sector, structure/profile/conicalProfile.ts):
      // each vertex takes the UV of its own place in the sector — 1 mm of artwork = 1 mm of wall.
      if (spec.model === "tub") conicalUV(wallGeo, tubWall(L, W, H).wall);
      g.add(mesh(wallGeo, printed(surfaceTexture(d, surfaces.get("wrap")!), fin, bodySurface), bodyH / 2));
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
      const { lidH, bodyH, label: jarPrint } = jarLabel(L, W, H);
      const bodyMat = surface === "glass" ? glassMaterial(material) : solid(bg, { roughness: 0.3, clearcoat: 0.6 });
      g.add(mesh(lathe([[0, 0], [R * 0.9, 0], [R, R * 0.12], [R, bodyH * 0.92], [R * 0.9, bodyH], [R * 0.88, bodyH + lidH * 0.3], [0, bodyH + lidH * 0.3]]), bodyMat));
      const jarFill = contentFill(d, surface);
      if (jarFill) g.add(mesh(lathe([[0, R * 0.05], [R * 0.86, R * 0.05], [R * 0.93, R * 0.14], [R * 0.93, bodyH * 0.86], [0, bodyH * 0.86]]), jarFill));
      // Physical label on the jar (same builder as the bottles: round section, 0.7 of the wrap).
      const jarLbl = createBottleLabel(bottleSection({ width: R * 2, depth: R * 2, bodyShape: "round" }), {
        yStart: jarPrint.yStartMm, height: jarPrint.heightMm, fraction: jarPrint.coverage, thickness: LABEL_THICKNESS_MM,
      });
      g.add(mesh(jarLbl.geometry, [printed(surfaceTexture(d, surfaces.get("label")!), fin, "paper", undefined, true), mat({ preset: "labelEdge" })]));
      // Lid from the closure library: knurled plastic (PEHD) or smooth painted metal, rounded edge.
      const plasticLid = /pehd/i.test(material);
      const lidMat = plasticLid ? mat({ preset: "glossyPlastic", color: "#ffffff" }) : mat({ preset: /fer|alu/i.test(material) ? "paintedMetal" : "glossyPlastic", color: ink });
      addClosure(g, createClosureGeometry({ type: "screwCap", width: R * 1.92, height: lidH, neckWidth: R * 1.76, skirt: 0, ribCount: plasticLid ? 48 : 0 }), H - lidH, {
        primary: lidMat, secondary: lidMat, metal: lidMat, rubber: lidMat, glass: lidMat,
      });
      break;
    }

    case "jug": {
      g.add(boxPartMesh(boxParts("jug", L, W, H)[0], d, surfaces, surface === "paper" ? "plastic" : surface));
      g.add(mesh(new THREE.CylinderGeometry(W * 0.2, W * 0.22, H * 0.12, 48), solid(accent, { roughness: 0.3 }), H * 0.94).translateX(-L * 0.25));
      const handle = mesh(new THREE.TorusGeometry(H * 0.14, W * 0.1, 16, 48, Math.PI), solid(bg, { roughness: 0.3, clearcoat: 0.5 }), H * 0.7);
      handle.position.x = L * 0.22;
      handle.rotation.z = -Math.PI / 2;
      g.add(handle);
      break;
    }

    // ── Bottles: parametric silhouette (section × profile), see geometry/bottleGeometry.ts ──
    default: {
      // Glass height, preset and label come from the structure (lib/structure/profile/labels.ts):
      // the bottle stops where its closure starts, and the printed label is exactly this one.
      const { family, preset, label: printLabel } = bottleLabel(spec.model as BottleModel, L, W, H, material);
      const closureFor = (b: ReturnType<typeof createBottleGeometry>) =>
        createClosureGeometry(closurePreset(family, H, { width: b.neck.width, finishHeight: b.finish.height, finishScale: b.finish.scale }, b.shoulderStartY));
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
      const labelH = printLabel.heightMm;
      // Physical label: 0.15 mm paper shell, printed face + white paper core on the edges and back.
      const label = createBottleLabel(bottle.section, { yStart: printLabel.yStartMm, height: labelH, fraction: printLabel.coverage, thickness: LABEL_THICKNESS_MM });
      // Plastic containers carry film labels (BOPP), glass and the rest paper labels.
      const filmLabel = surface === "plastic" || surface === "clearplastic";
      g.add(mesh(label.geometry, [
        printed(surfaceTexture(d, surfaces.get("label")!), fin, surface === "metal" ? "metal" : filmLabel ? "film" : "paper", undefined, true),
        mat({ preset: filmLabel ? "labelFilmMatte" : "labelEdge", color: filmLabel ? "#f7f7f5" : undefined }),
      ]));

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
  // Exact real-size factor (millimetres per scene unit), for AR / export consumers (phase 2C-6).
  outer.userData.mmPerUnit = 1 / k;
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
