import { createClient } from "@/lib/supabase/server";
import { hasProFeatures } from "@/lib/billing/plans";
import { logAiEvent } from "@/lib/admin/log";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Photographic backdrops for ad visuals: Cloudflare Workers AI, FLUX.1 [schnell]
 * (free daily allowance). Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI).
 * The pack itself is never generated: it is the real 3D render composited on the photo.
 */
const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const PER_DAY = 40;
const usage = new Map<string, { day: string; n: number }>();

export async function POST(req: Request) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) return Response.json({ error: "not_configured" }, { status: 503 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("plan, plan_expires_at").eq("id", user.id).single();
  if (!profile?.plan_expires_at || new Date(profile.plan_expires_at) <= new Date()) return Response.json({ error: "no_plan" }, { status: 402 });
  if (!hasProFeatures(profile.plan)) return Response.json({ error: "upgrade" }, { status: 403 });

  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(user.id);
  const n = u?.day === day ? u.n : 0;
  if (n >= PER_DAY) return Response.json({ error: "daily_limit" }, { status: 429 });
  usage.set(user.id, { day, n: n + 1 });

  const body = await req.json().catch(() => ({}));
  const scene = String(body?.prompt ?? "").slice(0, 300) || "Table en bois clair, cuisine lumineuse";
  const prompt =
    `Professional product photography backdrop: ${scene}. Empty surface in the foreground, centred, where a product will be placed. ` +
    "Soft natural light, shallow depth of field, photorealistic, high detail, commercial advertising style. No product, no packaging, no text, no people, no logo.";

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, steps: 8, seed: Math.floor(Math.random() * 1e9) }),
    });
    const json = await res.json().catch(() => null);
    const image = json?.result?.image;
    await logAiEvent(user.id, "image", "cloudflare", !!(res.ok && image));
    if (!res.ok || !image) {
      console.error("[ai-image]", res.status, JSON.stringify(json?.errors ?? json).slice(0, 300));
      return Response.json({ error: "generation_failed" }, { status: 502 });
    }
    return Response.json({ image: `data:image/jpeg;base64,${image}` });
  } catch (e) {
    console.error("[ai-image]", e);
    return Response.json({ error: "generation_failed" }, { status: 502 });
  }
}
