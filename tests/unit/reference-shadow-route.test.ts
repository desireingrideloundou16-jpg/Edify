/**
 * PI-4 — T / U: the reference shadow in the real /api/design route. With EDIFY_REFERENCE_SHADOW unset it
 * logs one REFERENCE_SHADOW line (no brief); with "off" it logs nothing; the response is the same in
 * both cases. Mocks only the route's I/O boundaries (auth, database, provider, AI usage logging), as the
 * existing design-usage-tracking test does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const SPEC = {
  shapeId: "juice-bottle-30cl", styleId: "juicy-fruit", layout: "label", motif: "none", artStyle: "flat", artSubject: "hibiscus", badge: "", origin: "",
  contentColor: "", adHeadline: "Frais", adCta: "Commander", headingFont: "Montserrat", bodyFont: "Montserrat",
  palette: { background: "#fdf8f2", ink: "#2b2621", accent: "#8e1b3a", extra: "#d97706" }, projectName: "Bissap", brandName: "Kola", productName: "Jus de bissap",
  tagline: "", volume: "50 cl", details: "", ingredients: "Eau, fleurs d'hibiscus", usage: "Conserver au frais", rationale: "Test",
};
const BRIEF = "Secret client : jus de bissap 50 cl";
const request = () => new Request("http://localhost/api/design", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: BRIEF, fresh: true, current: { shapeId: "juice-bottle-30cl", styleId: "x", brandName: "", productName: "", volume: "" } }),
});

async function run(env: string | undefined) {
  if (env === undefined) delete process.env.EDIFY_REFERENCE_SHADOW;
  else process.env.EDIFY_REFERENCE_SHADOW = env;
  const lines: string[] = [];
  const info = vi.spyOn(console, "info").mockImplementation((l: unknown) => { lines.push(String(l)); });
  const { POST } = await import("@/app/api/design/route");
  const res = await POST(request());
  const body = await res.json();
  info.mockRestore();
  return { body, shadows: lines.filter((l) => l.includes('"REFERENCE_SHADOW"')) };
}

describe("PI-4 shadow dans /api/design", () => {
  beforeEach(() => {
    geminiDesign.mockReset();
    geminiDesign.mockResolvedValue(SPEC);
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  });
  afterEach(() => { delete process.env.EDIFY_REFERENCE_SHADOW; });

  it("U. activé par défaut : une ligne REFERENCE_SHADOW, sans le brief", async () => {
    const { shadows } = await run(undefined);
    expect(shadows).toHaveLength(1);
    const line = JSON.parse(shadows[0]);
    expect(line).toMatchObject({ level: "info", code: "REFERENCE_SHADOW", source: "referenceShadow", archetypeId: "localBeverage" });
    expect(shadows[0]).not.toMatch(/Secret client/);
  });

  it("T. désactivé (EDIFY_REFERENCE_SHADOW=off) : aucune ligne ; S. la réponse est identique", async () => {
    const on = await run(undefined);
    const off = await run("off");
    expect(off.shadows).toEqual([]);
    expect(off.body).toEqual(on.body);
    expect(on.body.spec.shapeId).toBe("juice-bottle-30cl");
  });
});
