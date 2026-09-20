"use client";

import { supabase } from "@/lib/supabase";

export default function LogoutButton() {
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-xs text-ink/50 hover:text-rust transition-colors"
    >
      <span>🚪</span> Keluar
    </button>
  );
}
