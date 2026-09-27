/**
 * Runs once when the server starts. Fails fast when a variable the app cannot work without is
 * missing (instead of cryptic runtime errors), and warns about optional services.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    const message = `[edify] Variables d'environnement manquantes : ${missing.join(", ")}`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.error(message);
  }
  const optional: [string, string][] = [
    ["GEMINI_API_KEY", "designer IA (mode simplifié sans elle)"],
    ["CLOUDFLARE_ACCOUNT_ID", "illustrations et décors photo IA"],
    ["CLOUDFLARE_API_TOKEN", "illustrations et décors photo IA"],
    ["SASPAY_SECRET_KEY", "paiements Mobile Money"],
    ["SASPAY_WEBHOOK_SECRET", "confirmation automatique des paiements par webhook"],
  ];
  for (const [key, feature] of optional) {
    if (!process.env[key]?.trim()) console.warn(`[edify] ${key} absente : ${feature} désactivé(e).`);
  }
}
