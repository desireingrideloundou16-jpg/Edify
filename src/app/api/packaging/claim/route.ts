import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimPackaging, resolveProject } from "@/lib/billing/packaging";

export const runtime = "nodejs";

/** Called before a download: counts the project as one of the plan's packagings (once). */
export async function POST(req: Request) {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("plan_expires_at, suspended, credits").eq("id", user.id).single();
  if (profile?.suspended) return Response.json({ error: "suspended" }, { status: 403 });
  if (!profile?.plan_expires_at || new Date(profile.plan_expires_at) <= new Date()) {
    return Response.json({ error: "no_plan", reason: "no_plan", credits: profile?.credits ?? 0 }, { status: 402 });
  }
  // No packaging left and no existing project: refuse without creating an empty project.
  if (!body?.projectId && (profile.credits ?? 0) <= 0) return Response.json({ error: "no_credits", reason: "no_credits", credits: 0 }, { status: 402 });
  const project = await resolveProject(admin, user.id, body?.projectId);
  const remaining = await claimPackaging(admin, user.id, project.id);
  if (remaining < 0) return Response.json({ error: "no_credits", reason: "no_credits", credits: 0, projectId: project.id }, { status: 402 });
  return Response.json({ ok: true, projectId: project.id, credits: remaining, counted: true });
}
