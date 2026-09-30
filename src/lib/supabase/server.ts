import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// For use in Server Components, Server Actions, and Route Handlers where a
// signed-in user's session should be respected (RLS applies normally).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component with no response to write
            // cookies to -- safe to ignore since middleware refreshes the
            // session on every request.
          }
        },
      },
    },
  );
}
