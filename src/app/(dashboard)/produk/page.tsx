"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BahanBaku, Pengaturan, Platform, Produk, ResepProduk, KategoriMenu, Addon } from "@/lib/types";
import {
  formatRupiah,
  hitungHPP,
  hitungHargaJualDisarankan,
  hitungHargaPlatform,
} from "@/lib/hpp";
import BahanBakuQuickAdd from "@/components/BahanBakuQuickAdd";

export default function ProdukPage() {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [bahanBakuList, setBahanBakuList] = useState<BahanBaku[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriMenu[]>([]);
  const [addonList, setAddonList] = useState<Addon[]>([]);
  const [addonTerpilih, setAddonTerpilih] = useState<string[]>([]);
  const [resepByProduk, setResepByProduk] = useState<
    Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]>
  >({});
  const [selectedProdukId, setSelectedProdukId] = useState<string | null>(null);

  const [formProduk, setFormProduk] = useState({ nama: "" });
  const [formResep, setFormResep] = useState({ bahan_baku_id: "", qty: "" });
  const [error, setError] = useState<string | null>(null);
  const [hargaJualManual, setHargaJualManual] = useState("");
  const [tabAktif, setTabAktif] = useState<"resep" | "harga" | "platform" | "kategori">(
    "resep"
  );
  const [showFormProduk, setShowFormProduk] = useState(false);

  const PRESET_MARGIN = [20, 25, 30, 35, 40, 45, 50, 55, 60];

  async function loadAll() {
    const [
      { data: produk },
      { data: bahan },
      { data: pengaturanData },
      { data: platformData },
      { data: kategoriData },
      { data: addonData },
    ] = await Promise.all([
      supabase.from("produk").select("*").order("nama"),
      supabase.from("bahan_baku").select("*").order("nama"),
      supabase.from("pengaturan").select("*").limit(1).single(),
      supabase.from("platform").select("*").order("urutan"),
      supabase.from("kategori_menu").select("*").order("urutan"),
      supabase.from("addon").select("*").order("nama"),
    ]);
    setProdukList((produk as Produk[]) ?? []);
    setBahanBakuList((bahan as BahanBaku[]) ?? []);
    setPengaturan((pengaturanData as Pengaturan) ?? null);
    setPlatformList((platformData as Platform[]) ?? []);
    setKategoriList((kategoriData as KategoriMenu[]) ?? []);
    setAddonList((addonData as Addon[]) ?? []);

    if (produk && produk.length > 0) {
      const { data: resep } = await supabase
        .from("resep_produk")
        .select("*, bahan_baku(*)");
      const grouped: Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]> = {};
      (resep ?? []).forEach((r: any) => {
        if (!grouped[r.produk_id]) grouped[r.produk_id] = [];
        grouped[r.produk_id].push(r);
      });
      setResepByProduk(grouped);
      if (!selectedProdukId) setSelectedProdukId(produk[0].id);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadAddonProduk() {
      if (!selectedProdukId) {
        setAddonTerpilih([]);
        return;
      }
      const { data } = await supabase
        .from("produk_addon")
        .select("addon_id")
        .eq("produk_id", selectedProdukId);
      setAddonTerpilih((data ?? []).map((r: any) => r.addon_id));
    }
    loadAddonProduk();
  }, [selectedProdukId]);

  async function handleUbahKategori(produkId: string, kategoriId: string) {
    await supabase
      .from("produk")
      .update({ kategori_id: kategoriId || null })
      .eq("id", produkId);
    loadAll();
  }

  async function handleToggleAddon(produkId: string, addonId: string, aktif: boolean) {
    if (aktif) {
      await supabase.from("produk_addon").insert({ produk_id: produkId, addon_id: addonId });
      setAddonTerpilih((prev) => [...prev, addonId]);
    } else {
      await supabase
        .from("produk_addon")
        .delete()
        .eq("produk_id", produkId)
        .eq("addon_id", addonId);
      setAddonTerpilih((prev) => prev.filter((id) => id !== addonId));
    }
  }

  async function handleTambahProduk(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { data, error } = await supabase
      .from("produk")
      .insert({ nama: formProduk.nama, harga_jual: 0, target_margin_persen: 30 })
      .select()
      .single();
    if (error) setError(error.message);
    setFormProduk({ nama: "" });
    await loadAll();
    if (data) setSelectedProdukId(data.id);
  }

  async function handlePakaiHargaDisarankan(produkId: string, harga: number) {
    await supabase
      .from("produk")
      .update({ harga_jual: Math.round(harga) })
      .eq("id", produkId);
    loadAll();
  }

  async function handlePilihMargin(produkId: string, persen: number) {
    await supabase
      .from("produk")
      .update({ target_margin_persen: persen })
      .eq("id", produkId);
    loadAll();
  }

  async function handleSimpanHargaManual(produkId: string) {
    const nilai = parseFloat(hargaJualManual || "0");
    if (nilai <= 0) return;
    await supabase.from("produk").update({ harga_jual: nilai }).eq("id", produkId);
    setHargaJualManual("");
    loadAll();
  }

  async function handleHapusProduk(id: string) {
    if (!confirm("Hapus produk ini beserta resepnya?")) return;
    await supabase.from("produk").delete().eq("id", id);
    if (selectedProdukId === id) setSelectedProdukId(null);
    loadAll();
  }

  async function handleTambahResep(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProdukId) return;
    setError(null);
    const { error } = await supabase.from("resep_produk").insert({
      produk_id: selectedProdukId,
      bahan_baku_id: formResep.bahan_baku_id,
      qty: parseFloat(formResep.qty || "0"),
    });
    if (error) setError(error.message);
    setFormResep({ bahan_baku_id: "", qty: "" });
    loadAll();
  }

  async function handleHapusResep(id: string) {
    await supabase.from("resep_produk").delete().eq("id", id);
    loadAll();
  }

  const selectedProduk = produkList.find((p) => p.id === selectedProdukId);
  const resepSelected = selectedProdukId ? resepByProduk[selectedProdukId] ?? [] : [];
  const rincianHPP = hitungHPP({
    resep: resepSelected,
    pengaturan,
  });
  const margin = selectedProduk
    ? selectedProduk.harga_jual - rincianHPP.hppPerUnit
    : 0;
  const marginPersen =
    selectedProduk && selectedProduk.harga_jual > 0
      ? (margin / selectedProduk.harga_jual) * 100
      : 0;
  const hargaJualDisarankan = selectedProduk
    ? hitungHargaJualDisarankan(
        rincianHPP.hppPerUnit,
        selectedProduk.target_margin_persen
      )
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Daftar Produk */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">Produk</h2>
            <button
              onClick={() => setShowFormProduk((v) => !v)}
              className="text-xs text-ledger hover:underline font-medium"
            >
              {showFormProduk ? "Batal" : "+ Tambah"}
            </button>
          </div>
          {showFormProduk && (
          <form onSubmit={(e) => { handleTambahProduk(e); setShowFormProduk(false); }} className="space-y-3 mb-5">
            <div>
              <label className="label-field">Nama Produk</label>
              <input
                className="input-field"
                placeholder="Contoh: Roti Coklat"
                value={formProduk.nama}
                onChange={(e) =>
                  setFormProduk({ ...formProduk, nama: e.target.value })
                }
                required
                autoFocus
              />
              <p className="text-xs text-ink/40 mt-1">
                Cukup nama dulu — susun resep dan tentukan harga jualnya nanti
                setelah bahan baku ditentukan.
              </p>
            </div>
            <button type="submit" className="btn-primary w-full">
              Tambah Produk
            </button>
          </form>
          )}

          <ul className="space-y-1">
            {produkList.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedProdukId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex justify-between items-center ${
                    selectedProdukId === p.id
                      ? "bg-ledger text-white"
                      : "hover:bg-line/40"
                  }`}
                >
                  <span>{p.nama}</span>
                  <span
                    className={`text-xs font-mono ${
                      selectedProdukId === p.id ? "text-white/80" : "text-ink/50"
                    }`}
                  >
                    {formatRupiah(p.harga_jual)}
                  </span>
                </button>
              </li>
            ))}
            {produkList.length === 0 && (
              <p className="text-ink/50 text-sm">Belum ada produk.</p>
            )}
          </ul>
        </div>

        {/* Resep + HPP */}
        <div className="md:col-span-2 space-y-4">
          {selectedProduk ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg truncate">
                  {selectedProduk.nama}
                </h2>
                <button
                  onClick={() => handleHapusProduk(selectedProduk.id)}
                  className="text-rust text-xs hover:underline shrink-0 ml-2"
                >
                  Hapus Produk
                </button>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
                {[
                  { key: "resep", label: "Resep" },
                  { key: "kategori", label: "Kategori & Addon" },
                  { key: "harga", label: "HPP & Harga Jual" },
                  { key: "platform", label: "Harga per Platform" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setTabAktif(tab.key as typeof tabAktif)}
                    className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                      tabAktif === tab.key
                        ? "border-ledger text-ledger"
                        : "border-transparent text-ink/50 hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {tabAktif === "resep" && (
              <div className="card p-5">
                <form
                  onSubmit={handleTambahResep}
                  className="flex flex-wrap gap-2 items-end mb-2"
                >
                  <div className="flex-1 min-w-[160px]">
                    <label className="label-field">Bahan Baku</label>
                    <select
                      className="input-field"
                      value={formResep.bahan_baku_id}
                      onChange={(e) =>
                        setFormResep({ ...formResep, bahan_baku_id: e.target.value })
                      }
                      required
                    >
                      <option value="">Pilih bahan baku</option>
                      {bahanBakuList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nama} ({b.satuan})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="label-field">Qty / unit</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="input-field"
                      value={formResep.qty}
                      onChange={(e) =>
                        setFormResep({ ...formResep, qty: e.target.value })
                      }
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    Tambah
                  </button>
                </form>

                {/* Quick-add bahan baku tanpa pindah halaman */}
                <BahanBakuQuickAdd onCreated={loadAll} />

                <div className="overflow-x-auto">
                <table className="w-full table-ledger mt-3">
                  <thead>
                    <tr>
                      <th>Bahan Baku</th>
                      <th>Qty / unit</th>
                      <th>Harga Satuan</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resepSelected.map((r) => (
                      <tr key={r.id}>
                        <td className="font-body">{r.bahan_baku?.nama}</td>
                        <td>
                          {r.qty} {r.bahan_baku?.satuan}
                        </td>
                        <td>{formatRupiah(r.bahan_baku?.harga_per_satuan ?? 0)}</td>
                        <td>
                          {formatRupiah(r.qty * (r.bahan_baku?.harga_per_satuan ?? 0))}
                        </td>
                        <td>
                          <button
                            onClick={() => handleHapusResep(r.id)}
                            className="text-rust text-xs hover:underline font-body"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                    {resepSelected.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-ink/50">
                          Belum ada bahan baku di resep ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
              )}

              {tabAktif === "kategori" && (
              <div className="space-y-4">
                <div className="card p-5">
                  <h2 className="font-display text-base mb-3">Kategori Produk</h2>
                  {kategoriList.length === 0 ? (
                    <p className="text-sm text-ink/50">
                      Belum ada kategori. Buat dulu di halaman{" "}
                      <a href="/menu-setting" className="text-ledger underline">
                        Kelola Menu
                      </a>
                      .
                    </p>
                  ) : (
                    <select
                      className="input-field"
                      value={selectedProduk.kategori_id ?? ""}
                      onChange={(e) =>
                        handleUbahKategori(selectedProduk.id, e.target.value)
                      }
                    >
                      <option value="">Tanpa kategori</option>
                      {kategoriList.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="card p-5">
                  <h2 className="font-display text-base mb-1">Addon untuk Produk Ini</h2>
                  <p className="text-xs text-ink/50 mb-3">
                    Centang addon yang boleh ditambahkan pelanggan saat memesan
                    produk ini di kasir.
                  </p>
                  {addonList.length === 0 ? (
                    <p className="text-sm text-ink/50">
                      Belum ada addon. Buat dulu di halaman{" "}
                      <a href="/menu-setting" className="text-ledger underline">
                        Kelola Menu
                      </a>
                      .
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {addonList.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center justify-between text-sm border-b border-line/60 pb-2 last:border-0 cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={addonTerpilih.includes(a.id)}
                              onChange={(e) =>
                                handleToggleAddon(selectedProduk.id, a.id, e.target.checked)
                              }
                            />
                            {a.nama}
                          </span>
                          <span className="font-mono text-ink/50">
                            {formatRupiah(a.harga)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}

              {tabAktif === "harga" && (
              <>
              {/* Ringkasan HPP */}
              <div className="card p-5 bg-ledger-dark/[0.03]">
                <h2 className="font-display text-base mb-4">Ringkasan HPP per Unit</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="label-field">Bahan Baku</p>
                    <p className="font-mono text-lg">
                      {formatRupiah(rincianHPP.biayaBahanBaku)}
                    </p>
                  </div>
                  <div>
                    <p className="label-field">Overhead</p>
                    <p className="font-mono text-lg">
                      {formatRupiah(rincianHPP.overheadPerUnit)}
                    </p>
                  </div>
                  <div>
                    <p className="label-field">HPP / Unit</p>
                    <p className="font-mono text-lg text-ledger font-semibold">
                      {formatRupiah(rincianHPP.hppPerUnit)}
                    </p>
                  </div>
                  <div>
                    <p className="label-field">Margin Saat Ini</p>
                    <p
                      className={`font-mono text-lg font-semibold ${
                        margin >= 0 ? "text-ledger" : "text-rust"
                      }`}
                    >
                      {formatRupiah(margin)}{" "}
                      <span className="text-xs font-body text-ink/50">
                        ({marginPersen.toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-ink/50 mt-3">
                  Overhead dihitung otomatis dari{" "}
                  <span className="font-medium">Biaya Operasional Bulanan</span>{" "}
                  yang diatur di halaman Produksi, dibagi rata ke semua produk.
                </p>
              </div>

              {/* Saran Harga Jual */}
              <div className="card p-5 border-ledger/40">
                <h2 className="font-display text-base mb-3">💡 Harga Jual</h2>

                <p className="label-field mb-2">Pilih target margin</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {PRESET_MARGIN.map((persen) => (
                    <button
                      key={persen}
                      onClick={() => handlePilihMargin(selectedProduk.id, persen)}
                      className={`px-3 py-1.5 rounded-md text-sm font-mono border transition-colors ${
                        selectedProduk.target_margin_persen === persen
                          ? "bg-ledger text-white border-ledger"
                          : "border-line text-ink/60 hover:border-ledger hover:text-ledger"
                      }`}
                    >
                      {persen}%
                    </button>
                  ))}
                </div>

                <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <p className="label-field">
                      Harga jual disarankan (margin {selectedProduk.target_margin_persen}%)
                    </p>
                    <p className="font-mono text-2xl text-ledger font-semibold">
                      {formatRupiah(hargaJualDisarankan)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      handlePakaiHargaDisarankan(selectedProduk.id, hargaJualDisarankan)
                    }
                    className="btn-primary"
                  >
                    Pakai Harga Ini
                  </button>
                </div>

                <div className="border-t border-line pt-4">
                  <p className="label-field mb-2">
                    Atau tentukan sendiri harga jualnya
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="input-field"
                      placeholder={`Harga saat ini: ${selectedProduk.harga_jual}`}
                      value={hargaJualManual}
                      onChange={(e) => setHargaJualManual(e.target.value)}
                    />
                    <button
                      onClick={() => handleSimpanHargaManual(selectedProduk.id)}
                      className="btn-secondary whitespace-nowrap"
                    >
                      Simpan
                    </button>
                  </div>
                  <p className="text-xs text-ink/50 mt-2">
                    Harga jual aktif sekarang:{" "}
                    <span className="font-mono font-medium">
                      {formatRupiah(selectedProduk.harga_jual)}
                    </span>
                  </p>
                </div>
              </div>
              </>
              )}

              {tabAktif === "platform" && (
              /* Harga di Tiap Platform */
              <div className="card p-5">
                {platformList.length > 0 && selectedProduk.harga_jual > 0 ? (
                <>
                  <h2 className="font-display text-base mb-1">
                    📱 Harga di Tiap Platform
                  </h2>
                  <p className="text-xs text-ink/50 mb-4">
                    Dihitung otomatis dari harga jual di tab "HPP & Harga Jual",
                    supaya pendapatan bersih kamu tetap sama setelah dipotong
                    komisi. Atur % komisi di halaman <b>Platform</b>.
                  </p>
                  <div className="space-y-2">
                    {platformList.map((p) => {
                      const hargaDiPlatform =
                        p.komisi_persen > 0
                          ? hitungHargaPlatform(selectedProduk.harga_jual, p.komisi_persen)
                          : selectedProduk.harga_jual;
                      return (
                        <div
                          key={p.id}
                          className="flex justify-between items-center text-sm border-b border-line/60 pb-2 last:border-0"
                        >
                          <span>
                            {p.nama}{" "}
                            <span className="text-xs text-ink/40">
                              (komisi {p.komisi_persen}%)
                            </span>
                          </span>
                          <span className="font-mono font-semibold text-ledger">
                            {formatRupiah(hargaDiPlatform)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
                ) : (
                  <p className="text-ink/50 text-sm">
                    Set harga jual dulu di tab "HPP & Harga Jual" untuk melihat
                    harga per platform.
                  </p>
                )}
              </div>
              )}
            </>
          ) : (
            <div className="card p-5 text-ink/50 text-sm">
              Pilih atau tambahkan produk terlebih dahulu.
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-rust text-sm">{error}</p>}
    </div>
  );
}
