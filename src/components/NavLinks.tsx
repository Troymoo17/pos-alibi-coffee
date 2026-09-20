"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS = [
  { href: "/", label: "Ringkasan", icon: "📊" },
  { href: "/bahan-baku", label: "Bahan Baku", icon: "🧺" },
  { href: "/produk", label: "Produk & Resep", icon: "☕" },
  { href: "/menu-setting", label: "Kelola Menu", icon: "📋" },
  { href: "/produksi", label: "Produksi", icon: "🔥" },
  { href: "/platform", label: "Platform", icon: "📱" },
  { href: "/pembayaran", label: "Toko & Pembayaran", icon: "💳" },
  { href: "/transaksi", label: "Penjualan", icon: "🧾" },
  { href: "/riwayat-pesanan", label: "Riwayat Pesanan", icon: "📜" },
  { href: "/rekap-penjualan", label: "Rekap Penjualan", icon: "📆" },
  { href: "/laporan", label: "Laporan", icon: "📈" },
];

export default function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Navigasi utama">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
              active
                ? "bg-ledger text-white"
                : "text-ink/65 hover:bg-line/40 hover:text-ink"
            }`}
          >
            <span className="text-base leading-none">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
