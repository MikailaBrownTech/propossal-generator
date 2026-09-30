import { createBrowserClient } from "@supabase/ssr";

// TODO: once the Supabase project is linked, run
// `supabase gen types typescript --linked` and pass the generated
// `Database` type as createBrowserClient<Database>(...) here and in
// lib/supabase/server.ts / service.ts for full query type-safety.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
