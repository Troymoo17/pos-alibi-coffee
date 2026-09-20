"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BahanBaku } from "@/lib/types";
import {
  SATUAN_OPTIONS,
  SatuanBeli,
  faktorKonversi,
  formatRupiah,
  satuanTerkecil,
} from "@/lib/hpp";

export default function BahanBakuPage() {
  const [list, setList] = useState<BahanBaku[]>([]);
  const [cari, setCari] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nama: "",
    satuan_beli: "gram" as SatuanBeli,
    jumlah_beli: "",
    total_harga_beli: "",
    stok: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bahan_baku")
      .select("*")
      .order("nama", { ascending: true });
    if (error) setError(error.message);
    else setList(data as BahanBaku[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm({
      nama: "",
      satuan_beli: "gram",
      jumlah_beli: "",
      total_harga_beli: "",
      stok: "",
    });
    setEditingId(null);
  }

  const jumlahBeli = parseFloat(form.jumlah_beli || "0");
  const totalHarga = parseFloat(form.total_harga_beli || "0");
  const jumlahDalamSatuanTerkecil = jumlahBeli * faktorKonversi(form.satuan_beli);
  const hargaPerSatuanTerkecil =
    jumlahDalamSatuanTerkecil > 0 ? totalHarga / jumlahDalamSatuanTerkecil : 0;
  const satuanTampil = satuanTerkecil(form.satuan_beli);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (jumlahBeli <= 0) {
      setError("Jumlah yang dibeli harus lebih dari 0.");
      return;
    }

    const payload = {
      nama: form.nama,
      satuan: satuanTampil,
      harga_per_satuan: hargaPerSatuanTerkecil,
      stok: parseFloat(form.stok || "0"),
    };

    if (editingId) {
      const { error } = await supabase
        .from("bahan_baku")
        .update(payload)
        .eq("id", editingId);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from("bahan_baku").insert(payload);
      if (error) setError(error.message);
    }

    resetForm();
    loadData();
  }

  function handleEdit(item: BahanBaku) {
    setEditingId(item.id);
    // Data lama disimpan dalam satuan terkecil (gram/ml/pcs), jadi kita
    // tampilkan lagi kalkulatornya dengan asumsi "jumlah beli = 1" dalam
    // satuan terkecil itu supaya harga per satuan tetap konsisten.
    const satuanBeliSemula: SatuanBeli =
      item.satuan === "gram" ? "gram" : item.satuan === "ml" ? "ml" : "pcs";
    setForm({
      nama: item.nama,
      satuan_beli: satuanBeliSemula,
      jumlah_beli: "1",
      total_harga_beli: String(item.harga_per_satuan),
      stok: String(item.stok),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus bahan baku ini?")) return;
    const { error } = await supabase.from("bahan_baku").delete().eq("id", id);
    if (error) setError(error.message);
    loadData();
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 order-2 md:order-1">
        <div className="card p-5">
          <h2 className="font-display text-lg mb-4">
            {editingId ? "Ubah Bahan Baku" : "Tambah Bahan Baku"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label-field">Nama Bahan</label>
              <input
                className="input-field"
                placeholder="Contoh: Tepung Terigu"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                required
              />
            </div>

            <div className="border-t border-line pt-3 mt-1">
              <p className="text-xs font-medium text-ledger mb-2">
                Info Pembelian — tulis apa adanya, biar aplikasi yang konversi
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Beli Dalam</label>
                  <select
                    className="input-field"
                    value={form.satuan_beli}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        satuan_beli: e.target.value as SatuanBeli,
                      })
                    }
                  >
                    {SATUAN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-field">
                    Jumlah ({form.satuan_beli})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="Contoh: 1"
                    value={form.jumlah_beli}
                    onChange={(e) =>
                      setForm({ ...form, jumlah_beli: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="label-field">Total Bayar (Rp)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="Contoh: 15000"
                  value={form.total_harga_beli}
                  onChange={(e) =>
                    setForm({ ...form, total_harga_beli: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="bg-ledger-dark/[0.05] rounded-md px-3 py-2 flex justify-between items-center">
              <span className="text-xs text-ink/60">
                Harga per {satuanTampil} (otomatis)
              </span>
              <span className="font-mono text-sm font-semibold text-ledger">
                {formatRupiah(hargaPerSatuanTerkecil)}
              </span>
            </div>

            <div>
              <label className="label-field">Stok Saat Ini (opsional)</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0"
                value={form.stok}
                onChange={(e) => setForm({ ...form, stok: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary">
                {editingId ? "Simpan Perubahan" : "Tambah"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-secondary"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
          {error && <p className="text-rust text-sm mt-3">{error}</p>}
        </div>
      </div>

      <div className="md:col-span-2 order-1 md:order-2">
        <input
          type="text"
          className="input-field mb-3"
          placeholder="🔍 Cari bahan baku..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full table-ledger">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Satuan</th>
                <th>Harga/Satuan</th>
                <th>Stok</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-ink/50">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-ink/50">
                    Belum ada bahan baku. Tambahkan lewat form di samping.
                  </td>
                </tr>
              )}
              {list
                .filter((item) => item.nama.toLowerCase().includes(cari.toLowerCase()))
                .map((item) => (
                <tr key={item.id}>
                  <td className="font-body">{item.nama}</td>
                  <td>{item.satuan}</td>
                  <td>{formatRupiah(item.harga_per_satuan)}</td>
                  <td>
                    {item.stok} {item.satuan}
                  </td>
                  <td className="font-body space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-ledger hover:underline text-xs"
                    >
                      Ubah
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-rust hover:underline text-xs"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
