/**
 * PI-5 — shot intent: WHY a picture is taken (purpose) and WHICH canonical style of the 3D system
 * (SHOT_STYLES, scenePresets) expresses it. Never camera math: resolveShot() stays the camera authority.
 *
 *   MasterDesignIntent → shotIntent.style → shotRequestFromIntent → resolveShot({ style }) → renderHD
 *
 * A style is resolved only to an existing SHOT_STYLES id (case and separators ignored: "catalog-ecommerce"
 * is catalogEcommerce; "catalogue" or "ecommerceCatalog" are not, they stay unresolved). No style is ever
 * created here.
 */
import { SHOT_STYLES, type ShotRequest, type ShotStyleId } from "@/lib/three/scenePresets";
import type { DesignGrammar } from "@/lib/intelligence/grammar";
import type { ProductIntelligence } from "@/lib/intelligence/taxonomy";
import type { MasterDesignIntent, ShotIntent } from "./types";
import type { ShotPurpose } from "./vocabulary";

const STYLE_IDS = Object.keys(SHOT_STYLES) as ShotStyleId[];
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The canonical id of an existing shot style, or null. */
export function canonicalShotStyle(requested: string | null | undefined): ShotStyleId | null {
  if (!requested) return null;
  return STYLE_IDS.find((id) => key(id) === key(requested)) ?? null;
}
export const isShotStyle = (s: unknown): s is ShotStyleId => typeof s === "string" && (STYLE_IDS as string[]).includes(s);

/** Purposes that an existing style expresses. Social and technical have no style yet: they stay unresolved. */
const PURPOSE_STYLE: Readonly<Partial<Record<ShotPurpose, ShotStyleId>>> = {
  hero: "heroPremium", presentation: "heroPremium", ecommerce: "catalogEcommerce", catalog: "catalogEcommerce", detail: "closeUpDetail", lifestyle: "naturalLifestyle",
};
/** A hero shot of a bold / energetic territory uses the existing dramatic hero style. */
const DRAMATIC_TERRITORIES = new Set(["boldCommercial", "youthfulEnergetic"]);
const PREMIUM_TERRITORIES = new Set(["luxuryMinimal", "premiumEditorial", "refinedPlayful", "masstige", "heritageClassic"]);
const NATURAL_TERRITORIES = new Set(["modernNatural", "botanicalOrganic", "naturalMinimal", "artisanalCraft", "sustainableHonest", "evidenceNatural"]);

export function resolveShotIntent(explicit: { purpose?: ShotPurpose; style?: string } | undefined, pi: ProductIntelligence, grammar: DesignGrammar): ShotIntent {
  const territory = grammar.territory.primary;
  // 1. an explicit style
  if (explicit?.style) {
    const style = canonicalShotStyle(explicit.style);
    return {
      purpose: explicit.purpose ?? null, requestedStyle: explicit.style, style, status: style ? "resolved" : "unresolved", source: "user", priority: "userRequirement",
      confidence: style ? "high" : "unknown",
      rationale: style ? `Style demandé : ${style}.` : `« ${explicit.style} » n'est pas un style de prise de vue existant (${STYLE_IDS.join(", ")}) : rien n'est inventé.`,
    };
  }
  // 2. an explicit purpose
  if (explicit?.purpose) {
    const style = explicit.purpose === "hero" && territory && DRAMATIC_TERRITORIES.has(territory) ? "dramaticHero" : PURPOSE_STYLE[explicit.purpose] ?? null;
    return {
      purpose: explicit.purpose, requestedStyle: style, style, status: style ? "resolved" : "unresolved", source: "user", priority: "userRequirement", confidence: style ? "high" : "unknown",
      rationale: style ? `Usage demandé « ${explicit.purpose} » → style existant ${style}.` : `Aucun style existant pour l'usage « ${explicit.purpose} ».`,
    };
  }
  // 3. derived from positioning, then from where the product is sold (inferred, never more than "medium")
  const conf = pi.confidence === "high" ? "medium" : pi.confidence;
  const premium = (territory && PREMIUM_TERRITORIES.has(territory)) || pi.pricePosition === "luxury" || pi.pricePosition === "premium";
  if (premium) {
    return { purpose: "hero", requestedStyle: "heroPremium", style: "heroPremium", status: "resolved", source: "designGrammar", priority: "positioning", confidence: conf,
      rationale: "Positionnement premium : prise de vue de présentation (hero)." };
  }
  if ((pi.purchaseContext ?? []).includes("ecommerce")) {
    return { purpose: "ecommerce", requestedStyle: "catalogEcommerce", style: "catalogEcommerce", status: "resolved", source: "productIntelligence", priority: "audience", confidence: conf,
      rationale: "Produit vendu en ligne : présentation catalogue e-commerce." };
  }
  if (territory && DRAMATIC_TERRITORIES.has(territory)) {
    return { purpose: "hero", requestedStyle: "dramaticHero", style: "dramaticHero", status: "resolved", source: "designGrammar", priority: "creativeInference", confidence: conf === "medium" ? "low" : conf,
      rationale: "Territoire percutant : hero contrasté." };
  }
  if (territory && NATURAL_TERRITORIES.has(territory)) {
    return { purpose: "lifestyle", requestedStyle: "naturalLifestyle", style: "naturalLifestyle", status: "resolved", source: "designGrammar", priority: "creativeInference", confidence: conf === "medium" ? "low" : conf,
      rationale: "Territoire naturel : lumière naturelle." };
  }
  return { purpose: null, requestedStyle: null, style: null, status: "unspecified", source: null, priority: null, confidence: "unknown",
    rationale: "Aucun signal d'usage : le style par défaut du système de prise de vue s'applique." };
}

/** The request handed to resolveShot (the camera authority): only a canonical, resolved style. */
export function shotRequestFromIntent(intent: Pick<MasterDesignIntent, "shotIntent">, quality?: ShotRequest["quality"]): ShotRequest {
  return { ...(intent.shotIntent.status === "resolved" && intent.shotIntent.style ? { style: intent.shotIntent.style } : {}), ...(quality ? { quality } : {}) };
}
