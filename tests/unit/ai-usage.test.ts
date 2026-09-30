/** ai_usage rows never carry secrets, prompts or oversized payloads. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }) }));

import { scrubSecrets, toRow } from "@/lib/ai/usage";

describe("scrubSecrets", () => {
  it("masque les clés, jetons et JWT dans les messages d'erreur", () => {
    const msg = scrubSecrets(
      "401 for key AIzaSyA1234567890abcdefghijklmnopqr with Bearer abc.def.ghi and sk_live_ABCDEF123456 url?key=SECRET123&x=1 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig"
    );
    expect(msg).not.toMatch(/AIzaSy|abc\.def|sk_live_ABC|SECRET123|eyJhbGci/);
    expect(msg).toContain("[redacted]");
  });

  it("tronque à 300 caractères", () => {
    expect(scrubSecrets("a ".repeat(400)).length).toBeLessThanOrEqual(300);
  });
});

describe("toRow", () => {
  it("métadonnées plates et courtes uniquement (aucun objet imbriqué, aucun prompt)", () => {
    const row = toRow({
      userId: null, operation: "suggest.generate", provider: "gemini", model: "gemini-2.5-flash", status: "success",
      inputTokens: 12.6, outputTokens: 3, totalTokens: null, imagesGenerated: 0, estimatedCostUsdMicros: 7.4, latencyMs: 120,
      errorCode: null, errorMessage: null,
      metadata: { step: "usage", nested: { prompt: "tout le brief" }, long: "x".repeat(500) },
    });
    expect(row.metadata).toEqual({ step: "usage", long: "x".repeat(120).replace(/x{40,}/, "[redacted]") });
    expect(row.input_tokens).toBe(13);
    expect(row.estimated_cost_usd_micros).toBe(7);
    expect(row.metadata).not.toHaveProperty("nested");
  });
});
