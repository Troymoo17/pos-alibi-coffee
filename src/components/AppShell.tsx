"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import MobileDrawer from "./MobileDrawer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Kunci scroll halaman belakang saat drawer mobile terbuka
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex">
      <Sidebar />
      <MobileDrawer open={open} onClose={() => setOpen(false)} />

      <div className="flex-1 min-w-0">
        {/* Top bar mobile -- hamburger + judul singkat */}
        <div className="md:hidden flex items-center gap-3 px-4 pt-5 pb-3 border-b border-line">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-ink p-1 -ml-1"
            aria-label="Buka menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6h18M3 12h18M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-crema font-semibold">
              ☕ Buku Kerja
            </p>
            <h1 className="font-display font-semibold text-base text-ink tracking-tight leading-tight">
              HPP &amp; Pembukuan
            </h1>
          </div>
        </div>

        <main className="px-4 md:px-8 pb-16 pt-4 md:pt-8 w-full">{children}</main>
      </div>
    </div>
  );
}
