import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// No auth required; an already-logged-in user gets bounced to "/" instead
// (seeing the login/signup/forgot-password form while signed in is pointless).
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"];

// Always let these through regardless of auth state, and never redirect
// away from them. /auth/confirm processes a one-time recovery link and may
// need to run whether or not the browser already happens to have an
// unrelated session cookie -- redirecting it to "/" before the route
// handler runs would silently break the password-reset flow for anyone
// who clicks the email link while already signed in elsewhere.
const BYPASS_ROUTES = ["/auth/confirm"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  if (BYPASS_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route))) {
    return supabaseResponse;
  }

  // Always re-validate against Supabase (not just reading the cookie) so an
  // expired/revoked session is caught on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
