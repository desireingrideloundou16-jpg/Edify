import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Routes that need a signed-in user. */
const PROTECTED = ["/create", "/abonnement", "/admin"];
/** Auth pages a signed-in user doesn't need to see again. */
const GUEST_ONLY = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // OAuth / e-mail links that land on the site root (fallback redirect) finish on /auth/callback.
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie when needed. Must run before any redirect decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    // New customers choosing a plan most likely have no account yet.
    url.pathname = pathname.startsWith("/abonnement") ? "/signup" : "/login";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Admin area: role checked here, before any admin page code runs (the admin's own profile is
  // readable through RLS). Non-admins get a 404, so the area isn't even revealed.
  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase.from("profiles").select("role, suspended").eq("id", user.id).single();
    if (profile?.role !== "admin" || profile?.suspended) {
      return NextResponse.rewrite(new URL("/_admin-introuvable", request.url), { status: 404 });
    }
  }

  if (user && GUEST_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")!.split("?")[0] : "/create";
    url.search = searchParams.get("next")?.includes("?") ? "?" + searchParams.get("next")!.split("?")[1] : "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets and API routes (they authenticate themselves).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|landing/|api/|.*\\.(?:png|jpg|jpeg|svg|webp|woff2|glb)$).*)"],
};
