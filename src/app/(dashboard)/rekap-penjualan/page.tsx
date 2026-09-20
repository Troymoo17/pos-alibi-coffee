"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { TransaksiPenjualan } from "@/lib/types";
import { formatRupiah, hitungPendapatanBersih } from "@/lib/hpp";

type Periode = "harian" | "mingguan" | "bulanan";

function nomorMingguISO(tanggal: Date): string {
  const d = new Date(Date.UTC(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export default function RekapPenjualanPage() {
  const [periode, setPeriode] = useState<Periode>("harian");
  const [transaksiList, setTransaksiList] = useState<
    (TransaksiPenjualan & { pesanan_id: string | null })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("transaksi_penjualan")
        .select("*")
        .eq("dibatalkan", false)
        .order("tanggal", { ascending: true });
      setTransaksiList((data as any) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const rekap = useMemo(() => {
    const map: Record<
      string,
      { kotor: number; bersih: number; hpp: number; pesananSet: Set<string> }
    > = {};

    transaksiList.forEach((t) => {
      const tgl = new Date(t.tanggal);
      let key: string;
      if (periode === "harian") {
        key = t.tanggal;
      } else if (periode === "mingguan") {
        key = nomorMingguISO(tgl);
      } else {
        key = t.tanggal.slice(0, 7);
      }

      if (!map[key]) {
        map[key] = { kotor: 0, bersih: 0, hpp: 0, pesananSet: new Set() };
      }
      const bersihPerUnit = hitungPendapatanBersih(
        t.harga_jual_saat_itu,
        t.komisi_persen_saat_itu
      );
      map[key].kotor += t.harga_jual_saat_itu * t.qty;
      map[key].bersih += bersihPerUnit * t.qty;
      map[key].hpp += t.hpp_saat_itu * t.qty;
      if (t.pesanan_id) map[key].pesananSet.add(t.pesanan_id);
    });

    return Object.entries(map)
      .map(([key, v]) => ({
        periode: key,
        kotor: v.kotor,
        bersih: v.bersih,
        hpp: v.hpp,
        laba: v.bersih - v.hpp,
        jumlahTransaksi: v.pesananSet.size,
      }))
      .sort((a, b) => (a.periode < b.periode ? 1 : -1)); // terbaru dulu
  }, [transaksiList, periode]);

  const dataChart = [...rekap].reverse().slice(-30); // urut lama->baru untuk grafik, maks 30 titik

  const totalLaba = rekap.reduce((s, r) => s + r.laba, 0);
  const totalKotor = rekap.reduce((s, r) => s + r.kotor, 0);
  const totalTransaksi = rekap.reduce((s, r) => s + r.jumlahTransaksi, 0);

  function labelPeriode(key: string) {
    if (periode === "harian") {
      return new Date(key).toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    if (periode === "mingguan") {
      return `Minggu ${key.split("-W")[1]}, ${key.split("-W")[0]}`;
    }
    const [tahun, bulan] = key.split("-");
    return new Date(Number(tahun), Number(bulan) - 1).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl mb-1">Rekap Penjualan</h1>
        <p className="text-sm text-ink/50">
          Lihat performa penjualan per hari, minggu, atau bulan.
        </p>
      </div>

      <div className="flex gap-1">
        {[
          { key: "harian", label: "Harian" },
          { key: "mingguan", label: "Mingguan" },
          { key: "bulanan", label: "Bulanan" },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriode(p.key as Periode)}
            className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
              periode === p.key
                ? "bg-ledger text-white border-ledger"
                : "border-line text-ink/60"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink/50">Memuat data...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="label-field">Total Penjualan Kotor</p>
              <p className="font-mono text-lg font-semibold">{formatRupiah(totalKotor)}</p>
            </div>
            <div className="card p-4">
              <p className="label-field">Total Transaksi</p>
              <p className="font-mono text-lg font-semibold">{totalTransaksi}</p>
            </div>
            <div className="card p-4 bg-ledger-dark/[0.05]">
              <p className="label-field">Total Laba</p>
              <p className="font-mono text-lg font-semibold text-ledger">
                {formatRupiah(totalLaba)}
              </p>
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <h2 className="font-display text-base mb-4">
              Grafik Laba per {periode === "harian" ? "Hari" : periode === "mingguan" ? "Minggu" : "Bulan"}
            </h2>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataChart} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D2C4" />
                  <XAxis
                    dataKey="periode"
                    tick={{ fontSize: 10, fill: "#1C1B1988" }}
                    tickFormatter={(v) => labelPeriode(v).slice(0, 8)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#1C1B1988" }}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}rb` : v)}
                  />
                  <Tooltip
                    formatter={(value: any) => formatRupiah(Number(value))}
                    labelFormatter={(label) => labelPeriode(String(label))}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 4,
                      border: "1px solid #D9D2C4",
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar dataKey="laba" fill="#5B3A29" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-ledger">
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>Jumlah Transaksi</th>
                    <th>Penjualan Kotor</th>
                    <th>HPP</th>
                    <th>Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {rekap.map((r) => (
                    <tr key={r.periode}>
                      <td className="font-body">{labelPeriode(r.periode)}</td>
                      <td>{r.jumlahTransaksi}</td>
                      <td>{formatRupiah(r.kotor)}</td>
                      <td>{formatRupiah(r.hpp)}</td>
                      <td className={r.laba >= 0 ? "text-ledger font-semibold" : "text-rust font-semibold"}>
                        {formatRupiah(r.laba)}
                      </td>
                    </tr>
                  ))}
                  {rekap.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-ink/50">
                        Belum ada data penjualan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
