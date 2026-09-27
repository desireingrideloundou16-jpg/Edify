import { requireAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { settlePayment, type PaymentRow } from "@/lib/billing/settle";

export const runtime = "nodejs";

/** Payment actions: re-check with SasPay, or settle by hand (money received another way). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { action } = await req.json().catch(() => ({}));
  const db = createAdminClient();
  const { data: payment } = await db.from("payments").select("*").eq("id", params.id).maybeSingle<PaymentRow>();
  if (!payment) return Response.json({ error: "not_found" }, { status: 404 });
  const { data: owner } = await db.from("profiles").select("email").eq("id", payment.user_id).single();
  const target = `${owner?.email ?? payment.user_id} · ${payment.amount} FCFA`;

  if (action === "verify") {
    try {
      const status = await settlePayment(db, payment);
      await audit(admin, "Paiement revérifié auprès de SasPay", target, { status });
      return Response.json({ ok: true, status });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "gateway_error" }, { status: 502 });
    }
  }
  if (action === "mark_paid") {
    if (payment.status === "paid") return Response.json({ ok: true, status: "paid" });
    // A failed/cancelled payment is put back to pending so activation stays atomic and single.
    if (payment.status !== "pending") await db.from("payments").update({ status: "pending" }).eq("id", payment.id);
    const { data: ok } = await db.rpc("activate_payment", { p_payment: payment.id });
    await audit(admin, "Paiement validé manuellement", target, { activated: ok });
    return Response.json({ ok: true, status: "paid" });
  }
  if (action === "mark_failed" || action === "mark_cancelled") {
    if (payment.status === "paid") return Response.json({ error: "already_paid" }, { status: 400 });
    const status = action === "mark_failed" ? "failed" : "cancelled";
    await db.from("payments").update({ status }).eq("id", payment.id);
    await audit(admin, status === "failed" ? "Paiement marqué échoué" : "Paiement annulé", target);
    return Response.json({ ok: true, status });
  }
  return Response.json({ error: "unknown_action" }, { status: 400 });
}
