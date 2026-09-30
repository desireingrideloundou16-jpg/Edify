/**
 * CRITICAL: observability must never be a single point of failure.
 * The provider succeeds but the ai_usage insert fails → the user still gets the AI result,
 * with the exact same response contract as before the gateway.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert } = vi.hoisted(() => ({ insert: vi.fn(async (..._args: unknown[]): Promise<{ error: null }> => { throw new Error("ai_usage unavailable"); }) }));

vi.mock("@/lib/admin/log", () => ({ logAiEvent: async () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "ai_usage"
        ? { insert }
        : { select: () => ({ eq: () => ({ eq: () => ({ gte: async () => ({ count: 0 }) }) }) }) },
  }),
}));

const GEMINI_OK = {
  modelVersion: "gemini-3.5-flash-lite",
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80, totalTokenCount: 200 },
  candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: ["Eau, fleurs d'hibiscus, sucre", "Hibiscus, gingembre, menthe"] }) }] } }],
};

function request() {
  return new Request("http://localhost/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ step: "ingredients", brief: { packaging: "Jus de bissap 50 cl" }, lang: "fr" }),
  });
}

describe("POST /api/suggest — observabilité en mode shadow", () => {
  beforeEach(() => {
    insert.mockClear();
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(GEMINI_OK), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  it("le fournisseur réussit mais l'écriture ai_usage échoue → l'utilisateur reçoit quand même le résultat IA", async () => {
    const { POST } = await import("@/app/api/suggest/route");
    const res = await POST(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ suggestions: ["Eau, fleurs d'hibiscus, sucre", "Hibiscus, gingembre, menthe"], source: "ai" });
    // the gateway did try to record the call (and swallowed the failure)
    await vi.waitFor(() => expect(insert).toHaveBeenCalled());
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ operation: "suggest.generate", provider: "gemini", model: "gemini-3.5-flash-lite", status: "success", input_tokens: 120, output_tokens: 80 });
    expect(JSON.stringify(row)).not.toContain("hibiscus"); // neither prompt nor answer stored
  });
});
