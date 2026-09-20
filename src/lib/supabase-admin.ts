import { createClient } from "@supabase/supabase-js";

/**
 * Client khusus server-side (API routes) -- pakai Service Role Key yang
 * bisa bypass RLS. JANGAN PERNAH import file ini di komponen "use client"
 * atau expose service role key ke browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  );
}
