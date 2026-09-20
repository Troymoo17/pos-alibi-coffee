"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { supabase } from "@/lib/supabase";
import {
  BahanBaku,
  Pengaturan,
  KasUmum,
  Platform,
  Produk,
  ResepProduk,
  TransaksiPenjualan,
} from "@/lib/types";
import { formatRupiah, hitungHPP, hitungPendapatanBersih } from "@/lib/hpp";

const CHART_COLORS = ["#5B3A29", "#C98A4B", "#8A6A4F", "#B33F32", "#7A8A73"];

export default function RingkasanPage() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [bahanBakuList, setBahanBakuList] = useState<BahanBaku[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [resepByProduk, setResepByProduk] = useState<
    Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]>
  >({});
  const [penjualanList, setPenjualanList] = useState<
    (TransaksiPenjualan & { platform?: Platform })[]
  >([]);
  const [kasList, setKasList] = useState<KasUmum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { data: produk },
        { data: bahan },
        { data: pengaturanData },
        { data: platformData },
        { data: resep },
        { data: penjualan },
        { data: kas },
      ] = await Promise.all([
        supabase.from("produk").select("*").order("nama"),
        supabase.from("bahan_baku").select("*"),
        supabase.from("pengaturan").select("*").limit(1).single(),
        supabase.from("platform").select("*").order("urutan"),
        supabase.from("resep_produk").select("*, bahan_baku(*)"),
        supabase.from("transaksi_penjualan").select("*, platform(*)").eq("dibatalkan", false),
        supabase.from("kas_umum").select("*"),
      ]);

      setProdukList((produk as Produk[]) ?? []);
      setBahanBakuList((bahan as BahanBaku[]) ?? []);
      setPengaturan((pengaturanData as Pengaturan) ?? null);
      setPlatformList((platformData as Platform[]) ?? []);
      setPenjualanList((penjualan as any) ?? []);
      setKasList((kas as KasUmum[]) ?? []);

      const grouped: Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]> = {};
      (resep ?? []).forEach((r: any) => {
        if (!grouped[r.produk_id]) grouped[r.produk_id] = [];
        grouped[r.produk_id].push(r);
      });
      setResepByProduk(grouped);
      setLoading(false);
    }
    load();
  }, []);

  const bulanIni = new Date().toISOString().slice(0, 7);
  const penjualanBulanIni = penjualanList.filter((t) => t.tanggal.startsWith(bulanIni));
  const kasBulanIni = kasList.filter((k) => k.tanggal.startsWith(bulanIni));

  const hariIni = new Date().toISOString().slice(0, 10);
  const penjualanHariIni = penjualanList.filter((t) => t.tanggal === hariIni);
  const totalPenjualanHariIni = penjualanHariIni.reduce(
    (sum, t) => sum + t.harga_jual_saat_itu * t.qty,
    0
  );
  const totalHPPHariIni = penjualanHariIni.reduce((sum, t) => sum + t.hpp_saat_itu * t.qty, 0);
  const totalBersihHariIni = penjualanHariIni.reduce(
    (sum, t) =>
      sum + hitungPendapatanBersih(t.harga_jual_saat_itu, t.komisi_persen_saat_itu) * t.qty,
    0
  );
  const labaHariIni = totalBersihHariIni - totalHPPHariIni;
  const jumlahTransaksiHariIni = new Set(
    penjualanHariIni.map((t: any) => t.pesanan_id ?? t.id)
  ).size;

  const totalPenjualanBulanIni = penjualanBulanIni.reduce(
    (sum, t) => sum + t.harga_jual_saat_itu * t.qty,
    0
  );
  const totalHPPBulanIni = penjualanBulanIni.reduce((sum, t) => sum + t.hpp_saat_itu * t.qty, 0);
  const totalBersihBulanIni = penjualanBulanIni.reduce(
    (sum, t) => sum + hitungPendapatanBersih(t.harga_jual_saat_itu, t.komisi_persen_saat_itu) * t.qty,
    0
  );
  const labaKotorBulanIni = totalBersihBulanIni - totalHPPBulanIni;
  const kasMasuk = kasBulanIni.filter((k) => k.tipe === "masuk").reduce((s, k) => s + k.jumlah, 0);
  const kasKeluar = kasBulanIni.filter((k) => k.tipe === "keluar").reduce((s, k) => s + k.jumlah, 0);
  const labaBersihBulanIni = labaKotorBulanIni + kasMasuk - kasKeluar;

  // Tren 14 hari terakhir: pendapatan bersih vs HPP per hari
  const trenHarian = useMemo(() => {
    const hariMap: Record<string, { tanggal: string; bersih: number; hpp: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      hariMap[key] = {
        tanggal: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        bersih: 0,
        hpp: 0,
      };
    }
    penjualanList.forEach((t) => {
      if (hariMap[t.tanggal]) {
        const bersih = hitungPendapatanBersih(t.harga_jual_saat_itu, t.komisi_persen_saat_itu) * t.qty;
        hariMap[t.tanggal].bersih += bersih;
        hariMap[t.tanggal].hpp += t.hpp_saat_itu * t.qty;
      }
    });
    return Object.keys(hariMap)
      .sort()
      .map((k) => hariMap[k]);
  }, [penjualanList]);

  // Kontribusi per platform (bulan ini) -- pendapatan bersih
  const platformChart = useMemo(() => {
    const map: Record<string, number> = {};
    penjualanBulanIni.forEach((t) => {
      const nama = t.platform?.nama ?? "Lainnya";
      const bersih = hitungPendapatanBersih(t.harga_jual_saat_itu, t.komisi_persen_saat_itu) * t.qty;
      map[nama] = (map[nama] ?? 0) + bersih;
    });
    return Object.entries(map)
      .map(([nama, bersih]) => ({ nama, bersih }))
      .sort((a, b) => b.bersih - a.bersih);
  }, [penjualanBulanIni]);

  const produkTerlaris = [...produkList]
    .map((p) => {
      const resep = resepByProduk[p.id] ?? [];
      const hpp = hitungHPP({ resep, pengaturan }).hppPerUnit;
      const margin = p.harga_jual - hpp;
      return { ...p, hpp, margin };
    })
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  if (loading) {
    return <p className="text-ink/50">Memuat ringkasan...</p>;
  }

  return (
    <div className="space-y-6">
      {/* HARI INI -- paling menonjol, di atas semua */}
      <div className="card p-5 border-ledger bg-ledger-dark/[0.04]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base">
            📅 Hari Ini —{" "}
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="label-field">Penjualan</p>
            <p className="font-mono text-xl md:text-2xl font-semibold">
              {formatRupiah(totalPenjualanHariIni)}
            </p>
          </div>
          <div>
            <p className="label-field">Transaksi</p>
            <p className="font-mono text-xl md:text-2xl font-semibold">
              {jumlahTransaksiHariIni}
            </p>
          </div>
          <div>
            <p className="label-field">HPP</p>
            <p className="font-mono text-xl md:text-2xl font-semibold">
              {formatRupiah(totalHPPHariIni)}
            </p>
          </div>
          <div>
            <p className="label-field">Laba Hari Ini</p>
            <p
              className={`font-mono text-xl md:text-2xl font-semibold ${
                labaHariIni >= 0 ? "text-ledger" : "text-rust"
              }`}
            >
              {formatRupiah(labaHariIni)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink/50 mb-1">
          {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="label-field">Penjualan Kotor</p>
            <p className="font-mono text-lg md:text-xl">{formatRupiah(totalPenjualanBulanIni)}</p>
          </div>
          <div className="card p-4">
            <p className="label-field">Total HPP</p>
            <p className="font-mono text-lg md:text-xl">{formatRupiah(totalHPPBulanIni)}</p>
          </div>
          <div className="card p-4">
            <p className="label-field">Laba Kotor</p>
            <p
              className={`font-mono text-lg md:text-xl ${
                labaKotorBulanIni >= 0 ? "text-ledger" : "text-rust"
              }`}
            >
              {formatRupiah(labaKotorBulanIni)}
            </p>
          </div>
          <div className="card p-4 bg-ledger-dark/[0.04]">
            <p className="label-field">Laba Bersih</p>
            <p
              className={`font-mono text-lg md:text-xl font-semibold ${
                labaBersihBulanIni >= 0 ? "text-ledger" : "text-rust"
              }`}
            >
              {formatRupiah(labaBersihBulanIni)}
            </p>
          </div>
        </div>
      </div>

      {/* Grafik Tren 14 Hari */}
      <div className="card p-4 md:p-5">
        <h2 className="font-display text-base md:text-lg mb-4">
          Tren Pendapatan Bersih vs HPP (14 Hari Terakhir)
        </h2>
        <div className="w-full h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trenHarian} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D2C4" />
              <XAxis
                dataKey="tanggal"
                tick={{ fontSize: 10, fill: "#1C1B1988" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#1C1B1988" }}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}rb` : v)}
              />
              <Tooltip
                formatter={(value: any) => formatRupiah(Number(value))}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 4,
                  border: "1px solid #D9D2C4",
                  fontFamily: "monospace",
                }}
              />
              <Line
                type="monotone"
                dataKey="bersih"
                name="Pendapatan Bersih"
                stroke="#5B3A29"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="hpp"
                name="HPP"
                stroke="#B33F32"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-ink/50">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-ledger inline-block" /> Pendapatan Bersih
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-rust inline-block" /> HPP
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Kontribusi per Platform */}
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base md:text-lg">Kontribusi per Platform</h2>
            <Link href="/laporan" className="text-xs text-ledger hover:underline">
              Detail →
            </Link>
          </div>
          {platformChart.length === 0 ? (
            <p className="text-ink/50 text-sm">Belum ada penjualan bulan ini.</p>
          ) : (
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformChart} layout="vertical" margin={{ left: 8 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#1C1B1988" }}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}rb` : v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="nama"
                    tick={{ fontSize: 11, fill: "#1C1B19" }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value: any) => formatRupiah(Number(value))}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 4,
                      border: "1px solid #D9D2C4",
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar dataKey="bersih" radius={[0, 3, 3, 0]}>
                    {platformChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Margin Tertinggi */}
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base md:text-lg">Margin Tertinggi</h2>
            <Link href="/produk" className="text-xs text-ledger hover:underline">
              Kelola Produk →
            </Link>
          </div>
          {produkTerlaris.length === 0 ? (
            <p className="text-ink/50 text-sm">Belum ada produk.</p>
          ) : (
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={produkTerlaris} layout="vertical" margin={{ left: 8 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#1C1B1988" }}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}rb` : v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="nama"
                    tick={{ fontSize: 11, fill: "#1C1B19" }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value: any) => formatRupiah(Number(value))}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 4,
                      border: "1px solid #D9D2C4",
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar dataKey="margin" radius={[0, 3, 3, 0]}>
                    {produkTerlaris.map((p, i) => (
                      <Cell key={i} fill={p.margin >= 0 ? "#5B3A29" : "#B33F32"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Status Data */}
      <div className="card p-4 md:p-5">
        <h2 className="font-display text-base md:text-lg mb-4">Status Data</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="label-field">Bahan Baku</p>
            <p className="font-mono text-lg">{bahanBakuList.length}</p>
          </div>
          <div>
            <p className="label-field">Produk</p>
            <p className="font-mono text-lg">{produkList.length}</p>
          </div>
          <div>
            <p className="label-field">Transaksi (semua waktu)</p>
            <p className="font-mono text-lg">{penjualanList.length}</p>
          </div>
          <div>
            <p className="label-field">Overhead / Unit</p>
            <p className="font-mono text-lg">
              {formatRupiah(
                pengaturan && pengaturan.estimasi_unit_bulanan
                  ? pengaturan.biaya_operasional_bulanan / pengaturan.estimasi_unit_bulanan
                  : 0
              )}
            </p>
          </div>
        </div>
        {(bahanBakuList.length === 0 || produkList.length === 0) && (
          <p className="text-xs text-rust mt-4">
            Mulai dengan menambahkan{" "}
            <Link href="/bahan-baku" className="underline">
              bahan baku
            </Link>{" "}
            lalu{" "}
            <Link href="/produk" className="underline">
              produk &amp; resep
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
