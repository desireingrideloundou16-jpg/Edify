// Privileged Supabase client (secret key). SERVER ONLY: used to record payments and activate
// plans after SasPay has confirmed them. Never import this from a client component.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof window !== "undefined") throw new Error("admin client is server-only");
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
