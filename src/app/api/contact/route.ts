import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Contact form. The browser no longer writes to the table itself (spam, forged status):
 * input is validated here and rate-limited per e-mail and per IP, counted in the database.
 */
const Body = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().max(80).default("Question"),
  message: z.string().trim().min(5).max(4000),
  // Honeypot: hidden field, left empty by humans.
  website: z.string().max(0).optional(),
});

const PER_HOUR_PER_EMAIL = 3;
const PER_HOUR_TOTAL = 60;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { website: _honeypot, ...msg } = parsed.data;
  void _honeypot;

  const db = createAdminClient();
  const since = new Date(Date.now() - 3600_000).toISOString();
  const [{ count: mine }, { count: all }] = await Promise.all([
    db.from("contact_messages").select("id", { count: "exact", head: true }).eq("email", msg.email).gte("created_at", since),
    db.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  if ((mine ?? 0) >= PER_HOUR_PER_EMAIL || (all ?? 0) >= PER_HOUR_TOTAL) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  // status stays 'new' (column default): the sender can't choose it.
  const { error } = await db.from("contact_messages").insert(msg);
  if (error) {
    console.error("[contact]", error.message);
    return Response.json({ error: "server" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
