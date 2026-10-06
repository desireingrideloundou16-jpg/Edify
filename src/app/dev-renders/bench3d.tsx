"use client";

/**
 * Phase 3D-A — 3D baseline benchmark (dev tool, measurement only).
 *
 *   /dev-renders?mode=bench&shape=<catalog id>&view=front|threeQuarter|back&rotate=0|1&seconds=5
 *     &scenario=none|rebuild|camera|stage   &hd=1 (HD render instead of the live viewer)
 *   scenario=stage mounts the real PreviewStage (view buttons); window.__bench exposes the 3D-B checks
 *   (camera persistence, renderer / WebGL context identity, stale artwork, visibility, resize).
 *   Phase 3D-C: window.__bench.hdExport / analyze / compare / viewerPng / viewerState (HD export checks).
 *   Phase 3D-D: window.__bench.hdShot (export per shot style) / cropIoU / drop.
 *
 * Mounts the REAL product viewer (Packaging3DViewer) on the product's 3D-stage background and
 * measures it from the outside: every frame the viewer's renderer draws is observed through a
 * wrapper around that renderer instance's render() (renderer.info, CPU time of the call, camera,
 * pack identity). Nothing in the viewer, the rig, the materials or the presets is changed.
 * Results: window.__benchResult (JSON) and body[data-done]. Driven by scripts/bench-3d.mjs.
 */
import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { _roots } from "@react-three/fiber";
import { ALL_CATALOG_SHAPES } from "@/lib/catalog/shapes";
import { SHOWCASE, loadShowcaseArt } from "@/components/landing/showcase";
import type { PackagingDesign } from "@/lib/artwork/draw";
import type { CameraPresetId } from "@/lib/three/scenePresets";

/** The reference panel: one supported format per family. */
export const BENCH_PANEL = [
  { family: "pot", shapeId: "cosmetic-jar" },
  { family: "bottle", shapeId: "shampoo-bottle" },
  { family: "glass", shapeId: "juice-bottle" },
  { family: "metal", shapeId: "beverage-can" },
  { family: "box", shapeId: "folding-box-standard" },
  { family: "pouch", shapeId: "stand-up-pouch" },
  { family: "tube", shapeId: "squeeze-tube" },
] as const;

/** The product's 3D stage background (studio.css `.st-3d`, light theme). */
const STAGE_BG = "radial-gradient(120% 90% at 50% 30%, #ffffff 0%, #e9ecf1 70%)";

interface Frame {
  t: number;
  /** CPU time of the render() call (GPU time is not observable in WebGL). */
  cpu: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pack: string | null;
  cam: number[];
  dir: number[];
  /** Renderer instance id (a new id = a new WebGLRenderer, i.e. a Canvas remount). */
  rid: number;
  aspect: number;
}

type W = Window & {
  __benchFrames?: Frame[]; __benchPatched?: boolean; __bench?: Record<string, unknown>; __benchResult?: unknown; __benchCanvases?: number;
  /** WebGL contexts created since the page loaded (getContext("webgl"/"webgl2") on a new canvas). */
  __benchContexts?: number; __benchRid?: number; __benchLast?: { scene: THREE.Object3D; camera: THREE.Camera };
};

/**
 * Observe the viewer's renderer from the outside. three defines render() on each instance (not the
 * prototype), so the probe wraps the instance R3F created, found through R3F's public _roots registry.
 * The wrapper calls the original render unchanged and only records renderer.info, timing and camera.
 */
function wrapViewerRenderer(canvas: HTMLCanvasElement): boolean {
  const w = window as W;
  const gl = _roots.get(canvas)?.store.getState().gl as (THREE.WebGLRenderer & { __benchWrapped?: boolean; __benchId?: number }) | undefined;
  if (!gl) return false;
  if (gl.__benchWrapped) return true;
  gl.__benchWrapped = true;
  const rid = (gl.__benchId = w.__benchRid = (w.__benchRid ?? 0) + 1);
  const render = gl.render.bind(gl);
  gl.render = (scene: THREE.Object3D, camera: THREE.Camera) => {
    const t0 = performance.now();
    render(scene, camera);
    const t1 = performance.now();
    if (gl.getRenderTarget() !== null) return;
    const pack = scene.children.find((o) => o.userData.mmPerUnit !== undefined);
    const dir = camera.getWorldDirection(new THREE.Vector3());
    w.__benchLast = { scene, camera };
    w.__benchFrames!.push({
      rid,
      aspect: +((camera as THREE.PerspectiveCamera).aspect ?? 0).toFixed(4),
      t: t1,
      cpu: t1 - t0,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      pack: pack?.uuid ?? null,
      cam: camera.position.toArray().map((x) => +x.toFixed(4)),
      dir: dir.toArray().map((x) => +x.toFixed(4)),
    });
  };
  return true;
}

/** Frame log + canvas counter (canvases created = artwork textures drawn; micro-surfaces are cached). */
function installProbe() {
  const w = window as W;
  w.__benchFrames = [];
  if (w.__benchPatched) return;
  w.__benchPatched = true;
  const create = document.createElement.bind(document);
  w.__benchCanvases = 0;
  document.createElement = ((tag: string, o?: ElementCreationOptions) => {
    if (tag.toLowerCase() === "canvas") w.__benchCanvases = (w.__benchCanvases ?? 0) + 1;
    return create(tag, o);
  }) as typeof document.createElement;
  // WebGL contexts created: a Canvas remount creates a new one, a view change must not.
  w.__benchContexts = 0;
  const getContext = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet<HTMLCanvasElement>();
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = (getContext as (...a: unknown[]) => unknown).call(this, type, ...rest);
    if (ctx && /webgl/.test(type) && !seen.has(this)) {
      seen.add(this);
      w.__benchContexts = (w.__benchContexts ?? 0) + 1;
    }
    return ctx;
  } as typeof getContext;
}

const frames = () => (window as W).__benchFrames!;
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const r1 = (x: number) => Math.round(x * 10) / 10;

async function waitFor(pred: () => boolean, timeout = 20000) {
  const t0 = performance.now();
  while (!pred()) {
    if (performance.now() - t0 > timeout) throw new Error("bench timeout");
    await sleep(16);
  }
}

/** FPS over a window of on-screen frames. */
function fpsStats(from: number, to: number) {
  const f = frames().filter((x) => x.t >= from && x.t <= to);
  const dt = f.slice(1).map((x, i) => x.t - f[i].t);
  const buckets: number[] = [];
  for (let s = from; s + 1000 <= to + 1; s += 1000) buckets.push(f.filter((x) => x.t >= s && x.t < s + 1000).length);
  const last = frames().filter((x) => x.t <= to).pop();
  return {
    frames: f.length,
    seconds: r1((to - from) / 1000),
    fpsAvg: f.length > 1 ? r1(((f.length - 1) * 1000) / (f[f.length - 1].t - f[0].t)) : 0,
    fpsMinPerSecond: buckets.length ? Math.min(...buckets) : null,
    fpsMaxPerSecond: buckets.length ? Math.max(...buckets) : null,
    frameMsAvg: dt.length ? r1(dt.reduce((a, b) => a + b, 0) / dt.length) : null,
    frameMsP95: dt.length ? r1(pct(dt, 0.95)) : null,
    frameMsMax: dt.length ? r1(Math.max(...dt)) : null,
    renderCpuMsAvg: f.length ? r1(f.reduce((a, b) => a + b.cpu, 0) / f.length) : null,
    info: last ? { drawCalls: last.calls, triangles: last.triangles, geometries: last.geometries, textures: last.textures, programs: last.programs } : null,
  };
}

/** A deterministic logo (no network): a magenta disc with a white "S". */
async function benchLogo(): Promise<HTMLImageElement> {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#E6007E";
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "bold 170px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("S", 128, 140);
  const img = new Image();
  img.src = c.toDataURL("image/png");
  await img.decode();
  return img;
}

/** The reference design: identical for every pack and every run (text, colours, logo, illustration, label). */
export async function benchDesign(): Promise<PackagingDesign> {
  const item = SHOWCASE[0];
  return {
    ...item.design,
    ingredients: "Eau, fleurs d'hibiscus 12 %, sucre de canne, menthe / Water, hibiscus flowers 12%, cane sugar, mint",
    usage: "Bien agiter. Servir frais. / Shake well. Serve chilled.",
    barcode: "4006381333931",
    production: "2026-09-26",
    expiry: "2027-03-26",
    price: "1 500 FCFA",
    extra: "Fabriqué à Douala, Cameroun / Made in Douala, Cameroon",
    logo: await benchLogo(),
    art: await loadShowcaseArt(item),
  } as PackagingDesign;
}

function gpuString() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const s = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : gl ? String(gl.getParameter(gl.RENDERER)) : "no webgl";
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return s;
  } catch {
    return "unknown";
  }
}

type ViewerProps = React.ComponentProps<typeof import("@/components/workspace/Packaging3DViewer").default>;
export interface BenchControls {
  setDesign: React.Dispatch<React.SetStateAction<PackagingDesign>>;
  setSpec: (spec: ViewerProps["spec"]) => void;
  /** View button: new preset + an explicit command (same as PreviewStage). */
  setView: (view: CameraPresetId) => void;
  recenter: () => void;
  setRotate: (on: boolean) => void;
}

function BenchViewer({ Viewer, spec: spec0, initial, view: view0, rotate: rotate0, expose }: {
  Viewer: React.ComponentType<ViewerProps>;
  spec: ViewerProps["spec"];
  initial: PackagingDesign;
  view: CameraPresetId;
  rotate: boolean;
  expose: (c: BenchControls) => void;
}) {
  const [design, setDesign] = useState(initial);
  const [spec, setSpec] = useState(spec0);
  const [view, setViewState] = useState(view0);
  const [command, setCommand] = useState(0);
  const [rotate, setRotate] = useState(rotate0);
  useEffect(() => {
    expose({
      setDesign, setSpec, setRotate,
      setView: (v) => {
        setViewState(v);
        setCommand((c) => c + 1);
      },
      recenter: () => setCommand((c) => c + 1),
    });
  }, [expose]);
  // viewCommand only exists from phase 3D-B on: passed loosely so the bench also runs on the 3D-A viewer.
  const extra = { viewCommand: command } as Record<string, unknown>;
  return (
    <div id="bench-stage" style={{ position: "relative", width: "100%", height: "100%", borderRadius: 18, overflow: "hidden", border: "1px solid #e6e8ee", background: STAGE_BG }}>
      <Viewer spec={spec} design={design} logoUrl={null} view={view} lighting="studio" autoRotate={rotate} {...extra} />
    </div>
  );
}

export async function runBench(q: URLSearchParams, mount: (node: React.ReactNode) => void) {
  const w = window as W;
  installProbe();
  const shape = ALL_CATALOG_SHAPES.find((s) => s.id === (q.get("shape") ?? "cosmetic-jar"))!;
  const spec = { model: shape.model ?? "box", lengthMm: shape.lengthMm, widthMm: shape.widthMm, heightMm: shape.heightMm, material: shape.material };
  const view = (q.get("view") ?? "threeQuarter") as CameraPresetId;
  const rotate = q.get("rotate") === "1";
  const seconds = Number(q.get("seconds") ?? 5);
  const scenario = q.get("scenario") ?? "none";
  const size = Number(q.get("size") ?? 640);

  const [{ loadDesignFonts }, models, { chooseQuality, frameShot, resolveCamera, resolveLighting }, { detectGraphicsCaps }, { StudioRig }] = await Promise.all([
    import("@/lib/artwork/draw"), import("@/lib/three/packagingModels"), import("@/lib/three/scenePresets"),
    import("@/lib/three/capabilities"), import("@/lib/three/studioRig"),
  ]);
  const design = await benchDesign();
  await loadDesignFonts(design);
  const caps = detectGraphicsCaps();
  const previewQuality = chooseQuality("preview", caps);
  const result: Record<string, unknown> = {
    shape: shape.id, model: shape.model, material: shape.material, view, rotate, seconds, scenario,
    env: { userAgent: navigator.userAgent, gpu: gpuString(), devicePixelRatio: window.devicePixelRatio, viewport: [innerWidth, innerHeight], caps, previewQuality },
  };

  if (q.get("hd") === "1") {
    // HIGH tier = the HD renderer (not used by the product UI today; measured as it is).
    const { renderHD } = await import("@/lib/three/hdRender");
    const t0 = performance.now();
    const url = await renderHD({ spec, design, camera: "threeQuarter", lighting: "premium", width: size, height: size, background: "preset" });
    result.hd = { ms: Math.round(performance.now() - t0), quality: chooseQuality("hd", caps), size };
    (w.__bench ??= {}).hdImage = url;
    w.__benchResult = result;
    document.body.dataset.done = "1";
    return;
  }

  // 1. Packaging build, outside the viewer (same function, same inputs): cold, then per quality.
  const stats = (o: THREE.Object3D) => {
    let tris = 0, meshes = 0, px = 0;
    const mats = new Set<THREE.Material>(), srcs = new Set<unknown>();
    o.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
        mats.add(mt);
        for (const v of Object.values(mt)) {
          const t = v as THREE.Texture | null;
          if (!t || !t.isTexture || srcs.has(t.source)) continue;
          srcs.add(t.source);
          const img = t.image as { width?: number; height?: number } | null;
          px += (img?.width ?? 0) * (img?.height ?? 0);
        }
      }
    });
    // RGBA8 + mip chain: an ESTIMATE from the image sizes, not a GPU measurement.
    return { meshes, triangles: Math.round(tris), materials: mats.size, textureSources: srcs.size, texturePixels: px, textureMBEstimate: r1((px * 4 * 4) / 3 / 1048576) };
  };
  const timeBuild = (quality: "low" | "medium" | "high" | "ultra") => {
    const c0 = w.__benchCanvases ?? 0;
    const t0 = performance.now();
    const o = models.buildPackaging(spec, design, { quality });
    const ms = performance.now() - t0;
    const s = stats(o);
    models.disposeObject(o);
    return { ms, canvases: (w.__benchCanvases ?? 0) - c0, s };
  };
  const cold = timeBuild("medium");
  const builds: Record<string, unknown> = { coldMediumMs: r1(cold.ms) };
  for (const quality of ["low", "medium", "high"] as const) {
    const runs = [0, 1, 2].map(() => timeBuild(quality));
    builds[quality] = { msMedian: r1(median(runs.map((r) => r.ms))), canvasesPerBuild: runs[0].canvases, ...runs[0].s };
  }
  result.build = builds;

  // 2. Studio rig, framing and first renders on a private renderer (same classes as the viewer).
  {
    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(size, size, false);
    const scene = new THREE.Scene();
    const t0 = performance.now();
    const rig = new StudioRig(renderer, resolveLighting("studio"), previewQuality ?? { shadowMapSize: 1024 });
    rig.attach(scene, renderer);
    const t1 = performance.now();
    const obj = models.buildPackaging(spec, design, { quality: previewQuality?.materialQuality ?? "medium" });
    scene.add(obj);
    const t2 = performance.now();
    rig.fit(renderer, scene, obj);
    const t3 = performance.now();
    const box = new THREE.Box3().setFromObject(obj);
    const f = frameShot({ min: box.min.toArray(), max: box.max.toArray() }, resolveCamera(view), 1);
    const t4 = performance.now();
    const cam = new THREE.PerspectiveCamera(f.fov, 1, f.near, f.far);
    cam.position.set(...f.position);
    cam.lookAt(...f.target);
    const t5 = performance.now();
    renderer.render(scene, cam);
    renderer.getContext().finish();
    const t6 = performance.now();
    const again: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = performance.now();
      renderer.render(scene, cam);
      renderer.getContext().finish();
      again.push(performance.now() - a);
    }
    result.setup = {
      studioRigInitMs: r1(t1 - t0),
      buildMs: r1(t2 - t1),
      rigFitMs: r1(t3 - t2),
      frameShotMs: r1(t4 - t3),
      firstRenderMs: r1(t6 - t5),
      stableRenderMsMedian: r1(median(again)),
      note: "private renderer, gl.finish() after each render: CPU+GPU wall time, machine-dependent",
    };
    scene.remove(obj);
    models.disposeObject(obj);
    rig.detach(scene);
    rig.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  // 3. The real viewer, as in the product.
  const { default: Viewer } = await import("@/components/workspace/Packaging3DViewer");
  let ctl: BenchControls | null = null;
  const tMount = performance.now();
  if (scenario === "stage") {
    // The real studio stage: its own view buttons (Face, ¾, Dos, Recentrer) and auto-rotation.
    const { PreviewStage } = await import("@/components/studio/PreviewStage");
    mount(
      <div id="bench-wrap" style={{ width: size, height: size + 64, display: "flex", flexDirection: "column" }}>
        <div id="bench-stage" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <PreviewStage mode="3d" onMode={() => {}} shape={shape} spec={spec} design={design} logoUrl={null} onCaptureReady={() => {}} />
        </div>
      </div>
    );
  } else {
    mount(
      <div id="bench-wrap" style={{ width: size, height: size }}>
        <BenchViewer Viewer={Viewer} spec={spec} initial={design} view={view} rotate={rotate} expose={(c) => (ctl = c)} />
      </div>
    );
  }
  const setDesign = (v: PackagingDesign) => (ctl as BenchControls | null)?.setDesign(v);
  await waitFor(() => {
    const c = document.querySelector<HTMLCanvasElement>("#bench-stage canvas");
    return !!c && wrapViewerRenderer(c);
  });
  result.viewer = { wrappedAfterMountMs: r1(performance.now() - tMount) };
  await waitFor(() => frames().some((x) => x.pack));
  const first = frames().find((x) => x.pack)!;
  Object.assign(result.viewer as object, { mountToFirstPackFrameMs: r1(first.t - tMount), firstPackFrameCpuMs: r1(first.cpu) });
  await sleep(1500);
  const t0 = performance.now();
  await sleep(seconds * 1000);
  result.fps = fpsStats(t0, performance.now());

  const lastPack = () => frames()[frames().length - 1]?.pack ?? null;
  const camNow = () => {
    const f = frames()[frames().length - 1];
    return f ? { position: f.cam, direction: f.dir } : null;
  };
  // The design the viewer was given last, and the one before (stale-artwork check).
  let current = design;
  let previous = design;
  /** Applies a design change and reports what the viewer did (rebuilds, latency, textures drawn). */
  const change = async (kind: "text" | "color" | "art") => {
    const before = lastPack();
    const c0 = w.__benchCanvases ?? 0;
    const tc = performance.now();
    const art = kind === "art" ? await loadShowcaseArt(SHOWCASE[6]) : null;
    const next: PackagingDesign =
      kind === "text" ? { ...current, productName: `${current.productName} intense` }
        : kind === "color" ? { ...current, palette: ["#FF8A00", ...current.palette.slice(1)] }
          : { ...current, art };
    previous = current;
    current = next;
    setDesign(next);
    await waitFor(() => lastPack() !== before);
    const seen = frames().find((x) => x.t >= tc && x.pack !== before)!;
    await sleep(1000);
    const packs = new Set(frames().filter((x) => x.t >= tc).map((x) => x.pack));
    packs.delete(before);
    return { kind, changeToNewPackFrameMs: r1(seen.t - tc), newPacksRendered: packs.size, canvasesCreated: (w.__benchCanvases ?? 0) - c0, cameraAfter: camNow() };
  };
  const displayed = () => w.__benchLast?.scene.children.find((o) => o.userData.mmPerUnit !== undefined) ?? null;
  /** How many corners of the displayed pack's box project inside the frame (8 = fully visible). */
  const visible = () => {
    const obj = displayed(), cam = w.__benchLast?.camera;
    if (!obj || !cam) return null;
    const bx = new THREE.Box3().setFromObject(obj);
    let inside = 0;
    for (const x of [bx.min.x, bx.max.x]) for (const y of [bx.min.y, bx.max.y]) for (const z of [bx.min.z, bx.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(cam);
      if (Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z > -1 && p.z < 1) inside++;
    }
    return inside;
  };
  let specNow = spec;
  let shapeNow = shape;
  /**
   * Stale artwork: the displayed pack's artwork textures against fresh builds of the CURRENT and the
   * PREVIOUS design. Pixels differing strongly (sum of channel deltas > 90) are counted; the paper grain
   * (random 1.5 px dots at 3.5 %) stays far below that threshold, a text / colour / image change does not.
   */
  const artCheck = () => {
    const maps = (o: THREE.Object3D) => {
      const m = new Map<string, HTMLCanvasElement>();
      o.traverse((x) => {
        const mesh = x as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const mt of [mesh.material].flat()) {
          const map = (mt as THREE.MeshStandardMaterial).map;
          if (map?.userData.surfaceId && map.image instanceof HTMLCanvasElement) m.set(String(map.userData.surfaceId), map.image);
        }
      });
      return m;
    };
    const strong = (ca: HTMLCanvasElement, cb: HTMLCanvasElement) => {
      if (ca.width !== cb.width || ca.height !== cb.height) return ca.width * ca.height;
      const da = ca.getContext("2d")!.getImageData(0, 0, ca.width, ca.height).data;
      const db = cb.getContext("2d")!.getImageData(0, 0, cb.width, cb.height).data;
      let n = 0;
      for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 90) n++;
      return n;
    };
    const obj = displayed();
    if (!obj) return null;
    const shown = maps(obj);
    const quality = previewQuality?.materialQuality ?? "medium";
    const diff = (d: PackagingDesign) => {
      const built = models.buildPackaging(specNow, d, { quality });
      const ref = maps(built);
      let n = 0;
      for (const [id, c] of shown) n += ref.has(id) ? strong(c, ref.get(id)!) : c.width * c.height;
      models.disposeObject(built);
      return n;
    };
    return { surfaces: shown.size, strongPixelsVsCurrent: diff(current), strongPixelsVsPrevious: diff(previous) };
  };
  /** Another packaging (TEST D): waits for its first frame. */
  const setShape = async (id: string) => {
    const sh = ALL_CATALOG_SHAPES.find((x) => x.id === id)!;
    shapeNow = sh;
    specNow = { model: sh.model ?? "box", lengthMm: sh.lengthMm, widthMm: sh.widthMm, heightMm: sh.heightMm, material: sh.material };
    const before = lastPack();
    (ctl as BenchControls | null)?.setSpec(specNow);
    await waitFor(() => lastPack() !== before);
    await sleep(800);
    return { shape: id, camera: camNow(), visibleCorners: visible() };
  };
  /** Re-attach the probe after a possible Canvas remount; returns the current renderer id. */
  const rewrap = () => {
    const c = document.querySelector<HTMLCanvasElement>("#bench-stage canvas");
    if (c) wrapViewerRenderer(c);
    return { rendererId: w.__benchRid ?? 0, webglContexts: w.__benchContexts ?? 0, canvases: document.querySelectorAll("#bench-stage canvas").length };
  };
  const clickButton = (label: string) => {
    const btn = [...document.querySelectorAll<HTMLButtonElement>("#bench-stage button")].find((x) => x.textContent?.trim() === label);
    btn?.click();
    return !!btn;
  };
  const resize = async (width: number, height: number) => {
    const el = document.getElementById("bench-wrap")!;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    await sleep(1000);
    const t = performance.now();
    await sleep(2000);
    const after = frames().filter((x) => x.t >= t).length;
    const last = frames()[frames().length - 1];
    return { size: [width, height], aspect: last?.aspect ?? null, rendererId: last?.rid ?? null, visibleCorners: visible(), framesDuring2sAfterSettle: after, camera: camNow() };
  };
  // ─── Phase 3D-C: HD export checks ───────────────────────────────────────────
  const imgs: Record<string, string> = {};
  const loadImg = async (url: string) => {
    const i = new Image();
    i.src = url;
    await i.decode();
    return i;
  };
  const pixels = (i: HTMLImageElement, wd = i.width, ht = i.height) => {
    const c = document.createElement("canvas");
    c.width = wd;
    c.height = ht;
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(i, 0, 0, wd, ht);
    return g.getImageData(0, 0, wd, ht).data;
  };
  /** The export picture of the CURRENT design (the product's module, same call as the ZIP). */
  const hdExport = async (key: string, size?: number) => {
    const { renderExportPreview } = await import("@/lib/three/hdExport");
    const f0 = frames().length;
    const t0 = performance.now();
    const r = await renderExportPreview(shapeNow, specNow, current, { size });
    const ms = performance.now() - t0;
    if (!r) return { key, ok: false };
    imgs[key] = r.dataUrl;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
    return { key, ok: true, engine: r.engine, ms: r1(ms), viewerFramesDuringExport: frames().length - f0, jsHeapMB: heap ? r1(heap / 1048576) : null };
  };
  /** Same camera as the viewer (threeQuarter, same canvas size): the interactive vs HD comparison. */
  const hdMatched = async (key: string) => {
    const { renderHD } = await import("@/lib/three/hdRender");
    const c = document.querySelector<HTMLCanvasElement>("#bench-stage canvas")!;
    const url = await renderHD({ spec: specNow, design: current, camera: "threeQuarter", lighting: "premium", width: c.width, height: c.height, background: "transparent" });
    if (url) imgs[key] = url;
    return !!url;
  };
  const viewerGl = () => {
    const c = document.querySelector<HTMLCanvasElement>("#bench-stage canvas");
    return c ? (_roots.get(c)?.store.getState().gl as THREE.WebGLRenderer | undefined) ?? null : null;
  };
  const viewerPng = (key: string) => {
    const gl = viewerGl();
    if (!gl) return false;
    imgs[key] = gl.domElement.toDataURL("image/png");
    return true;
  };
  const viewerState = () => {
    const gl = viewerGl();
    return { camera: camNow(), rendererIds: [...new Set(frames().map((x) => x.rid))], frames: frames().length, contextLost: gl ? gl.getContext().isContextLost() : null };
  };
  /** PNG facts: size, bytes, alpha, the drawn area and its margins. */
  const analyze = async (key: string) => {
    const url = imgs[key];
    if (!url) return null;
    const i = await loadImg(url);
    const d = pixels(i);
    let transparent = 0, opaque = 0, partial = 0, x0 = i.width, y0 = i.height, x1 = -1, y1 = -1;
    let solidX0 = i.width, solidY0 = i.height, solidX1 = -1, solidY1 = -1;
    for (let p = 0, k = 0; k < d.length; k += 4, p++) {
      const a = d[k + 3];
      if (a === 0) transparent++;
      else if (a === 255) opaque++;
      else partial++;
      const x = p % i.width, y = (p / i.width) | 0;
      if (a > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (a > 200) {
        if (x < solidX0) solidX0 = x;
        if (x > solidX1) solidX1 = x;
        if (y < solidY0) solidY0 = y;
        if (y > solidY1) solidY1 = y;
      }
    }
    const n = i.width * i.height;
    const pct = (v: number) => +((100 * v) / n).toFixed(2);
    return {
      width: i.width, height: i.height, pngBytes: Math.round((url.length - url.indexOf(",") - 1) * 0.75),
      isPng: url.startsWith("data:image/png"),
      alpha: { transparentPct: pct(transparent), opaquePct: pct(opaque), partialPct: pct(partial) },
      nonEmptyPct: pct(opaque + partial),
      drawnBox: x1 < 0 ? null : [x0, y0, x1, y1],
      // The pack itself (alpha > 200: the soft shadows are excluded) and its margins, in % of the side.
      packBox: solidX1 < 0 ? null : [solidX0, solidY0, solidX1, solidY1],
      packMarginsPct: solidX1 < 0 ? null : { left: pct(solidX0 * i.height), top: pct(solidY0 * i.width), right: pct((i.width - 1 - solidX1) * i.height), bottom: pct((i.height - 1 - solidY1) * i.width) },
      touchesEdge: x0 === 0 || y0 === 0 || x1 === i.width - 1 || y1 === i.height - 1,
      // Strongest alpha on the image border: > 0 means something (a shadow) is cut by the frame.
      borderMaxAlpha: (() => {
        let m = 0;
        for (let x = 0; x < i.width; x++) m = Math.max(m, d[x * 4 + 3], d[((i.height - 1) * i.width + x) * 4 + 3]);
        for (let y = 0; y < i.height; y++) m = Math.max(m, d[y * i.width * 4 + 3], d[(y * i.width + i.width - 1) * 4 + 3]);
        return m;
      })(),
    };
  };
  /** Two pictures at the same size (b is resized to a): colour difference and silhouette overlap. */
  const compare = async (ka: string, kb: string) => {
    if (!imgs[ka] || !imgs[kb]) return null;
    const [ia, ib] = await Promise.all([loadImg(imgs[ka]), loadImg(imgs[kb])]);
    const da = pixels(ia), db = pixels(ib, ia.width, ia.height);
    let sum = 0, strong = 0, both = 0, either = 0, colourSum = 0, colourN = 0;
    for (let k = 0; k < da.length; k += 4) {
      const d = Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) + Math.abs(da[k + 3] - db[k + 3]);
      sum += d;
      if (d > 90) strong++;
      const sa = da[k + 3] > 200, sb = db[k + 3] > 200;
      if (sa || sb) either++;
      if (sa && sb) {
        both++;
        colourSum += (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2])) / 3;
        colourN++;
      }
    }
    const n = da.length / 4;
    return {
      size: [ia.width, ia.height],
      meanAbsRgbaPerChannel: +(sum / n / 4).toFixed(3),
      strongPct: +((100 * strong) / n).toFixed(3),
      silhouetteIoU: either ? +(both / either).toFixed(4) : null,
      meanColourDiffOnPack: colourN ? +(colourSum / colourN).toFixed(2) : null,
    };
  };
  const image = (key: string) => imgs[key] ?? null;
  /** Free a stored picture (the bench keeps nothing it no longer needs). */
  const drop = (key: string) => {
    delete imgs[key];
    return true;
  };
  /**
   * Phase 3D-D: the export picture for a shot style. "export" = the product's path (renderExportPreview with
   * the shot request); "direct" = renderHD with the style's camera / lighting and the HD export framing as it
   * is in the code at the time of the run (used to capture the 3D-C state before 3D-D).
   */
  const hdShot = async (key: string, style: string, variant: "export" | "direct", size?: number) => {
    const t0 = performance.now();
    let url: string | null = null;
    if (variant === "export") {
      const { renderExportPreview } = await import("@/lib/three/hdExport");
      const exportPreview = renderExportPreview as unknown as (sh: typeof shapeNow, sp: typeof specNow, d: PackagingDesign, o: Record<string, unknown>) => ReturnType<typeof renderExportPreview>;
      const r = await exportPreview(shapeNow, specNow, current, { size, shot: { style } });
      url = r?.dataUrl ?? null;
    } else {
      const [{ renderHD }, { resolveShot: rs }, { HD_EXPORT }] = await Promise.all([import("@/lib/three/hdRender"), import("@/lib/three/scenePresets"), import("@/lib/three/hdExport")]);
      const shot = rs({ style });
      url = await renderHD({ spec: specNow, design: current, camera: shot.camera.id, lighting: shot.lighting.id, width: size ?? 2048, height: size ?? 2048, background: "transparent", frame: HD_EXPORT.frame });
    }
    if (!url) return { key, ok: false };
    imgs[key] = url;
    return { key, ok: true, ms: r1(performance.now() - t0) };
  };
  /** Silhouette of the pack alone (alpha > 200, cropped to itself, 256 px): same geometry / angle → IoU ≈ 1, whatever the framing. */
  const cropIoU = async (ka: string, kb: string) => {
    if (!imgs[ka] || !imgs[kb]) return null;
    const mask = async (k: string) => {
      const i = await loadImg(imgs[k]);
      const d = pixels(i);
      let x0 = i.width, y0 = i.height, x1 = -1, y1 = -1;
      for (let p = 0, q = 0; q < d.length; q += 4, p++) if (d[q + 3] > 200) {
        const x = p % i.width, y = (p / i.width) | 0;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d")!;
      g.drawImage(i, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, 256, 256);
      const m = g.getImageData(0, 0, 256, 256).data;
      return { m, aspect: (x1 - x0 + 1) / (y1 - y0 + 1) };
    };
    const [a, b] = await Promise.all([mask(ka), mask(kb)]);
    let both = 0, either = 0;
    for (let q = 3; q < a.m.length; q += 4) {
      const sa = a.m[q] > 200, sb = b.m[q] > 200;
      if (sa || sb) either++;
      if (sa && sb) both++;
    }
    return { iou: either ? +(both / either).toFixed(4) : null, aspectA: +a.aspect.toFixed(4), aspectB: +b.aspect.toFixed(4) };
  };

  w.__bench = {
    hdExport, hdMatched, viewerPng, viewerState, analyze, compare, image, hdShot, cropIoU, drop,
    put: (key: string, url: string) => {
      imgs[key] = url;
      return true;
    },
    change, camera: camNow, frames: () => frames().length, mark: () => performance.now(), stats: fpsStats,
    visible, artCheck, setShape, rewrap, clickButton, resize,
    setView: async (v: CameraPresetId) => {
      (ctl as BenchControls | null)?.setView(v);
      await sleep(800);
      return camNow();
    },
    recenter: async () => {
      (ctl as BenchControls | null)?.recenter();
      await sleep(800);
      return camNow();
    },
    setRotate: (on: boolean) => (ctl as BenchControls | null)?.setRotate(on),
    rendererIds: () => [...new Set(frames().map((x) => x.rid))],
    contexts: () => w.__benchContexts ?? 0,
  };

  if (scenario === "rebuild") {
    const steps = [];
    for (const kind of ["text", "color", "art"] as const) {
      const r = await change(kind);
      // The mini 3D of the 2D tab re-renders the whole pack too (renderShowcase 440 px).
      const { renderShowcase } = await import("@/lib/three/thumbnails");
      const m0 = performance.now();
      await renderShowcase(shape, design, 440, -0.55);
      const mini = performance.now() - m0;
      const b = timeBuild(previewQuality?.materialQuality ?? "medium");
      steps.push({ ...r, directBuildMs: r1(b.ms), mini3dMs: r1(mini) });
    }
    result.rebuild = steps;
  }
  if (scenario === "camera") result.cameraStart = camNow();

  w.__benchResult = result;
  document.body.dataset.done = "1";
}
