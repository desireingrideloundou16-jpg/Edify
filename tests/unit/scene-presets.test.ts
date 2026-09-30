import { describe, expect, it } from "vitest";
import {
  CAMERA_IDS, CAMERA_PRESETS, LIGHTING_IDS, LIGHTING_PRESETS, SHOT_STYLES,
  chooseQuality, frameShot, fovFromFocal, resolveCamera, resolveLighting, resolveShot, shotDirection,
  type Bounds, type GraphicsCaps,
} from "@/lib/three/scenePresets";
import { studioScene } from "@/lib/three/studioEnvironment";

const HEX = /^#[0-9a-f]{6}$/i;
const unit = (x: number) => x >= 0 && x <= 1;

describe("presets d'éclairage", () => {
  it("chaque preset est complet et physiquement plausible", () => {
    expect(Object.keys(LIGHTING_PRESETS).sort()).toEqual([...LIGHTING_IDS].sort());
    for (const [id, p] of Object.entries(LIGHTING_PRESETS)) {
      expect(p.id).toBe(id);
      expect(p.exposure).toBeGreaterThan(0.5);
      expect(p.exposure).toBeLessThan(2);
      for (const c of [p.environment.tint, p.key.color, p.background, p.fill?.color, p.rim?.color].filter(Boolean)) expect(c).toMatch(HEX);
      expect(unit(p.shadow.opacity) && unit(p.shadow.contactOpacity)).toBe(true);
      expect(p.key.elevation).toBeGreaterThan(0); // a key light under the floor casts no shadow
      expect(p.environment.panels.length).toBeGreaterThan(0);
      for (const panel of p.environment.panels) {
        expect(panel.width * panel.height * panel.intensity * panel.distance).toBeGreaterThan(0);
        if (panel.color) expect(panel.color).toMatch(HEX);
      }
    }
  });

  it("anciens noms conservés, id inconnu → preset premium par défaut", () => {
    expect(resolveLighting("studio").id).toBe("premium");
    expect(resolveLighting("warm").id).toBe("natural");
    expect(resolveLighting("soft").id).toBe("soft");
    expect(resolveLighting("n'importe quoi").id).toBe("premium");
    expect(resolveLighting(undefined).id).toBe("premium");
  });

  it("le studio procédural contient la pièce et un panneau par softbox, placés autour du pack", () => {
    const env = LIGHTING_PRESETS.premium.environment;
    const scene = studioScene(env);
    expect(scene.children.length).toBe(env.panels.length + 1);
    const panel = scene.children[1];
    expect(panel.position.distanceTo({ x: 0, y: 0.5, z: 0 } as never)).toBeCloseTo(env.panels[0].distance, 5);
  });
});

describe("presets caméra et composition automatique", () => {
  const packs: Record<string, Bounds> = {
    bouteille: { min: [-0.12, 0, -0.12], max: [0.12, 1, 0.12] },
    boite: { min: [-0.5, 0, -0.35], max: [0.5, 0.3, 0.35] },
    sachet: { min: [-0.35, 0, -0.08], max: [0.35, 1, 0.08] },
  };

  it("chaque preset est valide", () => {
    expect(Object.keys(CAMERA_PRESETS).sort()).toEqual([...CAMERA_IDS].sort());
    for (const [id, c] of Object.entries(CAMERA_PRESETS)) {
      expect(c.id).toBe(id);
      expect(c.focalMm).toBeGreaterThan(10);
      expect(c.margin >= 0 && c.margin < 0.5).toBe(true);
      expect(c.zoom).toBeGreaterThan(0);
      expect(unit(c.aimHeight) && unit(c.aimFront) && c.aperture >= 0).toBe(true);
    }
    expect(resolveCamera("inconnu").id).toBe("threeQuarter");
    expect(fovFromFocal(50)).toBeCloseTo(27, 0);
  });

  it("le pack entier tient dans le cadre avec sa marge, quel que soit le format", () => {
    for (const bounds of Object.values(packs)) for (const aspect of [0.6, 1, 1.78]) {
      for (const shot of Object.values(CAMERA_PRESETS).filter((s) => s.zoom === 1)) {
        const f = frameShot(bounds, shot, aspect);
        const [px, py, pz] = f.position;
        const fwd = [f.target[0] - px, f.target[1] - py, f.target[2] - pz];
        const l = Math.hypot(...fwd);
        const F = fwd.map((v) => v / l);
        const up0 = Math.abs(F[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0];
        const R = [F[1] * up0[2] - F[2] * up0[1], F[2] * up0[0] - F[0] * up0[2], F[0] * up0[1] - F[1] * up0[0]];
        const rl = Math.hypot(...R);
        const Rn = R.map((v) => v / rl);
        const U = [Rn[1] * F[2] - Rn[2] * F[1], Rn[2] * F[0] - Rn[0] * F[2], Rn[0] * F[1] - Rn[1] * F[0]];
        const tV = Math.tan((f.fov * Math.PI) / 360);
        for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
          const c = [x - px, y - py, z - pz];
          const depth = c[0] * F[0] + c[1] * F[1] + c[2] * F[2];
          expect(depth).toBeGreaterThan(0);
          // camera lifting (never below the floor) may only move corners inward vertically by a hair
          expect(Math.abs(c[0] * Rn[0] + c[1] * Rn[1] + c[2] * Rn[2]) / depth).toBeLessThanOrEqual(tV * aspect * 1.001);
          expect(Math.abs(c[0] * U[0] + c[1] * U[1] + c[2] * U[2]) / depth).toBeLessThanOrEqual(tV * 1.05);
        }
        if (!shot.allowBelowGround) expect(py).toBeGreaterThanOrEqual(bounds.min[1]);
      }
    }
  });

  it("gros plan plus serré que la vue ¾, hero plus bas que la plongée, dessous sous le sol", () => {
    const b = packs.bouteille;
    expect(frameShot(b, CAMERA_PRESETS.closeUp, 1).distance).toBeLessThan(frameShot(b, CAMERA_PRESETS.threeQuarter, 1).distance);
    expect(frameShot(b, CAMERA_PRESETS.hero, 1).position[1]).toBeLessThan(frameShot(b, CAMERA_PRESETS.top, 1).position[1]);
    expect(frameShot(b, CAMERA_PRESETS.bottom, 1).position[1]).toBeLessThan(0);
    const d = shotDirection(0, 0);
    expect(d[2]).toBeCloseTo(1); // azimuth 0 = in front of the pack (+z)
  });
});

describe("qualité PREVIEW / HD et repli", () => {
  const caps = (o: Partial<GraphicsCaps> = {}): GraphicsCaps => ({ webgl: true, webgl2: true, webgpu: false, mobile: false, lowEnd: false, maxTextureSize: 16384, ...o });

  it("sans WebGL → null (l'interface affiche son repli 2D, jamais un écran noir)", () => {
    expect(chooseQuality("preview", caps({ webgl: false, webgl2: false }))).toBeNull();
    expect(chooseQuality("hd", caps({ webgl: false }))).toBeNull();
  });

  it("appareil modeste ou mobile → aperçu allégé, HD avec moins d'échantillons", () => {
    const desk = chooseQuality("preview", caps())!;
    const phone = chooseQuality("preview", caps({ mobile: true }))!;
    expect(phone.maxPixelRatio).toBeLessThan(desk.maxPixelRatio);
    expect(phone.shadowMapSize).toBeLessThan(desk.shadowMapSize);
    expect(chooseQuality("hd", caps({ lowEnd: true }))!.samples).toBeLessThan(chooseQuality("hd", caps())!.samples);
    expect(chooseQuality("hd", caps({ webgl2: false }))!.samples).toBeLessThan(chooseQuality("hd", caps())!.samples);
    expect(chooseQuality("hd", caps({ maxTextureSize: 1024 }))!.maxSize).toBe(1024);
    expect(desk.samples).toBe(1); // the preview never accumulates
  });
});

describe("demandes de prise de vue (future couche IA)", () => {
  it("style nommé, surcharge explicite, valeurs invalides", () => {
    expect(resolveShot({ style: "heroPremium" })).toMatchObject({ camera: { id: "hero" }, lighting: { id: "premium" }, quality: "preview" });
    expect(resolveShot({ style: "heroPremium", lighting: "dramatic", quality: "hd" })).toMatchObject({ lighting: { id: "dramatic" }, quality: "hd" });
    expect(resolveShot({ style: "???", camera: "???", lighting: "???" })).toMatchObject({ camera: { id: "threeQuarter" }, lighting: { id: "premium" } });
    expect(resolveShot()).toMatchObject({ camera: { id: "threeQuarter" }, lighting: { id: "premium" } });
    for (const s of Object.values(SHOT_STYLES)) {
      expect(CAMERA_PRESETS[s.camera]).toBeDefined();
      expect(LIGHTING_PRESETS[s.lighting]).toBeDefined();
    }
  });
});
