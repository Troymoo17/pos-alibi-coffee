"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Addon, JenisKategori, KategoriMenu, Platform, Produk } from "@/lib/types";
import { formatRupiah, hitungHargaPlatform } from "@/lib/hpp";

export default function MenuSettingPage() {
  const [tab, setTab] = useState<"kategori" | "addon" | "tambah-menu">("kategori");
  const [kategoriList, setKategoriList] = useState<KategoriMenu[]>([]);
  const [addonList, setAddonList] = useState<Addon[]>([]);
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);

  const [formKategori, setFormKategori] = useState<{ nama: string; jenis: JenisKategori }>({
    nama: "",
    jenis: "makanan",
  });
  const [formAddon, setFormAddon] = useState({ nama: "", harga: "" });
  const [formMenu, setFormMenu] = useState({ nama: "", harga_jual: "", kategori_id: "" });
  const [savedMsgMenu, setSavedMsgMenu] = useState(false);

  async function loadData() {
    const [{ data: kategori }, { data: addon }, { data: platform }, { data: produk }] =
      await Promise.all([
        supabase.from("kategori_menu").select("*").order("urutan"),
        supabase.from("addon").select("*").order("nama"),
        supabase.from("platform").select("*").order("urutan"),
        supabase.from("produk").select("*").order("nama"),
      ]);
    setKategoriList((kategori as KategoriMenu[]) ?? []);
    setAddonList((addon as Addon[]) ?? []);
    setPlatformList(((platform as Platform[]) ?? []).filter((p) => p.komisi_persen > 0));
    setProdukList((produk as Produk[]) ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleTambahKategori(e: React.FormEvent) {
    e.preventDefault();
    if (!formKategori.nama.trim()) return;
    await supabase.from("kategori_menu").insert({
      nama: formKategori.nama,
      jenis: formKategori.jenis,
      urutan: kategoriList.length,
    });
    setFormKategori({ nama: "", jenis: "makanan" });
    loadData();
  }

  async function handleHapusKategori(id: string) {
    if (!confirm("Hapus kategori ini? Produk di kategori ini tidak ikut terhapus.")) return;
    await supabase.from("kategori_menu").delete().eq("id", id);
    loadData();
  }

  async function handleTambahAddon(e: React.FormEvent) {
    e.preventDefault();
    if (!formAddon.nama.trim()) return;
    await supabase.from("addon").insert({
      nama: formAddon.nama,
      harga: parseFloat(formAddon.harga || "0"),
    });
    setFormAddon({ nama: "", harga: "" });
    loadData();
  }

  async function handleHapusAddon(id: string) {
    if (!confirm("Hapus addon ini?")) return;
    await supabase.from("addon").delete().eq("id", id);
    loadData();
  }

  async function handleTambahMenuCepat(e: React.FormEvent) {
    e.preventDefault();
    if (!formMenu.nama.trim()) return;
    await supabase.from("produk").insert({
      nama: formMenu.nama,
      harga_jual: parseFloat(formMenu.harga_jual || "0"),
      target_margin_persen: 30,
      kategori_id: formMenu.kategori_id || null,
    });
    setFormMenu({ nama: "", harga_jual: "", kategori_id: "" });
    setSavedMsgMenu(true);
    setTimeout(() => setSavedMsgMenu(false), 2000);
    loadData();
  }

  async function handleHapusMenu(id: string) {
    if (!confirm("Hapus menu ini?")) return;
    await supabase.from("produk").delete().eq("id", id);
    loadData();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl mb-1">Kelola Menu</h1>
        <p className="text-sm text-ink/50">
          Atur kategori menu, addon/tambahan, dan tambah menu cepat tanpa resep.
        </p>
      </div>

      <div className="flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
        {[
          { key: "kategori", label: "Kategori Menu" },
          { key: "addon", label: "Addon / Tambahan" },
          { key: "tambah-menu", label: "+ Tambah Menu Cepat" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-ledger text-ledger"
                : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "kategori" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-5">
            <h2 className="font-display text-base mb-3">Tambah Kategori</h2>
            <form onSubmit={handleTambahKategori} className="space-y-3">
              <div>
                <label className="label-field">Nama Kategori</label>
                <input
                  className="input-field"
                  placeholder="Contoh: Kopi, Non-Kopi, Snack"
                  value={formKategori.nama}
                  onChange={(e) => setFormKategori({ ...formKategori, nama: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-field mb-2">Jenis</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "minuman", label: "🍹 Minuman" },
                    { key: "makanan", label: "🍽️ Makanan" },
                  ].map((j) => (
                    <button
                      key={j.key}
                      type="button"
                      onClick={() =>
                        setFormKategori({ ...formKategori, jenis: j.key as JenisKategori })
                      }
                      className={`px-3 py-2 rounded text-sm font-medium border transition-colors ${
                        formKategori.jenis === j.key
                          ? "bg-ledger text-white border-ledger"
                          : "border-line text-ink/60"
                      }`}
                    >
                      {j.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink/40 mt-1">
                  Dipakai untuk misahin tampilan di kasir & struk dapur
                  minuman/makanan.
                </p>
              </div>
              <button type="submit" className="btn-primary w-full">
                Tambah
              </button>
            </form>
          </div>
          <div className="md:col-span-2 card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-ledger">
                <thead>
                  <tr>
                    <th>Nama Kategori</th>
                    <th>Jenis</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {kategoriList.map((k) => (
                    <tr key={k.id}>
                      <td className="font-body">{k.nama}</td>
                      <td className="font-body text-xs">
                        {k.jenis === "minuman" ? "🍹 Minuman" : "🍽️ Makanan"}
                      </td>
                      <td>
                        <button
                          onClick={() => handleHapusKategori(k.id)}
                          className="text-rust text-xs hover:underline font-body"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {kategoriList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-ink/50">
                        Belum ada kategori.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "addon" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-5">
            <h2 className="font-display text-base mb-3">Tambah Addon</h2>
            <form onSubmit={handleTambahAddon} className="space-y-3">
              <div>
                <label className="label-field">Nama Addon</label>
                <input
                  className="input-field"
                  placeholder="Contoh: Extra Shot"
                  value={formAddon.nama}
                  onChange={(e) => setFormAddon({ ...formAddon, nama: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-field">Harga Tambahan (Rp)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="5000"
                  value={formAddon.harga}
                  onChange={(e) => setFormAddon({ ...formAddon, harga: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Tambah
              </button>
            </form>
          </div>
          <div className="md:col-span-2 card overflow-hidden">
            {platformList.length > 0 && (
              <p className="text-xs text-ink/50 px-4 pt-4">
                💡 Harga addon di kasir otomatis naik sesuai komisi platform,
                sama seperti harga produk. Kolom "Harga di Platform" ini cuma
                referensi.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full table-ledger">
                <thead>
                  <tr>
                    <th>Nama Addon</th>
                    <th>Harga Dasar</th>
                    {platformList.map((p) => (
                      <th key={p.id}>{p.nama}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {addonList.map((a) => (
                    <tr key={a.id}>
                      <td className="font-body">{a.nama}</td>
                      <td>{formatRupiah(a.harga)}</td>
                      {platformList.map((p) => (
                        <td key={p.id} className="text-ledger">
                          {formatRupiah(hitungHargaPlatform(a.harga, p.komisi_persen))}
                        </td>
                      ))}
                      <td>
                        <button
                          onClick={() => handleHapusAddon(a.id)}
                          className="text-rust text-xs hover:underline font-body"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                  {addonList.length === 0 && (
                    <tr>
                      <td colSpan={3 + platformList.length} className="text-center py-6 text-ink/50">
                        Belum ada addon.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "tambah-menu" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-5">
            <h2 className="font-display text-base mb-1">Tambah Menu Cepat</h2>
            <p className="text-xs text-ink/50 mb-3">
              Buat menu langsung dengan nama + harga, TANPA perlu susun resep
              dulu. HPP-nya akan tercatat 0 sampai kamu isi resepnya nanti
              (opsional) di halaman Produk &amp; Resep.
            </p>
            <form onSubmit={handleTambahMenuCepat} className="space-y-3">
              <div>
                <label className="label-field">Nama Menu</label>
                <input
                  className="input-field"
                  placeholder="Contoh: Air Mineral"
                  value={formMenu.nama}
                  onChange={(e) => setFormMenu({ ...formMenu, nama: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-field">Harga Jual (Rp)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="5000"
                  value={formMenu.harga_jual}
                  onChange={(e) => setFormMenu({ ...formMenu, harga_jual: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-field">Kategori (opsional)</label>
                <select
                  className="input-field"
                  value={formMenu.kategori_id}
                  onChange={(e) => setFormMenu({ ...formMenu, kategori_id: e.target.value })}
                >
                  <option value="">Tanpa kategori</option>
                  {kategoriList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.jenis === "minuman" ? "🍹" : "🍽️"} {k.nama}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full">
                Tambah Menu
              </button>
              {savedMsgMenu && (
                <p className="text-ledger text-xs text-center">✓ Menu tersimpan</p>
              )}
            </form>
          </div>
          <div className="md:col-span-2 card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-ledger">
                <thead>
                  <tr>
                    <th>Nama Menu</th>
                    <th>Kategori</th>
                    <th>Harga Jual</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {produkList.map((p) => {
                    const kat = kategoriList.find((k) => k.id === p.kategori_id);
                    return (
                      <tr key={p.id}>
                        <td className="font-body">{p.nama}</td>
                        <td className="font-body text-xs">
                          {kat ? `${kat.jenis === "minuman" ? "🍹" : "🍽️"} ${kat.nama}` : "-"}
                        </td>
                        <td>{formatRupiah(p.harga_jual)}</td>
                        <td>
                          <button
                            onClick={() => handleHapusMenu(p.id)}
                            className="text-rust text-xs hover:underline font-body"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {produkList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-ink/50">
                        Belum ada menu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink/40 p-4 pt-2">
              Mau atur resep/HPP untuk menu di atas? Buka halaman{" "}
              <a href="/produk" className="text-ledger underline">
                Produk &amp; Resep
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
