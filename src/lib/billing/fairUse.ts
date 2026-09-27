/**
 * Server-only fair use. Designing is open to every signed-in account (the paywall is at
 * download time), so AI usage is capped per day — lower without an active plan.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function hasActivePlan(profile: { plan_expires_at?: string | null } | null | undefined) {
  return !!profile?.plan_expires_at && new Date(profile.plan_expires_at) > new Date();
}

/** Successful AI calls of this kind by the user since midnight UTC. */
export async function dailyAiCount(admin: SupabaseClient, userId: string, kind: "design" | "image" | "suggest") {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("ai_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("success", true)
    .neq("engine", "local")
    .gte("created_at", since.toISOString());
  return count ?? 0;
}
