import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local"
  );
}

// Pakai createBrowserClient (bukan createClient biasa) supaya session login
// disimpan di cookie, bukan cuma localStorage -- ini WAJIB supaya middleware
// (yang jalan di server) bisa tahu status login user dan redirect sesuai role.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
