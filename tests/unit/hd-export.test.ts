/**
 * Phase 3D-C / 3D-D — HD export of the 3D picture (export ZIP): shot, product-first framing, shadow.
 *
 * The browser rendering itself (WebGL) is measured by the 3D bench (scripts/bench-3d.mjs --suite 3dc);
 * these tests pin the contracts that do not need a GPU: the export shot, the shadow-aware framing,
 * the ZIP wiring (never a capture of the live canvas) and the cleanup of the HD renderer.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { HD_EXPORT } from "@/lib/three/hdExport";
import { shadowFramePoints, shadowReach } from "@/lib/three/hdRender";
import { CAMERA_PRESETS, LIGHTING_PRESETS, SHOT_STYLES, frameShot, shotDirection } from "@/lib/three/scenePresets";

const src = (p: string) => readFileSync(p, "utf8");

describe("3D-C. export HD", () => {
  it("prise de vue du système (heroPremium), PNG transparent, ombre cadrée, 2048 px", () => {
    expect(HD_EXPORT.camera).toBe(SHOT_STYLES.heroPremium.camera);
    expect(HD_EXPORT.lighting).toBe(SHOT_STYLES.heroPremium.lighting);
    expect(HD_EXPORT.background).toBe("transparent");
    expect(HD_EXPORT.frame).toBe("packAndShadow");
    expect(HD_EXPORT.size).toBe(2048);
    expect(HD_EXPORT.fallbackSize).toBe(1400);
    // 3D-D: default request and the shadow's share of the frame
    expect(HD_EXPORT.defaultStyle).toBe("heroPremium");
    expect(HD_EXPORT.shadowAllowance).toBe(0.25);
  });

  const PACKS: [string, number, number, number][] = [["bouteille", 0.34, 1, 0.34], ["pot", 1, 0.77, 1], ["sachet", 0.42, 1, 0.19], ["tube fin", 0.15, 1, 0.15], ["boîte plate", 1, 0.2, 0.7]];
  const boxOf = (w: number, h: number, d: number) => new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2));

  it("3D-C (sans plafond) : la portée de l'ombre va jusqu'au bout de l'ombre portée", () => {
    const lighting = LIGHTING_PRESETS.premium;
    const [lx, ly, lz] = shotDirection(lighting.key.azimuth, lighting.key.elevation);
    for (const [, w, h, d] of PACKS) {
      const box = boxOf(w, h, d);
      const r = shadowReach(box, lighting);
      expect(r.clamped).toBe(false);
      const t = h / ly;
      // every projected top corner is within the reach
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) expect(Math.hypot(x - lx * t, z - lz * t)).toBeLessThanOrEqual(r.end + 1e-9);
    }
  });

  it("3D-D : l'ombre a une part contrôlée du cadre (plafond = footprint + 25 % du plus grand côté) ; une ombre courte n'est pas touchée", () => {
    for (const lighting of [LIGHTING_PRESETS.premium, LIGHTING_PRESETS.dramatic, LIGHTING_PRESETS.natural, LIGHTING_PRESETS.ecommerce]) {
      for (const [, w, h, d] of PACKS) {
        const box = boxOf(w, h, d);
        const full = shadowReach(box, lighting);
        const capped = shadowReach(box, lighting, HD_EXPORT.shadowAllowance);
        const limit = Math.hypot(w, d) / 2 + HD_EXPORT.shadowAllowance * Math.max(w, h, d);
        expect(capped.end).toBeLessThanOrEqual(limit + 1e-9);
        expect(capped.end).toBeLessThanOrEqual(full.end + 1e-9);
        expect(capped.clamped).toBe(full.end > limit);
        if (!capped.clamped) expect(capped.end).toBeCloseTo(full.end, 9);
      }
    }
    // the low dramatic light casts a long shadow: always capped
    expect(shadowReach(boxOf(0.34, 1, 0.34), LIGHTING_PRESETS.dramatic, 0.25).clamped).toBe(true);
  });

  it("une lumière verticale ne fait pas d'ombre à cadrer", () => {
    const zenith = { ...LIGHTING_PRESETS.premium, key: { ...LIGHTING_PRESETS.premium.key, elevation: 90 } };
    const r = shadowReach(boxOf(1, 1, 1), zenith);
    expect(r.tips).toHaveLength(0);
    expect(shadowFramePoints(boxOf(1, 1, 1), zenith)).toHaveLength(0);
  });

  it("frameShot : sans points en plus, résultat identique ; avec l'ombre, même visée (pack centré), recul juste nécessaire", () => {
    const lighting = LIGHTING_PRESETS.premium;
    for (const [, w, h, d] of PACKS) {
      const box = boxOf(w, h, d);
      const bounds = { min: box.min.toArray() as [number, number, number], max: box.max.toArray() as [number, number, number] };
      const plain = frameShot(bounds, CAMERA_PRESETS.hero, 1);
      expect(frameShot(bounds, CAMERA_PRESETS.hero, 1, [])).toEqual(plain);
      const pts = shadowFramePoints(box, lighting, HD_EXPORT.shadowAllowance);
      const f = frameShot(bounds, CAMERA_PRESETS.hero, 1, pts);
      expect(f.target).toEqual(plain.target);
      expect(f.distance).toBeGreaterThanOrEqual(plain.distance - 1e-9);
      // every shadow point lands inside the frame (minus the preset margin)
      const cam = new THREE.PerspectiveCamera(f.fov, 1, f.near, f.far);
      cam.position.set(...f.position);
      cam.lookAt(...f.target);
      cam.updateMatrixWorld();
      for (const p of pts) {
        const v = new THREE.Vector3(...p).project(cam);
        expect(Math.abs(v.x)).toBeLessThanOrEqual(1 - CAMERA_PRESETS.hero.margin + 1e-6);
        expect(Math.abs(v.y)).toBeLessThanOrEqual(1 - CAMERA_PRESETS.hero.margin + 1e-6);
      }
      // the product-first framing never pulls back more than the whole-shadow one
      const whole = frameShot(bounds, CAMERA_PRESETS.hero, 1, shadowFramePoints(box, lighting));
      expect(f.distance).toBeLessThanOrEqual(whole.distance + 1e-9);
    }
  });

  it("l'estompage de l'ombre est réservé à l'export : le viewer, les miniatures et le rendu pub ne l'appellent pas", () => {
    for (const p of ["src/components/workspace/Packaging3DViewer.tsx", "src/lib/three/thumbnails.ts", "src/lib/three/adRender.ts"]) expect(src(p)).not.toMatch(/setShadowFalloff|shadowAllowance/);
    const hd = src("src/lib/three/hdRender.ts");
    expect(hd).toMatch(/if \(reach\.clamped\) rig\.setShadowFalloff\(/);
  });

  it("le ZIP prend l'image HD du design appliqué, jamais une capture du canvas interactif ; noms de fichiers inchangés", () => {
    const ws = src("src/components/workspace/EdifyWorkspace.tsx");
    const zip = ws.slice(ws.indexOf("const handleDownloadZip"), ws.indexOf("const handleShare"));
    // PI-6: the shot decided by the Master Design Intent goes through the 3D-D path (renderExportPreview(…, { shot }))
    expect(zip).toMatch(/renderExportPreview\(shape, spec, design, exportShot \? \{ shot: \{ style: exportShot \} \} : \{\}\)/);
    expect(zip).toMatch(/const design = checked\?\.design \?\? fullDesign;/);
    expect(zip).not.toMatch(/captureRef/);
    for (const name of ["-impression.pdf", "-apercu-3d.png", "-modele-3d.glb", "fiche-technique.json"]) expect(zip).toContain(name);
    expect(src("src/lib/three/hdExport.ts")).not.toMatch(/captureRef|onCaptureReady|Packaging3DViewer/);
  });

  it("le rendu HD charge les polices du design puis libère tout (renderer, contexte, cibles, pack), même en cas d'erreur", () => {
    const hd = src("src/lib/three/hdRender.ts");
    const fn = hd.slice(hd.indexOf("export async function renderHD"));
    expect(fn.indexOf("await loadDesignFonts(opts.design)")).toBeGreaterThan(-1);
    expect(fn.indexOf("await loadDesignFonts(opts.design)")).toBeLessThan(fn.indexOf("new THREE.WebGLRenderer"));
    // the whole setup is inside try { } finally { }
    expect(fn.indexOf("  try {\n    renderer.setPixelRatio(1);")).toBeGreaterThan(-1);
    const fin = fn.slice(fn.lastIndexOf("} finally {"));
    for (const call of ["rig.dispose()", "disposeObject(object)", "t.dispose()", "d.dispose()", "renderer.dispose()", "renderer.forceContextLoss()"]) expect(fin).toContain(call);
  });
});
