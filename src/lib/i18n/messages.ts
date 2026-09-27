// Translated catalogues, loaded on the server only: the browser receives just its own language.
import type { Lang } from "./config";
import type { Messages } from "./localize";
import es from "./generated/es.json";
import pt from "./generated/pt.json";
import de from "./generated/de.json";
import it from "./generated/it.json";
import nl from "./generated/nl.json";

const GENERATED: Partial<Record<Lang, Messages>> = { es, pt, de, it, nl };

export function getMessages(lang: Lang): Messages {
  return GENERATED[lang] ?? {};
}
