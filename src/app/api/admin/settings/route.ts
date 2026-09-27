import { requireAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Site settings (announcement banner shown at the top of the landing page). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const body = await req.json().catch(() => ({}));
  const a = body?.announcement ?? {};
  const announcement = {
    enabled: a.enabled === true,
    text: String(a.text ?? "").slice(0, 200),
    link: /^(https?:\/\/|\/)/.test(String(a.link ?? "")) ? String(a.link).slice(0, 300) : "",
    tone: ["info", "promo", "warning"].includes(a.tone) ? a.tone : "info",
  };
  const { error } = await createAdminClient().from("app_settings").upsert({ key: "announcement", value: announcement, updated_at: new Date().toISOString() });
  if (error) {
    console.error("[admin/settings]", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  await audit(admin, "Bandeau d'annonce mis à jour", null, announcement);
  return Response.json({ ok: true, announcement });
}
