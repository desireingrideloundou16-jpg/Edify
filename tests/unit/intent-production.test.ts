/**
 * PI-6 — Master Design Intent in production, SHADOW MODE.
 *
 *   /api/design → shadowMasterDesignIntent (once) → validate → MASTER_DESIGN_INTENT_SHADOW log (no user text)
 *              → response.intent = { version, shotStyle } (the only operational output)
 *   client export → renderExportPreview(…, { shot: { style } }) → resolveExportShot → resolveShot → renderHD
 *
 * The design itself (the spec) must be identical with or without the intent. Mocks only the route's I/O
 * boundaries (auth, database, provider, AI usage logging) and renderHD (WebGL), as the existing tests do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { SHOT_STYLES, resolveShot, type ShotStyleId } from "@/lib/three/scenePresets";
import type { PackagingShape } from "@/components/workspace/Modals";
import type { CurrentDesign } from "@/lib/ai/designSpec";
import {
  MASTER_DESIGN_INTENT_VERSION, buildMasterDesignIntent, exportShotOf, intentLogFields, publicIntent, shadowMasterDesignIntent, shotRequestFromIntent, validateMasterDesignIntent,
} from "@/lib/intelligence/intent";

// ── Route I/O boundaries ─────────────────────────────────────────────────────
const logAiEvent = vi.fn(async () => {});
vi.mock("@/lib/admin/log", () => ({ logAiEvent }));
const geminiDesign = vi.fn();
vi.mock("@/lib/ai/gemini", () => ({ geminiDesign, GeminiError: class GeminiError extends Error {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { credits: 0, plan_expires_at: null, suspended: false } }) }) }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) }) }));
vi.mock("@/lib/billing/fairUse", () => ({ dailyAiCount: async () => 0, hasActivePlan: () => false }));
vi.mock("@/lib/billing/packaging", () => ({ resolveProject: async () => ({ id: "project-1", counted: false, ai_generations: 0 }) }));
// renderHD needs WebGL: a spy records what reaches it
const renderHD = vi.fn<(opts: Record<string, unknown>) => Promise<string>>(async () => "data:image/png;base64,iVBORw0KGgo=");
vi.mock("@/lib/three/hdRender", () => ({ renderHD: (opts: Record<string, unknown>) => renderHD(opts) }));

const { HD_EXPORT, renderExportPreview } = await import("@/lib/three/hdExport");
const { POST } = await import("@/app/api/design/route");

const SPEC = {
  shapeId: "pet-food-bag", styleId: "pet-friendly", layout: "label", motif: "none", artStyle: "flat", artSubject: "a dog", badge: "", origin: "", contentColor: "",
  adHeadline: "Croquant", adCta: "Commander", headingFont: "Montserrat", bodyFont: "Montserrat", palette: { background: "#fdf8f2", ink: "#2b2621", accent: "#8e1b3a", extra: "#d97706" },
  projectName: "Croquettes", brandName: "Rex", productName: "Croquettes", tagline: "", volume: "2 kg", details: "", ingredients: "", usage: "", rationale: "Test",
};
const CURRENT: CurrentDesign = { shapeId: "pet-food-bag", styleId: "x", brandName: "Maison Secrète", productName: "Recette Confidentielle", volume: "2 kg" };
const SHAPE = { id: "pet-food-bag", name: "Sac", model: "bag", lengthMm: 200, widthMm: 90, heightMm: 300, material: "Film PE" } as unknown as PackagingShape;
const PSPEC = { model: "bag" as const, lengthMm: 200, widthMm: 90, heightMm: 300, material: "Film PE" };
const DESIGN = { brandName: "Rex", productName: "Croquettes", palette: ["#fff", "#111", "#b3261e", "#e6a700"], headingFont: "Inter", bodyFont: "Inter" } as never;
const deepFreeze = <T,>(o: T): T => { if (o && typeof o === "object") { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

const request = (prompt: string, current: CurrentDesign = CURRENT) => new Request("http://localhost/api/design", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt, fresh: true, lockShapeId: current.shapeId, current }),
});
async function generate(prompt: string, env: Record<string, string | undefined> = {}, current: CurrentDesign = CURRENT) {
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  const lines: string[] = [];
  const info = vi.spyOn(console, "info").mockImplementation((l: unknown) => { lines.push(String(l)); });
  const res = await POST(request(prompt, current));
  const body = await res.json();
  info.mockRestore();
  for (const k of Object.keys(env)) delete process.env[k];
  return { status: res.status, body, intentLogs: lines.filter((l) => l.includes('"MASTER_DESIGN_INTENT_SHADOW"')).map((l) => JSON.parse(l)) };
}

beforeEach(() => {
  geminiDesign.mockReset();
  geminiDesign.mockResolvedValue(SPEC);
  renderHD.mockClear();
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});
afterEach(() => { for (const k of ["EDIFY_INTENT_SHADOW", "EDIFY_INTENT_EXPORT_SHOT", "EDIFY_REFERENCE_SHADOW"]) delete process.env[k]; });

describe("PI-6 — adaptateur (unitaires)", () => {
  const input = { brief: "Aliment pour chien 2 kg", current: CURRENT, shapeId: "pet-food-bag", references: "active" as const };

  it("A-B. un brief valide → MasterDesignIntent PI-5.0 valide, construit par PI-5 lui-même", () => {
    const r = shadowMasterDesignIntent(input);
    expect(r.failure).toBeNull();
    expect(r.intent?.version).toBe(MASTER_DESIGN_INTENT_VERSION);
    expect(r.validation).toEqual(validateMasterDesignIntent(r.intent!));
    expect(r.validation?.valid).toBe(true);
    expect(JSON.stringify(r.intent)).toBe(JSON.stringify(buildMasterDesignIntent({ brief: input.brief, content: { brandName: "Maison Secrète", productName: "Recette Confidentielle", volume: "2 kg" }, shapeId: "pet-food-bag", references: "active" })));
  });

  it("C. intention invalide → observable, aucune exception, pas de style transmis", () => {
    const r = shadowMasterDesignIntent({ ...input, brief: "ma nouvelle marque", current: { ...CURRENT, productName: "" } });
    expect(r.validation?.valid).toBe(false);
    expect(r).toMatchObject({ exportShot: null, exportShotReason: "invalidIntent", failure: null });
    expect(intentLogFields(r)).toMatchObject({ generated: true, valid: false, errors: ["PRODUCT_MISSING"] });
  });

  it("une panne inattendue est capturée : aucune exception, le produit continue sans style", () => {
    const broken = new Proxy({} as CurrentDesign, { get: () => { throw new Error("boom"); } });
    const r = shadowMasterDesignIntent({ ...input, current: broken });
    expect(r).toMatchObject({ intent: null, validation: null, exportShot: null, exportShotReason: "failure", failure: "boom" });
    expect(intentLogFields(r)).toMatchObject({ generated: false, failure: "boom", exportShot: null });
  });

  it("D-F. e-commerce → catalogEcommerce ; sans intention ou non résolu → aucun style (l'export garde heroPremium)", () => {
    expect(shadowMasterDesignIntent(input)).toMatchObject({ exportShot: "catalogEcommerce", exportShotReason: "applied" });
    expect(exportShotOf(null, null)).toEqual({ style: null, reason: "noIntent" });
    const social = buildMasterDesignIntent({ brief: "Aliment pour chien 2 kg", shot: { purpose: "social" } });
    expect(exportShotOf(social, validateMasterDesignIntent(social))).toEqual({ style: null, reason: "unresolved" });
    // a weak inference (one recognised word) is observed, never applied
    expect(shadowMasterDesignIntent({ ...input, brief: "croquettes pour chien" })).toMatchObject({ exportShot: null, exportShotReason: "lowConfidence" });
  });

  it("G-H. déterministe et sans mutation des entrées", () => {
    const frozen = deepFreeze(structuredClone(input));
    const a = shadowMasterDesignIntent(frozen), b = shadowMasterDesignIntent(frozen);
    expect(a).toEqual(b);
    expect(frozen).toEqual(input);
  });

  it("le log ne contient ni le brief, ni les textes de l'utilisateur, ni les titres de sources", () => {
    const r = shadowMasterDesignIntent({ ...input, brief: "Aliment pour chien 2 kg — secret client 0612345678" });
    const log = JSON.stringify(intentLogFields(r, 1.234));
    expect(log).not.toMatch(/secret|0612345678|Maison Secrète|Recette Confidentielle|Aliment pour chien|Codex|FAO/);
    expect(JSON.parse(log)).toMatchObject({ intentVersion: "PI-5.0", generated: true, valid: true, buildMs: 1.2, exportShot: "catalogEcommerce", shot: { style: "catalogEcommerce", status: "resolved" } });
    expect(publicIntent(r)).toEqual({ version: "PI-5.0", shotStyle: "catalogEcommerce" });
  });
});

describe("PI-6 — /api/design (flux réel)", () => {
  it("une seule construction par génération, journalisée ; la réponse porte seulement { version, shotStyle }", async () => {
    const { status, body, intentLogs } = await generate("Aliment pour chien 2 kg");
    expect(status).toBe(200);
    expect(intentLogs).toHaveLength(1);
    expect(intentLogs[0]).toMatchObject({ level: "info", code: "MASTER_DESIGN_INTENT_SHADOW", intentVersion: "PI-5.0", valid: true, exportShot: "catalogEcommerce" });
    expect(JSON.stringify(intentLogs[0])).not.toMatch(/Maison Secrète|Recette Confidentielle|Aliment pour chien/);
    expect(body.intent).toEqual({ version: "PI-5.0", shotStyle: "catalogEcommerce" });
    expect(Object.keys(body).sort()).toEqual(["counted", "credits", "engine", "intent", "projectId", "spec"]);
  });

  it("le design est identique avec ou sans l'intention (spec octet pour octet)", async () => {
    for (const brief of ["Aliment pour chien 2 kg", "parfum de luxe 50 ml", "ma nouvelle marque", "eau de javel 1 L"]) {
      const on = await generate(brief);
      const off = await generate(brief, { EDIFY_INTENT_SHADOW: "off" });
      expect(JSON.stringify(on.body.spec), brief).toBe(JSON.stringify(off.body.spec));
      expect(off.body.intent).toBeUndefined();
      expect(off.intentLogs).toEqual([]);
      const { intent: _intent, ...rest } = on.body;
      void _intent;
      expect(rest).toEqual(off.body);
    }
  });

  it("intention invalide : la génération continue normalement, sans style", async () => {
    const { status, body, intentLogs } = await generate("ma nouvelle marque", {}, { ...CURRENT, productName: "", brandName: "" });
    expect(status).toBe(200);
    expect(body.spec).toBeDefined();
    expect(body.intent).toEqual({ version: "PI-5.0", shotStyle: null });
    expect(intentLogs[0]).toMatchObject({ valid: false, errors: ["PRODUCT_MISSING"], exportShotReason: "invalidIntent" });
  });

  it("repli local (fournisseur en panne) : même intention, même champ", async () => {
    geminiDesign.mockRejectedValue(new Error("provider down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { body } = await generate("Aliment pour chien 2 kg");
    expect(body.engine).toBe("local");
    expect(body.intent).toEqual({ version: "PI-5.0", shotStyle: "catalogEcommerce" });
  });

  it("interrupteurs : EDIFY_INTENT_EXPORT_SHOT=off observe sans piloter ; références désactivées suivies", async () => {
    const off = await generate("Aliment pour chien 2 kg", { EDIFY_INTENT_EXPORT_SHOT: "off" });
    expect(off.body.intent).toEqual({ version: "PI-5.0", shotStyle: null });
    expect(off.intentLogs).toHaveLength(1);
    const noRefs = await generate("Aliment pour chien 2 kg", { EDIFY_REFERENCE_SHADOW: "off" });
    expect(noRefs.intentLogs[0]).toMatchObject({ referenceMode: "disabled", activeReferences: 0 });
  });
});

describe("PI-6 — export (propagation jusqu'à renderHD)", () => {
  it("brief e-commerce → shotStyle catalogEcommerce → renderExportPreview → renderHD reçoit catalogEcommerce", async () => {
    const { body } = await generate("Aliment pour chien 2 kg");
    // what EdifyWorkspace does with the response (transport only)
    const r = await renderExportPreview(SHAPE, PSPEC, DESIGN, body.intent.shotStyle ? { shot: { style: body.intent.shotStyle } } : {});
    const want = resolveShot({ style: "catalogEcommerce" });
    expect(r?.shot).toEqual({ style: "catalogEcommerce", camera: want.camera.id, lighting: want.lighting.id });
    expect(renderHD).toHaveBeenCalledTimes(1);
    expect(renderHD.mock.calls[0][0]).toMatchObject({ camera: want.camera.id, lighting: want.lighting.id, width: HD_EXPORT.size, height: HD_EXPORT.size, background: "transparent" });
  });

  it("sans intention / intention non résolue / invalide : heroPremium, l'export fonctionne", async () => {
    const hero = resolveShot({ style: "heroPremium" });
    for (const env of [{ EDIFY_INTENT_SHADOW: "off" }, {}]) {
      for (const brief of ["miel de fleurs 250 g", "ma nouvelle marque"]) {
        renderHD.mockClear();
        const { body } = await generate(brief, env);
        const style = body.intent?.shotStyle;
        const r = await renderExportPreview(SHAPE, PSPEC, DESIGN, style ? { shot: { style } } : {});
        expect(r?.engine).toBe("hd");
        expect(r?.shot).toEqual({ style: "heroPremium", camera: hero.camera.id, lighting: hero.lighting.id });
        expect(renderHD.mock.calls[0][0]).toMatchObject({ camera: hero.camera.id, lighting: hero.lighting.id });
      }
    }
  });

  it("chaque style existant traverse PI-5 → shotRequest → resolveShot → renderExportPreview → renderHD", async () => {
    for (const style of Object.keys(SHOT_STYLES) as ShotStyleId[]) {
      renderHD.mockClear();
      const m = buildMasterDesignIntent({ brief: "Aliment pour chien 2 kg", shot: { style } });
      const req = shotRequestFromIntent(m);
      expect(req).toEqual({ style });
      const r = await renderExportPreview(SHAPE, PSPEC, DESIGN, { shot: req });
      const want = resolveShot({ style });
      expect(r?.shot).toEqual({ style, camera: want.camera.id, lighting: want.lighting.id });
      expect(renderHD.mock.calls[0][0]).toMatchObject({ camera: want.camera.id, lighting: want.lighting.id });
    }
  });

  it("un style arbitraire venu du client n'atteint jamais resolveShot tel quel", async () => {
    const r = await renderExportPreview(SHAPE, PSPEC, DESIGN, { shot: { style: "social" } });
    expect(r?.shot.style).toBe("heroPremium");
  });
});

describe("PI-6 — garde-fous de code", () => {
  it("EdifyWorkspace transporte la décision, sans intelligence ni captureRef ; le ZIP garde ses 4 fichiers", () => {
    const ws = readFileSync("src/components/workspace/EdifyWorkspace.tsx", "utf8");
    expect(ws).not.toMatch(/@\/lib\/intelligence/);
    // the export never captures the live canvas (the pre-existing captureRef registration is not called)
    expect(ws).not.toMatch(/captureRef\.current\?\.\(\)|CaptureBridge/);
    expect(ws).toMatch(/setExportShot\(typeof json\.intent\?\.shotStyle === "string" \? json\.intent\.shotStyle : null\)/);
    expect(ws).toMatch(/renderExportPreview\(shape, spec, design, exportShot \? \{ shot: \{ style: exportShot \} \} : \{\}\)/);
    for (const f of ["-impression.pdf", "-apercu-3d.png", "-modele-3d.glb", "fiche-technique.json"]) expect(ws).toContain(f);
  });

  it("la route construit l'intention une seule fois, ne s'en sert pas pour le design, et la journalise", () => {
    const route = readFileSync("src/app/api/design/route.ts", "utf8");
    expect(route.match(/shadowMasterDesignIntent\(/g)).toHaveLength(1);
    expect(route.match(/\.\.\.intentField/g)).toHaveLength(2);
    expect(route).not.toMatch(/buildMasterDesignIntent|sanitizeSpec\([^)]*intent/);
    expect(route).toMatch(/EDIFY_INTENT_SHADOW !== "off"/);
    const code = readFileSync("src/lib/intelligence/intent/production.ts", "utf8");
    expect(code).not.toMatch(/fetch\(|process\.env|Math\.random|Date\.now|new Date\(|WebGLRenderer/);
  });
});
