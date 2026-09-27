import { createClient } from "@/lib/supabase/server";
import { logAiEvent } from "@/lib/admin/log";
import { LAYOUT_IDS, MOTIF_IDS } from "@/lib/ai/designSpec";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyAiCount, hasActivePlan } from "@/lib/billing/fairUse";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Voice notes from the studio: Gemini listens to the note (16 kHz WAV), transcribes it and turns
 * it into a studio action — direct edits (texts, colours, layout, container) or a full AI design.
 */
const str = (description?: string) => ({ type: "STRING", ...(description ? { description } : {}) });
const SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: str("Transcription fidèle de la note vocale"),
    reply: str("Confirmation courte (1 phrase) de ce qui va être fait, dans la langue de l'utilisateur"),
    action: { type: "STRING", enum: ["edit", "design", "none"], description: "edit = modifier le packaging actuel ; design = concevoir un nouveau packaging avec l'IA ; none = rien de clair" },
    designBrief: str("Si action=design : brief complet et détaillé pour le designer IA, reprenant TOUT ce que l'utilisateur a dit"),
    edits: {
      type: "OBJECT",
      description: "Si action=edit : seulement les champs à changer, texte final prêt à imprimer",
      properties: {
        brandName: str(), productName: str(), tagline: str(), volume: str(), ingredients: str(), usage: str(),
        details: str(), extra: str(), price: str(), expiry: str("AAAA-MM-JJ"), production: str("AAAA-MM-JJ"), barcode: str(),
      },
    },
    layout: { type: "STRING", enum: ["keep", ...LAYOUT_IDS], description: "Nouvelle composition si demandée, sinon keep" },
    motif: { type: "STRING", enum: ["keep", ...MOTIF_IDS], description: "Nouveau motif si demandé, sinon keep" },
    colors: { type: "OBJECT", properties: { background: str("#RRGGBB ou vide"), accent: str("#RRGGBB ou vide"), ink: str("#RRGGBB ou vide") } },
    containerQuery: str("Si l'utilisateur veut changer de contenant : quelques mots pour le chercher dans le catalogue (ex. « bouteille verre 50 cl »), sinon vide"),
  },
  required: ["transcript", "reply", "action"],
};

export async function POST(req: Request) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });
  // Open without a plan (the paywall is at download time), within a daily fair-use cap
  // shared with the wizard suggestions.
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("plan_expires_at, suspended").eq("id", user.id).single();
  if (profile?.suspended) return Response.json({ error: "suspended" }, { status: 403 });
  if ((await dailyAiCount(admin, user.id, "suggest")) >= (hasActivePlan(profile) ? 120 : 30)) return Response.json({ error: "daily_limit" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const audio = typeof body?.audio === "string" ? body.audio : "";
  if (!audio || audio.length > 4_000_000) return Response.json({ error: "invalid_audio" }, { status: 400 });
  const context = JSON.stringify(body?.context ?? {}).slice(0, 3000);

  const prompt = `Tu es l'assistant vocal du studio de packaging Edify. L'utilisateur, qui n'est pas designer, vient d'enregistrer une note vocale (en français, anglais ou un mélange, parfois avec un accent camerounais ou des mots de pidgin). Écoute-la attentivement, transcris-la, puis décide de l'action :
- « edit » s'il veut changer quelque chose sur le packaging actuel (un texte, un prix, une date, les couleurs, la mise en page, le motif, le contenant) : remplis seulement ce qui change, avec le texte final soigné (orthographe corrigée, unités légales) ;
- couleurs : « background » = couleur dominante du packaging, « accent » = couleur de marque (bandeaux, formes), « ink » = couleur du texte (toujours lisible sur le fond). Une demande « en orange » change background et/ou accent, jamais le texte seul ; garde un contraste élevé ;
- « design » s'il décrit un nouveau produit ou demande de refaire tout le design : écris un brief complet et détaillé qui reprend tout ce qu'il a dit ;
- « none » si la note est vide, inaudible ou hors sujet (explique-le gentiment dans reply).
Couleurs demandées : convertis-les en #RRGGBB harmonieux (ex. « rouge bissap » → #8E1B3A). Ne invente rien que l'utilisateur n'a pas dit.

Packaging actuellement ouvert : ${context}`;

  for (const model of ["gemini-flash-latest", "gemini-3.5-flash", "gemini-flash-lite-latest"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: audio } }, { text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
        }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      const command = JSON.parse(text);
      await logAiEvent(user.id, "suggest", `voice:${model}`);
      return Response.json({ command });
    } catch {
      // next model
    }
  }
  await logAiEvent(user.id, "suggest", "voice", false);
  return Response.json({ error: "analysis_failed" }, { status: 502 });
}
