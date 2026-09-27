import { requireAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { status } = await req.json().catch(() => ({}));
  if (!["new", "handled", "archived"].includes(status)) return Response.json({ error: "invalid_status" }, { status: 400 });
  const db = createAdminClient();
  const { data } = await db
    .from("contact_messages")
    .update({ status, handled_at: status === "new" ? null : new Date().toISOString() })
    .eq("id", params.id)
    .select("email")
    .maybeSingle();
  if (!data) return Response.json({ error: "not_found" }, { status: 404 });
  await audit(admin, `Message marqué « ${status} »`, data.email);
  return Response.json({ ok: true });
}
