"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Pengaturan, Produk, Produksi, ResepProduk, BahanBaku } from "@/lib/types";
import { formatRupiah, hitungHPP } from "@/lib/hpp";

export default function ProduksiPage() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [produksiList, setProduksiList] = useState<(Produksi & { produk?: Produk })[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [resepByProduk, setResepByProduk] = useState<
    Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]>
  >({});

  const [form, setForm] = useState({
    produk_id: "",
    jumlah_diproduksi: "",
    biaya_tenaga_kerja: "",
    tanggal: new Date().toISOString().slice(0, 10),
    catatan: "",
  });

  const [formPengaturan, setFormPengaturan] = useState({
    biaya_operasional_bulanan: "",
    estimasi_unit_bulanan: "",
  });
  const [savedMsg, setSavedMsg] = useState(false);

  async function loadAll() {
    const [{ data: produk }, { data: produksi }, { data: pengaturanData }] =
      await Promise.all([
        supabase.from("produk").select("*").order("nama"),
        supabase
          .from("produksi")
          .select("*, produk(*)")
          .order("tanggal", { ascending: false }),
        supabase.from("pengaturan").select("*").limit(1).single(),
      ]);
    setProdukList((produk as Produk[]) ?? []);
    setProduksiList((produksi as any) ?? []);
    const p = (pengaturanData as Pengaturan) ?? null;
    setPengaturan(p);
    if (p) {
      setFormPengaturan({
        biaya_operasional_bulanan: String(p.biaya_operasional_bulanan),
        estimasi_unit_bulanan: String(p.estimasi_unit_bulanan),
      });
    }

    const { data: resep } = await supabase.from("resep_produk").select("*, bahan_baku(*)");
    const grouped: Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]> = {};
    (resep ?? []).forEach((r: any) => {
      if (!grouped[r.produk_id]) grouped[r.produk_id] = [];
      grouped[r.produk_id].push(r);
    });
    setResepByProduk(grouped);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("produksi").insert({
      produk_id: form.produk_id,
      jumlah_diproduksi: parseFloat(form.jumlah_diproduksi || "0"),
      biaya_tenaga_kerja: parseFloat(form.biaya_tenaga_kerja || "0"),
      tanggal: form.tanggal,
      catatan: form.catatan || null,
    });
    setForm({ ...form, jumlah_diproduksi: "", biaya_tenaga_kerja: "", catatan: "" });
    loadAll();
  }

  async function handleHapus(id: string) {
    await supabase.from("produksi").delete().eq("id", id);
    loadAll();
  }

  const overheadPerUnitPreview =
    parseFloat(formPengaturan.estimasi_unit_bulanan || "0") > 0
      ? parseFloat(formPengaturan.biaya_operasional_bulanan || "0") /
        parseFloat(formPengaturan.estimasi_unit_bulanan || "1")
      : 0;

  async function handleSimpanPengaturan(e: React.FormEvent) {
    e.preventDefault();
    await supabase
      .from("pengaturan")
      .update({
        biaya_operasional_bulanan: parseFloat(
          formPengaturan.biaya_operasional_bulanan || "0"
        ),
        estimasi_unit_bulanan: parseFloat(
          formPengaturan.estimasi_unit_bulanan || "1"
        ),
      })
      .eq("id", true);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
    loadAll();
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Catat Produksi */}
        <div className="card p-5">
          <h2 className="font-display text-lg mb-4">Catat Batch Produksi</h2>
          <p className="text-xs text-ink/50 mb-3">
            Opsional — isi kalau kamu mau menghitung biaya tenaga kerja
            langsung per batch. Kalau tidak, boleh dilewati.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-field">Produk</label>
              <select
                className="input-field"
                value={form.produk_id}
                onChange={(e) => setForm({ ...form, produk_id: e.target.value })}
                required
              >
                <option value="">Pilih produk</option>
                {produkList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Jumlah Diproduksi</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.jumlah_diproduksi}
                  onChange={(e) =>
                    setForm({ ...form, jumlah_diproduksi: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="label-field">Biaya Tenaga Kerja (Rp)</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.biaya_tenaga_kerja}
                  onChange={(e) =>
                    setForm({ ...form, biaya_tenaga_kerja: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div>
              <label className="label-field">Tanggal</label>
              <input
                type="date"
                className="input-field"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">Catatan (opsional)</label>
              <input
                className="input-field"
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Simpan Produksi
            </button>
          </form>
        </div>

        {/* Pengaturan Overhead — disederhanakan jadi 1 angka */}
        <div className="card p-5">
          <h2 className="font-display text-lg mb-1">Biaya Operasional Bulanan</h2>
          <p className="text-xs text-ink/50 mb-4">
            Gabungkan semua biaya tidak langsung (listrik, air, sewa, gas, dll)
            jadi satu angka per bulan. Aplikasi otomatis membaginya rata ke
            setiap unit produk yang kamu buat.
          </p>
          <form onSubmit={handleSimpanPengaturan} className="space-y-3">
            <div>
              <label className="label-field">
                Total Biaya Operasional / Bulan (Rp)
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="Contoh: 900000"
                value={formPengaturan.biaya_operasional_bulanan}
                onChange={(e) =>
                  setFormPengaturan({
                    ...formPengaturan,
                    biaya_operasional_bulanan: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="label-field">
                Estimasi Total Produksi Semua Produk / Bulan (unit)
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="Contoh: 3000"
                value={formPengaturan.estimasi_unit_bulanan}
                onChange={(e) =>
                  setFormPengaturan({
                    ...formPengaturan,
                    estimasi_unit_bulanan: e.target.value,
                  })
                }
              />
            </div>

            <div className="bg-ledger-dark/[0.05] rounded-md px-3 py-2 flex justify-between items-center">
              <span className="text-xs text-ink/60">Overhead per unit (otomatis)</span>
              <span className="font-mono text-sm font-semibold text-ledger">
                {formatRupiah(overheadPerUnitPreview)}
              </span>
            </div>

            <button type="submit" className="btn-primary w-full">
              Simpan Pengaturan
            </button>
            {savedMsg && (
              <p className="text-ledger text-xs text-center">✓ Tersimpan</p>
            )}
          </form>
        </div>
      </div>

      {/* Riwayat Produksi */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="font-display text-lg mb-4">Riwayat Produksi</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Produk</th>
              <th>Jumlah</th>
              <th>Tenaga Kerja</th>
              <th>HPP/Unit Batch Ini</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {produksiList.map((p) => {
              const resep = resepByProduk[p.produk_id] ?? [];
              const rincian = hitungHPP({
                resep,
                pengaturan,
                biayaTenagaKerja: p.biaya_tenaga_kerja,
                jumlahDiproduksi: p.jumlah_diproduksi,
              });
              return (
                <tr key={p.id}>
                  <td>{p.tanggal}</td>
                  <td className="font-body">{p.produk?.nama}</td>
                  <td>{p.jumlah_diproduksi}</td>
                  <td>{formatRupiah(p.biaya_tenaga_kerja)}</td>
                  <td className="text-ledger font-semibold">
                    {formatRupiah(rincian.hppPerUnit)}
                  </td>
                  <td>
                    <button
                      onClick={() => handleHapus(p.id)}
                      className="text-rust text-xs hover:underline font-body"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
            {produksiList.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-ink/50">
                  Belum ada riwayat produksi.
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
