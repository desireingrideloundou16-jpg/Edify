import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { geminiDesign, GeminiError } from "@/lib/ai/gemini";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  SHAPE_IDS, STYLE_IDS, FONT_FAMILIES, catalogForPrompt, localDesign, sanitizeSpec,
  type CurrentDesign, type DesignSpec,
} from "@/lib/ai/designSpec";
import { PACKAGING_KNOWLEDGE } from "@/lib/ai/packagingKnowledge";
import { logAiEvent } from "@/lib/admin/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimPackaging, resolveProject } from "@/lib/billing/packaging";
import { AI_REGEN_PER_PACKAGING } from "@/lib/billing/plans";

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
  ingredients: z.string(),
  usage: z.string(),
  rationale: z.string(),
});

const { shapes, styles, fonts } = catalogForPrompt();

// Stable prefix (cached): role, method and the full catalog.
const SYSTEM = `Tu es le meilleur directeur artistique et product designer packaging au monde (20 ans en agences de design de marque : alimentaire, boissons, cosmétique, luxe), spécialiste des marchés d'Afrique centrale et de l'Ouest. Tu conçois des packagings prêts à imprimer pour des entrepreneurs, souvent au Cameroun, qui n'ont aucune compétence en design : ils décrivent leur produit, toi tu prends toutes les décisions de design et tu rédiges des mentions conformes.

Méthode :
1. Comprends le produit, la cible, le canal de vente et le positionnement (prix, valeurs). Si le brief est vague, fais des choix plausibles et assumés.
2. Choisis le contenant le plus juste dans le catalogue (fonction, conventions de la catégorie, contenance).
3. Choisis la direction artistique (styleId) la plus proche, puis crée une palette sur mesure : background (fond du pack), ink (texte principal, contraste WCAG ≥ 4,5:1 avec background), accent (filets, monogramme, bandeaux), extra (couleur secondaire). Respecte les codes de la catégorie tout en se différenciant en rayon (ex. café : tons terre/crème ; pharmacie : blanc/bleu ; luxe : sombre + métal ; bio : naturels désaturés ; enfants : saturés).
4. Typographie : 2 polices maximum parmi la liste. headingFont pour la marque (personnalité), bodyFont pour les textes (lisibilité : sans-serif ou serif de texte, jamais une script ou display pour bodyFont).
5. Hiérarchie de la face avant : marque → nom du produit (court, 2 à 5 mots) → accroche (bénéfice clé, 3 à 7 mots) → contenance. Pas de phrases longues en façade.
6. Textes du dos, en français puis en anglais (ex. « Conserver au sec. / Keep dry. ») :
   - ingredients : si l'utilisateur les donne, reprends-les fidèlement (corrige seulement l'orthographe, mets les allergènes en MAJUSCULES) et ajoute la traduction anglaise ; sinon propose une liste plausible et prudente pour ce produit (INCI pour un cosmétique).
   - usage : mode d'emploi ou de conservation, 1 à 2 phrases courtes, bilingue.
   - details : 1 à 2 phrases d'histoire ou d'origine + conservation + « Fabriqué par … » si le fabricant est connu. Ne répète ni les ingrédients ni le mode d'emploi. N'invente aucune certification ni allégation de santé non demandée.
7. volume avec unité réglementaire (ml, cl, L, g, kg).
8. Si l'utilisateur fournit un nom de marque, des couleurs ou un visuel de référence, respecte-les strictement. Un visuel joint est une référence d'ambiance ou une charte : reprends-en les couleurs et l'esprit.
9. Face avant dans la langue principale de l'utilisateur (français par défaut) ; mentions du dos bilingues français/anglais. La quantité, les dates, le prix et le code-barres donnés par l'utilisateur sont imprimés automatiquement dans un bloc dédié : ne les écris JAMAIS dans details, ingredients ou usage (pas de doublon). rationale : 1 à 2 phrases dans la langue de l'utilisateur, qui expliquent tes choix comme un directeur artistique (catégorie, cible, couleurs, typographie).

${PACKAGING_KNOWLEDGE}

CATALOGUE DES CONTENANTS (shapeId: nom, dimensions, matériau)
${shapes}

DIRECTIONS ARTISTIQUES (styleId: nom — ambiance [palette de départ] finition)
${styles}

POLICES INSTALLÉES
${fonts}`;

function userMessage(prompt: string, current: CurrentDesign, opts: { fresh?: boolean; logoColors?: string[]; hasLogo?: boolean } = {}) {
  const logo = opts.hasLogo
    ? `\n\nLOGO DE LA MARQUE : fourni en image${opts.logoColors?.length ? `, couleurs dominantes ${opts.logoColors.join(", ")}` : ""}. Construis la palette à partir de ces couleurs (background ou accent = couleur principale du logo, ink contrasté) pour que le logo s'intègre parfaitement sur la face avant.`
    : "";
  if (opts.fresh) {
    return `NOUVEAU PACKAGING À CRÉER DE ZÉRO : ignore tout design précédent. Conçois-le de façon autonome, comme un directeur artistique, en utilisant TOUTES les informations ci-dessous : le contenant doit correspondre exactement au packaging décrit et à sa contenance, le nom de marque est repris à l'identique, les ingrédients et l'usage inspirent l'univers visuel (couleurs du fruit, de l'épice, de la plante…), l'origine et les autres informations nourrissent l'accroche et le texte du dos.${logo}

Brief de l'utilisateur :
${prompt}`;
  }
  const { ingredients, usage, barcode, expiry, production, price, extra, ...design } = current;
  const fields = Object.entries({ ingredients, usage, barcode, expiry, production, price, extra }).filter(([, v]) => v && String(v).trim());
  return `Design actuel (à faire évoluer seulement si le brief ne le contredit pas) : ${JSON.stringify(design)}${
    fields.length ? `\nInformations produit déjà saisies par l'utilisateur (à respecter et à utiliser) : ${JSON.stringify(Object.fromEntries(fields))}` : ""
  }${logo}

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

async function claudeDesign(prompt: string, current: CurrentDesign, reference: RefFile | null, opts: Parameters<typeof userMessage>[2]): Promise<DesignSpec> {
  const client = new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const ref = reference ? referenceBlock(reference) : null;
  if (ref) content.push(ref);
  content.push({ type: "text", text: userMessage(prompt, current, opts) });

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

/** Offline designer: at least wear the brand's own colours. */
function withLogoColors(spec: DesignSpec, colors: string[]): DesignSpec {
  if (!colors.length) return spec;
  return { ...spec, palette: { ...spec.palette, accent: colors[0], extra: colors[1] ?? spec.palette.extra } };
}

export async function POST(req: Request) {
  let body: { prompt?: string; current?: CurrentDesign; reference?: RefFile | null; fresh?: boolean; logoColors?: string[]; projectId?: string | null };
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
  const msgOpts = {
    fresh: body.fresh === true,
    hasLogo: reference?.name === "logo",
    logoColors: Array.isArray(body.logoColors) ? body.logoColors.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4) : [],
  };

  // Signed-in users only; credits are checked here and spent only when an AI engine succeeds.
  const supabase = createSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Connectez-vous pour générer un packaging." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("credits, plan_expires_at, suspended").eq("id", user.id).single();
  if (profile?.suspended) return Response.json({ error: "Compte suspendu.", reason: "suspended" }, { status: 403 });
  const available = profile?.credits ?? 0;
  if (!profile?.plan_expires_at || new Date(profile.plan_expires_at) <= new Date()) {
    return Response.json({ error: "Un abonnement actif est nécessaire.", reason: "no_plan", credits: available }, { status: 402 });
  }
  // Quota by packaging: a new packaging needs one left; an already counted one can be
  // regenerated up to AI_REGEN_PER_PACKAGING times (fair use).
  const admin = createAdminClient();
  if (!body.projectId && available <= 0) {
    return Response.json({ error: "Vous avez utilisé tous vos packagings.", reason: "no_credits", credits: 0 }, { status: 402 });
  }
  const project = await resolveProject(admin, user.id, body.projectId);
  if (!project.counted && available <= 0) {
    return Response.json({ error: "Vous avez utilisé tous vos packagings.", reason: "no_credits", credits: 0, projectId: project.id }, { status: 402 });
  }
  if (project.counted && project.ai_generations >= AI_REGEN_PER_PACKAGING) {
    return Response.json(
      { error: `Limite de ${AI_REGEN_PER_PACKAGING} régénérations IA atteinte pour ce packaging.`, reason: "regen_limit", credits: available, projectId: project.id },
      { status: 429 }
    );
  }

  // Engines in order of quality; each failure falls through to the next one.
  const engines: { name: "claude" | "gemini"; run: () => Promise<DesignSpec> }[] = [];
  if (hasClaude()) engines.push({ name: "claude", run: () => claudeDesign(prompt, current, reference, msgOpts) });
  if (hasGemini()) engines.push({ name: "gemini", run: () => geminiDesign(SYSTEM, userMessage(prompt, current, msgOpts), reference) });

  const failures: string[] = [];
  for (const engine of engines) {
    try {
      const spec = await engine.run();
      const remaining = await claimPackaging(admin, user.id, project.id);
      await admin.from("projects").update({ ai_generations: project.ai_generations + 1 }).eq("id", project.id);
      await logAiEvent(user.id, "design", engine.name);
      return Response.json({
        spec: sanitizeSpec(spec, current),
        engine: engine.name,
        credits: remaining >= 0 ? remaining : available,
        projectId: project.id,
        counted: true,
      });
    } catch (error) {
      console.error(`[api/design] ${engine.name}`, error);
      await logAiEvent(user.id, "design", engine.name, false);
      failures.push(describeError(error));
    }
  }

  await logAiEvent(user.id, "design", "local");
  return Response.json({
    spec: sanitizeSpec(withLogoColors(localDesign(prompt, current), msgOpts.logoColors), current),
    engine: "local",
    credits: available,
    projectId: project.id,
    notice: engines.length
      ? `Designer IA indisponible (${failures.join(" ; ")}) : design généré en mode hors ligne.`
      : "Mode hors ligne : ajoutez GEMINI_API_KEY (gratuit) dans .env.local pour activer le designer IA.",
  });
}
