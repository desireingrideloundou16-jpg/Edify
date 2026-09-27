import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLang, langFromHeader, type Lang } from "./config";
import { localize, type Namespace } from "./localize";
import { getMessages } from "./messages";

/** Language for this request: the visitor's choice, else their browser's language. */
export function getLang(): Lang {
  const chosen = cookies().get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  return langFromHeader(headers().get("accept-language"));
}

/** Server components: copy for a namespace in the request's language. */
export function serverCopy<N extends Namespace>(ns: N, lang: Lang = getLang()) {
  return localize(ns, lang, getMessages(lang));
}
