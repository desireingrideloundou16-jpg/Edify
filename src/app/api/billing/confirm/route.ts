import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settlePayment, type PaymentRow } from "@/lib/billing/settle";

export const runtime = "nodejs";

/** Called by /abonnement/retour: re-checks the payment with SasPay and activates the plan. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { paymentId } = await req.json().catch(() => ({}));
  if (typeof paymentId !== "string" || !/^[0-9a-f-]{36}$/i.test(paymentId)) return Response.json({ error: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("*").eq("id", paymentId).eq("user_id", user.id).maybeSingle<PaymentRow>();
  if (!payment) return Response.json({ error: "not_found" }, { status: 404 });

  let status: PaymentRow["status"] = payment.status;
  try {
    status = await settlePayment(admin, payment);
  } catch (e) {
    console.error("[billing/confirm]", e);
  }
  const { data: profile } = await admin.from("profiles").select("plan, plan_expires_at, credits").eq("id", user.id).single();
  return Response.json({ status, plan: payment.plan, months: payment.months, profile });
}
