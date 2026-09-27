/**
 * Server-only data for the admin board (secret-key client, after getAdmin()).
 * Aggregations are done in JS: fine for Edify's volume, and easy to move to SQL views later.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, isPlan } from "@/lib/billing/plans";
import { LEGAL } from "@/lib/legal";

const DAY = 86_400_000;
export const isoDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Last `n` days as YYYY-MM-DD, oldest first. */
export function lastDays(n: number) {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => isoDay(new Date(today.getTime() - (n - 1 - i) * DAY)));
}

function perDay(rows: { at: string; v?: number }[], days: string[]) {
  const map = new Map(days.map((d) => [d, 0]));
  for (const r of rows) {
    const d = isoDay(r.at);
    if (map.has(d)) map.set(d, (map.get(d) ?? 0) + (r.v ?? 1));
  }
  return days.map((d) => ({ day: d, value: map.get(d) ?? 0 }));
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  plan: string;
  plan_expires_at: string | null;
  credits: number;
  suspended: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export const isActive = (p: Pick<ProfileRow, "plan_expires_at">) => !!p.plan_expires_at && new Date(p.plan_expires_at) > new Date();

export async function dashboardStats() {
  const db = createAdminClient();
  const days = lastDays(30);
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [profiles, payments, ai, projects, messages] = await Promise.all([
    db.from("profiles").select("id, email, full_name, plan, plan_expires_at, credits, created_at, suspended").order("created_at", { ascending: false }),
    db.from("payments").select("id, user_id, plan, months, amount, status, created_at, paid_at").order("created_at", { ascending: false }),
    db.from("ai_events").select("kind, engine, success, created_at").gte("created_at", since30),
    db.from("projects").select("id", { count: "exact", head: true }),
    db.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const users = (profiles.data ?? []) as ProfileRow[];
  const pays = payments.data ?? [];
  const paid = pays.filter((p) => p.status === "paid");
  const active = users.filter(isActive);
  const byPlan = Object.fromEntries(Object.keys(PLANS).map((id) => [id, active.filter((u) => u.plan === id).length]));
  const mrr = active.reduce((s, u) => s + (isPlan(u.plan) ? PLANS[u.plan].monthly : 0), 0);
  const events = ai.data ?? [];

  return {
    users: users.length,
    newUsers7: users.filter((u) => Date.now() - new Date(u.created_at).getTime() < 7 * DAY).length,
    newUsers30: users.filter((u) => Date.now() - new Date(u.created_at).getTime() < 30 * DAY).length,
    activeSubscribers: active.length,
    byPlan,
    conversion: users.length ? active.length / users.length : 0,
    mrr,
    revenueTotal: paid.reduce((s, p) => s + p.amount, 0),
    revenueMonth: paid.filter((p) => (p.paid_at ?? p.created_at) >= monthStart).reduce((s, p) => s + p.amount, 0),
    pendingPayments: pays.filter((p) => p.status === "pending").length,
    projects: projects.count ?? 0,
    newMessages: messages.count ?? 0,
    aiDesigns30: events.filter((e) => e.kind === "design" && e.success).length,
    aiFailures30: events.filter((e) => !e.success).length,
    signupsChart: perDay(users.map((u) => ({ at: u.created_at })), days),
    revenueChart: perDay(paid.map((p) => ({ at: p.paid_at ?? p.created_at, v: p.amount })), days),
    aiChart: perDay(events.filter((e) => e.kind === "design").map((e) => ({ at: e.created_at })), days),
    recentUsers: users.slice(0, 6),
    recentPayments: pays.slice(0, 6).map((p) => ({ ...p, email: users.find((u) => u.id === p.user_id)?.email ?? null })),
    expiringSoon: active
      .filter((u) => new Date(u.plan_expires_at!).getTime() - Date.now() < 7 * DAY)
      .sort((a, b) => a.plan_expires_at!.localeCompare(b.plan_expires_at!))
      .slice(0, 6),
  };
}

export async function listUsers(opts: { q?: string; plan?: string; status?: string; page?: number }) {
  const db = createAdminClient();
  const size = 25;
  const page = Math.max(1, opts.page ?? 1);
  let query = db.from("profiles").select("id, email, full_name, role, plan, plan_expires_at, credits, suspended, created_at, last_seen_at", { count: "exact" });
  if (opts.q) query = query.or(`email.ilike.%${opts.q.replace(/[%,()]/g, "")}%,full_name.ilike.%${opts.q.replace(/[%,()]/g, "")}%`);
  if (opts.plan && opts.plan !== "all") query = query.eq("plan", opts.plan);
  const now = new Date().toISOString();
  if (opts.status === "active") query = query.gt("plan_expires_at", now);
  if (opts.status === "expired") query = query.lte("plan_expires_at", now);
  if (opts.status === "never") query = query.is("plan_expires_at", null);
  if (opts.status === "suspended") query = query.eq("suspended", true);
  if (opts.status === "admin") query = query.eq("role", "admin");
  const { data, count } = await query.order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  return { rows: (data ?? []) as ProfileRow[], total: count ?? 0, page, pages: Math.max(1, Math.ceil((count ?? 0) / size)) };
}

export async function userDetail(id: string) {
  const db = createAdminClient();
  const [profile, payments, projects, ai, auth] = await Promise.all([
    db.from("profiles").select("*").eq("id", id).maybeSingle(),
    db.from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("projects").select("id, name, data, created_at, updated_at").eq("user_id", id).order("updated_at", { ascending: false }),
    db.from("ai_events").select("kind, engine, success, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
    db.auth.admin.getUserById(id),
  ]);
  if (!profile.data) return null;
  const u = auth.data?.user;
  return {
    profile: profile.data as ProfileRow & { avatar_url: string | null },
    provider: (u?.app_metadata?.provider as string | undefined) ?? "email",
    lastSignIn: u?.last_sign_in_at ?? null,
    confirmed: !!u?.email_confirmed_at,
    payments: payments.data ?? [],
    projects: projects.data ?? [],
    ai: ai.data ?? [],
  };
}

/**
 * "Satisfait ou remboursé": first paid payment of the account, within LEGAL.refundDays of
 * payment, with at most LEGAL.refundMaxPackagings packaging(s) used since.
 */
export async function refundEligibility(payment: { id: string; user_id: string; status: string; paid_at: string | null; created_at: string }) {
  if (payment.status !== "paid") return { eligible: false, reason: "Paiement non encaissé" };
  const db = createAdminClient();
  const paidAt = payment.paid_at ?? payment.created_at;
  if (Date.now() - new Date(paidAt).getTime() > LEGAL.refundDays * DAY) return { eligible: false, reason: `Plus de ${LEGAL.refundDays} jours` };
  const { data: earlier } = await db.from("payments").select("id").eq("user_id", payment.user_id).in("status", ["paid", "refunded"]).lt("created_at", payment.created_at).limit(1);
  if (earlier?.length) return { eligible: false, reason: "Pas le premier paiement" };
  const { count } = await db.from("projects").select("id", { count: "exact", head: true }).eq("user_id", payment.user_id).eq("counted", true).gte("counted_at", paidAt);
  if ((count ?? 0) > LEGAL.refundMaxPackagings) return { eligible: false, reason: `${count} packagings utilisés` };
  return { eligible: true, reason: `${count ?? 0} packaging(s) utilisé(s)` };
}

export async function listPayments(opts: { status?: string; page?: number }) {
  const db = createAdminClient();
  const size = 30;
  const page = Math.max(1, opts.page ?? 1);
  let query = db.from("payments").select("*", { count: "exact" });
  if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);
  const { data, count } = await query.order("created_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  const ids = [...new Set((data ?? []).map((p) => p.user_id))];
  const { data: owners } = ids.length ? await db.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const { data: all } = await db.from("payments").select("amount, status");
  const sum = (s: string) => (all ?? []).filter((p) => p.status === s).reduce((a, p) => a + p.amount, 0);
  return {
    rows: await Promise.all(
      (data ?? []).map(async (p) => ({ ...p, owner: owners?.find((o) => o.id === p.user_id) ?? null, refund: p.status === "paid" ? await refundEligibility(p) : null }))
    ),
    total: count ?? 0,
    page,
    pages: Math.max(1, Math.ceil((count ?? 0) / size)),
    totals: { paid: sum("paid"), pending: sum("pending"), failed: sum("failed") + sum("cancelled"), refunded: sum("refunded") },
  };
}

export async function listProjects(opts: { q?: string; page?: number }) {
  const db = createAdminClient();
  const size = 30;
  const page = Math.max(1, opts.page ?? 1);
  let query = db.from("projects").select("id, user_id, name, data, created_at, updated_at", { count: "exact" });
  if (opts.q) query = query.ilike("name", `%${opts.q.replace(/[%,()]/g, "")}%`);
  const { data, count } = await query.order("updated_at", { ascending: false }).range((page - 1) * size, page * size - 1);
  const ids = [...new Set((data ?? []).map((p) => p.user_id))];
  const { data: owners } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
  return {
    rows: (data ?? []).map((p) => ({ ...p, email: owners?.find((o) => o.id === p.user_id)?.email ?? null })),
    total: count ?? 0,
    page,
    pages: Math.max(1, Math.ceil((count ?? 0) / size)),
  };
}

export async function listMessages(status: string) {
  const db = createAdminClient();
  let query = db.from("contact_messages").select("*");
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  const { data: counts } = await db.from("contact_messages").select("status");
  const c = (s: string) => (counts ?? []).filter((m) => m.status === s).length;
  return { rows: data ?? [], counts: { new: c("new"), handled: c("handled"), archived: c("archived"), all: counts?.length ?? 0 } };
}

export async function aiStats() {
  const db = createAdminClient();
  const days = lastDays(30);
  const { data } = await db.from("ai_events").select("kind, engine, success, created_at").gte("created_at", new Date(Date.now() - 30 * DAY).toISOString());
  const events = data ?? [];
  const today = isoDay(new Date());
  const group = (key: "kind" | "engine") => {
    const m = new Map<string, { ok: number; fail: number }>();
    for (const e of events) {
      const k = (e[key] as string) ?? "—";
      const v = m.get(k) ?? { ok: 0, fail: 0 };
      if (e.success) v.ok++;
      else v.fail++;
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].ok + b[1].fail - (a[1].ok + a[1].fail));
  };
  return {
    today: events.filter((e) => isoDay(e.created_at) === today && e.kind === "design").length,
    designs30: events.filter((e) => e.kind === "design" && e.success).length,
    suggest30: events.filter((e) => e.kind === "suggest").length,
    images30: events.filter((e) => e.kind === "image" && e.success).length,
    failures30: events.filter((e) => !e.success).length,
    byKind: group("kind"),
    byEngine: group("engine"),
    chart: perDay(events.filter((e) => e.kind === "design").map((e) => ({ at: e.created_at })), days),
  };
}

export async function auditLog(page = 1) {
  const size = 50;
  const { data, count } = await createAdminClient()
    .from("admin_audit")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  return { rows: data ?? [], page, pages: Math.max(1, Math.ceil((count ?? 0) / size)) };
}

export interface Announcement {
  enabled: boolean;
  text: string;
  link: string;
  tone: "info" | "promo" | "warning";
}

export async function getSettings() {
  const { data } = await createAdminClient().from("app_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    announcement: { enabled: false, text: "", link: "", tone: "info", ...(map.announcement ?? {}) } as Announcement,
  };
}

export async function listAdmins() {
  const { data } = await createAdminClient().from("profiles").select("id, email, full_name").eq("role", "admin");
  return data ?? [];
}

/** What is configured on the server (values are never sent to the browser). */
export function systemStatus() {
  const has = (k: string) => Boolean(process.env[k]?.trim());
  return [
    { key: "Supabase", ok: has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY"), detail: "Base de données et comptes" },
    { key: "Clé serveur Supabase", ok: has("SUPABASE_SERVICE_ROLE_KEY"), detail: "Activation des abonnements, board admin" },
    { key: "Gemini", ok: has("GEMINI_API_KEY"), detail: "Designer IA et suggestions" },
    { key: "Claude (Anthropic)", ok: has("ANTHROPIC_API_KEY"), detail: "Designer IA premium (optionnel)" },
    { key: "SasPay", ok: has("SASPAY_SECRET_KEY"), detail: "Paiement Mobile Money" },
    { key: "Webhook SasPay", ok: has("SASPAY_WEBHOOK_SECRET"), detail: "Confirmation automatique des paiements" },
    { key: "Cloudflare Workers AI", ok: has("CLOUDFLARE_ACCOUNT_ID") && has("CLOUDFLARE_API_TOKEN"), detail: "Décors photo IA (plans Pro et Entreprise)" },
    { key: "URL du site", ok: has("NEXT_PUBLIC_SITE_URL"), detail: "SEO, retours de paiement, e-mails" },
  ];
}
