/**
 * Translates the English catalogues (src/lib/i18n/sources) into the European languages with
 * Gemini, into src/lib/i18n/generated/<lang>.json. Re-run after changing the site copy:
 *   npx tsx scripts/translate-i18n.ts            (all languages)
 *   npx tsx scripts/translate-i18n.ts de it      (some languages)
 * Missing or malformed strings fall back to English at runtime, never to an empty text.
 */
import fs from "node:fs";
import path from "node:path";
import { SOURCES } from "../src/lib/i18n/localize";
import { LANG_NAMES, type Lang } from "../src/lib/i18n/config";

const ROOT = path.resolve(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const KEY = env.match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim();
if (!KEY) throw new Error("GEMINI_API_KEY missing in .env.local");

const TARGETS = (process.argv.slice(2).length ? process.argv.slice(2) : ["es", "pt", "de", "it", "nl"]) as Lang[];
const MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-lite-latest"];

const english = Object.fromEntries(Object.entries(SOURCES).map(([ns, v]) => [ns, (v as { en: unknown }).en]));

function placeholders(s: string) {
  return (s.match(/\{\w+\}/g) ?? []).sort().join(",");
}

/** Keeps only strings whose place and placeholders match the English tree. */
function clean(src: unknown, tr: unknown): unknown {
  if (typeof src === "string") return typeof tr === "string" && tr.trim() && placeholders(tr) === placeholders(src) ? tr : undefined;
  if (Array.isArray(src)) return Array.isArray(tr) && tr.length === src.length ? src.map((s, i) => clean(s, tr[i])) : undefined;
  if (src && typeof src === "object") {
    if (!tr || typeof tr !== "object") return undefined;
    return Object.fromEntries(Object.keys(src).map((k) => [k, clean((src as Record<string, unknown>)[k], (tr as Record<string, unknown>)[k])]));
  }
  return undefined;
}

function count(v: unknown): [number, number] {
  if (typeof v === "string") return [1, 1];
  if (v === undefined) return [0, 1];
  if (Array.isArray(v) || (v && typeof v === "object")) {
    return Object.values(v as object).reduce<[number, number]>((acc, x) => {
      const [a, b] = count(x);
      return [acc[0] + a, acc[1] + b];
    }, [0, 0]);
  }
  return [0, 0];
}

async function translatePart(lang: Lang, english: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const prompt = `Translate the string values of this JSON from English into ${LANG_NAMES[lang]} (${lang}) for the website of Edify, an AI packaging-design SaaS for African entrepreneurs.
Rules:
- Return JSON with exactly the same keys, nesting and array lengths. Translate values only, never keys.
- Keep placeholders like {brand}, {credits}, {n}, {total}, {email}, {date}, {plan}, {digit}, {p} exactly as they are.
- Keep brand and proper names unchanged: Edify, MTN MoMo, Orange Money, SasPay, WhatsApp, Instagram, Facebook, TikTok, Google, FCFA, ANOR, GS1, EAN-13, PDF, PNG, GLB, USDZ, ZIP, URL, Oku, Penja, TERRA, bissap, karité/shea.
- Natural, persuasive marketing tone; short UI labels stay short. Use the formal "you" form where the language has one (usted, Sie, u, Lei, você).
- Keep typographic quotes and the "·" separators.

${JSON.stringify(english)}`;

  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY! },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 60000 },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.log(`  ${lang}: ${model} → ${json?.error?.code} ${String(json?.error?.message ?? "").slice(0, 80)}`);
      continue;
    }
    const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
    try {
      const parsed = JSON.parse(text);
      const out = clean(english, parsed);
      const [ok] = count(out);
      const [total] = count(english);
      console.log(`  ${lang}: ${model} → ${ok}/${total} strings`);
      if (ok / total > 0.9) return out as Record<string, unknown>;
    } catch {
      console.log(`  ${lang}: ${model} → invalid JSON`);
    }
  }
  return null;
}

/** Whole catalogue in one call; if that fails, one call per namespace. */
async function translate(lang: Lang) {
  const whole = await translatePart(lang, english);
  if (whole) return whole;
  const out: Record<string, unknown> = {};
  for (const ns of Object.keys(english)) {
    console.log(`  ${lang}: section ${ns}`);
    const part = await translatePart(lang, { [ns]: english[ns] });
    if (part) out[ns] = part[ns];
  }
  const [ok] = count(clean(english, out));
  const [total] = count(english);
  return ok / total > 0.9 ? out : null;
}

(async () => {
  const dir = path.join(ROOT, "src/lib/i18n/generated");
  fs.mkdirSync(dir, { recursive: true });
  for (const lang of TARGETS) {
    const out = await translate(lang);
    if (!out) {
      console.log(`✗ ${lang}: not translated (English stays as fallback)`);
      continue;
    }
    fs.writeFileSync(path.join(dir, `${lang}.json`), JSON.stringify(out, null, 1) + "\n");
    console.log(`✓ ${lang}`);
  }
})();
