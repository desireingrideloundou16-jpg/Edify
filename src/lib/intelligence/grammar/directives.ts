/**
 * PI-2 — explicit design intent in a brief ("je veux un design minimaliste", "use bold red"). Only what
 * the user clearly asks about the DESIGN is read, never a product claim: "crème bio" is not a request for
 * an organic look, "jus de fruits rouges" is not a request for red. A positioning word counts when it
 * sits next to a design word (design, style, look, ambiance, univers…); a colour when it is introduced as
 * a colour ("en rouge", "couleur rouge", "use red") or carries an intensity ("bold red", "rouge vif").
 * Deterministic and local. The vocabulary is PI-1's (positioning) and PI-2's; nothing is guessed.
 */
import type { PositioningTerritory } from "@/lib/intelligence/taxonomy";
import type { DesignDirectives } from "./types";

const norm = (s: string) => ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim()} `;

/** Design words in the user's language → PI-1 positioning signals. */
const POSITIONING_WORDS: readonly [PositioningTerritory, readonly string[]][] = [
  ["minimalist", ["minimaliste", "minimalist", "minimal", "epure", "epuree", "sobre"]],
  ["luxury", ["luxe", "luxueux", "luxueuse", "luxury", "luxurious"]],
  ["premium", ["premium", "haut de gamme", "high-end"]],
  ["playful", ["ludique", "playful", "fun", "amusant"]],
  ["natural", ["naturel", "naturelle", "natural"]],
  ["modern", ["moderne", "modern", "contemporain", "contemporaine"]],
  ["traditional", ["traditionnel", "traditionnelle", "traditional"]],
  ["artisanal", ["artisanal", "artisanale", "craft"]],
  ["scientific", ["scientifique", "scientific"]],
  ["clinical", ["clinique", "clinical"]],
  ["bold", ["audacieux", "audacieuse", "percutant", "percutante", "bold"]],
  ["elegant", ["elegant", "elegante"]],
  ["heritage", ["vintage", "retro", "heritage"]],
  ["energetic", ["energique", "energetic", "dynamique"]],
];
const DESIGN_WORDS = ["design", "style", "look", "ambiance", "univers", "esprit", "rendu", "direction artistique", "aspect", "packaging", "emballage", "graphisme"];

const COLOR_WORDS: readonly [string, readonly string[]][] = [
  ["rouge", ["rouge", "red"]], ["bleu", ["bleu", "blue"]], ["vert", ["vert", "green"]], ["jaune", ["jaune", "yellow"]], ["orange", ["orange"]],
  ["violet", ["violet", "purple"]], ["rose", ["rose", "pink"]], ["noir", ["noir", "black"]], ["blanc", ["blanc", "white"]], ["or", ["dore", "gold"]],
  ["argent", ["argente", "silver"]], ["marron", ["marron", "brun", "brown"]], ["beige", ["beige"]], ["turquoise", ["turquoise"]], ["bordeaux", ["bordeaux", "burgundy"]],
];
const VIVID = ["vif", "vive", "bold", "bright", "eclatant", "eclatante", "flashy", "intense"];
const MUTED = ["pastel", "doux", "douce", "soft", "muted", "pale", "poudre"];
const COLOR_CUES = ["en", "couleur", "couleurs", "color", "colour", "use", "utilise", "utiliser", "dominante", "fond", "palette", "teinte", "avec du", "du"];

const word = (w: string) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9]|$)`, "g");
const near = (t: string, at: number, len: number, words: readonly string[], span: number) => {
  const around = t.slice(Math.max(0, at - span), at + len + span);
  return words.some((w) => word(w).test(around));
};

export function designDirectivesFromBrief(text: string): DesignDirectives | undefined {
  const t = norm(text);
  const out: DesignDirectives = { source: "brief" };

  const colors: NonNullable<DesignDirectives["colors"]> = [];
  for (const [name, forms] of COLOR_WORDS) {
    for (const f of forms) {
      for (const m of t.matchAll(word(f))) {
        const at = m.index! + m[1].length;
        const before = t.slice(Math.max(0, at - 14), at), after = t.slice(at + f.length, at + f.length + 12);
        const vivid = VIVID.some((v) => word(v).test(before) || word(v).test(after)), muted = MUTED.some((v) => word(v).test(before) || word(v).test(after));
        const cued = COLOR_CUES.some((c) => new RegExp(`(^|[^a-z])${c} (le |la |l'|du |de |des )?$`).test(t.slice(Math.max(0, at - 18), at)));
        if ((vivid || muted || cued) && !colors.some((c) => c.name === name)) colors.push({ name, ...(vivid ? { intensity: "vivid" as const } : muted ? { intensity: "muted" as const } : {}) });
      }
    }
  }
  if (colors.length) out.colors = colors;

  // "bold" next to a colour is an intensity, not a positioning.
  const positioning: PositioningTerritory[] = [];
  for (const [p, forms] of POSITIONING_WORDS) {
    for (const f of forms) {
      for (const m of t.matchAll(word(f))) {
        const at = m.index! + m[1].length;
        const nextColor = COLOR_WORDS.some(([, cs]) => cs.some((c) => new RegExp(`^ ${c}(?=[^a-z]|$)`).test(t.slice(at + f.length))));
        if (!nextColor && near(t, at, f.length, DESIGN_WORDS, 28) && !positioning.includes(p)) positioning.push(p);
      }
    }
  }
  if (positioning.length) out.positioning = positioning;
  if (/(^|[^a-z])(sans (fioritures|ornements?|decor)|no (ornaments?|decoration))/.test(t)) out.decorationLevel = "none";

  return out.colors || out.positioning || out.decorationLevel ? out : undefined;
}
