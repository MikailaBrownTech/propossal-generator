import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses RLS entirely. Only for server-side code with no user session to
// scope to -- e.g. the Vercel Cron route that dispatches scheduled sends.
// Never import this into a Server Component, Server Action, or anywhere
// reachable from a user request; it must stay behind a secret-checked
// route (see CRON_SECRET).
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
