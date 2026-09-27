import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAiEvent } from "@/lib/admin/log";
import { colorName } from "@/lib/ai/colorNames";
import { dailyAiCount, hasActivePlan } from "@/lib/billing/fairUse";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI images: Cloudflare Workers AI, FLUX.1 [schnell] (free daily allowance).
 * Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers AI).
 *  - mode "art":   the custom illustration printed on the pack (on white for light packs,
 *                  on black for dark ones, so it blends into the label);
 *  - mode "scene": the photographic set of the ad visual (the pack itself is never generated:
 *                  it is the real 3D render composited on the photo).
 * Available without a plan (the paywall is at download time), with a daily fair-use cap.
 */
const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const PER_DAY = { free: 12, plan: 60 };

const ART_STYLES: Record<string, string> = {
  engraving: "vintage botanical engraving illustration, fine etching and cross-hatching lines, detailed scientific illustration, printed label artwork",
  flat: "bold flat vector illustration, clean geometric shapes, modern packaging illustration, flat colours, no gradients",
  watercolor: "delicate watercolour illustration, soft washes and pigment blooms, elegant, hand painted",
  linocut: "bold linocut relief print illustration, carved texture, strong graphic contrast, African textile inspired shapes",
  photo: "appetizing high-end macro photograph, studio lighting, fresh, glistening, ultra detailed, commercial food photography",
  papercut: "layered paper-cut art illustration, soft shadows between paper layers, handcrafted",
  mascot: "friendly cartoon mascot character illustration, bold clean outlines, playful, vector style, full body",
  lineart: "minimal elegant continuous line art illustration, thin confident lines",
};

export async function POST(req: Request) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) return Response.json({ error: "not_configured" }, { status: 503 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("plan_expires_at, suspended").eq("id", user.id).single();
  if (profile?.suspended) return Response.json({ error: "suspended" }, { status: 403 });
  const limit = hasActivePlan(profile) ? PER_DAY.plan : PER_DAY.free;
  if ((await dailyAiCount(admin, user.id, "image")) >= limit) return Response.json({ error: "daily_limit" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const hex = (v: unknown, fb: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fb);
  let prompt: string;
  if (body?.mode === "art") {
    const style = ART_STYLES[String(body.style)] ?? ART_STYLES.flat;
    const subject = String(body.subject ?? "").slice(0, 240) || "fresh natural ingredients";
    const dark = body.dark === true;
    const colors = (Array.isArray(body.colors) ? body.colors : []).slice(0, 3).map((c: unknown) => colorName(hex(c, "#888888")));
    const ground = body.style === "photo" ? `on a plain seamless ${colorName(hex(body.background, "#ffffff"))} background` : dark ? "on a pure solid black background" : "on a pure solid white background";
    prompt =
      `${style}: ${subject}. Colour palette limited to ${colors.join(", ")}. Isolated subject ${ground}, centred, generous empty margin around it. ` +
      "Packaging label artwork, award-winning, high detail. No text, no letters, no words, no numbers, no logo, no frame, no border, no packaging, no bottle, no mockup.";
  } else {
    const scene = String(body?.prompt ?? "").slice(0, 500) || "sunlit studio set, soft shadows";
    prompt =
      `Award-winning advertising product photography set: ${scene}. Camera at eye level, slightly above the table, three-quarter front view (never a top-down flat lay): the surface recedes towards a softly blurred background. An empty spot in the foreground centre where a product will stand, the surface clearly visible. ` +
      "Photorealistic, shot on a medium-format camera, 85 mm lens, shallow depth of field, rich textures, premium commercial campaign, high detail. No product, no packaging, no bottle, no box, no text, no people, no logo.";
  }

  const run = async (p: string) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // FLUX schnell on Workers AI accepts only prompt and steps (a seed is rejected).
      body: JSON.stringify({ prompt: p, steps: 8 }),
    });
    return { res, json: await res.json().catch(() => null) };
  };

  try {
    let { res, json } = await run(prompt);
    // The safety filter sometimes flags innocent food words ("juicy", "ripe"…): retry once softened.
    if (!json?.result?.image && JSON.stringify(json?.errors ?? "").includes("NSFW")) {
      ({ res, json } = await run(prompt.replace(/(juicy|ripe|luscious|succulent|naked|bare|hot|sexy|lush|moist|creamy|dripping)s*/gi, "")));
    }
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
