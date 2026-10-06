/**
 * Phase 3D-D — PI-5 → shot → HD export.
 *
 *   MasterDesignIntent → shotIntent → shotRequestFromIntent → resolveShot → renderExportPreview → renderHD
 *
 * PI-5 says WHY (a style); resolveShot stays the camera authority; the export only hands what resolveShot
 * produced to renderHD. renderHD itself (WebGL) is replaced by a spy: the bench measures the pictures.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMasterDesignIntent, shotRequestFromIntent } from "@/lib/intelligence/intent";
import { SHOT_STYLES, resolveShot, type ShotStyleId } from "@/lib/three/scenePresets";
import type { PackagingShape } from "@/components/workspace/Modals";

const renderHD = vi.fn<(opts: Record<string, unknown>) => Promise<string>>(async () => "data:image/png;base64,iVBORw0KGgo=");
vi.mock("@/lib/three/hdRender", () => ({ renderHD: (opts: Record<string, unknown>) => renderHD(opts) }));

const { HD_EXPORT, renderExportPreview, resolveExportShot } = await import("@/lib/three/hdExport");

const SHAPE = { id: "cosmetic-jar", name: "Pot crème", model: "jar", lengthMm: 65, widthMm: 65, heightMm: 50, material: "Verre dépoli" } as unknown as PackagingShape;
const SPEC = { model: "jar" as const, lengthMm: 65, widthMm: 65, heightMm: 50, material: "Verre dépoli" };
const DESIGN = { brandName: "Kola", productName: "Crème", palette: ["#fff", "#111", "#b3261e", "#e6a700"], headingFont: "Inter", bodyFont: "Inter" } as never;

describe("3D-D. intention PI-5 → prise de vue de l'export", () => {
  beforeEach(() => renderHD.mockClear());

  it("intention e-commerce → catalogEcommerce → exactement le même résultat que resolveShot({ style })", () => {
    const m = buildMasterDesignIntent({ brief: "chips de plantain", shot: { purpose: "ecommerce" } });
    expect(m.shotIntent).toMatchObject({ style: "catalogEcommerce", status: "resolved" });
    const req = shotRequestFromIntent(m);
    expect(req).toEqual({ style: "catalogEcommerce" });
    expect(resolveShot(req)).toEqual(resolveShot({ style: "catalogEcommerce" }));
    // the export resolves it the same way (only the quality tier is the export's)
    const { style, resolved } = resolveExportShot(req);
    expect(style).toBe("catalogEcommerce");
    expect(resolved.camera).toEqual(resolveShot({ style: "catalogEcommerce" }).camera);
    expect(resolved.lighting).toEqual(resolveShot({ style: "catalogEcommerce" }).lighting);
    expect(resolved.quality).toBe("hd");
  });

  it("chaque style existant arrive tel quel jusqu'à renderHD (caméra et éclairage de resolveShot, cadrage export)", async () => {
    for (const style of Object.keys(SHOT_STYLES) as ShotStyleId[]) {
      renderHD.mockClear();
      const r = await renderExportPreview(SHAPE, SPEC, DESIGN, { shot: { style }, size: 512 });
      const want = resolveShot({ style });
      expect(r?.engine).toBe("hd");
      expect(r?.shot).toEqual({ style, camera: want.camera.id, lighting: want.lighting.id });
      expect(renderHD).toHaveBeenCalledTimes(1);
      expect(renderHD.mock.calls[0][0]).toMatchObject({
        camera: want.camera.id, lighting: want.lighting.id, width: 512, height: 512,
        background: "transparent", frame: "packAndShadow", shadowAllowance: HD_EXPORT.shadowAllowance,
      });
    }
  });

  it("sans intention, ou une intention non résolue : la requête par défaut de l'export (heroPremium, contrat 3D-C)", async () => {
    const hero = resolveShot({ style: "heroPremium" });
    for (const req of [undefined, {}, shotRequestFromIntent(buildMasterDesignIntent({ brief: "chips", shot: { purpose: "social" } }))]) {
      renderHD.mockClear();
      const r = await renderExportPreview(SHAPE, SPEC, DESIGN, req ? { shot: req } : {});
      expect(r?.shot).toEqual({ style: "heroPremium", camera: hero.camera.id, lighting: hero.lighting.id });
      expect(renderHD.mock.calls[0][0]).toMatchObject({ camera: "hero", lighting: "premium" });
    }
    // an intent never invents a style: "social" stays unresolved and asks nothing of resolveShot
    expect(shotRequestFromIntent(buildMasterDesignIntent({ brief: "chips", shot: { purpose: "social" } }))).toEqual({});
  });

  it("déterministe et sans mutation : mêmes entrées, même configuration ; la requête n'est pas modifiée", () => {
    const req = Object.freeze({ style: "dramaticHero" as const });
    expect(JSON.stringify(resolveExportShot(req))).toBe(JSON.stringify(resolveExportShot(req)));
    expect(req).toEqual({ style: "dramaticHero" });
    // resolveShot's own contract is untouched
    expect(resolveShot()).toEqual(resolveShot({}));
    expect(resolveShot({ style: "heroPremium" }).camera.id).toBe("hero");
  });
});
