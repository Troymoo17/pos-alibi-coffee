"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  SATUAN_OPTIONS,
  SatuanBeli,
  faktorKonversi,
  formatRupiah,
  satuanTerkecil,
} from "@/lib/hpp";

export default function BahanBakuQuickAdd({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nama: "",
    satuan_beli: "gram" as SatuanBeli,
    jumlah_beli: "",
    total_harga_beli: "",
  });
  const [error, setError] = useState<string | null>(null);

  const jumlahBeli = parseFloat(form.jumlah_beli || "0");
  const totalHarga = parseFloat(form.total_harga_beli || "0");
  const jumlahTerkecil = jumlahBeli * faktorKonversi(form.satuan_beli);
  const hargaPerSatuan = jumlahTerkecil > 0 ? totalHarga / jumlahTerkecil : 0;
  const satuanTampil = satuanTerkecil(form.satuan_beli);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (jumlahBeli <= 0) {
      setError("Jumlah dibeli harus lebih dari 0.");
      return;
    }
    const { error } = await supabase.from("bahan_baku").insert({
      nama: form.nama,
      satuan: satuanTampil,
      harga_per_satuan: hargaPerSatuan,
      stok: 0,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ nama: "", satuan_beli: "gram", jumlah_beli: "", total_harga_beli: "" });
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ledger hover:underline font-medium"
      >
        + Bahan barunya belum ada di daftar? Tambah di sini
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-ledger/30 bg-ledger-dark/[0.03] rounded-md p-3 space-y-2 mt-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ledger">Tambah Bahan Baku Baru</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-ink/40 hover:text-ink"
        >
          Batal
        </button>
      </div>
      <input
        className="input-field !py-1.5 text-sm"
        placeholder="Nama bahan, contoh: Susu UHT"
        value={form.nama}
        onChange={(e) => setForm({ ...form, nama: e.target.value })}
        required
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          className="input-field !py-1.5 text-sm"
          value={form.satuan_beli}
          onChange={(e) =>
            setForm({ ...form, satuan_beli: e.target.value as SatuanBeli })
          }
        >
          {SATUAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          className="input-field !py-1.5 text-sm"
          placeholder={`Jumlah`}
          value={form.jumlah_beli}
          onChange={(e) => setForm({ ...form, jumlah_beli: e.target.value })}
          required
        />
        <input
          type="number"
          step="0.01"
          className="input-field !py-1.5 text-sm"
          placeholder="Total Bayar"
          value={form.total_harga_beli}
          onChange={(e) => setForm({ ...form, total_harga_beli: e.target.value })}
          required
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink/50">
          Harga per {satuanTampil}: <span className="font-mono">{formatRupiah(hargaPerSatuan)}</span>
        </span>
        <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs">
          Simpan Bahan
        </button>
      </div>
      {error && <p className="text-rust text-xs">{error}</p>}
    </form>
  );
}
