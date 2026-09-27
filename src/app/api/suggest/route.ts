import { localSuggestions } from "@/lib/ai/suggest";
import { SUGGEST_STEPS, type StartBrief, type SuggestStep } from "@/lib/design/brief";
import { isLang, LANG_NAMES, type Lang } from "@/lib/i18n/config";
import { logAiEvent } from "@/lib/admin/log";

export const runtime = "nodejs";

// Open to visitors before sign-up, so it is rate-limited per IP (per server instance).
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const QUESTION: Record<SuggestStep, { fr: string; en: string }> = {
  packaging: { fr: "le type de packaging à créer (produit + contenant + contenance, ex. « Jus de gingembre en bouteille verre 33 cl »)", en: "the packaging to create (product + container + size, e.g. “Ginger juice in a 33 cl glass bottle”)" },
  ingredients: { fr: "la liste des ingrédients, par ordre décroissant de poids, allergènes compris (nomenclature INCI pour un cosmétique)", en: "the ingredient list, in descending order of weight, allergens included (INCI names for cosmetics)" },
  usage: { fr: "le mode d'utilisation ou de conservation, en une phrase courte", en: "the directions for use or storage, in one short sentence" },
  quantity: { fr: "la quantité nette avec l'unité légale (g, kg, ml, cl, L)", en: "the net quantity with its legal unit (g, kg, ml, cl, L)" },
  expiry: { fr: "une date limite réaliste pour ce produit, au format AAAA-MM-JJ", en: "a realistic best-before date for this product, as YYYY-MM-DD" },
  production: { fr: "une date de production au format AAAA-MM-JJ", en: "a production date as YYYY-MM-DD" },
  extra: { fr: "d'autres mentions utiles sur l'emballage (origine, conservation, allergènes, contact, certifications réelles seulement)", en: "other useful on-pack information (origin, storage, allergens, contact, only real certifications)" },
};

async function aiSuggestions(step: SuggestStep, brief: Partial<StartBrief>, lang: Lang): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const today = new Date().toISOString().slice(0, 10);
  const context = Object.entries(brief)
    .filter(([k, v]) => typeof v === "string" && v.trim() && !["logo", "logoName", "lang"].includes(k))
    .map(([k, v]) => `${k}: ${String(v).slice(0, 300)}`)
    .join("\n");
  const prompt =
    lang === "fr"
      ? `Tu es un expert en packaging et en étiquetage pour des PME au Cameroun. Nous sommes le ${today}.\nInformations déjà connues sur le produit :\n${context || "(aucune)"}\n\nPropose 4 à 6 réponses courtes, concrètes et différentes pour : ${QUESTION[step].fr}.\nChaque réponse fait au plus 110 caractères, en français, sans numérotation. N'invente jamais de certification.`
      : `You are a packaging and labelling expert for small businesses in Cameroon. Today is ${today}.\nWhat we already know about the product:\n${context || "(nothing yet)"}\n\nSuggest 4 to 6 short, concrete, different answers for: ${QUESTION[step].en}.\nEach answer is at most 110 characters, written in ${LANG_NAMES[lang]} (language code "${lang}"), no numbering. Never invent a certification.`;

  for (const model of ["gemini-flash-lite-latest", "gemini-flash-latest"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT", properties: { suggestions: { type: "ARRAY", items: { type: "STRING" } } }, required: ["suggestions"] },
            temperature: 0.8,
          },
        }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      const list = (JSON.parse(text).suggestions as unknown[]).filter((s): s is string => typeof s === "string").map((s) => s.trim().slice(0, 140)).filter(Boolean);
      if (list.length) return list.slice(0, 6);
    } catch {
      // try the next model, then fall back to local suggestions
    }
  }
  return null;
}

export async function POST(req: Request) {
  let body: { step?: string; brief?: Partial<StartBrief>; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const step = body.step as SuggestStep;
  if (!SUGGEST_STEPS.includes(step)) return Response.json({ error: "unknown step" }, { status: 400 });
  const lang: Lang = isLang(body.lang) ? body.lang : "fr";
  const brief = body.brief ?? {};
  const local = localSuggestions(step, brief, lang);

  // Dates are computed locally: exact and instant.
  if (step === "production") return Response.json({ suggestions: local, source: "local" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) return Response.json({ suggestions: local, source: "local" });

  const ai = await aiSuggestions(step, brief, lang);
  await logAiEvent(null, "suggest", ai ? "gemini" : "local", !!ai);
  if (!ai) return Response.json({ suggestions: local, source: "local" });
  // Keep a date-shaped answer for the expiry step.
  const list = step === "expiry" ? ai.filter((s) => /\d{4}-\d{2}-\d{2}/.test(s)).map((s) => s.match(/\d{4}-\d{2}-\d{2}/)![0]) : ai;
  return Response.json({ suggestions: list.length ? [...new Set(list)] : local, source: list.length ? "ai" : "local" });
}
