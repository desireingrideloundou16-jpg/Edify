/** Site languages. Cameroon is officially bilingual, so French and English. */
export type Lang = "fr" | "en";
export const LANGS: Lang[] = ["fr", "en"];
export const DEFAULT_LANG: Lang = "fr";
export const LANG_COOKIE = "edify-lang";

export const isLang = (v: unknown): v is Lang => v === "fr" || v === "en";

/** Best match from an Accept-Language header ("en-GB,en;q=0.9,fr;q=0.8"). */
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
