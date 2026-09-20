"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Ringkasan", short: "Home" },
  { href: "/bahan-baku", label: "Bahan Baku", short: "Bahan" },
  { href: "/produk", label: "Produk & Resep", short: "Produk" },
  { href: "/produksi", label: "Produksi", short: "Produksi" },
  { href: "/platform", label: "Platform", short: "Platform" },
  { href: "/transaksi", label: "Penjualan", short: "Jual" },
  { href: "/laporan", label: "Laporan", short: "Laporan" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 border-b border-line mb-5 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0"
      aria-label="Navigasi utama"
    >
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              active
                ? "border-ledger text-ledger"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            <span className="hidden sm:inline">{link.label}</span>
            <span className="sm:hidden">{link.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
