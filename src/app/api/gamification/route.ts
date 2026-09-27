import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVENTS, MISSION_BONUS_XP, isGameEvent, levelOf, missionsFor, type GameEvent, type GameState } from "@/lib/gamification";

export const runtime = "nodejs";

interface Row {
  user_id: string;
  xp: number;
  streak: number;
  best_streak: number;
  last_active: string | null;
  badges: string[];
  counters: Record<string, number>;
  daily: { day?: string; counts?: Record<string, number>; missionsDone?: string[]; bonus?: boolean };
}

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function toState(row: Row): GameState {
  const day = today();
  const done = row.daily?.day === day ? row.daily.missionsDone ?? [] : [];
  return {
    xp: row.xp,
    streak: row.streak,
    bestStreak: row.best_streak,
    badges: row.badges ?? [],
    missions: missionsFor(day).map((m) => ({ id: m.id, label: m.label, done: done.includes(m.id) })),
    missionsBonus: row.daily?.day === day && !!row.daily.bonus,
  };
}

async function load(userId: string): Promise<Row> {
  const db = createAdminClient();
  const { data } = await db.from("gamification").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as Row;
  const fresh: Row = { user_id: userId, xp: 0, streak: 0, best_streak: 0, last_active: null, badges: [], counters: {}, daily: {} };
  await db.from("gamification").insert(fresh);
  return fresh;
}

export async function GET() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json({ state: toState(await load(user.id)) });
}

/** Records one event: XP (with daily caps), streak, missions, badges. */
export async function POST(req: Request) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const event = body?.event;
  if (!isGameEvent(event)) return Response.json({ error: "unknown_event" }, { status: 400 });
  const meta = typeof body?.meta === "string" ? body.meta.slice(0, 40) : "";

  const db = createAdminClient();
  const row = await load(user.id);
  const before = levelOf(row.xp);
  const day = today();
  if (row.daily?.day !== day) row.daily = { day, counts: {}, missionsDone: [], bonus: false };
  const counts = row.daily.counts ?? (row.daily.counts = {});
  const counters = row.counters ?? (row.counters = {});
  let gained = 0;

  // Daily streak (any event counts as being active today)
  if (row.last_active !== day) {
    row.streak = row.last_active === yesterday() ? row.streak + 1 : 1;
    row.best_streak = Math.max(row.best_streak, row.streak);
    row.last_active = day;
  }

  const rule = EVENTS[event as GameEvent];
  if ((counts[event] ?? 0) < rule.daily) {
    counts[event] = (counts[event] ?? 0) + 1;
    counters[event] = (counters[event] ?? 0) + 1;
    gained += rule.xp;
  }
  // Distinct layouts tried (for the collector badge)
  if (event === "change_layout" && meta) {
    const key = `layout:${meta}`;
    counters[key] = 1;
  }

  // Missions of the day
  const done = row.daily.missionsDone ?? (row.daily.missionsDone = []);
  for (const m of missionsFor(day)) if (m.event === event && !done.includes(m.id)) done.push(m.id);
  if (!row.daily.bonus && done.length >= 3) {
    row.daily.bonus = true;
    gained += MISSION_BONUS_XP;
  }

  // Badges
  const has = new Set(row.badges ?? []);
  const newBadges: string[] = [];
  const award = (id: string, cond: boolean) => {
    if (cond && !has.has(id)) {
      has.add(id);
      newBadges.push(id);
    }
  };
  award("premier-design", (counters.ai_design ?? 0) >= 1);
  award("voix-d-or", (counters.voice_note ?? 0) >= 1);
  award("pret-a-imprimer", (counters.download_pdf ?? 0) >= 1);
  award("publicitaire", (counters.ad_visual ?? 0) >= 1);
  award("explorateur-3d", (counters.view_back ?? 0) >= 1);
  award("code-barres", (counters.barcode_valid ?? 0) >= 1);
  award("identite", (counters.logo_upload ?? 0) >= 1);
  award("ambassadeur", (counters.share ?? 0) >= 3);
  award("perfectionniste", (counters.edit_text ?? 0) >= 30);
  award("collectionneur", Object.keys(counters).filter((k) => k.startsWith("layout:")).length >= 5);
  award("flamme-7", row.streak >= 7);
  award("flamme-30", row.streak >= 30);
  if (!has.has("gamme")) {
    const { count } = await db.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("counted", true);
    award("gamme", (count ?? 0) >= 5);
  }
  gained += newBadges.length * 30;

  row.xp += gained;
  row.badges = [...has];
  await db
    .from("gamification")
    .update({ xp: row.xp, streak: row.streak, best_streak: row.best_streak, last_active: row.last_active, badges: row.badges, counters, daily: row.daily, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  const after = levelOf(row.xp);
  return Response.json({ state: toState(row), gained, newBadges, levelUp: after.level > before.level ? after : null });
}
