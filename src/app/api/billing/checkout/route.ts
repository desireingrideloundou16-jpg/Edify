import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckout, isSasPayConfigured, SasPayError } from "@/lib/billing/saspay";
import { creditsFor, isMonths, isPlan, priceFor } from "@/lib/billing/plans";

export const runtime = "nodejs";

const PLAN_NAMES = { essentiel: "Essentiel", pro: "Pro", entreprise: "Entreprise" } as const;

/** Starts a Mobile Money payment: records it, then returns SasPay's hosted checkout URL. */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = body?.plan;
  const months = Number(body?.months);
  if (!isPlan(plan) || !isMonths(months)) return Response.json({ error: "invalid_plan" }, { status: 400 });
  if (!isSasPayConfigured()) return Response.json({ error: "payments_unavailable" }, { status: 503 });

  const amount = priceFor(plan, months);
  const admin = createAdminClient();
  const { count: recent } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((recent ?? 0) >= 10) return Response.json({ error: "rate_limited" }, { status: 429 });
  const { data: payment, error } = await admin
    .from("payments")
    .insert({ user_id: user.id, plan, months, amount, credits: creditsFor(plan, months) })
    .select("id")
    .single();
  if (error || !payment) {
    console.error("[billing/checkout] insert", error);
    return Response.json({ error: "db_error" }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const meta = user.user_metadata ?? {};
  try {
    const session = await createCheckout({
      amount,
      description: `Edify ${PLAN_NAMES[plan]} — ${months} mois`,
      customerEmail: user.email ?? "",
      customerName: meta.full_name || meta.name || user.email?.split("@")[0] || "Client Edify",
      returnUrl: `${origin}/abonnement/retour?p=${payment.id}`,
      metadata: { payment_id: payment.id, user_id: user.id, plan, months: String(months) },
    });
    await admin.from("payments").update({ session_id: session.id }).eq("id", payment.id);
    return Response.json({ url: session.checkout_url, paymentId: payment.id });
  } catch (e) {
    console.error("[billing/checkout] saspay", e);
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    const status = e instanceof SasPayError && e.status === 503 ? 503 : 502;
    return Response.json({ error: "gateway_error" }, { status });
  }
}
