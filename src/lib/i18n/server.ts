import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLang, langFromHeader, type Lang } from "./config";

/** Language for this request: the visitor's choice, else their browser's language. */
export function getLang(): Lang {
  const chosen = cookies().get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  return langFromHeader(headers().get("accept-language"));
}
