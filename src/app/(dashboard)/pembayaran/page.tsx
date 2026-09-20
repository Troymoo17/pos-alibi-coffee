"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PengaturanPembayaran, PengaturanToko } from "@/lib/types";

export default function PembayaranPage() {
  const [pengaturan, setPengaturan] = useState<PengaturanPembayaran | null>(null);
  const [toko, setToko] = useState<PengaturanToko | null>(null);
  const [namaTokoInput, setNamaTokoInput] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  async function loadData() {
    const [{ data }, { data: tokoData }] = await Promise.all([
      supabase.from("pengaturan_pembayaran").select("*").limit(1).single(),
      supabase.from("pengaturan_toko").select("*").limit(1).single(),
    ]);
    setPengaturan((data as PengaturanPembayaran) ?? null);
    setToko((tokoData as PengaturanToko) ?? null);
    if (tokoData) setNamaTokoInput(tokoData.nama_toko);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingLogo(true);

    const path = `logo-toko-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage
      .from("logo")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(`Gagal upload logo: ${uploadError.message}`);
      setUploadingLogo(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("logo").getPublicUrl(path);
    await supabase
      .from("pengaturan_toko")
      .update({ logo_url: publicUrlData.publicUrl })
      .eq("id", true);

    setUploadingLogo(false);
    loadData();
  }

  async function handleHapusLogo() {
    if (!confirm("Hapus logo toko?")) return;
    await supabase.from("pengaturan_toko").update({ logo_url: null }).eq("id", true);
    loadData();
  }

  async function handleSimpanNamaToko(e: React.FormEvent) {
    e.preventDefault();
    await supabase
      .from("pengaturan_toko")
      .update({ nama_toko: namaTokoInput || "Buku Kerja" })
      .eq("id", true);
    loadData();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const path = `qris-sendiri-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage
      .from("qris")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(`Gagal upload: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("qris").getPublicUrl(path);

    await supabase
      .from("pengaturan_pembayaran")
      .update({ qris_sendiri_url: publicUrlData.publicUrl })
      .eq("id", true);

    setUploading(false);
    loadData();
  }

  async function handleToggleMidtrans() {
    if (!pengaturan) return;
    await supabase
      .from("pengaturan_pembayaran")
      .update({ qris_midtrans_aktif: !pengaturan.qris_midtrans_aktif })
      .eq("id", true);
    loadData();
  }

  async function handleHapusQris() {
    if (!confirm("Hapus QRIS yang sedang dipakai?")) return;
    await supabase
      .from("pengaturan_pembayaran")
      .update({ qris_sendiri_url: null })
      .eq("id", true);
    loadData();
  }

  if (!pengaturan) return <p className="text-ink/50">Memuat...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-xl mb-1">Toko &amp; Pembayaran</h1>
        <p className="text-sm text-ink/50">
          Atur identitas toko (untuk header struk) dan metode pembayaran di kasir.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-base mb-3">🏪 Info Toko (untuk header struk)</h2>

        <form onSubmit={handleSimpanNamaToko} className="flex gap-2 mb-4">
          <input
            className="input-field"
            placeholder="Nama Coffee Shop"
            value={namaTokoInput}
            onChange={(e) => setNamaTokoInput(e.target.value)}
          />
          <button type="submit" className="btn-secondary whitespace-nowrap">
            Simpan Nama
          </button>
        </form>

        <p className="label-field mb-2">Logo Toko</p>
        {toko?.logo_url ? (
          <div className="mb-3">
            <img
              src={toko.logo_url}
              alt="Logo Toko"
              className="w-32 h-32 object-contain border border-line rounded bg-white p-2"
            />
            <button
              onClick={handleHapusLogo}
              className="text-rust text-xs hover:underline mt-2"
            >
              Hapus logo ini
            </button>
          </div>
        ) : (
          <p className="text-xs text-ink/40 mb-3">
            Belum ada logo — header struk akan pakai teks nama toko saja.
          </p>
        )}
        <label className="btn-secondary inline-block cursor-pointer">
          {uploadingLogo ? "Mengupload..." : "Upload / Ganti Logo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadLogo}
            disabled={uploadingLogo}
          />
        </label>
        <p className="text-xs text-ink/40 mt-2">
          Disarankan gambar persegi (contoh 500x500px), latar putih/transparan,
          biar rapi dicetak di struk.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-base mb-1">💵 Cash / Tunai</h2>
        <p className="text-xs text-ink/50">
          Selalu aktif secara default, tidak perlu pengaturan tambahan.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-base mb-3">📷 QRIS Sendiri</h2>
        <p className="text-xs text-ink/50 mb-4">
          Upload gambar QRIS milik kamu sendiri (dari bank/e-wallet). Ini yang
          akan ditampilkan ke pelanggan saat memilih bayar QRIS di kasir.
        </p>

        {pengaturan.qris_sendiri_url ? (
          <div className="mb-4">
            <img
              src={pengaturan.qris_sendiri_url}
              alt="QRIS"
              className="w-40 h-40 object-contain border border-line rounded bg-white p-2"
            />
            <button
              onClick={handleHapusQris}
              className="text-rust text-xs hover:underline mt-2"
            >
              Hapus QRIS ini
            </button>
          </div>
        ) : (
          <p className="text-xs text-ink/40 mb-4">Belum ada QRIS yang diupload.</p>
        )}

        <label className="btn-secondary inline-block cursor-pointer">
          {uploading ? "Mengupload..." : "Upload / Ganti Gambar QRIS"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
        {error && <p className="text-rust text-xs mt-2">{error}</p>}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-base">🔗 QRIS Midtrans</h2>
          <button
            onClick={handleToggleMidtrans}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              pengaturan.qris_midtrans_aktif
                ? "bg-ledger text-white border-ledger"
                : "border-line text-ink/60"
            }`}
          >
            {pengaturan.qris_midtrans_aktif ? "Aktif" : "Nonaktif"}
          </button>
        </div>
        <p className="text-xs text-ink/50">
          Belum terhubung ke akun Midtrans asli — kalau diaktifkan, opsi ini
          cuma tampil sebagai <b>simulasi/demo</b> di halaman kasir (belum
          memproses pembayaran sungguhan). Hubungkan ke Midtrans API nanti
          kalau sudah siap produksi.
        </p>
      </div>
    </div>
  );
}
