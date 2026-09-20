"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { KasUmum, TransaksiPenjualan, Produk, Platform } from "@/lib/types";
import { formatRupiah, hitungPendapatanBersih } from "@/lib/hpp";

export default function LaporanPage() {
  const [penjualanList, setPenjualanList] = useState<
    (TransaksiPenjualan & { produk?: Produk; platform?: Platform })[]
  >([]);
  const [kasList, setKasList] = useState<KasUmum[]>([]);
  const [bulan, setBulan] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    async function load() {
      const { data: penjualan } = await supabase
        .from("transaksi_penjualan")
        .select("*, produk(*), platform(*)")
        .eq("dibatalkan", false);
      const { data: kas } = await supabase.from("kas_umum").select("*");
      setPenjualanList((penjualan as any) ?? []);
      setKasList((kas as KasUmum[]) ?? []);
    }
    load();
  }, []);

  const penjualanBulanIni = penjualanList.filter((t) => t.tanggal.startsWith(bulan));
  const kasBulanIni = kasList.filter((k) => k.tanggal.startsWith(bulan));

  // Total penjualan KOTOR (sebelum dipotong komisi platform)
  const totalPenjualanKotor = penjualanBulanIni.reduce(
    (sum, t) => sum + t.harga_jual_saat_itu * t.qty,
    0
  );
  // Total komisi yang terpotong platform
  const totalKomisi = penjualanBulanIni.reduce((sum, t) => {
    const bersihPerUnit = hitungPendapatanBersih(t.harga_jual_saat_itu, t.komisi_persen_saat_itu);
    return sum + (t.harga_jual_saat_itu - bersihPerUnit) * t.qty;
  }, 0);
  // Pendapatan BERSIH yang benar-benar diterima (setelah komisi)
  const totalPendapatanBersih = totalPenjualanKotor - totalKomisi;
  const totalHPP = penjualanBulanIni.reduce((sum, t) => sum + t.hpp_saat_itu * t.qty, 0);
  const labaKotor = totalPendapatanBersih - totalHPP;

  const kasMasukLain = kasBulanIni
    .filter((k) => k.tipe === "masuk")
    .reduce((sum, k) => sum + k.jumlah, 0);
  const kasKeluarLain = kasBulanIni
    .filter((k) => k.tipe === "keluar")
    .reduce((sum, k) => sum + k.jumlah, 0);

  const labaBersih = labaKotor + kasMasukLain - kasKeluarLain;

  // Rekap per produk (pakai pendapatan bersih setelah komisi)
  const rekapProduk: Record<
    string,
    { nama: string; qty: number; kotor: number; komisi: number; bersih: number; hpp: number }
  > = {};
  penjualanBulanIni.forEach((t) => {
    const key = t.produk_id;
    if (!rekapProduk[key]) {
      rekapProduk[key] = {
        nama: t.produk?.nama ?? "-",
        qty: 0,
        kotor: 0,
        komisi: 0,
        bersih: 0,
        hpp: 0,
      };
    }
    const bersihPerUnit = hitungPendapatanBersih(t.harga_jual_saat_itu, t.komisi_persen_saat_itu);
    rekapProduk[key].qty += t.qty;
    rekapProduk[key].kotor += t.harga_jual_saat_itu * t.qty;
    rekapProduk[key].komisi += (t.harga_jual_saat_itu - bersihPerUnit) * t.qty;
    rekapProduk[key].bersih += bersihPerUnit * t.qty;
    rekapProduk[key].hpp += t.hpp_saat_itu * t.qty;
  });

  // Rekap per PLATFORM
  const rekapPlatform: Record<
    string,
    { nama: string; qty: number; kotor: number; komisi: number; bersih: number; hpp: number }
  > = {};
  penjualanBulanIni.forEach((t) => {
    const key = t.platform_id ?? "tanpa-platform";
    if (!rekapPlatform[key]) {
      rekapPlatform[key] = {
        nama: t.platform?.nama ?? "Tidak diketahui",
        qty: 0,
        kotor: 0,
        komisi: 0,
        bersih: 0,
        hpp: 0,
      };
    }
    const bersihPerUnit = hitungPendapatanBersih(t.harga_jual_saat_itu, t.komisi_persen_saat_itu);
    rekapPlatform[key].qty += t.qty;
    rekapPlatform[key].kotor += t.harga_jual_saat_itu * t.qty;
    rekapPlatform[key].komisi += (t.harga_jual_saat_itu - bersihPerUnit) * t.qty;
    rekapPlatform[key].bersih += bersihPerUnit * t.qty;
    rekapPlatform[key].hpp += t.hpp_saat_itu * t.qty;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="label-field !mb-0">Periode</label>
        <input
          type="month"
          className="input-field w-48"
          value={bulan}
          onChange={(e) => setBulan(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="label-field">Penjualan Kotor</p>
          <p className="font-mono text-xl">{formatRupiah(totalPenjualanKotor)}</p>
        </div>
        <div className="card p-4">
          <p className="label-field">Komisi Platform</p>
          <p className="font-mono text-xl text-rust">
            {totalKomisi > 0 ? `-${formatRupiah(totalKomisi)}` : formatRupiah(0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="label-field">Total HPP</p>
          <p className="font-mono text-xl">{formatRupiah(totalHPP)}</p>
        </div>
        <div className="card p-4 bg-ledger-dark/[0.04]">
          <p className="label-field">Laba Bersih</p>
          <p
            className={`font-mono text-xl font-semibold ${
              labaBersih >= 0 ? "text-ledger" : "text-rust"
            }`}
          >
            {formatRupiah(labaBersih)}
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg mb-2">Laporan Laba Rugi</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-line/60">
              <td className="py-2">Penjualan Kotor (harga yang dibayar pelanggan)</td>
              <td className="py-2 text-right font-mono">{formatRupiah(totalPenjualanKotor)}</td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-2">Komisi Platform (GoFood/ShopeeFood/GrabFood)</td>
              <td className="py-2 text-right font-mono">({formatRupiah(totalKomisi)})</td>
            </tr>
            <tr className="border-b border-line/60 font-medium">
              <td className="py-2">Pendapatan Bersih Diterima</td>
              <td className="py-2 text-right font-mono">{formatRupiah(totalPendapatanBersih)}</td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-2">HPP (Harga Pokok Penjualan)</td>
              <td className="py-2 text-right font-mono">({formatRupiah(totalHPP)})</td>
            </tr>
            <tr className="border-b border-line/60 font-medium">
              <td className="py-2">Laba Kotor</td>
              <td className="py-2 text-right font-mono">{formatRupiah(labaKotor)}</td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-2">Kas Masuk Lain (modal, dll)</td>
              <td className="py-2 text-right font-mono">{formatRupiah(kasMasukLain)}</td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-2">Kas Keluar Lain (biaya operasional, dll)</td>
              <td className="py-2 text-right font-mono">({formatRupiah(kasKeluarLain)})</td>
            </tr>
            <tr className="font-semibold text-ledger">
              <td className="py-3">Laba Bersih</td>
              <td className="py-3 text-right font-mono">{formatRupiah(labaBersih)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rekap per Platform */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="font-display text-lg mb-4">Rekap per Platform</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Qty</th>
              <th>Kotor</th>
              <th>Komisi</th>
              <th>Bersih</th>
              <th>HPP</th>
              <th>Laba</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(rekapPlatform).map((r) => (
              <tr key={r.nama}>
                <td className="font-body">{r.nama}</td>
                <td>{r.qty}</td>
                <td>{formatRupiah(r.kotor)}</td>
                <td className="text-rust">
                  {r.komisi > 0 ? `-${formatRupiah(r.komisi)}` : "-"}
                </td>
                <td>{formatRupiah(r.bersih)}</td>
                <td>{formatRupiah(r.hpp)}</td>
                <td className={r.bersih - r.hpp >= 0 ? "text-ledger" : "text-rust"}>
                  {formatRupiah(r.bersih - r.hpp)}
                </td>
              </tr>
            ))}
            {Object.values(rekapPlatform).length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-ink/50">
                  Belum ada penjualan di periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Rekap per Produk */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="font-display text-lg mb-4">Rekap per Produk</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Qty Terjual</th>
              <th>Kotor</th>
              <th>Bersih (setelah komisi)</th>
              <th>HPP</th>
              <th>Laba</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(rekapProduk).map((r) => (
              <tr key={r.nama}>
                <td className="font-body">{r.nama}</td>
                <td>{r.qty}</td>
                <td>{formatRupiah(r.kotor)}</td>
                <td>{formatRupiah(r.bersih)}</td>
                <td>{formatRupiah(r.hpp)}</td>
                <td className={r.bersih - r.hpp >= 0 ? "text-ledger" : "text-rust"}>
                  {formatRupiah(r.bersih - r.hpp)}
                </td>
              </tr>
            ))}
            {Object.values(rekapProduk).length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-ink/50">
                  Belum ada penjualan di periode ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
