/**
 * Phase 3D-A — 3D baseline benchmark runner (measurement only, no dependency).
 *
 *   npm run dev                                   (the /dev-renders page only exists in development)
 *   node --experimental-websocket scripts/bench-3d.mjs [--url http://localhost:3000] [--out docs/phase3/3d-baseline]
 *        [--chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"] [--size 640] [--seconds 5] [--headful]
 *   node --experimental-websocket scripts/bench-3d.mjs --suite 3db --tag before|after --out docs/phase3/3d-b
 *        (phase 3D-B: camera persistence, view buttons without remount, idle / interaction rendering)
 *   node --experimental-websocket scripts/bench-3d.mjs --suite 3dd --variant direct|export --tag before|after [--before <dir>] --out docs/phase3/3d-d
 *        (phase 3D-D: the export per shot style, 7 families x 5 SHOT_STYLES)
 *   node --experimental-websocket scripts/bench-3d.mjs --suite 3dc --tag run --out docs/phase3/3d-c
 *        (phase 3D-C: export picture — resolution, 7 formats, interactive vs HD, changes, isolation, cleanup)
 *   node --experimental-websocket scripts/bench-3d.mjs --uncapped     (FPS only, vsync and frame-rate cap off:
 *                                                                       the real headroom; writes metrics-uncapped.json)
 *
 * Drives Chrome over the DevTools protocol (Node's built-in WebSocket) through /dev-renders?mode=bench
 * (src/app/dev-renders/bench3d.tsx): captures of the real viewer (front / ¾ / back) for the panel, FPS
 * static and rotating, LOW tier (emulated weak device), DPR 2, HD renders, the rebuild and camera
 * scenarios, a contact sheet, and metrics.json. Every number is machine-dependent.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i < 0 ? d : process.argv[i + 1] ?? true;
};
const URL_BASE = arg("url", "http://localhost:3000");
const OUT = arg("out", "docs/phase3/3d-baseline");
const CHROME = arg("chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe");
const SIZE = Number(arg("size", 640));
const SECONDS = Number(arg("seconds", 5));
const HEADFUL = process.argv.includes("--headful");
const UNCAPPED = process.argv.includes("--uncapped");
// --suite 3db --tag before|after: the phase 3D-B checks only (metrics-3db-<tag>.json).
const SUITE = arg("suite", null);
const TAG = arg("tag", "run");
// --label: the contact sheet title (default: the phase 3D-A baseline).
const LABEL = arg("label", "BASELINE PHASE 3D — BEFORE");
const PORT = 9333;

const PANEL = [
  ["pot", "cosmetic-jar"], ["bottle", "shampoo-bottle"], ["glass", "juice-bottle"], ["metal", "beverage-can"],
  ["box", "folding-box-standard"], ["pouch", "stand-up-pouch"], ["tube", "squeeze-tube"],
];
const VIEWS = [["front", "front"], ["threeQuarter", "three-quarter"], ["back", "back"]];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ─── Chrome + DevTools protocol ──────────────────────────────────────────────
const profile = mkdtempSync(join(tmpdir(), "edify-bench-"));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--ignore-gpu-blocklist", "--no-first-run",
  "--no-default-browser-check", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
  `--window-size=${SIZE + 200},${SIZE + 200}`, ...(HEADFUL ? [] : ["--headless=new"]),
  ...(UNCAPPED ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"] : []), "about:blank",
], { stdio: "ignore" });

let ws, seq = 0;
const pending = new Map();
const pageWarnings = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      ws = new WebSocket(v.webSocketDebuggerUrl);
      await new Promise((ok, ko) => ((ws.onopen = ok), (ws.onerror = ko)));
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === "Runtime.exceptionThrown") console.error("page exception:", m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
        if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") console.error("page console.error:", m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 400));
        // WebGL warnings (e.g. "Too many active WebGL contexts"): a leak shows up here.
        if (m.method === "Runtime.consoleAPICalled" && /webgl|context/i.test(m.params.args.map((a) => a.value ?? a.description ?? "").join(" "))) {
          pageWarnings.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200)}`);
        }
        if (m.id && pending.has(m.id)) {
          const { ok, ko } = pending.get(m.id);
          pending.delete(m.id);
          if (m.error) ko(new Error(m.error.message));
          else ok(m.result);
        }
      };
      return v;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Chrome DevTools not reachable");
}
const send = (method, params = {}, sessionId) =>
  new Promise((ok, ko) => {
    const id = ++seq;
    pending.set(id, { ok, ko });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

async function newPage({ dpr = 1, weak = false } = {}) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s("Page.enable");
  await s("Runtime.enable");
  await s("Emulation.setDeviceMetricsOverride", { width: SIZE + 100, height: SIZE + 100, deviceScaleFactor: dpr, mobile: false });
  // LOW tier: the product's own rule (≤ 4 cores → weak device), emulated without touching the code.
  if (weak) await s("Page.addScriptToEvaluateOnNewDocument", { source: "Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 });" });
  const evaluate = async (expression) => {
    const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return {
    s, evaluate,
    close: () => send("Target.closeTarget", { targetId }),
    async open(query) {
      // A background tab gets no animation frames: the measured tab is always in front.
      await s("Page.bringToFront");
      await s("Page.navigate", { url: `${URL_BASE}/dev-renders?${query}` });
      for (let i = 0; i < 480; i++) {
        await sleep(250);
        const done = await evaluate("document.body?.dataset.done === '1'").catch(() => false);
        if (done) return evaluate("JSON.stringify(window.__benchResult ?? null)").then(JSON.parse);
      }
      throw new Error(`timeout: ${query}`);
    },
    async shot(file) {
      const box = await evaluate("(() => { const r = document.querySelector('#bench-stage').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()");
      const { data } = await s("Page.captureScreenshot", { format: "png", clip: { x: box[0], y: box[1], width: box[2], height: box[3], scale: 1 } });
      writeFileSync(file, Buffer.from(data, "base64"));
    },
    async drag(dx, dy) {
      const box = await evaluate("(() => { const r = document.querySelector('#bench-stage canvas').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()");
      const [x, y] = box;
      await s("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await s("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      for (let i = 1; i <= 20; i++) {
        await s("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + (dx * i) / 20, y: y + (dy * i) / 20, button: "left", buttons: 1 });
        await sleep(16);
      }
      await s("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y: y + dy, button: "left", clickCount: 1 });
    },
    /** A continuous orbit: the pointer circles for `ms` (interaction FPS). */
    async orbitFor(ms) {
      const [x, y] = await evaluate("(() => { const r = document.querySelector('#bench-stage canvas').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()");
      await s("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await s("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      const t0 = Date.now();
      let px = x, py = y;
      while (Date.now() - t0 < ms) {
        const a = ((Date.now() - t0) / 1000) * Math.PI;
        px = x + Math.sin(a) * 160;
        py = y + Math.sin(a * 0.5) * 30;
        await s("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py, button: "left", buttons: 1 });
        await sleep(8);
      }
      await s("Input.dispatchMouseEvent", { type: "mouseReleased", x: px, y: py, button: "left", clickCount: 1 });
    },
    /** Mouse-wheel zoom in then out for `ms`. */
    async zoomFor(ms) {
      const [x, y] = await evaluate("(() => { const r = document.querySelector('#bench-stage canvas').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()");
      const t0 = Date.now();
      let events = 0;
      while (Date.now() - t0 < ms) {
        const dir = Date.now() - t0 < ms / 2 ? -1 : 1;
        await s("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dir * 40 });
        events++;
        await sleep(16);
      }
      // Each wheel notch moves the camera once: render rate = input rate (not a GPU limit).
      return { wheelEvents: events, wheelEventsPerSecond: Math.round((events * 10000) / ms) / 10 };
    },
  };
}

// ─── Run ─────────────────────────────────────────────────────────────────────
const commit = execSync("git rev-parse HEAD").toString().trim();
const version = await connect();
mkdirSync(OUT, { recursive: true });
const metrics = { commit, date: new Date().toISOString(), chrome: version.Browser, headless: !HEADFUL, uncapped: UNCAPPED, size: SIZE, seconds: SECONDS, runs: [] };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const page = await newPage();
log("warm-up (dev compilation)");
await page.open(`mode=bench&shape=cosmetic-jar&view=front&seconds=1&size=${SIZE}`);

if (UNCAPPED) {
  // Same scenes, no vsync: how many frames the GPU could draw (static, rotating, DPR 2, LOW).
  const dpr2 = await newPage({ dpr: 2 });
  const weak = await newPage({ weak: true });
  for (const [family, shape] of PANEL) {
    for (const [kind, p, rotate] of [["static", page, 0], ["rotating", page, 1], ["rotating-dpr2", dpr2, 1], ["rotating-low", weak, 1]]) {
      const r = await p.open(`mode=bench&shape=${shape}&view=threeQuarter&rotate=${rotate}&seconds=${SECONDS}&size=${SIZE}`);
      metrics.runs.push({ kind, family, ...r });
      log(family, kind, "uncapped fps", r.fps.fpsAvg, "p95 ms", r.fps.frameMsP95);
    }
  }
  writeFileSync(join(OUT, "metrics-uncapped.json"), JSON.stringify(metrics, null, 2));
  log("done →", OUT);
  ws.close();
  chrome.kill();
  process.exit(0);
}

if (SUITE === "3dd") {
  // Phase 3D-D: the export picture per shot style (7 families × the 5 SHOT_STYLES). --variant direct captures
  // the code as it is (renderHD with the style's camera / lighting and the HD export framing), --variant export
  // goes through renderExportPreview({ shot }). Pictures of the key cases are saved; nothing is kept in memory.
  const ev = (x) => page.evaluate(x);
  const VARIANT = arg("variant", "export");
  const STYLES = ["heroPremium", "catalogEcommerce", "closeUpDetail", "naturalLifestyle", "dramaticHero"];
  const SAVE = new Set(["pot", "bottle", "box", "pouch", "tube"]);
  const SAVE_STYLES = new Set(["heroPremium", "catalogEcommerce"]);
  const BEFORE = arg("before", null);
  const save = async (key, file) => {
    const url = await ev(`window.__bench.image(${JSON.stringify(key)})`);
    if (url) writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
  };
  const res = { tag: TAG, variant: VARIANT, renders: [] };
  for (const [family, shape] of PANEL) {
    mkdirSync(join(OUT, family), { recursive: true });
    await page.open(`mode=bench&shape=${shape}&view=threeQuarter&rotate=0&seconds=1&size=${SIZE}`);
    for (const style of STYLES) {
      const r = await ev(`window.__bench.hdShot('s', '${style}', '${VARIANT}')`);
      const png = await ev("window.__bench.analyze('s')");
      const row = { family, style, ms: r.ms, png };
      if (png?.packBox) {
        const [x0, y0, x1, y1] = png.packBox;
        row.productWidthPct = +((100 * (x1 - x0 + 1)) / png.width).toFixed(1);
        row.productHeightPct = +((100 * (y1 - y0 + 1)) / png.height).toFixed(1);
        row.productAreaPct = +((100 * (x1 - x0 + 1) * (y1 - y0 + 1)) / (png.width * png.height)).toFixed(1);
        // how far the drawn area (shadow included) reaches beyond the pack, in % of the side
        const [dx0, , dx1, dy1] = png.drawnBox;
        row.shadowBeyondPackPct = { left: +((100 * (x0 - dx0)) / png.width).toFixed(1), right: +((100 * (dx1 - x1)) / png.width).toFixed(1), bottom: +((100 * (dy1 - y1)) / png.height).toFixed(1) };
      }
      const file = join(OUT, family, `${family}-${style}-${TAG}.png`);
      if (SAVE.has(family) && SAVE_STYLES.has(style)) {
        await save("s", file);
        if (BEFORE) {
          // same pack, same angle, another framing: the pack's own silhouette must not change
          const prev = join(BEFORE, family, `${family}-${style}-before.png`);
          if (existsSync(prev)) {
            await ev(`window.__bench.put('b', ${JSON.stringify(`data:image/png;base64,${readFileSync(prev).toString("base64")}`)})`);
            row.silhouetteVsBefore = await ev("window.__bench.cropIoU('s', 'b')");
            await ev("window.__bench.drop('b')");
          }
        }
      }
      await ev("window.__bench.drop('s')");
      res.renders.push(row);
      log(family, style, "ms", r.ms, "product W/H %", row.productWidthPct, row.productHeightPct, "border", png?.borderMaxAlpha, "shadow+", JSON.stringify(row.shadowBeyondPackPct), row.silhouetteVsBefore ? `IoU ${row.silhouetteVsBefore.iou}` : "");
    }
  }
  writeFileSync(join(OUT, `metrics-3dd-${TAG}.json`), JSON.stringify({ ...metrics, suite: res }, null, 2));
  log("done →", OUT);
  ws.close();
  chrome.kill();
  process.exit(0);
}

if (SUITE === "3dc") {
  // Phase 3D-C: the export picture (src/lib/three/hdExport.ts) — resolution, the seven formats,
  // interactive vs HD, design changes, viewer isolation, WebGL cleanup. Writes metrics-3dc-<tag>.json.
  const ev = (x) => page.evaluate(x);
  const res = { tag: TAG, formats: [] };
  const save = async (key, file) => {
    const url = await ev(`window.__bench.image(${JSON.stringify(key)})`);
    if (url) writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
  };
  const open = (shape, extra = "") => page.open(`mode=bench&shape=${shape}&view=threeQuarter&rotate=0&seconds=1&size=${SIZE}${extra}`);

  // 1. Resolution: time and PNG size per side (heaviest pack: glass; lightest: box).
  res.resolution = [];
  for (const [family, shape] of [["glass", "juice-bottle"], ["box", "folding-box-standard"]]) {
    await open(shape);
    for (const size of [1024, 1600, 2048, 3072]) {
      const runs = [];
      for (let k = 0; k < 2; k++) runs.push(await ev(`window.__bench.hdExport('r${size}_${k}', ${size})`));
      const a = await ev(`window.__bench.analyze('r${size}_0')`);
      res.resolution.push({ family, size, ms: runs.map((r) => r.ms), width: a.width, pngBytes: a.pngBytes, jsHeapMB: runs[1].jsHeapMB });
      log("resolution", family, size, "ms", runs.map((r) => r.ms).join("/"), "png", Math.round(a.pngBytes / 1024), "KB", "→", a.width);
    }
  }

  // 2. The seven formats: export (cold + 2 warm), integrity, framing, determinism, interactive vs HD.
  for (const [family, shape] of PANEL) {
    mkdirSync(join(OUT, family), { recursive: true });
    await open(shape);
    const r = { family, shape };
    r.viewerBefore = await ev("window.__bench.viewerState()");
    await ev("window.__bench.viewerPng('viewer')");
    await ev("window.__bench.hdMatched('matched')");
    r.interactiveVsHd = await ev("window.__bench.compare('viewer', 'matched')");
    r.exports = [await ev("window.__bench.hdExport('e1')"), await ev("window.__bench.hdExport('e2')"), await ev("window.__bench.hdExport('e3')")];
    r.png = await ev("window.__bench.analyze('e1')");
    r.determinism = await ev("window.__bench.compare('e2', 'e3')");
    r.viewerAfter = await ev("window.__bench.viewerState()");
    await save("e1", join(OUT, family, `${family}-hd-export.png`));
    await save("viewer", join(OUT, family, `${family}-viewer-640.png`));
    await save("matched", join(OUT, family, `${family}-hd-matched-640.png`));
    res.formats.push(r);
    log(family, "export ms", r.exports.map((x) => x.ms).join("/"), r.exports[0].engine, "png", r.png.width, Math.round(r.png.pngBytes / 1024) + "KB",
      "alpha", JSON.stringify(r.png.alpha), "edge", r.png.touchesEdge, "IoU", r.interactiveVsHd?.silhouetteIoU, "det strong%", r.determinism?.strongPct);
  }

  // 3. Design changes on the pot: each export shows the current design, never the previous one.
  await open("cosmetic-jar");
  const ch = { base: await ev("window.__bench.hdExport('d0')") };
  for (const [kind, key, prev] of [["text", "d1", "d0"], ["color", "d2", "d1"], ["art", "d3", "d2"]]) {
    await ev(`window.__bench.change('${kind}')`);
    ch[kind] = { export: await ev(`window.__bench.hdExport('${key}')`), again: await ev(`window.__bench.hdExport('${key}b')`) };
    ch[kind].vsPrevious = await ev(`window.__bench.compare('${prev}', '${key}')`);
    ch[kind].vsSameDesignAgain = await ev(`window.__bench.compare('${key}', '${key}b')`);
    log("change", kind, "vs previous strong%", ch[kind].vsPrevious.strongPct, "vs same again strong%", ch[kind].vsSameDesignAgain.strongPct);
  }
  await ev("window.__bench.setShape('juice-bottle')");
  ch.packaging = { export: await ev("window.__bench.hdExport('d4')"), vsPrevious: await ev("window.__bench.compare('d3', 'd4')") };
  await save("d1", join(OUT, "pot", "pot-hd-after-text.png"));
  await save("d4", join(OUT, "pot", "pot-hd-after-packaging-change.png"));
  log("change packaging IoU vs pot", ch.packaging.vsPrevious.silhouetteIoU);
  res.changes = ch;

  // 4. Viewer isolation: orbit → export → the viewer is exactly where the user left it, then still works.
  await open("cosmetic-jar");
  await page.drag(-180, 40);
  await sleep(2500);
  const iso = { before: await ev("window.__bench.viewerState()") };
  iso.export = await ev("window.__bench.hdExport('iso')");
  iso.after = await ev("window.__bench.viewerState()");
  let t = await ev("window.__bench.mark()");
  await sleep(5000);
  iso.idleAfterExport = await ev(`window.__bench.stats(${t}, window.__bench.mark())`);
  await page.drag(120, -20);
  await sleep(1500);
  iso.afterSecondOrbit = await ev("window.__bench.viewerState()");
  iso.face = await ev("window.__bench.setView('front')");
  iso.threeQuarter = await ev("window.__bench.setView('threeQuarter')");
  iso.back = await ev("window.__bench.setView('back')");
  iso.recenter = await ev("window.__bench.recenter()");
  iso.final = await ev("window.__bench.viewerState()");
  res.isolation = iso;
  log("isolation", JSON.stringify({ before: iso.before.camera.position, after: iso.after.camera.position, framesDuring: iso.export.viewerFramesDuringExport, idle: iso.idleAfterExport.frames, ids: iso.final.rendererIds, lost: iso.final.contextLost }));

  // 5. Cleanup: 20 exports in a row (512 px) — a leaked context would hit Chrome's limit (16) and kill the viewer's.
  await open("beverage-can");
  const w0 = pageWarnings.length;
  const leak = { exports: [] };
  for (let k = 0; k < 20; k++) leak.exports.push((await ev(`window.__bench.hdExport('l${k}', 512)`)).ms);
  leak.webglContextsCreated = await ev("window.__bench.contexts()");
  leak.viewer = await ev("window.__bench.viewerState()");
  leak.viewAfter = await ev("window.__bench.setView('front')");
  leak.viewerFramesAfterView = (await ev("window.__bench.viewerState()")).frames - leak.viewer.frames;
  leak.webglWarnings = pageWarnings.slice(w0);
  leak.jsHeapMBAfter = (await ev("window.__bench.hdExport('lastHeap', 512)")).jsHeapMB;
  res.cleanup = leak;
  log("cleanup", JSON.stringify({ contexts: leak.webglContextsCreated, lost: leak.viewer.contextLost, framesAfterView: leak.viewerFramesAfterView, warnings: leak.webglWarnings.length }));

  writeFileSync(join(OUT, `metrics-3dc-${TAG}.json`), JSON.stringify({ ...metrics, suite: res }, null, 2));
  log("done →", OUT);
  ws.close();
  chrome.kill();
  process.exit(0);
}

if (SUITE === "3db") {
  // Phase 3D-B checks: camera persistence (A-D), view buttons without remount (E-H), idle / interaction
  // rendering, stale artwork, resize. Same page, same design, same machine as the baseline.
  const ev = (x) => page.evaluate(x);
  const res = { tag: TAG };
  const idle = async (ms = 5000) => {
    const t = await ev("window.__bench.mark()");
    await sleep(ms);
    return ev(`window.__bench.stats(${t}, window.__bench.mark())`);
  };

  // A-D + resize + interaction on the live viewer (pot, ¾).
  const r0 = await page.open(`mode=bench&shape=cosmetic-jar&view=threeQuarter&rotate=0&seconds=${SECONDS}&scenario=camera&size=${SIZE}`);
  res.idleStatic = { fps: r0.fps, viewer: r0.viewer };
  res.cameraStart = r0.cameraStart;
  await page.drag(-180, 40);
  await sleep(1500);
  res.afterOrbit = await ev("window.__bench.camera()");
  for (const kind of ["text", "color", "art"]) {
    res[`after_${kind}`] = await ev(`window.__bench.change('${kind}')`);
    res[`art_${kind}`] = await ev("window.__bench.artCheck()");
    log(kind, JSON.stringify(res[`after_${kind}`].cameraAfter), "stale check", JSON.stringify(res[`art_${kind}`]));
  }
  res.idleAfterEdits = await idle();
  res.packagingChange = [];
  for (const id of ["shampoo-bottle", "folding-box-standard", "beverage-can"]) {
    const r = await ev(`window.__bench.setShape('${id}')`);
    res.packagingChange.push(r);
    log("shape", id, JSON.stringify(r.camera), "visible corners", r.visibleCorners);
  }
  res.resize = [await ev("window.__bench.resize(480, 640)"), await ev(`window.__bench.resize(${SIZE}, ${SIZE})`)];
  log("resize", JSON.stringify(res.resize.map((x) => [x.aspect, x.visibleCorners, x.framesDuring2sAfterSettle, x.rendererId])));
  let t = await ev("window.__bench.mark()");
  await page.orbitFor(3000);
  res.orbitInteraction = await ev(`window.__bench.stats(${t}, window.__bench.mark())`);
  res.idleAfterOrbit = await idle();
  t = await ev("window.__bench.mark()");
  res.zoomInput = await page.zoomFor(2000);
  res.zoomInteraction = await ev(`window.__bench.stats(${t}, window.__bench.mark())`);
  res.idleAfterZoom = await idle();
  await ev("window.__bench.setRotate(true)");
  res.autoRotate = await idle();
  await ev("window.__bench.setRotate(false)");
  await sleep(1000);
  res.idleAfterAutoRotate = await idle();
  res.rendererIdsViewer = await ev("window.__bench.rendererIds()");
  log("orbit fps", res.orbitInteraction.fpsAvg, "zoom fps", res.zoomInteraction.fpsAvg, "wheel ev/s", res.zoomInput?.wheelEventsPerSecond, "autorotate fps", res.autoRotate.fpsAvg, "idle frames", res.idleStatic.fps.frames, res.idleAfterOrbit.frames, res.idleAfterAutoRotate.frames);

  // E-H on the real PreviewStage (its own buttons).
  await page.open(`mode=bench&shape=cosmetic-jar&scenario=stage&seconds=1&size=${SIZE}`);
  const step = async (label) => {
    const clicked = await ev(`window.__bench.clickButton('${label}')`);
    await sleep(1200);
    const id = await ev("window.__bench.rewrap()");
    await sleep(300);
    return { label, clicked, ...id, camera: await ev("window.__bench.camera()") };
  };
  res.stage = { start: await ev("window.__bench.rewrap()") };
  res.stage.face = await step("Face");
  res.stage.threeQuarter = await step("¾");
  await page.drag(-150, 30);
  await sleep(1500);
  res.stage.afterOrbit = await ev("window.__bench.camera()");
  res.stage.recenter = await step("Recentrer");
  res.stage.back = await step("Dos");
  res.stage.idleAfterViews = await idle();
  res.stage.rendererIds = await ev("window.__bench.rendererIds()");
  res.stage.webglContexts = await ev("window.__bench.contexts()");
  log("stage", JSON.stringify({ ids: res.stage.rendererIds, contexts: res.stage.webglContexts, idle: res.stage.idleAfterViews.frames }));

  writeFileSync(join(OUT, `metrics-3db-${TAG}.json`), JSON.stringify({ ...metrics, suite: res }, null, 2));
  log("done →", OUT);
  ws.close();
  chrome.kill();
  process.exit(0);
}

const shots = [];
for (const [family, shape] of PANEL) {
  mkdirSync(join(OUT, family), { recursive: true });
  for (const [view, slug] of VIEWS) {
    const r = await page.open(`mode=bench&shape=${shape}&view=${view}&rotate=0&seconds=${SECONDS}&size=${SIZE}`);
    const file = join(OUT, family, `${family}-${slug}.png`);
    await page.shot(file);
    shots.push({ family, view: slug, file });
    metrics.runs.push({ kind: "static", family, ...r });
    log(family, view, "fps", r.fps.fpsAvg, "calls", r.fps.info?.drawCalls);
  }
  const rot = await page.open(`mode=bench&shape=${shape}&view=threeQuarter&rotate=1&seconds=${SECONDS}&size=${SIZE}`);
  metrics.runs.push({ kind: "rotating", family, ...rot });
  log(family, "rotating fps", rot.fps.fpsAvg);
}

const dpr2 = await newPage({ dpr: 2 });
for (const [family, shape] of PANEL) {
  const r = await dpr2.open(`mode=bench&shape=${shape}&view=threeQuarter&rotate=1&seconds=${SECONDS}&size=${SIZE}`);
  metrics.runs.push({ kind: "rotating-dpr2", family, ...r });
  log(family, "dpr2 fps", r.fps.fpsAvg);
}
await dpr2.close();

const weak = await newPage({ weak: true });
for (const [family, shape] of PANEL) {
  const r = await weak.open(`mode=bench&shape=${shape}&view=threeQuarter&rotate=0&seconds=${SECONDS}&size=${SIZE}`);
  await weak.shot(join(OUT, family, `${family}-three-quarter-low.png`));
  metrics.runs.push({ kind: "static-low", family, ...r });
  log(family, "LOW fps", r.fps.fpsAvg, r.env.previewQuality?.materialQuality);
}
await weak.close();

for (const [family, shape] of PANEL) {
  const r = await page.open(`mode=bench&shape=${shape}&hd=1&size=800`);
  const url = await page.evaluate("window.__bench.hdImage");
  if (url) writeFileSync(join(OUT, family, `${family}-hd-three-quarter.png`), Buffer.from(url.split(",")[1], "base64"));
  metrics.runs.push({ kind: "hd", family, ...r });
  log(family, "HD ms", r.hd?.ms);
}

// Rebuild scenario (pot): text, colour, illustration.
const rb = await page.open(`mode=bench&shape=cosmetic-jar&view=threeQuarter&rotate=0&seconds=2&scenario=rebuild&size=${SIZE}`);
metrics.runs.push({ kind: "rebuild", family: "pot", ...rb });
log("rebuild", JSON.stringify(rb.rebuild));

// Camera scenario (pot): orbit by hand, then edit the text and a colour.
const cam = await page.open(`mode=bench&shape=cosmetic-jar&view=threeQuarter&rotate=0&seconds=1&scenario=camera&size=${SIZE}`);
await page.drag(-180, 40);
await sleep(1500);
const afterDrag = await page.evaluate("window.__bench.camera()");
await page.shot(join(OUT, "pot", "camera-1-after-orbit.png"));
const afterText = await page.evaluate("window.__bench.change('text')");
await page.shot(join(OUT, "pot", "camera-2-after-text.png"));
const afterColor = await page.evaluate("window.__bench.change('color')");
await page.shot(join(OUT, "pot", "camera-3-after-color.png"));
metrics.runs.push({ kind: "camera", family: "pot", env: cam.env, start: cam.cameraStart, afterDrag, afterText, afterColor });
log("camera", JSON.stringify({ start: cam.cameraStart, afterDrag, afterText: afterText.cameraAfter, afterColor: afterColor.cameraAfter }));

// Contact sheet: the captures as they are (drawImage only, no processing).
const imgs = shots.map((x) => ({ ...x, data: `data:image/png;base64,${readFileSync(x.file).toString("base64")}` }));
await page.s("Page.navigate", { url: "about:blank" });
await sleep(300);
const T = 320, HEAD = 48, LEFT = 90;
const sheet = await page.evaluate(`(async () => {
  const shots = ${JSON.stringify(imgs.map(({ family, view, data }) => ({ family, view, data })))};
  const fams = [...new Set(shots.map((s) => s.family))], views = ["front", "three-quarter", "back"];
  const c = document.createElement("canvas");
  c.width = ${LEFT} + views.length * ${T}; c.height = ${HEAD} + 24 + fams.length * ${T};
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#111"; g.font = "bold 20px sans-serif";
  g.fillText(${JSON.stringify(LABEL)} + "  ·  ${commit.slice(0, 7)}  ·  aperçu MEDIUM, DPR 1", 12, 30);
  g.font = "14px sans-serif";
  views.forEach((v, i) => g.fillText(v, ${LEFT} + i * ${T} + 8, ${HEAD} + 16));
  for (const s of shots) {
    const img = new Image(); img.src = s.data; await img.decode();
    const r = fams.indexOf(s.family), k = views.indexOf(s.view);
    g.drawImage(img, ${LEFT} + k * ${T}, ${HEAD} + 24 + r * ${T}, ${T}, ${T});
    if (k === 0) g.fillText(s.family, 10, ${HEAD} + 24 + r * ${T} + ${T} / 2);
  }
  return c.toDataURL("image/png");
})()`);
writeFileSync(join(OUT, "baseline-sheet.png"), Buffer.from(sheet.split(",")[1], "base64"));

writeFileSync(join(OUT, "metrics.json"), JSON.stringify(metrics, null, 2));
log("done →", OUT);
ws.close();
chrome.kill();
process.exit(0);
