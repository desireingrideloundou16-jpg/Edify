import { requireAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/log";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas, quote everything.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV exports: /api/admin/export?type=users|payments|messages */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const type = new URL(req.url).searchParams.get("type") ?? "users";
  const db = createAdminClient();
  let rows: Record<string, unknown>[] = [];
  if (type === "users") {
    const { data } = await db.from("profiles").select("email, full_name, role, plan, plan_expires_at, credits, suspended, created_at, last_seen_at").order("created_at");
    rows = data ?? [];
  } else if (type === "payments") {
    const { data } = await db.from("payments").select("id, user_id, plan, months, amount, currency, credits, provider, status, session_id, created_at, paid_at").order("created_at");
    const { data: owners } = await db.from("profiles").select("id, email");
    rows = (data ?? []).map((p) => ({ email: owners?.find((o) => o.id === p.user_id)?.email ?? "", ...p }));
  } else if (type === "messages") {
    const { data } = await db.from("contact_messages").select("created_at, name, email, subject, message, status").order("created_at");
    rows = data ?? [];
  } else {
    return Response.json({ error: "unknown_type" }, { status: 400 });
  }
  const headers = rows.length ? Object.keys(rows[0]) : ["vide"];
  const csv = "﻿" + [headers.map(csvCell).join(";"), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(";"))].join("\r\n");
  await audit(admin, "Export CSV", type, { lignes: rows.length });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edify-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
