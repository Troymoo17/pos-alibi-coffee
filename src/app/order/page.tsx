"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Addon,
  BahanBaku,
  KategoriMenu,
  Pengaturan,
  PengaturanToko,
  Produk,
  ResepProduk,
} from "@/lib/types";
import { formatRupiah, hitungHPP } from "@/lib/hpp";
import { useToast } from "@/components/Toast";

type CartItem = {
  key: string;
  produk: Produk;
  qty: number;
  addons: Addon[];
  catatan: string;
};

type Step = "info" | "menu" | "bayar" | "selesai";

export default function SelfServicePage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("info");
  const { showToast } = useToast();

  const [kategoriList, setKategoriList] = useState<KategoriMenu[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [addonByProduk, setAddonByProduk] = useState<Record<string, Addon[]>>({});
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [pengaturanToko, setPengaturanToko] = useState<PengaturanToko | null>(null);
  const [resepByProduk, setResepByProduk] = useState<
    Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]>
  >({});

  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [tipeOrder, setTipeOrder] = useState<"dinein" | "takeaway">("dinein");
  const [nomorMeja, setNomorMeja] = useState("");

  const [kategoriAktif, setKategoriAktif] = useState<string | "semua">("semua");
  const [cariMenu, setCariMenu] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [popupProduk, setPopupProduk] = useState<Produk | null>(null);
  const [popupAddon, setPopupAddon] = useState<string[]>([]);
  const [popupQty, setPopupQty] = useState(1);
  const [popupCatatan, setPopupCatatan] = useState("");

  const [showQrisPopup, setShowQrisPopup] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [menungguPembayaran, setMenungguPembayaran] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [memproses, setMemproses] = useState(false);
  const [nomorNotaSelesai, setNomorNotaSelesai] = useState<number | null>(null);

  async function loadRefData() {
    setLoading(true);
    const [
      { data: kategori },
      { data: produk },
      { data: produkAddon },
      { data: pengaturanData },
      { data: resep },
      { data: tokoData },
    ] = await Promise.all([
      supabase.from("kategori_menu").select("*").order("urutan"),
      supabase.from("produk").select("*").order("nama"),
      supabase.from("produk_addon").select("produk_id, addon(*)"),
      supabase.from("pengaturan").select("*").limit(1).single(),
      supabase.from("resep_produk").select("*, bahan_baku(*)"),
      supabase.from("pengaturan_toko").select("*").limit(1).single(),
    ]);

    setKategoriList((kategori as KategoriMenu[]) ?? []);
    setProdukList((produk as Produk[]) ?? []);
    setPengaturan((pengaturanData as Pengaturan) ?? null);
    setPengaturanToko((tokoData as PengaturanToko) ?? null);

    const addonMap: Record<string, Addon[]> = {};
    (produkAddon ?? []).forEach((r: any) => {
      if (!addonMap[r.produk_id]) addonMap[r.produk_id] = [];
      if (r.addon) addonMap[r.produk_id].push(r.addon);
    });
    setAddonByProduk(addonMap);

    const resepMap: Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]> = {};
    (resep ?? []).forEach((r: any) => {
      if (!resepMap[r.produk_id]) resepMap[r.produk_id] = [];
      resepMap[r.produk_id].push(r);
    });
    setResepByProduk(resepMap);
    setLoading(false);
  }

  useEffect(() => {
    loadRefData();
  }, []);

  function hppProduk(produkId: string) {
    const resep = resepByProduk[produkId] ?? [];
    return hitungHPP({ resep, pengaturan }).hppPerUnit;
  }

  function hargaSatuanCart(item: CartItem) {
    const hargaAddon = item.addons.reduce((s, a) => s + a.harga, 0);
    return item.produk.harga_jual + hargaAddon;
  }

  const totalBelanja = useMemo(
    () => cart.reduce((sum, item) => sum + hargaSatuanCart(item) * item.qty, 0),
    [cart]
  );

  function handleMulaiPesanan(e: React.FormEvent) {
    e.preventDefault();
    setStep("menu");
  }

  function bukaPopupProduk(produk: Produk) {
    setPopupProduk(produk);
    setPopupAddon([]);
    setPopupQty(1);
    setPopupCatatan("");
  }

  function konfirmasiTambahKeranjang() {
    if (!popupProduk) return;
    const addonsTerpilih = (addonByProduk[popupProduk.id] ?? []).filter((a) =>
      popupAddon.includes(a.id)
    );
    setCart((prev) => [
      ...prev,
      {
        key: `${popupProduk.id}-${Date.now()}`,
        produk: popupProduk,
        qty: popupQty,
        addons: addonsTerpilih,
        catatan: popupCatatan,
      },
    ]);
    setPopupProduk(null);
  }

  function ubahQtyCart(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key ? { ...item, qty: Math.max(1, item.qty + delta) } : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  function hapusDariKeranjang(key: string) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  async function handleMulaiPembayaranDoku() {
    if (cart.length === 0) return;
    setMemproses(true);

    // 1. Buat pesanan dengan status "belum_bayar" dulu -- baru dianggap
    //    sah kalau webhook DOKU konfirmasi pembayaran sukses.
    const { data: pesanan, error: errPesanan } = await supabase
      .from("pesanan")
      .insert({
        nama_pelanggan: namaPelanggan || null,
        tipe_order: tipeOrder,
        platform_id: null,
        nomor_meja: tipeOrder === "dinein" ? nomorMeja : null,
        metode_bayar: "qris_doku",
        status: "belum_bayar",
        total: totalBelanja,
        subtotal_sebelum_diskon: totalBelanja,
        diskon_nominal: 0,
        sumber: "self_service",
      })
      .select()
      .single();

    if (errPesanan || !pesanan) {
      showToast("Gagal menyimpan pesanan: " + errPesanan?.message, "error");
      setMemproses(false);
      return;
    }

    // 2. Simpan item pesanan. Stok & transaksi_penjualan BELUM dibuat di
    //    sini -- itu baru diproses otomatis oleh webhook setelah DOKU
    //    konfirmasi pembayaran sukses (lihat src/app/api/doku/webhook).
    for (const item of cart) {
      const hpp = hppProduk(item.produk.id);
      const { data: pesananItem } = await supabase
        .from("pesanan_item")
        .insert({
          pesanan_id: pesanan.id,
          produk_id: item.produk.id,
          nama_produk_saat_itu: item.produk.nama,
          qty: item.qty,
          harga_saat_itu: hargaSatuanCart(item),
          hpp_saat_itu: hpp,
          catatan: item.catatan || null,
        })
        .select()
        .single();

      if (pesananItem && item.addons.length > 0) {
        await supabase.from("pesanan_item_addon").insert(
          item.addons.map((a) => ({
            pesanan_item_id: pesananItem.id,
            nama_addon_saat_itu: a.nama,
            harga_addon_saat_itu: a.harga,
          }))
        );
      }
    }

    // 3. Minta QRIS ke DOKU lewat API route kita sendiri (server-side,
    //    supaya Secret Key & Private Key tidak pernah kekirim ke browser)
    try {
      const res = await fetch("/api/doku/generate-qris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesananId: pesanan.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast("Gagal membuat QRIS: " + data.error, "error");
        setMemproses(false);
        return;
      }

      setQrImageUrl(data.qrImageDataUrl);
      setShowQrisPopup(true);
      setMenungguPembayaran(true);
      mulaiPollingStatus(pesanan.id, pesanan.nomor_urut);
    } catch (err: any) {
      showToast("Gagal terhubung ke payment gateway: " + err.message, "error");
    }

    setMemproses(false);
  }

  function mulaiPollingStatus(pesananId: string, nomorUrut: number) {
    // Cek status pesanan tiap 3 detik, sampai statusnya berubah jadi
    // "sudah_bayar" (di-update otomatis oleh webhook DOKU di background).
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("pesanan")
        .select("status")
        .eq("id", pesananId)
        .single();

      if (data?.status === "sudah_bayar") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setMenungguPembayaran(false);
        setShowQrisPopup(false);
        setNomorNotaSelesai(nomorUrut);
        setStep("selesai");
      }
    }, 3000);
  }

  function batalkanMenungguPembayaran() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setMenungguPembayaran(false);
    setShowQrisPopup(false);
  }

  useEffect(() => {
    // Bersihkan interval polling kalau halaman ditutup/pindah
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  function pesanLagi() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setCart([]);
    setNamaPelanggan("");
    setTipeOrder("dinein");
    setNomorMeja("");
    setNomorNotaSelesai(null);
    setQrImageUrl(null);
    setMenungguPembayaran(false);
    setStep("info");
  }

  const produkDitampilkan = produkList.filter(
    (p) =>
      (kategoriAktif === "semua" || p.kategori_id === kategoriAktif) &&
      p.nama.toLowerCase().includes(cariMenu.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-ink/50">Memuat menu...</p>
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
      <div className="flex items-center justify-center px-4 py-4 border-b border-line bg-paper/80 sticky top-0 z-30">
        {pengaturanToko?.logo_url ? (
          <img src={pengaturanToko.logo_url} alt="Logo" className="h-10 object-contain" />
        ) : (
          <h1 className="font-display font-semibold text-lg text-ink">
            {pengaturanToko?.nama_toko ?? "Buku Kerja"}
          </h1>
        )}
      </div>

      <div className="p-4 md:p-6">
        {step === "info" && (
          <div className="max-w-md mx-auto">
            <div className="card p-6">
              <h2 className="font-display text-lg mb-1 text-center">
                Selamat Datang! 👋
              </h2>
              <p className="text-xs text-ink/50 text-center mb-4">
                Yuk pesan sendiri, langsung dari HP kamu.
              </p>
              <form onSubmit={handleMulaiPesanan} className="space-y-4">
                <div>
                  <label className="label-field">Nama Kamu (opsional)</label>
                  <input
                    className="input-field"
                    value={namaPelanggan}
                    onChange={(e) => setNamaPelanggan(e.target.value)}
                    placeholder="Contoh: Budi"
                  />
                </div>

                <div>
                  <label className="label-field">Mau Makan di Sini atau Bawa Pulang?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "dinein", label: "Dine-in" },
                      { key: "takeaway", label: "Takeaway" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTipeOrder(t.key as "dinein" | "takeaway")}
                        className={`px-3 py-2.5 rounded text-sm font-medium border transition-colors ${
                          tipeOrder === t.key
                            ? "bg-ledger text-white border-ledger"
                            : "border-line text-ink/60"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {tipeOrder === "dinein" && (
                  <div>
                    <label className="label-field">Nomor Meja</label>
                    <input
                      className="input-field"
                      value={nomorMeja}
                      onChange={(e) => setNomorMeja(e.target.value)}
                      placeholder="Contoh: 5"
                      required
                    />
                  </div>
                )}

                <button type="submit" className="btn-primary w-full">
                  Lihat Menu →
                </button>
              </form>
            </div>
          </div>
        )}

        {step === "menu" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <input
                type="text"
                className="input-field"
                placeholder="🔍 Cari menu..."
                value={cariMenu}
                onChange={(e) => setCariMenu(e.target.value)}
              />
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setKategoriAktif("semua")}
                  className={`shrink-0 px-3 py-1.5 rounded text-sm font-medium border ${
                    kategoriAktif === "semua"
                      ? "bg-ledger text-white border-ledger"
                      : "border-line text-ink/60"
                  }`}
                >
                  Semua
                </button>
                {kategoriList.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setKategoriAktif(k.id)}
                    className={`shrink-0 px-3 py-1.5 rounded text-sm font-medium border ${
                      kategoriAktif === k.id
                        ? "bg-ledger text-white border-ledger"
                        : "border-line text-ink/60"
                    }`}
                  >
                    {k.nama}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {produkDitampilkan.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => bukaPopupProduk(p)}
                    className="card p-4 text-left hover:border-ledger transition-colors"
                  >
                    <p className="font-medium text-sm mb-1">{p.nama}</p>
                    <p className="font-mono text-ledger text-sm font-semibold">
                      {formatRupiah(p.harga_jual)}
                    </p>
                  </button>
                ))}
                {produkDitampilkan.length === 0 && (
                  <p className="text-ink/50 text-sm col-span-full">
                    Menu tidak ditemukan.
                  </p>
                )}
              </div>
            </div>

            <div className="card p-4 h-fit lg:sticky lg:top-24">
              <h2 className="font-display text-base mb-3">Pesanan Kamu</h2>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.key} className="border-b border-dashed border-line pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{item.produk.nama}</p>
                        {item.addons.length > 0 && (
                          <p className="text-xs text-ink/50">
                            + {item.addons.map((a) => a.nama).join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => hapusDariKeranjang(item.key)}
                        className="text-rust text-xs hover:underline shrink-0 ml-2"
                      >
                        Hapus
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => ubahQtyCart(item.key, -1)}
                          className="w-6 h-6 border border-line rounded text-sm"
                        >
                          −
                        </button>
                        <span className="text-sm font-mono w-5 text-center">{item.qty}</span>
                        <button
                          onClick={() => ubahQtyCart(item.key, 1)}
                          className="w-6 h-6 border border-line rounded text-sm"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono text-sm">
                        {formatRupiah(hargaSatuanCart(item) * item.qty)}
                      </span>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && (
                  <p className="text-ink/40 text-sm text-center py-6">
                    Belum ada pesanan, yuk pilih menu!
                  </p>
                )}
              </div>

              <div className="border-t-2 border-ink/80 mt-3 pt-3 flex justify-between items-center">
                <span className="font-medium text-sm">Total</span>
                <span className="font-mono font-semibold text-lg text-ledger">
                  {formatRupiah(totalBelanja)}
                </span>
              </div>

              <button
                onClick={() => setStep("bayar")}
                disabled={cart.length === 0}
                className="btn-primary w-full mt-3"
              >
                Lanjut Bayar
              </button>
            </div>
          </div>
        )}

        {step === "bayar" && (
          <div className="max-w-md mx-auto">
            <div className="card p-6">
              <h2 className="font-display text-lg mb-4 text-center">Pembayaran</h2>
              <div className="bg-ledger-dark/[0.04] rounded p-3 mb-5 flex justify-between items-center">
                <span className="text-sm">Total Bayar</span>
                <span className="font-mono text-xl font-semibold text-ledger">
                  {formatRupiah(totalBelanja)}
                </span>
              </div>
              <p className="text-xs text-ink/50 text-center mb-4">
                Scan QRIS untuk bayar (didukung semua e-wallet & m-banking).
              </p>
              <button
                onClick={handleMulaiPembayaranDoku}
                disabled={memproses}
                className="btn-primary w-full"
              >
                {memproses ? "Menyiapkan QRIS..." : "💳 Bayar dengan QRIS"}
              </button>
              <button
                onClick={() => setStep("menu")}
                className="text-xs text-ink/50 hover:underline w-full text-center mt-3"
              >
                ← Kembali ke menu
              </button>
            </div>
          </div>
        )}

        {step === "selesai" && (
          <div className="max-w-sm mx-auto text-center">
            <div className="card p-8">
              <p className="text-5xl mb-3">✅</p>
              <h2 className="font-display text-xl mb-1">Pesanan Diterima!</h2>
              <p className="text-sm text-ink/50 mb-4">
                Nomor antrian kamu:
              </p>
              <p className="font-mono text-3xl font-bold text-ledger mb-4">
                #{String(nomorNotaSelesai).padStart(4, "0")}
              </p>
              <p className="text-xs text-ink/40">
                Tunjukkan nomor ini ke kasir/barista saat pesanan dipanggil. 
                Terima kasih! ☕
              </p>
            </div>
            <button onClick={pesanLagi} className="btn-secondary w-full mt-4">
              + Pesan Lagi
            </button>
          </div>
        )}

        {/* Popup Addon */}
        {popupProduk && (
          <div
            className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4"
            onClick={() => setPopupProduk(null)}
          >
            <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display text-base mb-1">{popupProduk.nama}</h3>
              <p className="font-mono text-ledger font-semibold mb-4">
                {formatRupiah(popupProduk.harga_jual)}
              </p>

              {(addonByProduk[popupProduk.id] ?? []).length > 0 && (
                <div className="mb-4">
                  <p className="label-field mb-2">Tambahan (opsional)</p>
                  <div className="space-y-2">
                    {(addonByProduk[popupProduk.id] ?? []).map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center justify-between text-sm cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={popupAddon.includes(a.id)}
                            onChange={(e) =>
                              setPopupAddon((prev) =>
                                e.target.checked
                                  ? [...prev, a.id]
                                  : prev.filter((id) => id !== a.id)
                              )
                            }
                          />
                          {a.nama}
                        </span>
                        <span className="font-mono text-ink/50">+{formatRupiah(a.harga)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="label-field mb-2">Jumlah</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPopupQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 border border-line rounded"
                  >
                    −
                  </button>
                  <span className="font-mono w-6 text-center">{popupQty}</span>
                  <button
                    onClick={() => setPopupQty((q) => q + 1)}
                    className="w-8 h-8 border border-line rounded"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setPopupProduk(null)} className="btn-secondary flex-1">
                  Batal
                </button>
                <button onClick={konfirmasiTambahKeranjang} className="btn-primary flex-1">
                  Tambah
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Popup QRIS DOKU -- QR asli, otomatis lanjut begitu terbayar */}
        {showQrisPopup && (
          <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4">
            <div className="card p-6 w-full max-w-sm text-center">
              <h3 className="font-display text-lg mb-1">Scan untuk Bayar</h3>
              <p className="font-mono text-2xl font-semibold text-ledger mb-4">
                {formatRupiah(totalBelanja)}
              </p>
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="QRIS"
                  className="w-56 h-56 object-contain mx-auto border-2 border-ledger rounded-lg bg-white p-2 mb-4"
                />
              ) : (
                <div className="w-56 h-56 mx-auto border-2 border-dashed border-line rounded-lg flex items-center justify-center mb-4">
                  <p className="text-sm text-ink/40">Memuat QR...</p>
                </div>
              )}
              {menungguPembayaran && (
                <p className="text-xs text-ledger mb-4 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-ledger rounded-full animate-pulse" />
                  Menunggu pembayaran... akan lanjut otomatis
                </p>
              )}
              <button
                onClick={batalkanMenungguPembayaran}
                className="btn-secondary w-full"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
