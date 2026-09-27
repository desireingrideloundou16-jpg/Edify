/**
 * Message catalogues. fr/en come from the sources; other languages are the English tree
 * with every string replaced by its translation when one exists (never a missing key).
 */
import type { Lang } from "./config";
import { LANDING } from "./sources/landing";
import { SITE } from "./sources/site";
import { WIZARD, AUTH, BILLING, META } from "./sources/app";
import { SHOWCASE } from "@/components/landing/showcase";

const SHOWCASE_PROMPTS = { fr: { prompts: SHOWCASE.map((s) => s.prompt) }, en: { prompts: SHOWCASE.map((s) => s.promptEn) } };

export const SOURCES = { landing: LANDING, site: SITE, wizard: WIZARD, auth: AUTH, billing: BILLING, meta: META, showcase: SHOWCASE_PROMPTS };
export type Namespace = keyof typeof SOURCES;
export type Messages = Partial<Record<Namespace, unknown>>;
export type Copy<N extends Namespace> = (typeof SOURCES)[N]["fr"];

function merge(base: unknown, over: unknown): unknown {
  if (over === undefined || over === null) return base;
  if (typeof base === "string") return typeof over === "string" && over.trim() ? over : base;
  if (Array.isArray(base)) return Array.isArray(over) && over.length === base.length ? base.map((b, i) => merge(b, over[i])) : base;
  if (base && typeof base === "object") {
    if (typeof over !== "object") return base;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(base)) out[k] = merge((base as Record<string, unknown>)[k], (over as Record<string, unknown>)[k]);
    return out;
  }
  return base;
}

export function localize<N extends Namespace>(ns: N, lang: Lang, messages?: Messages): Copy<N> {
  const src = SOURCES[ns] as { fr: unknown; en: unknown };
  if (lang === "fr") return src.fr as Copy<N>;
  if (lang === "en") return src.en as Copy<N>;
  return merge(src.en, messages?.[ns]) as Copy<N>;
}
