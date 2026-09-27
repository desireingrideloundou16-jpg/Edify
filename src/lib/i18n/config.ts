/**
 * Site languages. French and English are written by hand (Cameroon is bilingual); the
 * European languages are translated from English (src/lib/i18n/generated).
 */
export const LANGS = ["fr", "en", "es", "pt", "de", "it", "nl"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "fr";
export const LANG_COOKIE = "edify-lang";

/** Native names, shown in the language menu. */
export const LANG_NAMES: Record<Lang, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
};

/** Locale used for dates and numbers. */
export const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES", pt: "pt-PT", de: "de-DE", it: "it-IT", nl: "nl-NL" };

/** Languages without their own demo film get the English one. */
export const filmLang = (lang: Lang): "fr" | "en" => (lang === "fr" ? "fr" : "en");

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);

/** Best match from an Accept-Language header ("de-DE,de;q=0.9,en;q=0.8"). */
export function langFromHeader(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { base } of ranked) if (isLang(base)) return base;
  return DEFAULT_LANG;
}

/** "Étape {n} sur {total}" + { n: 2, total: 11 } → "Étape 2 sur 11". */
export const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** Money in FCFA for the visitor's locale. */
export const fcfa = (n: number, lang: Lang) => `${new Intl.NumberFormat(LOCALES[lang]).format(n).replace(/ | /g, " ")} FCFA`;
