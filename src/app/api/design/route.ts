import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { geminiDesign, GeminiError } from "@/lib/ai/gemini";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  SHAPE_IDS, STYLE_IDS, FONT_FAMILIES, catalogForPrompt, localDesign, sanitizeSpec,
  type CurrentDesign, type DesignSpec,
} from "@/lib/ai/designSpec";

export const runtime = "nodejs";
export const maxDuration = 120;

const Hex = z.string().describe("Couleur hexadécimale #RRGGBB");

const DesignSchema = z.object({
  shapeId: z.enum(SHAPE_IDS as [string, ...string[]]),
  styleId: z.enum(STYLE_IDS as [string, ...string[]]),
  headingFont: z.enum(FONT_FAMILIES as [string, ...string[]]),
  bodyFont: z.enum(FONT_FAMILIES as [string, ...string[]]),
  palette: z.object({ background: Hex, ink: Hex, accent: Hex, extra: Hex }),
  projectName: z.string(),
  brandName: z.string(),
  productName: z.string(),
  tagline: z.string(),
  volume: z.string(),
  details: z.string(),
  rationale: z.string(),
});

const { shapes, styles, fonts } = catalogForPrompt();

// Stable prefix (cached): role, method and the full catalog.
const SYSTEM = `Tu es un directeur artistique et product designer packaging senior (15 ans en agences de design de marque, cosmétique, alimentaire, boissons, luxe). Tu conçois des packagings prêts à imprimer pour des utilisateurs qui n'ont aucune compétence en design : ils décrivent leur produit en quelques mots, toi tu prends toutes les décisions de design.

Méthode :
1. Comprends le produit, la cible, le canal de vente et le positionnement (prix, valeurs). Si le brief est vague, fais des choix plausibles et assumés.
2. Choisis le contenant le plus juste dans le catalogue (fonction, conventions de la catégorie, contenance).
3. Choisis la direction artistique (styleId) la plus proche, puis crée une palette sur mesure : background (fond du pack), ink (texte principal, contraste WCAG ≥ 4,5:1 avec background), accent (filets, monogramme, bandeaux), extra (couleur secondaire). Respecte les codes de la catégorie tout en se différenciant en rayon (ex. café : tons terre/crème ; pharmacie : blanc/bleu ; luxe : sombre + métal ; bio : naturels désaturés ; enfants : saturés).
4. Typographie : 2 polices maximum parmi la liste. headingFont pour la marque (personnalité), bodyFont pour les textes (lisibilité : sans-serif ou serif de texte, jamais une script ou display pour bodyFont).
5. Hiérarchie de la face avant : marque → nom du produit (court, 2 à 5 mots) → accroche (bénéfice clé, 3 à 7 mots) → contenance. Pas de phrases longues en façade.
6. details = texte du dos : 2 à 4 phrases utiles (description, conseil d'utilisation) + mentions attendues pour la catégorie (liste INCI plausible pour un cosmétique, ingrédients et allergènes pour l'alimentaire, mention alcool pour les boissons alcoolisées). N'invente aucune certification ni allégation de santé non demandée.
7. volume avec unité réglementaire (ml, cl, L, g, kg).
8. Si l'utilisateur fournit un nom de marque, des couleurs ou un visuel de référence, respecte-les strictement. Un visuel joint est une référence d'ambiance ou une charte : reprends-en les couleurs et l'esprit.
9. Écris les textes dans la langue du brief (français par défaut). rationale : 1 à 2 phrases en français expliquant tes choix à l'utilisateur.

CATALOGUE DES CONTENANTS (shapeId: nom, dimensions, matériau)
${shapes}

DIRECTIONS ARTISTIQUES (styleId: nom — ambiance [palette de départ] finition)
${styles}

POLICES INSTALLÉES
${fonts}`;

function userMessage(prompt: string, current: CurrentDesign) {
  return `Design actuel (à faire évoluer seulement si le brief ne le contredit pas) : ${JSON.stringify(current)}

Brief de l'utilisateur :
${prompt}`;
}

type RefFile = { mediaType: string; data: string; name?: string };

function referenceBlock(ref: RefFile): Anthropic.Beta.BetaContentBlockParam | null {
  if (ref.mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: ref.data } };
  }
  if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(ref.mediaType)) {
    return {
      type: "image",
      source: { type: "base64", media_type: ref.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: ref.data },
    };
  }
  return null;
}

async function claudeDesign(prompt: string, current: CurrentDesign, reference: RefFile | null): Promise<DesignSpec> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const ref = reference ? referenceBlock(reference) : null;
  if (ref) content.push(ref);
  content.push({ type: "text", text: userMessage(prompt, current) });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(DesignSchema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Le modèle a refusé ce brief.");
  }
  if (!response.parsed_output) {
    throw new Error(`Réponse incomplète (${response.stop_reason}).`);
  }
  return response.parsed_output;
}

const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

function describeError(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return "clé Anthropic invalide";
  if (error instanceof Anthropic.RateLimitError) return "trop de requêtes Claude";
  if (error instanceof Anthropic.APIError) return `Claude indisponible (${error.status})`;
  if (error instanceof GeminiError) {
    if (error.status === 429) return "quota gratuit Gemini atteint, réessayez plus tard";
    if (error.status === 400 || error.status === 403) return `clé Gemini refusée (${error.message})`;
    return `Gemini indisponible (${error.message})`;
  }
  return error instanceof Error ? error.message : "erreur inconnue";
}

export async function POST(req: Request) {
  let body: { prompt?: string; current?: CurrentDesign; reference?: RefFile | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim().slice(0, 4000);
  const current = body.current;
  if (!prompt || !current) {
    return Response.json({ error: "Brief manquant." }, { status: 400 });
  }
  const reference = body.reference ?? null;

  // Signed-in users only; credits are checked here and spent only when an AI engine succeeds.
  const supabase = createSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Connectez-vous pour générer un packaging." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("credits").eq("id", user.id).single();
  const available = profile?.credits ?? 0;
  if (available <= 0) {
    return Response.json({ error: "Vous n'avez plus de crédits IA.", credits: 0 }, { status: 402 });
  }

  // Engines in order of quality; each failure falls through to the next one.
  const engines: { name: "claude" | "gemini"; run: () => Promise<DesignSpec> }[] = [];
  if (hasClaude()) engines.push({ name: "claude", run: () => claudeDesign(prompt, current, reference) });
  if (hasGemini()) engines.push({ name: "gemini", run: () => geminiDesign(SYSTEM, userMessage(prompt, current), reference) });

  const failures: string[] = [];
  for (const engine of engines) {
    try {
      const spec = await engine.run();
      const { data: remaining } = await supabase.rpc("consume_credit");
      return Response.json({ spec: sanitizeSpec(spec, current), engine: engine.name, credits: typeof remaining === "number" && remaining >= 0 ? remaining : available - 1 });
    } catch (error) {
      console.error(`[api/design] ${engine.name}`, error);
      failures.push(describeError(error));
    }
  }

  return Response.json({
    spec: sanitizeSpec(localDesign(prompt, current), current),
    engine: "local",
    credits: available,
    notice: engines.length
      ? `Designer IA indisponible (${failures.join(" ; ")}) : design généré en mode hors ligne.`
      : "Mode hors ligne : ajoutez GEMINI_API_KEY (gratuit) dans .env.local pour activer le designer IA.",
  });
}
