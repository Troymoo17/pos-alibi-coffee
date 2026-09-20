"use client";

import NavLinks from "./NavLinks";
import LogoutButton from "./LogoutButton";

export default function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Kalau tertutup, JANGAN render apapun sama sekali -- ini memastikan
  // tidak ada elemen tersembunyi yang tetap menghalangi klik/scroll.
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel drawer */}
      <aside className="absolute top-0 left-0 h-full w-72 max-w-[80vw] bg-paper border-r border-line py-6 px-4 flex flex-col shadow-lg">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-crema font-semibold">
              ☕ Buku Kerja
            </p>
            <h1 className="font-display font-semibold text-lg text-ink tracking-tight leading-tight mt-1">
              HPP &amp; Pembukuan
            </h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink/50 hover:text-ink text-2xl leading-none p-1 -mr-1 -mt-1"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>
        <div className="mb-6">
          <div className="border-t-2 border-ink/80" />
          <div className="mt-1 border-t border-line" />
        </div>

        <div className="overflow-y-auto flex-1">
          <NavLinks onNavigate={onClose} />
        </div>

        <div className="pt-6 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink/35">No. Nota</p>
            <p className="font-mono text-xs text-ink/50">#PERSONAL-01</p>
          </div>
          <LogoutButton />
        </div>
      </aside>
    </div>
  );
}
