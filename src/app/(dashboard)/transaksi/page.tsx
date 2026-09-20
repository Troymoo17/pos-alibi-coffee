"use client";

import { useEffect, useState } from "react";
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
import {
  formatRupiah,
  hitungHPP,
  hitungHargaPlatform,
  hitungPendapatanBersih,
} from "@/lib/hpp";

export default function TransaksiPage() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [resepByProduk, setResepByProduk] = useState<
    Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]>
  >({});
  const [penjualanList, setPenjualanList] = useState<
    (TransaksiPenjualan & { produk?: Produk; platform?: Platform })[]
  >([]);
  const [kasList, setKasList] = useState<KasUmum[]>([]);

  const [formJual, setFormJual] = useState({
    produk_id: "",
    platform_id: "",
    qty: "",
    tanggal: new Date().toISOString().slice(0, 10),
  });

  const [formKas, setFormKas] = useState({
    tipe: "masuk" as "masuk" | "keluar",
    kategori: "",
    jumlah: "",
    keterangan: "",
    tanggal: new Date().toISOString().slice(0, 10),
  });

  async function loadAll() {
    const [
      { data: produk },
      { data: pengaturanData },
      { data: platformData },
      { data: penjualan },
      { data: kas },
    ] = await Promise.all([
      supabase.from("produk").select("*").order("nama"),
      supabase.from("pengaturan").select("*").limit(1).single(),
      supabase.from("platform").select("*").order("urutan"),
      supabase
        .from("transaksi_penjualan")
        .select("*, produk(*), platform(*)")
        .eq("dibatalkan", false)
        .order("tanggal", { ascending: false }),
      supabase.from("kas_umum").select("*").order("tanggal", { ascending: false }),
    ]);
    setProdukList((produk as Produk[]) ?? []);
    setPengaturan((pengaturanData as Pengaturan) ?? null);
    setPlatformList((platformData as Platform[]) ?? []);
    setPenjualanList((penjualan as any) ?? []);
    setKasList((kas as KasUmum[]) ?? []);

    if (platformData && platformData.length > 0 && !formJual.platform_id) {
      setFormJual((prev) => ({ ...prev, platform_id: platformData[0].id }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const produkTerpilih = produkList.find((p) => p.id === formJual.produk_id);
  const platformTerpilih = platformList.find((p) => p.id === formJual.platform_id);
  const previewHargaJual =
    produkTerpilih && platformTerpilih
      ? platformTerpilih.komisi_persen > 0
        ? hitungHargaPlatform(produkTerpilih.harga_jual, platformTerpilih.komisi_persen)
        : produkTerpilih.harga_jual
      : 0;

  async function handleJual(e: React.FormEvent) {
    e.preventDefault();
    const produk = produkList.find((p) => p.id === formJual.produk_id);
    const platform = platformList.find((p) => p.id === formJual.platform_id);
    if (!produk || !platform) return;

    const resep = resepByProduk[produk.id] ?? [];
    const rincian = hitungHPP({ resep, pengaturan });

    await supabase.from("transaksi_penjualan").insert({
      produk_id: produk.id,
      platform_id: platform.id,
      qty: parseFloat(formJual.qty || "0"),
      harga_jual_saat_itu: previewHargaJual,
      komisi_persen_saat_itu: platform.komisi_persen,
      hpp_saat_itu: rincian.hppPerUnit,
      tanggal: formJual.tanggal,
    });

    setFormJual({ ...formJual, qty: "" });
    loadAll();
  }

  async function handleHapusJual(id: string) {
    await supabase.from("transaksi_penjualan").delete().eq("id", id);
    loadAll();
  }

  async function handleTambahKas(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("kas_umum").insert({
      tipe: formKas.tipe,
      kategori: formKas.kategori,
      jumlah: parseFloat(formKas.jumlah || "0"),
      keterangan: formKas.keterangan || null,
      tanggal: formKas.tanggal,
    });
    setFormKas({ ...formKas, kategori: "", jumlah: "", keterangan: "" });
    loadAll();
  }

  async function handleHapusKas(id: string) {
    await supabase.from("kas_umum").delete().eq("id", id);
    loadAll();
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Penjualan */}
        <div className="card p-5">
          <h2 className="font-display text-lg mb-4">Catat Penjualan</h2>
          <form onSubmit={handleJual} className="space-y-3">
            <div>
              <label className="label-field">Produk</label>
              <select
                className="input-field"
                value={formJual.produk_id}
                onChange={(e) =>
                  setFormJual({ ...formJual, produk_id: e.target.value })
                }
                required
              >
                <option value="">Pilih produk</option>
                {produkList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} — {formatRupiah(p.harga_jual)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-field">Dijual Lewat</label>
              <div className="flex flex-wrap gap-2">
                {platformList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFormJual({ ...formJual, platform_id: p.id })}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      formJual.platform_id === p.id
                        ? "bg-ledger text-white border-ledger"
                        : "border-line text-ink/60 hover:border-ledger hover:text-ledger"
                    }`}
                  >
                    {p.nama}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Qty Terjual</label>
                <input
                  type="number"
                  className="input-field"
                  value={formJual.qty}
                  onChange={(e) => setFormJual({ ...formJual, qty: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-field">Tanggal</label>
                <input
                  type="date"
                  className="input-field"
                  value={formJual.tanggal}
                  onChange={(e) =>
                    setFormJual({ ...formJual, tanggal: e.target.value })
                  }
                />
              </div>
            </div>

            {produkTerpilih && platformTerpilih && (
              <div className="bg-ledger-dark/[0.05] rounded-md px-3 py-2 flex justify-between items-center text-sm">
                <span className="text-xs text-ink/60">
                  Harga jual di {platformTerpilih.nama} (komisi {platformTerpilih.komisi_persen}%)
                </span>
                <span className="font-mono font-semibold text-ledger">
                  {formatRupiah(previewHargaJual)}
                </span>
              </div>
            )}

            <button type="submit" className="btn-primary w-full">
              Simpan Penjualan
            </button>
          </form>
          <p className="text-xs text-ink/50 mt-3">
            Harga jual & komisi otomatis "difoto" (snapshot) ke transaksi, jadi
            laporan tetap akurat meski harga atau komisi berubah nanti.
          </p>
        </div>

        {/* Kas Umum */}
        <div className="card p-5">
          <h2 className="font-display text-lg mb-4">Catat Kas (Modal/Biaya Lain)</h2>
          <form onSubmit={handleTambahKas} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Tipe</label>
                <select
                  className="input-field"
                  value={formKas.tipe}
                  onChange={(e) =>
                    setFormKas({ ...formKas, tipe: e.target.value as "masuk" | "keluar" })
                  }
                >
                  <option value="masuk">Kas Masuk</option>
                  <option value="keluar">Kas Keluar</option>
                </select>
              </div>
              <div>
                <label className="label-field">Jumlah (Rp)</label>
                <input
                  type="number"
                  className="input-field"
                  value={formKas.jumlah}
                  onChange={(e) => setFormKas({ ...formKas, jumlah: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label-field">Kategori</label>
              <input
                className="input-field"
                placeholder="Modal, komisi platform, tarik tunai, dll"
                value={formKas.kategori}
                onChange={(e) => setFormKas({ ...formKas, kategori: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label-field">Keterangan (opsional)</label>
              <input
                className="input-field"
                value={formKas.keterangan}
                onChange={(e) =>
                  setFormKas({ ...formKas, keterangan: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label-field">Tanggal</label>
              <input
                type="date"
                className="input-field"
                value={formKas.tanggal}
                onChange={(e) => setFormKas({ ...formKas, tanggal: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Simpan
            </button>
          </form>
        </div>
      </div>

      {/* Riwayat Penjualan */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="font-display text-lg mb-4">Riwayat Penjualan</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Produk</th>
              <th>Platform</th>
              <th>Qty</th>
              <th>Harga Kotor</th>
              <th>Komisi</th>
              <th>Bersih</th>
              <th>HPP</th>
              <th>Laba</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {penjualanList.map((t) => {
              const bersihPerUnit = hitungPendapatanBersih(
                t.harga_jual_saat_itu,
                t.komisi_persen_saat_itu
              );
              const laba = (bersihPerUnit - t.hpp_saat_itu) * t.qty;
              return (
                <tr key={t.id}>
                  <td>{t.tanggal}</td>
                  <td className="font-body">{t.produk?.nama}</td>
                  <td className="font-body text-xs">
                    {t.platform?.nama ?? "-"}
                    {t.komisi_persen_saat_itu > 0 && (
                      <span className="text-ink/40"> ({t.komisi_persen_saat_itu}%)</span>
                    )}
                  </td>
                  <td>{t.qty}</td>
                  <td>{formatRupiah(t.harga_jual_saat_itu)}</td>
                  <td className="text-rust">
                    {t.komisi_persen_saat_itu > 0
                      ? `-${formatRupiah(t.harga_jual_saat_itu - bersihPerUnit)}`
                      : "-"}
                  </td>
                  <td>{formatRupiah(bersihPerUnit)}</td>
                  <td>{formatRupiah(t.hpp_saat_itu)}</td>
                  <td className={laba >= 0 ? "text-ledger" : "text-rust"}>
                    {formatRupiah(laba)}
                  </td>
                  <td>
                    <button
                      onClick={() => handleHapusJual(t.id)}
                      className="text-rust text-xs hover:underline font-body"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              );
            })}
            {penjualanList.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-6 text-ink/50">
                  Belum ada transaksi penjualan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Riwayat Kas */}
      <div className="card overflow-hidden">
        <div className="p-5 pb-0">
          <h2 className="font-display text-lg mb-4">Riwayat Kas</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full table-ledger">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe</th>
              <th>Kategori</th>
              <th>Jumlah</th>
              <th>Keterangan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {kasList.map((k) => (
              <tr key={k.id}>
                <td>{k.tanggal}</td>
                <td className={k.tipe === "masuk" ? "text-ledger" : "text-rust"}>
                  {k.tipe === "masuk" ? "Masuk" : "Keluar"}
                </td>
                <td className="font-body">{k.kategori}</td>
                <td>{formatRupiah(k.jumlah)}</td>
                <td className="font-body text-xs text-ink/60">{k.keterangan}</td>
                <td>
                  <button
                    onClick={() => handleHapusKas(k.id)}
                    className="text-rust text-xs hover:underline font-body"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {kasList.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-ink/50">
                  Belum ada catatan kas.
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
