"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Pesanan, TutupKasir } from "@/lib/types";
import { formatRupiah } from "@/lib/hpp";
import LogoutButton from "@/components/LogoutButton";
import { useToast } from "@/components/Toast";

export default function TutupKasirPage() {
  const [loading, setLoading] = useState(true);
  const [namaKasir, setNamaKasir] = useState("Kasir");
  const [waktuMulai, setWaktuMulai] = useState<string>("");
  const [pesananShiftIni, setPesananShiftIni] = useState<Pesanan[]>([]);
  const [riwayatTutup, setRiwayatTutup] = useState<TutupKasir[]>([]);
  const [catatan, setCatatan] = useState("");
  const [memproses, setMemproses] = useState(false);
  const { showToast } = useToast();

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nama")
        .eq("id", user.id)
        .single();
      if (profile?.nama) setNamaKasir(profile.nama);
    }

    // Tentukan awal shift: waktu_tutup dari tutup_kasir terakhir, atau
    // awal hari ini kalau belum pernah tutup kasir sama sekali.
    const { data: tutupTerakhir } = await supabase
      .from("tutup_kasir")
      .select("*")
      .order("waktu_tutup", { ascending: false })
      .limit(1)
      .maybeSingle();

    const mulai = tutupTerakhir
      ? tutupTerakhir.waktu_tutup
      : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    setWaktuMulai(mulai);

    const [{ data: pesanan }, { data: riwayat }] = await Promise.all([
      supabase
        .from("pesanan")
        .select("*, platform(*)")
        .eq("status", "sudah_bayar")
        .eq("sumber", "kasir")
        .gte("created_at", mulai)
        .order("created_at", { ascending: false }),
      supabase
        .from("tutup_kasir")
        .select("*")
        .order("waktu_tutup", { ascending: false })
        .limit(10),
    ]);

    setPesananShiftIni((pesanan as Pesanan[]) ?? []);
    setRiwayatTutup((riwayat as TutupKasir[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalCash = pesananShiftIni
    .filter((p) => p.metode_bayar === "cash")
    .reduce((s, p) => s + p.total, 0);
  const totalQris = pesananShiftIni
    .filter((p) => p.metode_bayar === "qris_sendiri" || p.metode_bayar === "qris_midtrans")
    .reduce((s, p) => s + p.total, 0);
  const totalSemua = totalCash + totalQris;

  async function handleTutupKasir() {
    if (pesananShiftIni.length === 0) {
      if (!confirm("Belum ada transaksi di shift ini. Tetap tutup kasir?")) return;
    }
    setMemproses(true);

    const { error } = await supabase.from("tutup_kasir").insert({
      kasir_nama: namaKasir,
      waktu_mulai: waktuMulai,
      waktu_tutup: new Date().toISOString(),
      total_cash: totalCash,
      total_qris: totalQris,
      total_semua: totalSemua,
      jumlah_transaksi: pesananShiftIni.length,
      catatan: catatan || null,
    });

    if (error) {
      showToast("Gagal menutup kasir: " + error.message, "error");
      setMemproses(false);
      return;
    }

    showToast("Kasir berhasil ditutup, shift baru dimulai.", "success");
    setCatatan("");
    setMemproses(false);
    loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-ink/50">Memuat...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#F2EFE8",
        backgroundImage: "radial-gradient(#D9D2C4 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-line bg-paper/80 sticky top-0 z-30">
        <div>
          <p className="text-[9px] uppercase tracking-[0.25em] text-crema font-semibold">
            📕 Tutup Kasir
          </p>
          <h1 className="font-display font-semibold text-lg text-ink">
            Rekap Shift — {namaKasir}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/kasir" className="text-xs text-ink/50 hover:underline">
            ← Kembali ke Kasir
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <div className="card p-5">
          <p className="text-xs text-ink/50 mb-1">
            Shift berjalan sejak{" "}
            <span className="font-medium text-ink">
              {new Date(waktuMulai).toLocaleString("id-ID")}
            </span>
          </p>
          <p className="text-xs text-ink/50">
            {pesananShiftIni.length} transaksi tercatat di shift ini
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="label-field">Cash</p>
            <p className="font-mono text-lg font-semibold">{formatRupiah(totalCash)}</p>
          </div>
          <div className="card p-4">
            <p className="label-field">QRIS</p>
            <p className="font-mono text-lg font-semibold">{formatRupiah(totalQris)}</p>
          </div>
          <div className="card p-4 bg-ledger-dark/[0.05]">
            <p className="label-field">Total</p>
            <p className="font-mono text-lg font-semibold text-ledger">
              {formatRupiah(totalSemua)}
            </p>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-display text-base mb-3">Daftar Transaksi Shift Ini</h2>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {pesananShiftIni.map((p) => (
              <div
                key={p.id}
                className="flex justify-between text-sm border-b border-line/60 pb-1.5"
              >
                <span className="text-ink/60">
                  #{String(p.nomor_urut).padStart(4, "0")} —{" "}
                  {p.metode_bayar === "cash" ? "Cash" : "QRIS"}
                </span>
                <span className="font-mono">{formatRupiah(p.total)}</span>
              </div>
            ))}
            {pesananShiftIni.length === 0 && (
              <p className="text-ink/40 text-sm text-center py-4">Belum ada transaksi.</p>
            )}
          </div>
        </div>

        <div className="card p-5 border-ledger/40">
          <h2 className="font-display text-base mb-3">Tutup Kasir Sekarang</h2>
          <label className="label-field">Catatan (opsional)</label>
          <textarea
            className="input-field mb-3"
            rows={2}
            placeholder="Contoh: uang fisik cocok, tidak ada selisih"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
          <button
            onClick={handleTutupKasir}
            disabled={memproses}
            className="btn-primary w-full"
          >
            {memproses ? "Memproses..." : "📕 Tutup Kasir & Mulai Shift Baru"}
          </button>
          <p className="text-xs text-ink/40 mt-2">
            Setelah ditutup, rekap ini tersimpan permanen dan shift berikutnya
            mulai terhitung dari sekarang.
          </p>
        </div>

        {riwayatTutup.length > 0 && (
          <div className="card overflow-hidden">
            <h2 className="font-display text-base p-5 pb-3">Riwayat Tutup Kasir</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-ledger">
                <thead>
                  <tr>
                    <th>Waktu Tutup</th>
                    <th>Kasir</th>
                    <th>Cash</th>
                    <th>QRIS</th>
                    <th>Total</th>
                    <th>Trx</th>
                  </tr>
                </thead>
                <tbody>
                  {riwayatTutup.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.waktu_tutup).toLocaleString("id-ID")}</td>
                      <td className="font-body">{r.kasir_nama}</td>
                      <td>{formatRupiah(r.total_cash)}</td>
                      <td>{formatRupiah(r.total_qris)}</td>
                      <td className="font-semibold">{formatRupiah(r.total_semua)}</td>
                      <td>{r.jumlah_transaksi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
