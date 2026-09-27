import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhook } from "@/lib/billing/saspay";
import { settlePayment, type PaymentRow } from "@/lib/billing/settle";

export const runtime = "nodejs";

/**
 * SasPay webhook (configure https://<site>/api/billing/webhook in the SasPay dashboard, event
 * transaction.success). The payload is only a signal: every pending payment of the last 48 h
 * is re-checked with SasPay, so a forged or replayed call can never activate a plan.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-webhook-signature"), req.headers.get("x-webhook-timestamp"))) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  let event = "";
  try {
    event = JSON.parse(raw)?.event ?? "";
  } catch {}
  if (!event.startsWith("transaction.")) return Response.json({ ok: true, ignored: event });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: pending } = await admin
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .not("session_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(25);

  let settled = 0;
  for (const p of (pending ?? []) as PaymentRow[]) {
    try {
      if ((await settlePayment(admin, p)) !== "pending") settled++;
    } catch (e) {
      console.error("[billing/webhook]", p.id, e);
    }
  }
  return Response.json({ ok: true, settled });
}
