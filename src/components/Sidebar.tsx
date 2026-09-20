import NavLinks from "./NavLinks";
import LogoutButton from "./LogoutButton";

export default function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-line min-h-screen sticky top-0 py-6 pr-4">
      <div className="mb-8 px-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-crema font-semibold">
          ☕ Buku Kerja
        </p>
        <h1 className="font-display font-semibold text-xl text-ink tracking-tight leading-tight mt-1">
          HPP &amp; Pembukuan
        </h1>
        <div className="mt-4 border-t-2 border-ink/80" />
        <div className="mt-1 border-t border-line" />
      </div>

      <NavLinks />

      <div className="mt-auto pt-6 px-1 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ink/35">No. Nota</p>
          <p className="font-mono text-xs text-ink/50">#PERSONAL-01</p>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
