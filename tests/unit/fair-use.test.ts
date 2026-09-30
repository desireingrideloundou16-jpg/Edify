/**
 * The daily fair-use counter must count only successful, real AI calls: failed calls and the
 * offline designer never consume the user's daily allowance.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dailyAiCount, hasActivePlan } from "@/lib/billing/fairUse";

function recordingClient(count: number) {
  const filters: [string, string, unknown][] = [];
  let table = "";
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => (filters.push(["eq", col, val]), builder),
    neq: (col: string, val: unknown) => (filters.push(["neq", col, val]), builder),
    gte: (col: string, val: unknown) => {
      filters.push(["gte", col, val]);
      return Promise.resolve({ count });
    },
  };
  const client = { from: (t: string) => ((table = t), builder) } as unknown as SupabaseClient;
  return { client, filters, table: () => table };
}

describe("dailyAiCount", () => {
  it("ne compte que les appels IA réussis et réels du jour, pour cet utilisateur", async () => {
    const { client, filters, table } = recordingClient(4);
    const n = await dailyAiCount(client, "user-1", "design");

    expect(n).toBe(4);
    expect(table()).toBe("ai_events");
    expect(filters).toContainEqual(["eq", "user_id", "user-1"]);
    expect(filters).toContainEqual(["eq", "kind", "design"]);
    expect(filters).toContainEqual(["eq", "success", true]); // failures excluded
    expect(filters).toContainEqual(["neq", "engine", "local"]); // offline designer excluded
    const since = filters.find((f) => f[0] === "gte" && f[1] === "created_at")?.[2] as string;
    expect(new Date(since).getUTCHours()).toBe(0); // since midnight UTC
  });

  it("renvoie 0 quand la base ne renvoie rien", async () => {
    const { client } = recordingClient(null as unknown as number);
    expect(await dailyAiCount(client, "user-1", "image")).toBe(0);
  });
});

describe("hasActivePlan", () => {
  it("distingue un abonnement actif, expiré ou absent", () => {
    expect(hasActivePlan({ plan_expires_at: new Date(Date.now() + 86_400_000).toISOString() })).toBe(true);
    expect(hasActivePlan({ plan_expires_at: new Date(Date.now() - 1000).toISOString() })).toBe(false);
    expect(hasActivePlan({ plan_expires_at: null })).toBe(false);
    expect(hasActivePlan(null)).toBe(false);
  });
});
