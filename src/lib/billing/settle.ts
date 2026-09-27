/** Server-only: bring a payment row in line with SasPay's real status (idempotent). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkoutStatus, isDead, isPaid } from "./saspay";

export interface PaymentRow {
  id: string;
  user_id: string;
  plan: string;
  months: number;
  amount: number;
  session_id: string | null;
  status: "pending" | "paid" | "failed" | "cancelled";
  created_at: string;
}

export async function settlePayment(admin: SupabaseClient, p: PaymentRow): Promise<PaymentRow["status"]> {
  if (p.status !== "pending") return p.status;
  if (!p.session_id) return "pending";
  const s = await checkoutStatus(p.session_id);
  if (isPaid(s)) {
    const { error } = await admin.rpc("activate_payment", { p_payment: p.id });
    if (error) throw error;
    return "paid";
  }
  if (isDead(s)) {
    const status = s.status === "CANCELLED" ? "cancelled" : "failed";
    await admin.from("payments").update({ status }).eq("id", p.id).eq("status", "pending");
    return status;
  }
  return "pending";
}
