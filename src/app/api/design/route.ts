import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { geminiDesign, GeminiError } from "@/lib/ai/gemini";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  SHAPE_IDS, STYLE_IDS, FONT_FAMILIES, LAYOUT_IDS, MOTIF_IDS, ART_STYLES, catalogForPrompt, localDesign, sanitizeSpec,
  type CurrentDesign, type DesignSpec,
} from "@/lib/ai/designSpec";
import { PACKAGING_KNOWLEDGE } from "@/lib/ai/packagingKnowledge";
import { DESIGNER_METHOD, DESIGNER_ROLE } from "@/lib/ai/designerPrompt";
import { logAiEvent } from "@/lib/admin/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProject } from "@/lib/billing/packaging";
import { dailyAiCount, hasActivePlan } from "@/lib/billing/fairUse";
import { AI_REGEN_PER_PACKAGING } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Daily AI designs (fair use): open to every account, more with a plan. */
const DESIGNS_PER_DAY = { free: 6, plan: 40 };

const Hex = z.string().describe("Couleur hexadécimale #RRGGBB");

const DesignSchema = z.object({
  shapeId: z.enum(SHAPE_IDS as [string, ...string[]]),
  styleId: z.enum(STYLE_IDS as [string, ...string[]]),
  headingFont: z.enum(FONT_FAMILIES as [string, ...string[]]),
  bodyFont: z.enum(FONT_FAMILIES as [string, ...string[]]),
  layout: z.enum(LAYOUT_IDS as [string, ...string[]]),
  motif: z.enum(MOTIF_IDS as [string, ...string[]]),
  artStyle: z.enum(ART_STYLES as unknown as [string, ...string[]]),
  artSubject: z.string().describe("Sujet de l'illustration, en anglais"),
  badge: z.string(),
  origin: z.string(),
  contentColor: z.string(),
  adHeadline: z.string(),
  adCta: z.string(),
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
const SYSTEM = `${DESIGNER_ROLE}

${DESIGNER_METHOD}

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
  const REF_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
  const ref = body.reference ?? null;
  if (ref && (typeof ref.data !== "string" || !REF_TYPES.includes(ref.mediaType) || ref.data.length > 4_000_000)) {
    return Response.json({ error: "Fichier non accepté : image (PNG, JPEG, WebP) ou PDF de 3 Mo maximum." }, { status: 400 });
  }
  const reference = ref;
  const msgOpts = {
    fresh: body.fresh === true,
    hasLogo: reference?.name === "logo",
    logoColors: Array.isArray(body.logoColors) ? body.logoColors.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 4) : [],
  };

  // Signed-in users only. Designing is open (the paywall is at download time) within a daily cap;
  // a packaging counts in the plan when it is first downloaded (api/packaging/claim).
  const supabase = await createSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Connectez-vous pour générer un packaging." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("credits, plan_expires_at, suspended").eq("id", user.id).single();
  if (profile?.suspended) return Response.json({ error: "Compte suspendu.", reason: "suspended" }, { status: 403 });
  const available = profile?.credits ?? 0;
  const admin = createAdminClient();
  const cap = hasActivePlan(profile) ? DESIGNS_PER_DAY.plan : DESIGNS_PER_DAY.free;
  if ((await dailyAiCount(admin, user.id, "design")) >= cap) {
    return Response.json(
      { error: `Vous avez atteint la limite de ${cap} designs IA pour aujourd'hui. Revenez demain, ou modifiez votre packaging à la main dans le studio.`, reason: "daily_limit", credits: available },
      { status: 429 }
    );
  }
  const project = await resolveProject(admin, user.id, body.projectId);
  if (project.ai_generations >= AI_REGEN_PER_PACKAGING) {
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
      const spec = sanitizeSpec(await engine.run(), current);
      await admin.from("projects").update({ ai_generations: project.ai_generations + 1 }).eq("id", project.id);
      // A successful AI design MUST be logged: the daily fair-use cap (dailyAiCount) and the
      // admin statistics count exactly these events. Failures (success=false) and the offline
      // designer (engine "local") are logged too but never counted.
      await logAiEvent(user.id, "design", engine.name);
      return Response.json({
        spec,
        engine: engine.name,
        credits: available,
        projectId: project.id,
        counted: project.counted,
      });
    } catch (error) {
      console.error(`[api/design] ${engine.name}`, error);
      await logAiEvent(user.id, "design", engine.name, false);
      failures.push(describeError(error));
      console.error("[api/design] échec", engine.name, describeError(error));
    }
  }

  await logAiEvent(user.id, "design", "local");
  return Response.json({
    spec: sanitizeSpec(withLogoColors(localDesign(prompt, current), msgOpts.logoColors), current),
    engine: "local",
    credits: available,
    projectId: project.id,
    // Provider details stay in the server logs; the customer gets a plain message.
    notice: engines.length
      ? "Le designer IA est très demandé en ce moment : design réalisé en mode simplifié. Réessayez dans quelques minutes pour la version complète."
      : "Designer IA momentanément indisponible : design réalisé en mode simplifié.",
  });
}
