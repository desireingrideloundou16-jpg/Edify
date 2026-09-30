/**
 * Google Gemini engine (free tier) for the AI packaging designer.
 * Raw REST call with a JSON response schema, so the output always matches DesignSpec.
 */
import { geminiTokens, trackAiCall, type AiCallTracker } from "./gateway";
import { STYLE_IDS, FONT_FAMILIES, LAYOUT_IDS, MOTIF_IDS, ART_STYLES, type DesignSpec } from "./designSpec";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Tried in order: newest fast model first, then the stable "latest" alias. Overridable with GEMINI_MODEL.
export const GEMINI_MODELS = (process.env.GEMINI_MODEL || "gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash,gemini-flash-lite-latest").split(",").map((m) => m.trim());
const PER_CALL_MS = 25_000;
const TOTAL_BUDGET_MS = 60_000;

const str = (description?: string) => ({ type: "STRING", ...(description ? { description } : {}) });
const hex = str("Couleur hexadécimale #RRGGBB");

export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    // Free text: an enum of 100+ containers exceeds Gemini's schema limits (sanitizeSpec matches it to the catalogue).
    shapeId: str("Identifiant exact d'un contenant du CATALOGUE DES CONTENANTS"),
    styleId: { type: "STRING", enum: STYLE_IDS },
    headingFont: { type: "STRING", enum: FONT_FAMILIES },
    bodyFont: { type: "STRING", enum: FONT_FAMILIES },
    layout: { type: "STRING", enum: LAYOUT_IDS, description: "Composition de la face avant" },
    motif: { type: "STRING", enum: MOTIF_IDS, description: "Motif graphique de fond" },
    artStyle: { type: "STRING", enum: [...ART_STYLES], description: "Style de l'illustration sur mesure" },
    artSubject: str("Sujet de l'illustration, EN ANGLAIS, concret et visuel (ingrédient héros, origine, mascotte)"),
    badge: str("Texte du sceau rond, 1 à 3 mots, uniquement un fait du brief, ou vide"),
    origin: str("Ligne d'origine en petites capitales (ex. Ouest Cameroun), ou vide"),
    contentColor: str("Couleur #RRGGBB du produit visible à travers un contenant transparent, ou vide"),
    adHeadline: str("Accroche publicitaire, 2 à 6 mots"),
    adCta: str("Appel à l'action, 2 à 4 mots"),
    palette: {
      type: "OBJECT",
      properties: { background: hex, ink: hex, accent: hex, extra: hex },
      required: ["background", "ink", "accent", "extra"],
    },
    projectName: str(),
    brandName: str(),
    productName: str(),
    tagline: str(),
    volume: str(),
    details: str("Texte du dos : histoire/origine, conservation, fabricant, mentions (sans répéter ingrédients ni mode d'emploi)"),
    ingredients: str("Liste des ingrédients (ou INCI), par ordre décroissant"),
    usage: str("Mode d'emploi ou de conservation, court"),
    rationale: str(),
  },
  required: ["shapeId", "styleId", "headingFont", "bodyFont", "palette", "layout", "motif", "artStyle", "artSubject", "badge", "origin", "contentColor", "adHeadline", "adCta", "projectName", "brandName", "productName", "tagline", "volume", "details", "ingredients", "usage", "rationale"],
  propertyOrdering: ["shapeId", "styleId", "layout", "motif", "artStyle", "artSubject", "badge", "origin", "contentColor", "headingFont", "bodyFont", "palette", "projectName", "brandName", "productName", "tagline", "volume", "details", "ingredients", "usage", "adHeadline", "adCta", "rationale"],
};

export class GeminiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function geminiDesign(
  system: string,
  userText: string,
  reference: { mediaType: string; data: string } | null,
  ctx: { userId?: string | null; fallbackFrom?: string | null } = {}
): Promise<DesignSpec> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY manquante");

  const parts: Record<string, unknown>[] = [];
  if (reference && (reference.mediaType.startsWith("image/") || reference.mediaType === "application/pdf")) {
    parts.push({ inlineData: { mimeType: reference.mediaType, data: reference.data } });
  }
  parts.push({ text: userText });

  let lastError: GeminiError | null = null;
  // Previous failed attempt in this request (observability only).
  let previous: string | null = ctx.fallbackFrom ?? null;
  const started = Date.now();
  // Two passes: free-tier models are often briefly overloaded (503), a short pause usually clears it.
  for (const [pass, model] of [...GEMINI_MODELS.map((m) => [0, m] as const), ...GEMINI_MODELS.slice(0, 2).map((m) => [1, m] as const)]) {
    if (Date.now() - started > TOTAL_BUDGET_MS) break;
    if (pass === 1 && model === GEMINI_MODELS[0]) await new Promise((r) => setTimeout(r, 2000));
    try {
      const timeout = Math.min(PER_CALL_MS, TOTAL_BUDGET_MS - (Date.now() - started));
      // Observability only: the gateway returns/rethrows exactly what callModel does.
      return await trackAiCall(
        { operation: "design.generate", provider: "gemini", model, userId: ctx.userId, fallbackFrom: previous, metadata: { pass, reference: !!reference } },
        (t) => callModel(model, key, system, parts, timeout, t)
      );
    } catch (e) {
      if (!(e instanceof GeminiError)) throw e;
      lastError = e;
      previous = `gemini:${model}`;
      // Overloaded, unavailable or retired model: try the next one. Bad key or bad request: stop.
      if (![404, 429, 500, 503].includes(e.status ?? 0) && e.status !== undefined) throw e;
    }
  }
  throw lastError ?? new GeminiError("Aucun modèle Gemini disponible");
}

async function callModel(model: string, key: string, system: string, parts: Record<string, unknown>[], timeoutMs: number, t?: AiCallTracker): Promise<DesignSpec> {
  let res: Response;
  try {
    res = await fetch(`${API}/${model}:generateContent`, {
    signal: AbortSignal.timeout(Math.max(3000, timeoutMs)),
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9,
      },
    }),
  });
  } catch {
    t?.timedOut();
    throw new GeminiError(`${model} trop lent`, 503);
  }

  const json = await res.json().catch(() => null);
  t?.model(json?.modelVersion);
  const usage = geminiTokens(json);
  if (usage) t?.tokens(usage);
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new GeminiError(msg, res.status);
  }
  const candidate = json?.candidates?.[0];
  const text: string | undefined = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) {
    throw new GeminiError(`Réponse vide (${candidate?.finishReason ?? json?.promptFeedback?.blockReason ?? "inconnue"})`);
  }
  return JSON.parse(text) as DesignSpec;
}
