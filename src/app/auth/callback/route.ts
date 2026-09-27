import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Finishes Google sign-in, e-mail confirmation and password-reset links (PKCE code exchange). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/create";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/create";

  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(providerError)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Le lien a expiré ou a déjà été utilisé. Reconnectez-vous.")}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
