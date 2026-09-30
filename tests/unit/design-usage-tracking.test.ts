/**
 * Regression guard for commit c6e129f: a successful AI design must be logged as a successful
 * `design` AI event (the daily fair-use cap and the admin statistics count exactly those), and a
 * failed AI call must never be counted as a success.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks: only the I/O boundaries of the route (auth, database, providers, logging) ──────────
const logAiEvent = vi.fn(async (..._args: unknown[]) => {});
vi.mock("@/lib/admin/log", () => ({ logAiEvent }));

const geminiDesign = vi.fn();
vi.mock("@/lib/ai/gemini", () => ({
  geminiDesign,
  GeminiError: class GeminiError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { credits: 0, plan_expires_at: null, suspended: false } }) }) }),
    }),
  }),
}));

const projectUpdates: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        projectUpdates.push(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

vi.mock("@/lib/billing/fairUse", () => ({ dailyAiCount: async () => 0, hasActivePlan: () => false }));
vi.mock("@/lib/billing/packaging", () => ({
  resolveProject: async () => ({ id: "project-1", counted: false, ai_generations: 0 }),
}));

const SPEC = {
  shapeId: "honey-jar", styleId: "honey-bee", layout: "label", motif: "none",
  artStyle: "engraving", artSubject: "honeycomb and bees", badge: "100 % pur", origin: "Mont Oku",
  contentColor: "#f3ead2", adHeadline: "La douceur des sommets", adCta: "Commander",
  headingFont: "Playfair Display", bodyFont: "Lato",
  palette: { background: "#fdf8f2", ink: "#2b2621", accent: "#6b4fa0", extra: "#d97706" },
  projectName: "Miel", brandName: "Ruchers d'Oku", productName: "Miel blanc", tagline: "Récolté au Mont Oku",
  volume: "250 g", details: "", ingredients: "Miel", usage: "Conserver au sec", rationale: "Test",
};

function request() {
  return new Request("http://localhost/api/design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Miel blanc du Mont Oku, pot en verre 250 g",
      fresh: true,
      current: { shapeId: "honey-jar", styleId: "x", brandName: "", productName: "", volume: "" },
    }),
  });
}

const successCalls = () => logAiEvent.mock.calls.filter((c) => c[1] === "design" && c[2] !== "local" && c[3] !== false);

describe("POST /api/design — AI usage tracking", () => {
  beforeEach(() => {
    logAiEvent.mockClear();
    geminiDesign.mockReset();
    projectUpdates.length = 0;
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  });

  it("une génération IA réussie crée bien un événement IA (succès)", async () => {
    geminiDesign.mockResolvedValue(SPEC);
    const { POST } = await import("@/app/api/design/route");
    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.engine).toBe("gemini");
    expect(json.spec.brandName).toBe("Ruchers d'Oku");
    expect(json).not.toHaveProperty("mockupPrompt");
    // exactly one successful design event, for this user and this engine
    expect(successCalls()).toEqual([["user-1", "design", "gemini"]]);
    // the per-packaging regeneration counter moves too
    expect(projectUpdates).toEqual([{ ai_generations: 1 }]);
  });

  it("une génération IA échouée ne consomme pas une génération réussie", async () => {
    geminiDesign.mockRejectedValue(new Error("provider down"));
    const { POST } = await import("@/app/api/design/route");
    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200); // the customer still gets the offline design
    expect(json.engine).toBe("local");
    // the failure is logged as a failure, the offline designer as "local" (neither is counted)
    expect(logAiEvent).toHaveBeenCalledWith("user-1", "design", "gemini", false);
    expect(logAiEvent).toHaveBeenCalledWith("user-1", "design", "local");
    expect(successCalls()).toEqual([]);
    // no AI regeneration consumed on the project
    expect(projectUpdates).toEqual([]);
  });
});
