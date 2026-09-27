/**
 * The "Commencez maintenant" brief: answers collected step by step on /commencer, stored in
 * localStorage, then turned into a design by the studio after sign-in.
 */
import type { Lang } from "@/lib/i18n/config";
import type { DesignContent } from "./state";

export const BRIEF_KEY = "edify-start-brief";

export interface StartBrief {
  packaging: string;
  brand: string;
  hasLogo: "yes" | "no" | "";
  logo: string | null;
  logoName: string | null;
  ingredients: string;
  usage: string;
  quantity: string;
  barcode: string;
  expiry: string;
  production: string;
  price: string;
  extra: string;
  lang: Lang;
}

export const EMPTY_BRIEF: StartBrief = {
  packaging: "",
  brand: "",
  hasLogo: "",
  logo: null,
  logoName: null,
  ingredients: "",
  usage: "",
  quantity: "",
  barcode: "",
  expiry: "",
  production: "",
  price: "",
  extra: "",
  lang: "fr",
};

/** Steps whose answer the AI can suggest (server route /api/suggest). */
export const SUGGEST_STEPS = ["packaging", "ingredients", "usage", "quantity", "expiry", "production", "extra"] as const;
export type SuggestStep = (typeof SUGGEST_STEPS)[number];

/** Brief text sent to the AI designer. */
export function briefToPrompt(b: StartBrief): string {
  const lines = [
    `Packaging à créer : ${b.packaging}`,
    b.brand && `Nom de la marque : ${b.brand} (à respecter exactement)`,
    b.hasLogo === "yes" ? "La marque a déjà un logo (il sera placé sur la face avant)." : "Pas de logo : crée un monogramme élégant à partir du nom.",
    b.ingredients && `Ingrédients / composition : ${b.ingredients}`,
    b.usage && `Mode d'utilisation : ${b.usage}`,
    b.quantity && `Contenance / poids net : ${b.quantity}`,
    b.expiry && `Date de péremption / durabilité : ${b.expiry}`,
    b.production && `Date de production : ${b.production}`,
    b.price && `Prix de vente : ${b.price}`,
    b.extra && `Autres informations à faire figurer : ${b.extra}`,
    `Langue principale du site de l'utilisateur : ${b.lang === "fr" ? "français" : "anglais"}. Marché : Cameroun / Afrique centrale, mentions bilingues français-anglais.`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Fields the user typed themselves: they always win over the AI's proposals. */
export function briefContent(b: StartBrief): Partial<DesignContent> {
  const out: Partial<DesignContent> = {};
  if (b.brand.trim()) out.brandName = b.brand.trim();
  if (b.quantity.trim()) out.volume = b.quantity.trim();
  if (b.ingredients.trim()) out.ingredients = b.ingredients.trim();
  if (b.usage.trim()) out.usage = b.usage.trim();
  if (b.barcode.trim()) out.barcode = b.barcode.trim();
  if (b.expiry.trim()) out.expiry = b.expiry.trim();
  if (b.production.trim()) out.production = b.production.trim();
  if (b.price.trim()) out.price = b.price.trim();
  if (b.extra.trim()) out.extra = b.extra.trim();
  return out;
}

export function loadBrief(): StartBrief | null {
  try {
    const raw = localStorage.getItem(BRIEF_KEY);
    return raw ? { ...EMPTY_BRIEF, ...(JSON.parse(raw) as Partial<StartBrief>) } : null;
  } catch {
    return null;
  }
}

export function saveBrief(b: StartBrief) {
  try {
    localStorage.setItem(BRIEF_KEY, JSON.stringify(b));
    return true;
  } catch {
    // Quota exceeded (large logo): keep the brief without the logo.
    try {
      localStorage.setItem(BRIEF_KEY, JSON.stringify({ ...b, logo: null }));
    } catch {}
    return false;
  }
}

export function clearBrief() {
  try {
    localStorage.removeItem(BRIEF_KEY);
  } catch {}
}
