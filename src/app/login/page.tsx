"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Supabase Auth secara teknis tetap butuh format email di baliknya --
// jadi kita "terjemahkan" username ke email palsu secara otomatis
// (tidak terlihat oleh kamu, cukup ketik username biasa).
const DOMAIN_INTERNAL = "pos.local";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const emailInternal = `${username.trim().toLowerCase()}@${DOMAIN_INTERNAL}`;
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInternal,
      password,
    });

    if (error) {
      setError("Username atau password salah.");
      setLoading(false);
      return;
    }

    // Reload penuh supaya middleware (server) baca ulang cookie sesi yang
    // baru saja di-set, lalu otomatis diarahkan sesuai role (admin/kasir).
    window.location.href = "/";
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundColor: "#F2EFE8",
        backgroundImage: "radial-gradient(#D9D2C4 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-crema font-semibold">
            ☕ Buku Kerja
          </p>
          <h1 className="font-display font-semibold text-2xl text-ink tracking-tight mt-1">
            HPP &amp; Pembukuan
          </h1>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg mb-1">Masuk</h2>
          <p className="text-xs text-ink/50 mb-5">
            Masuk sebagai Admin (kelola HPP) atau Kasir (POS).
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-field">Username</label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                placeholder="admin / kasir"
                required
              />
            </div>
            <div>
              <label className="label-field">Password</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-rust text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
