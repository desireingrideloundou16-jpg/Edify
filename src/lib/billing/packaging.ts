/**
 * Server-only packaging quota. A project becomes one of the plan's packagings the first time
 * the AI designs it or it is downloaded (claim_packaging in Postgres, idempotent and atomic).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface QuotaProject {
  id: string;
  counted: boolean;
  ai_generations: number;
}

/** The user's project, or a new empty one when none is given or it isn't theirs. */
export async function resolveProject(admin: SupabaseClient, userId: string, projectId?: string | null): Promise<QuotaProject> {
  if (projectId && /^[0-9a-f-]{36}$/i.test(projectId)) {
    const { data } = await admin.from("projects").select("id, counted, ai_generations").eq("id", projectId).eq("user_id", userId).maybeSingle();
    if (data) return data as QuotaProject;
  }
  const { data, error } = await admin.from("projects").insert({ user_id: userId, name: "Nouveau packaging", data: {} }).select("id, counted, ai_generations").single();
  if (error || !data) throw new Error(error?.message ?? "project_create_failed");
  return data as QuotaProject;
}

/** Remaining packagings after claiming this project, or -1 when none is available. */
export async function claimPackaging(admin: SupabaseClient, userId: string, projectId: string): Promise<number> {
  const { data, error } = await admin.rpc("claim_packaging", { p_project: projectId, p_user: userId });
  if (error) throw error;
  return typeof data === "number" ? data : -1;
}
