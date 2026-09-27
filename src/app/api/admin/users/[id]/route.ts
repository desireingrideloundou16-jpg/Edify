import { requireAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { creditsFor, isMonths, isPlan } from "@/lib/billing/plans";

export const runtime = "nodejs";

/** Account actions from the admin board. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) return Response.json({ error: "not_found" }, { status: 404 });
  const bad = (m: string) => Response.json({ error: m }, { status: 400 });

  switch (action) {
    case "grant_plan": {
      const { plan, months } = body;
      const amount = Math.max(0, Math.round(Number(body.amount) || 0));
      if (!isPlan(plan) || !isMonths(Number(months))) return bad("invalid_plan");
      const m = Number(months) as 1 | 3 | 12;
      if (amount > 0) {
        // Money received outside SasPay (cash, direct MoMo): recorded as a paid manual payment.
        const { data: pay, error } = await db
          .from("payments")
          .insert({ user_id: id, plan, months: m, amount, credits: creditsFor(plan, m), provider: "manual" })
          .select("id")
          .single();
        if (error || !pay) return Response.json({ error: "db_error" }, { status: 500 });
        await db.rpc("activate_payment", { p_payment: pay.id });
      } else {
        const base = profile.plan_expires_at && new Date(profile.plan_expires_at) > new Date() ? new Date(profile.plan_expires_at) : new Date();
        base.setMonth(base.getMonth() + m);
        await db.from("profiles").update({ plan, plan_expires_at: base.toISOString(), credits: profile.credits + creditsFor(plan, m) }).eq("id", id);
      }
      await audit(admin, amount > 0 ? "Abonnement activé (paiement manuel)" : "Abonnement offert", profile.email, { plan, months: m, amount });
      break;
    }
    case "set_plan": {
      if (!isPlan(body.plan) && body.plan !== "none") return bad("invalid_plan");
      await db.from("profiles").update({ plan: body.plan }).eq("id", id);
      await audit(admin, "Plan modifié", profile.email, { from: profile.plan, to: body.plan });
      break;
    }
    case "set_expiry": {
      const date = body.date ? new Date(`${body.date}T23:59:59`) : null;
      if (date && Number.isNaN(date.getTime())) return bad("invalid_date");
      await db.from("profiles").update({ plan_expires_at: date?.toISOString() ?? null }).eq("id", id);
      await audit(admin, "Date de fin modifiée", profile.email, { from: profile.plan_expires_at, to: date?.toISOString() ?? null });
      break;
    }
    case "set_credits": {
      const credits = Math.round(Number(body.credits));
      if (!Number.isFinite(credits) || credits < 0) return bad("invalid_credits");
      await db.from("profiles").update({ credits }).eq("id", id);
      await audit(admin, "Crédits modifiés", profile.email, { from: profile.credits, to: credits });
      break;
    }
    case "suspend":
    case "unsuspend": {
      if (id === admin.id) return bad("self");
      await db.from("profiles").update({ suspended: action === "suspend" }).eq("id", id);
      // Also blocks sign-in (ban), lifted on reactivation.
      await db.auth.admin.updateUserById(id, { ban_duration: action === "suspend" ? "876000h" : "none" });
      await audit(admin, action === "suspend" ? "Compte suspendu" : "Compte réactivé", profile.email);
      break;
    }
    case "make_admin":
    case "remove_admin": {
      if (id === admin.id) return bad("self");
      await db.from("profiles").update({ role: action === "make_admin" ? "admin" : "user" }).eq("id", id);
      await audit(admin, action === "make_admin" ? "Droits admin accordés" : "Droits admin retirés", profile.email);
      break;
    }
    case "delete": {
      if (id === admin.id) return bad("self");
      if (body.confirm !== profile.email) return bad("confirm");
      const { error } = await db.auth.admin.deleteUser(id);
      if (error) {
        console.error("[admin/users] delete", error.message);
        return Response.json({ error: "server_error" }, { status: 500 });
      }
      await audit(admin, "Compte supprimé", profile.email);
      return Response.json({ ok: true, deleted: true });
    }
    default:
      return bad("unknown_action");
  }
  const { data: updated } = await db.from("profiles").select("*").eq("id", id).single();
  return Response.json({ ok: true, profile: updated });
}
