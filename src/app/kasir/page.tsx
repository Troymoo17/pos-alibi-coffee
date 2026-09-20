"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Addon,
  BahanBaku,
  KategoriMenu,
  Pengaturan,
  PengaturanPembayaran,
  PengaturanToko,
  Platform,
  Produk,
  ResepProduk,
  TipeOrder,
  MetodeBayar,
} from "@/lib/types";
import { formatRupiah, hitungHPP, hitungHargaPlatform } from "@/lib/hpp";
import LogoutButton from "@/components/LogoutButton";
import {
  bluetoothTersedia,
  hubungkanPrinterBluetooth,
  kirimKePrinter,
  PrinterBluetooth,
} from "@/lib/bluetoothPrinter";
import { buildStrukBytes, buildTiketDapurBytes } from "@/lib/escpos";
import { kurangiStokUntukPenjualan } from "@/lib/stok";
import { useToast } from "@/components/Toast";
import Link from "next/link";

type CartItem = {
  key: string;
  produk: Produk;
  qty: number;
  addons: Addon[];
  catatan: string;
};

type Step = "info" | "menu" | "checkout" | "receipt";

export default function KasirPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("info");

  // Data referensi
  const [kategoriList, setKategoriList] = useState<KategoriMenu[]>([]);
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [addonByProduk, setAddonByProduk] = useState<Record<string, Addon[]>>({});
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [pengaturanBayar, setPengaturanBayar] = useState<PengaturanPembayaran | null>(null);
  const [pengaturanToko, setPengaturanToko] = useState<PengaturanToko | null>(null);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [resepByProduk, setResepByProduk] = useState<
    Record<string, (ResepProduk & { bahan_baku?: BahanBaku })[]>
  >({});

  // Info pesanan
  const [orderInfo, setOrderInfo] = useState({
    nama_pelanggan: "",
    tipe_order: "dinein" as TipeOrder,
    platform_id: "",
    nomor_meja: "",
  });

  // Menu & keranjang
  const [kategoriAktif, setKategoriAktif] = useState<string | "semua">("semua");
  const [jenisAktif, setJenisAktif] = useState<"semua" | "minuman" | "makanan">("semua");
  const [cariMenu, setCariMenu] = useState("");
  const [diskonNominalInput, setDiskonNominalInput] = useState("");
  const [diskonPersenInput, setDiskonPersenInput] = useState("");
  const { showToast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [popupProduk, setPopupProduk] = useState<Produk | null>(null);
  const [popupAddon, setPopupAddon] = useState<string[]>([]);
  const [popupQty, setPopupQty] = useState(1);
  const [popupCatatan, setPopupCatatan] = useState("");

  // Checkout
  const [metodeBayar, setMetodeBayar] = useState<MetodeBayar>("cash");
  const [prosesBayar, setProsesBayar] = useState(false);
  const [showQrisPopup, setShowQrisPopup] = useState(false);
  const [showCashPopup, setShowCashPopup] = useState(false);
  const [uangDiterima, setUangDiterima] = useState("");
  const [printerBt, setPrinterBt] = useState<PrinterBluetooth | null>(null);
  const [statusPrinter, setStatusPrinter] = useState<
    "idle" | "connecting" | "connected" | "printing" | "error"
  >("idle");
  const [pesanPrinter, setPesanPrinter] = useState<string | null>(null);
  const [namaKasir, setNamaKasir] = useState<string>("Kasir");
  const [receiptData, setReceiptData] = useState<{
    nomorNota: number;
    items: CartItem[];
    total: number;
    subtotalSebelumDiskon: number;
    diskonNominal: number;
    metodeBayar: MetodeBayar;
    waktu: string;
    namaPelanggan: string;
    tipeOrder: TipeOrder;
    labelTipeOrder: string;
    namaKasir: string;
    uangDiterima: number | null;
    kembalian: number | null;
  } | null>(null);
  const [modeCetak, setModeCetak] = useState<"customer" | "minuman" | "makanan">("customer");

  async function loadRefData() {
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

    const [
      { data: kategori },
      { data: produk },
      { data: produkAddon },
      { data: platform },
      { data: bayar },
      { data: pengaturanData },
      { data: resep },
      { data: tokoData },
    ] = await Promise.all([
      supabase.from("kategori_menu").select("*").order("urutan"),
      supabase.from("produk").select("*").order("nama"),
      supabase.from("produk_addon").select("produk_id, addon(*)"),
      supabase.from("platform").select("*").order("urutan"),
      supabase.from("pengaturan_pembayaran").select("*").limit(1).single(),
      supabase.from("pengaturan").select("*").limit(1).single(),
      supabase.from("resep_produk").select("*, bahan_baku(*)"),
      supabase.from("pengaturan_toko").select("*").limit(1).single(),
    ]);

    setKategoriList((kategori as KategoriMenu[]) ?? []);
    setProdukList((produk as Produk[]) ?? []);
    setPlatformList((platform as Platform[]) ?? []);
    setPengaturanBayar((bayar as PengaturanPembayaran) ?? null);
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

  const platformMerchant = platformList.filter((p) => p.nama !== "Offline / Langsung");
  const platformOffline = platformList.find((p) => p.nama === "Offline / Langsung");
  const platformDipilih =
    orderInfo.tipe_order === "merchant"
      ? platformList.find((p) => p.id === orderInfo.platform_id)
      : null;

  function hppProduk(produkId: string) {
    const resep = resepByProduk[produkId] ?? [];
    return hitungHPP({ resep, pengaturan }).hppPerUnit;
  }

  // Kalau order lewat merchant (GoFood/ShopeeFood/GrabFood), harga dasar
  // WAJIB dinaikkan sesuai komisi platform -- ini yang kemarin belum
  // disesuaikan sehingga pembukuan tidak balance (harga tercatat sama
  // dengan offline padahal seharusnya lebih tinggi untuk menutup komisi).
  function hargaEfektifDasar(hargaDasar: number): number {
    if (platformDipilih && platformDipilih.komisi_persen > 0) {
      return hitungHargaPlatform(hargaDasar, platformDipilih.komisi_persen);
    }
    return hargaDasar;
  }

  function hargaSatuanCart(item: CartItem) {
    const hargaProdukEfektif = hargaEfektifDasar(item.produk.harga_jual);
    const hargaAddonEfektif = item.addons.reduce(
      (s, a) => s + hargaEfektifDasar(a.harga),
      0
    );
    return hargaProdukEfektif + hargaAddonEfektif;
  }

  const totalBelanja = useMemo(
    () => cart.reduce((sum, item) => sum + hargaSatuanCart(item) * item.qty, 0),
    [cart, platformDipilih]
  );

  const diskonDariNominal = Math.max(parseFloat(diskonNominalInput || "0"), 0);
  const diskonDariPersen =
    (Math.max(parseFloat(diskonPersenInput || "0"), 0) / 100) * totalBelanja;
  const diskonNominal = Math.min(diskonDariNominal + diskonDariPersen, totalBelanja);
  const totalSetelahDiskon = totalBelanja - diskonNominal;

  function hargaMenuTampil(produk: Produk) {
    return hargaEfektifDasar(produk.harga_jual);
  }

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

  function labelTipeOrderSaatIni(): string {
    if (orderInfo.tipe_order === "dinein") {
      return `Dine-in — Meja ${orderInfo.nomor_meja || "-"}`;
    }
    if (orderInfo.tipe_order === "takeaway") {
      return "Takeaway";
    }
    return `Merchant — ${platformDipilih?.nama ?? "-"}`;
  }

  async function handleBayar(dataCash?: { uangDiterima: number; kembalian: number }) {
    if (cart.length === 0) return;
    setProsesBayar(true);

    const platformId =
      orderInfo.tipe_order === "merchant"
        ? orderInfo.platform_id || null
        : platformOffline?.id ?? null;
    const komisiPersen =
      orderInfo.tipe_order === "merchant"
        ? platformList.find((p) => p.id === orderInfo.platform_id)?.komisi_persen ?? 0
        : 0;

    // Faktor prorata diskon -- supaya laporan HPP per item tetap akurat
    // walau ada diskon per transaksi (bukan per item).
    const faktorDiskon = totalBelanja > 0 ? totalSetelahDiskon / totalBelanja : 1;

    const { data: pesanan, error: errPesanan } = await supabase
      .from("pesanan")
      .insert({
        nama_pelanggan: orderInfo.nama_pelanggan || null,
        tipe_order: orderInfo.tipe_order,
        platform_id: platformId,
        nomor_meja: orderInfo.tipe_order === "dinein" ? orderInfo.nomor_meja : null,
        metode_bayar: metodeBayar,
        status: "sudah_bayar",
        total: totalSetelahDiskon,
        subtotal_sebelum_diskon: totalBelanja,
        diskon_nominal: diskonNominal,
        uang_diterima: dataCash?.uangDiterima ?? null,
        kembalian: dataCash?.kembalian ?? null,
        sumber: "kasir",
      })
      .select()
      .single();

    if (errPesanan || !pesanan) {
      showToast("Gagal menyimpan pesanan: " + errPesanan?.message, "error");
      setProsesBayar(false);
      return;
    }

    for (const item of cart) {
      const hpp = hppProduk(item.produk.id);
      const { data: pesananItem, error: errItem } = await supabase
        .from("pesanan_item")
        .insert({
          pesanan_id: pesanan.id,
          produk_id: item.produk.id,
          nama_produk_saat_itu: item.produk.nama,
          qty: item.qty,
          harga_saat_itu: hargaEfektifDasar(item.produk.harga_jual),
          hpp_saat_itu: hpp,
          catatan: item.catatan || null,
        })
        .select()
        .single();

      if (errItem || !pesananItem) continue;

      if (item.addons.length > 0) {
        await supabase.from("pesanan_item_addon").insert(
          item.addons.map((a) => ({
            pesanan_item_id: pesananItem.id,
            nama_addon_saat_itu: a.nama,
            harga_addon_saat_itu: a.harga,
          }))
        );
      }

      await supabase.from("transaksi_penjualan").insert({
        produk_id: item.produk.id,
        platform_id: platformId,
        pesanan_id: pesanan.id,
        qty: item.qty,
        harga_jual_saat_itu: hargaSatuanCart(item) * faktorDiskon,
        komisi_persen_saat_itu: komisiPersen,
        hpp_saat_itu: hpp,
        tanggal: new Date().toISOString().slice(0, 10),
      });

      // Otomatis kurangi stok bahan baku sesuai resep produk ini
      await kurangiStokUntukPenjualan(item.produk.id, item.qty);
    }

    setReceiptData({
      nomorNota: pesanan.nomor_urut,
      items: cart,
      total: totalSetelahDiskon,
      subtotalSebelumDiskon: totalBelanja,
      diskonNominal,
      metodeBayar,
      waktu: new Date().toLocaleString("id-ID"),
      namaPelanggan: orderInfo.nama_pelanggan || "Umum",
      tipeOrder: orderInfo.tipe_order,
      labelTipeOrder: labelTipeOrderSaatIni(),
      namaKasir,
      uangDiterima: dataCash?.uangDiterima ?? null,
      kembalian: dataCash?.kembalian ?? null,
    });
    setProsesBayar(false);
    setShowQrisPopup(false);
    setStep("receipt");
  }

  async function handleHubungkanPrinter() {
    setStatusPrinter("connecting");
    setPesanPrinter(null);
    try {
      const printer = await hubungkanPrinterBluetooth();
      setPrinterBt(printer);
      setStatusPrinter("connected");
      setPesanPrinter(`Terhubung ke "${printer.device.name ?? "printer"}"`);
    } catch (err: any) {
      setStatusPrinter("error");
      setPesanPrinter(err.message ?? "Gagal menghubungkan printer.");
    }
  }

  async function handleCetakBluetooth() {
    if (!printerBt || !receiptData) return;
    setStatusPrinter("printing");
    try {
      const bytes = await buildStrukBytes(
        {
          namaToko: pengaturanToko?.nama_toko ?? "Buku Kerja",
          logoUrl: pengaturanToko?.logo_url ?? null,
          waktu: receiptData.waktu,
          namaKasir: receiptData.namaKasir,
          namaPelanggan: receiptData.namaPelanggan,
          labelTipeOrder: receiptData.labelTipeOrder,
          total: receiptData.total,
          subtotalSebelumDiskon: receiptData.subtotalSebelumDiskon,
          diskonNominal: receiptData.diskonNominal,
          metodeBayar: receiptData.metodeBayar,
          uangDiterima: receiptData.uangDiterima,
          kembalian: receiptData.kembalian,
          items: receiptData.items.map((item) => ({
            nama: item.produk.nama,
            qty: item.qty,
            subtotal: hargaSatuanCart(item) * item.qty,
            addons: item.addons.map((a) => ({ nama: a.nama })),
          })),
        },
        formatRupiah
      );
      await kirimKePrinter(printerBt, bytes);
      setStatusPrinter("connected");
      setPesanPrinter("✓ Terkirim ke printer");
    } catch (err: any) {
      setStatusPrinter("error");
      setPesanPrinter("Gagal cetak: " + (err.message ?? "tidak diketahui"));
    }
  }

  async function handleCetakTiketBluetooth(jenis: "minuman" | "makanan") {
    if (!printerBt || !receiptData) return;
    setStatusPrinter("printing");
    try {
      const itemsJenisIni = receiptData.items.filter(
        (item) => jenisDariKategori(item.produk.kategori_id) === jenis
      );
      const bytes = buildTiketDapurBytes({
        jenis,
        nomorNota: receiptData.nomorNota,
        waktu: receiptData.waktu,
        namaPelanggan: receiptData.namaPelanggan,
        labelTipeOrder: receiptData.labelTipeOrder,
        items: itemsJenisIni.map((item) => ({
          nama: item.produk.nama,
          qty: item.qty,
          addons: item.addons.map((a) => ({ nama: a.nama })),
          catatan: item.catatan,
        })),
      });
      await kirimKePrinter(printerBt, bytes);
      setStatusPrinter("connected");
      setPesanPrinter(`✓ Tiket ${jenis} terkirim ke printer`);
    } catch (err: any) {
      setStatusPrinter("error");
      setPesanPrinter("Gagal cetak: " + (err.message ?? "tidak diketahui"));
    }
  }

  function cetakViaBrowser(mode: "customer" | "minuman" | "makanan") {
    setModeCetak(mode);
    // Kasih jeda sedikit supaya React sempat render ulang konten
    // #struk-cetak sesuai mode yang dipilih, baru panggil dialog print.
    setTimeout(() => window.print(), 100);
  }

  const adaItemMinuman = receiptData?.items.some(
    (item) => jenisDariKategori(item.produk.kategori_id) === "minuman"
  );
  const adaItemMakanan = receiptData?.items.some(
    (item) => jenisDariKategori(item.produk.kategori_id) === "makanan"
  );

  function pesananBaru() {
    setCart([]);
    setOrderInfo({ nama_pelanggan: "", tipe_order: "dinein", platform_id: "", nomor_meja: "" });
    setMetodeBayar("cash");
    setReceiptData(null);
    setShowQrisPopup(false);
    setShowCashPopup(false);
    setUangDiterima("");
    setDiskonNominalInput("");
    setDiskonPersenInput("");
    setCariMenu("");
    setModeCetak("customer");
    setStep("info");
  }

  function jenisDariKategori(kategoriId: string | null): "minuman" | "makanan" | null {
    if (!kategoriId) return null;
    return kategoriList.find((k) => k.id === kategoriId)?.jenis ?? null;
  }

  const kategoriUntukJenisAktif =
    jenisAktif === "semua" ? kategoriList : kategoriList.filter((k) => k.jenis === jenisAktif);

  const produkDitampilkan = produkList.filter((p) => {
    const jenisProduk = jenisDariKategori(p.kategori_id);
    const cocokJenis = jenisAktif === "semua" || jenisProduk === jenisAktif;
    const cocokKategori = kategoriAktif === "semua" || p.kategori_id === kategoriAktif;
    const cocokCari = p.nama.toLowerCase().includes(cariMenu.toLowerCase());
    return cocokJenis && cocokKategori && cocokCari;
  });

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
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-line bg-paper/80 sticky top-0 z-30 backdrop-blur-sm">
        <div>
          <p className="text-[9px] uppercase tracking-[0.25em] text-crema font-semibold">
            ☕ Kasir POS
          </p>
          <h1 className="font-display font-semibold text-lg text-ink">Buku Kerja</h1>
        </div>
        <div className="flex items-center gap-3">
          {step !== "info" && (
            <span className="text-xs text-ink/50 font-mono">
              🛒 {cart.length} item · {formatRupiah(totalBelanja)}
            </span>
          )}
          <Link
            href="/kasir/tutup-kasir"
            className="text-xs text-ink/50 hover:text-ledger hover:underline whitespace-nowrap"
          >
            📕 Tutup Kasir
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="p-4 md:p-6">
        {step === "info" && (
          <div className="max-w-md mx-auto">
            <div className="card p-6">
              <h2 className="font-display text-lg mb-4">Pesanan Baru</h2>
              <form onSubmit={handleMulaiPesanan} className="space-y-4">
                <div>
                  <label className="label-field">Nama Pelanggan (opsional)</label>
                  <input
                    className="input-field"
                    value={orderInfo.nama_pelanggan}
                    onChange={(e) =>
                      setOrderInfo({ ...orderInfo, nama_pelanggan: e.target.value })
                    }
                    placeholder="Contoh: Budi"
                  />
                </div>

                <div>
                  <label className="label-field">Tipe Order</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "dinein", label: "Dine-in" },
                      { key: "takeaway", label: "Takeaway" },
                      { key: "merchant", label: "Merchant" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() =>
                          setOrderInfo({ ...orderInfo, tipe_order: t.key as TipeOrder })
                        }
                        className={`px-2 py-2 rounded text-sm font-medium border transition-colors ${
                          orderInfo.tipe_order === t.key
                            ? "bg-ledger text-white border-ledger"
                            : "border-line text-ink/60"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {orderInfo.tipe_order === "dinein" && (
                  <div>
                    <label className="label-field">Nomor Meja</label>
                    <input
                      className="input-field"
                      value={orderInfo.nomor_meja}
                      onChange={(e) =>
                        setOrderInfo({ ...orderInfo, nomor_meja: e.target.value })
                      }
                      placeholder="Contoh: 5"
                      required
                    />
                  </div>
                )}

                {orderInfo.tipe_order === "merchant" && (
                  <div>
                    <label className="label-field">Pilih Merchant</label>
                    <div className="grid grid-cols-1 gap-2">
                      {platformMerchant.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setOrderInfo({ ...orderInfo, platform_id: p.id })}
                          className={`px-3 py-2 rounded text-sm font-medium border text-left transition-colors ${
                            orderInfo.platform_id === p.id
                              ? "bg-ledger text-white border-ledger"
                              : "border-line text-ink/60"
                          }`}
                        >
                          {p.nama}
                        </button>
                      ))}
                      {platformMerchant.length === 0 && (
                        <p className="text-xs text-rust">
                          Belum ada platform merchant diatur. Buka halaman Platform di
                          dashboard admin.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={orderInfo.tipe_order === "merchant" && !orderInfo.platform_id}
                  className="btn-primary w-full"
                >
                  Mulai Pesanan →
                </button>
              </form>
            </div>
          </div>
        )}

        {step === "menu" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {platformDipilih && (
                <div className="bg-crema/20 border border-crema rounded px-3 py-2 text-xs text-ink/70">
                  💡 Harga di menu sudah disesuaikan untuk{" "}
                  <b>{platformDipilih.nama}</b> (komisi {platformDipilih.komisi_persen}%)
                  — bukan harga offline biasa.
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "semua", label: "Semua" },
                  { key: "minuman", label: "🍹 Minuman" },
                  { key: "makanan", label: "🍽️ Makanan" },
                ].map((j) => (
                  <button
                    key={j.key}
                    onClick={() => {
                      setJenisAktif(j.key as typeof jenisAktif);
                      setKategoriAktif("semua");
                    }}
                    className={`px-3 py-2.5 rounded text-sm font-medium border transition-colors ${
                      jenisAktif === j.key
                        ? "bg-ledger text-white border-ledger"
                        : "border-line text-ink/60"
                    }`}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
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
                {kategoriUntukJenisAktif.map((k) => (
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
                      {formatRupiah(hargaMenuTampil(p))}
                    </p>
                  </button>
                ))}
                {produkDitampilkan.length === 0 && (
                  <p className="text-ink/50 text-sm col-span-full">
                    Belum ada produk di kategori ini.
                  </p>
                )}
              </div>
            </div>

            <div className="card p-4 h-fit lg:sticky lg:top-24">
              <h2 className="font-display text-base mb-3">Keranjang</h2>
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
                        {item.catatan && (
                          <p className="text-xs text-ink/40 italic">"{item.catatan}"</p>
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
                  <p className="text-ink/40 text-sm text-center py-6">Keranjang kosong</p>
                )}
              </div>

              <div className="border-t-2 border-ink/80 mt-3 pt-3 flex justify-between items-center">
                <span className="font-medium text-sm">Total</span>
                <span className="font-mono font-semibold text-lg text-ledger">
                  {formatRupiah(totalBelanja)}
                </span>
              </div>

              <button
                onClick={() => setStep("checkout")}
                disabled={cart.length === 0}
                className="btn-primary w-full mt-3"
              >
                Checkout
              </button>
              <button
                onClick={() => setStep("info")}
                className="text-xs text-ink/50 hover:underline w-full text-center mt-2"
              >
                ← Ubah info pesanan
              </button>
            </div>
          </div>
        )}

        {step === "checkout" && (
          <div className="max-w-md mx-auto">
            <div className="card p-6">
              <h2 className="font-display text-lg mb-4">Pembayaran</h2>

              <div className="mb-4">
                <label className="label-field">Diskon (opsional — boleh isi salah satu atau keduanya)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink/40">
                      Rp
                    </span>
                    <input
                      type="number"
                      className="input-field pl-8"
                      placeholder="0"
                      value={diskonNominalInput}
                      onChange={(e) => setDiskonNominalInput(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      className="input-field pr-8"
                      placeholder="0"
                      value={diskonPersenInput}
                      onChange={(e) => setDiskonPersenInput(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/40">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-ledger-dark/[0.04] rounded p-3 mb-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatRupiah(totalBelanja)}</span>
                </div>
                {diskonNominal > 0 && (
                  <div className="flex justify-between text-sm text-rust">
                    <span>
                      Diskon
                      {diskonDariNominal > 0 && diskonDariPersen > 0
                        ? ` (Rp + ${diskonPersenInput}%)`
                        : diskonDariPersen > 0
                        ? ` (${diskonPersenInput}%)`
                        : ""}
                    </span>
                    <span className="font-mono">-{formatRupiah(diskonNominal)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-line/60 pt-1 mt-1">
                  <span className="text-sm font-medium">Total Bayar</span>
                  <span className="font-mono text-xl font-semibold text-ledger">
                    {formatRupiah(totalSetelahDiskon)}
                  </span>
                </div>
              </div>

              <p className="label-field mb-2">Metode Pembayaran</p>
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => setMetodeBayar("cash")}
                  className={`w-full text-left px-3 py-2.5 rounded border text-sm font-medium ${
                    metodeBayar === "cash"
                      ? "bg-ledger text-white border-ledger"
                      : "border-line text-ink/70"
                  }`}
                >
                  💵 Cash / Tunai
                </button>
                <button
                  onClick={() => setMetodeBayar("qris_sendiri")}
                  disabled={!pengaturanBayar?.qris_sendiri_url}
                  className={`w-full text-left px-3 py-2.5 rounded border text-sm font-medium disabled:opacity-40 ${
                    metodeBayar === "qris_sendiri"
                      ? "bg-ledger text-white border-ledger"
                      : "border-line text-ink/70"
                  }`}
                >
                  📷 QRIS Sendiri{" "}
                  {!pengaturanBayar?.qris_sendiri_url && "(belum diatur admin)"}
                </button>
                <button
                  onClick={() => setMetodeBayar("qris_midtrans")}
                  disabled={!pengaturanBayar?.qris_midtrans_aktif}
                  className={`w-full text-left px-3 py-2.5 rounded border text-sm font-medium disabled:opacity-40 ${
                    metodeBayar === "qris_midtrans"
                      ? "bg-ledger text-white border-ledger"
                      : "border-line text-ink/70"
                  }`}
                >
                  🔗 QRIS Midtrans (Demo){" "}
                  {!pengaturanBayar?.qris_midtrans_aktif && "(nonaktif)"}
                </button>
              </div>

              <button
                onClick={() => {
                  if (metodeBayar === "cash") {
                    setUangDiterima("");
                    setShowCashPopup(true);
                  } else {
                    setShowQrisPopup(true);
                  }
                }}
                disabled={prosesBayar}
                className="btn-primary w-full"
              >
                {prosesBayar ? "Memproses..." : "Konfirmasi Pembayaran"}
              </button>
              <button
                onClick={() => setStep("menu")}
                className="text-xs text-ink/50 hover:underline w-full text-center mt-2"
              >
                ← Kembali ke menu
              </button>
            </div>
          </div>
        )}

        {step === "receipt" && receiptData && (
          <div className="max-w-sm mx-auto">
            <div id="struk-cetak" className="card p-6 font-mono text-sm">
              {modeCetak === "customer" && (
                <>
                  {/* HEADER */}
                  <div className="text-center mb-3">
                    {pengaturanToko?.logo_url ? (
                      <img
                        src={pengaturanToko.logo_url}
                        alt={pengaturanToko?.nama_toko ?? "Logo"}
                        className="w-20 h-20 object-contain mx-auto mb-1"
                      />
                    ) : (
                      <p className="font-display font-semibold text-base">
                        {pengaturanToko?.nama_toko ?? "Buku Kerja"}
                      </p>
                    )}
                    <p className="text-xs text-ink/50">Struk Pembayaran</p>
                  </div>
                  <div className="border-t border-dashed border-ink/40 my-2" />
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-ink/50 shrink-0">Waktu</span>
                      <span className="text-right">{receiptData.waktu}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-ink/50 shrink-0">Kasir</span>
                      <span className="text-right">{receiptData.namaKasir}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-ink/50 shrink-0">Pelanggan</span>
                      <span className="text-right break-words">{receiptData.namaPelanggan}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-ink/50 shrink-0">Tipe Order</span>
                      <span className="text-right">{receiptData.labelTipeOrder}</span>
                    </div>
                  </div>

                  {/* ITEM */}
                  <div className="border-t border-dashed border-ink/40 my-3" />
                  {receiptData.items.map((item) => (
                    <div key={item.key} className="mb-2.5">
                      <div className="flex justify-between gap-2">
                        <span className="break-words">
                          {item.qty}x {item.produk.nama}
                        </span>
                        <span className="shrink-0">
                          {formatRupiah(hargaSatuanCart(item) * item.qty)}
                        </span>
                      </div>
                      {item.addons.map((a) => (
                        <p key={a.id} className="text-xs text-ink/50 pl-3">
                          + {a.nama}
                        </p>
                      ))}
                      {item.catatan && (
                        <p className="text-xs text-ink/40 pl-3 italic">"{item.catatan}"</p>
                      )}
                    </div>
                  ))}

                  {/* TOTAL & PEMBAYARAN */}
                  <div className="border-t border-dashed border-ink/40 my-3" />
                  {receiptData.diskonNominal > 0 && (
                    <div className="text-xs space-y-0.5 mb-2">
                      <div className="flex justify-between">
                        <span className="text-ink/50">Subtotal</span>
                        <span>{formatRupiah(receiptData.subtotalSebelumDiskon)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink/50">Diskon</span>
                        <span>-{formatRupiah(receiptData.diskonNominal)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base pt-1">
                    <span>TOTAL</span>
                    <span>{formatRupiah(receiptData.total)}</span>
                  </div>
                  <div className="text-xs mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-ink/50">Metode Bayar</span>
                      <span>
                        {receiptData.metodeBayar === "cash"
                          ? "Cash / Tunai"
                          : receiptData.metodeBayar === "qris_sendiri"
                          ? "QRIS"
                          : "QRIS (Demo)"}
                      </span>
                    </div>
                    {receiptData.metodeBayar === "cash" && receiptData.uangDiterima !== null && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-ink/50">Uang Diterima</span>
                          <span>{formatRupiah(receiptData.uangDiterima)}</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-1">
                          <span>Kembalian</span>
                          <span>{formatRupiah(receiptData.kembalian ?? 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* FOOTER */}
                  <div className="border-t border-dashed border-ink/40 my-3" />
                  <div className="text-center pt-1">
                    <p className="text-xs text-ink/40">Terima kasih! ☕</p>
                    <p className="text-xs text-ink/40 mt-0.5">Sampai jumpa lagi</p>
                  </div>
                </>
              )}

              {(modeCetak === "minuman" || modeCetak === "makanan") && (
                <>
                  <div className="text-center mb-3">
                    <p className="font-display font-semibold text-lg">
                      {modeCetak === "minuman" ? "🍹 TIKET MINUMAN" : "🍽️ TIKET MAKANAN"}
                    </p>
                    <p className="text-xs text-ink/50">Bukan struk pembayaran</p>
                  </div>
                  <div className="border-t border-dashed border-ink/40 my-2" />
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-ink/50 shrink-0">Waktu</span>
                      <span className="text-right">{receiptData.waktu}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-ink/50 shrink-0">Pelanggan</span>
                      <span className="text-right break-words">{receiptData.namaPelanggan}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-ink/50 shrink-0">Tipe Order</span>
                      <span className="text-right">{receiptData.labelTipeOrder}</span>
                    </div>
                  </div>
                  <div className="border-t border-dashed border-ink/40 my-3" />
                  {receiptData.items
                    .filter((item) => jenisDariKategori(item.produk.kategori_id) === modeCetak)
                    .map((item) => (
                      <div key={item.key} className="mb-3">
                        <p className="font-semibold text-base break-words">
                          {item.qty}x {item.produk.nama}
                        </p>
                        {item.addons.map((a) => (
                          <p key={a.id} className="text-xs text-ink/60 pl-3">
                            + {a.nama}
                          </p>
                        ))}
                        {item.catatan && (
                          <p className="text-xs text-ink/50 pl-3 italic">"{item.catatan}"</p>
                        )}
                      </div>
                    ))}
                  <div className="border-t border-dashed border-ink/40 my-3" />
                  <p className="text-center text-xs text-ink/40">
                    #{String(receiptData.nomorNota).padStart(4, "0")}
                  </p>
                </>
              )}
            </div>
            <div className="print:hidden">
              {/* Jalur Bluetooth langsung -- cuma muncul kalau browser support */}
              {bluetoothTersedia() && (
                <div className="card p-3 mt-4">
                  <p className="text-xs text-ink/50 mb-2">
                    🔵 Printer Bluetooth (langsung, tanpa dialog print)
                  </p>
                  {!printerBt ? (
                    <button
                      onClick={handleHubungkanPrinter}
                      disabled={statusPrinter === "connecting"}
                      className="btn-secondary w-full"
                    >
                      {statusPrinter === "connecting"
                        ? "Menghubungkan..."
                        : "🔵 Hubungkan Printer"}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleCetakBluetooth}
                        disabled={statusPrinter === "printing"}
                        className="btn-primary w-full"
                      >
                        {statusPrinter === "printing"
                          ? "Mencetak..."
                          : "🖨️ Cetak Struk Customer"}
                      </button>
                      {adaItemMinuman && (
                        <button
                          onClick={() => handleCetakTiketBluetooth("minuman")}
                          disabled={statusPrinter === "printing"}
                          className="btn-secondary w-full"
                        >
                          🍹 Cetak Tiket Minuman
                        </button>
                      )}
                      {adaItemMakanan && (
                        <button
                          onClick={() => handleCetakTiketBluetooth("makanan")}
                          disabled={statusPrinter === "printing"}
                          className="btn-secondary w-full"
                        >
                          🍽️ Cetak Tiket Makanan
                        </button>
                      )}
                    </div>
                  )}
                  {pesanPrinter && (
                    <p
                      className={`text-xs mt-2 ${
                        statusPrinter === "error" ? "text-rust" : "text-ledger"
                      }`}
                    >
                      {pesanPrinter}
                    </p>
                  )}
                </div>
              )}

              {/* Jalur fallback -- selalu ada, jalan di semua device termasuk iPad */}
              <div className="space-y-2 mt-3">
                <button
                  onClick={() => cetakViaBrowser("customer")}
                  className="btn-secondary w-full"
                >
                  🖨️ Cetak Struk Customer {bluetoothTersedia() ? "(cadangan)" : ""}
                </button>
                {adaItemMinuman && (
                  <button
                    onClick={() => cetakViaBrowser("minuman")}
                    className="btn-secondary w-full"
                  >
                    🍹 Cetak Tiket Minuman (Browser)
                  </button>
                )}
                {adaItemMakanan && (
                  <button
                    onClick={() => cetakViaBrowser("makanan")}
                    className="btn-secondary w-full"
                  >
                    🍽️ Cetak Tiket Makanan (Browser)
                  </button>
                )}
              </div>
              {!bluetoothTersedia() && (
                <p className="text-xs text-ink/40 text-center mt-1">
                  Perangkat ini pakai printer via app print service (misal AirPrint /
                  RawBT) lewat dialog print di atas.
                </p>
              )}

              <button onClick={pesananBaru} className="btn-primary w-full mt-3">
                + Pesanan Baru
              </button>
            </div>
          </div>
        )}

        {popupProduk && (
          <div
            className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4"
            onClick={() => setPopupProduk(null)}
          >
            <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display text-base mb-1">{popupProduk.nama}</h3>
              <p className="font-mono text-ledger font-semibold mb-4">
                {formatRupiah(hargaMenuTampil(popupProduk))}
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
                        <span className="font-mono text-ink/50">
                          +{formatRupiah(hargaEfektifDasar(a.harga))}
                        </span>
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

              <div className="mb-4">
                <label className="label-field">Catatan (opsional)</label>
                <input
                  className="input-field"
                  placeholder="Contoh: less sugar"
                  value={popupCatatan}
                  onChange={(e) => setPopupCatatan(e.target.value)}
                />
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

        {/* Popup Cash -- input uang diterima & hitung kembalian */}
        {showCashPopup && (
          <div
            className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4"
            onClick={() => !prosesBayar && setShowCashPopup(false)}
          >
            <div
              className="card p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-lg mb-4 text-center">💵 Pembayaran Cash</h3>

              <div className="bg-ledger-dark/[0.05] rounded p-3 mb-4 flex justify-between items-center">
                <span className="text-sm">Total Belanja</span>
                <span className="font-mono text-xl font-semibold text-ledger">
                  {formatRupiah(totalSetelahDiskon)}
                </span>
              </div>

              <label className="label-field">Uang Diterima dari Customer</label>
              <input
                type="number"
                className="input-field text-lg font-mono"
                placeholder="0"
                value={uangDiterima}
                onChange={(e) => setUangDiterima(e.target.value)}
                autoFocus
              />

              {/* Tombol pecahan cepat */}
              <div className="flex flex-wrap gap-2 mt-2 mb-4">
                {[totalSetelahDiskon, 20000, 50000, 100000, 150000, 200000]
                  .filter((n, i, arr) => arr.indexOf(n) === i)
                  .sort((a, b) => a - b)
                  .map((nominal) => (
                    <button
                      key={nominal}
                      type="button"
                      onClick={() => setUangDiterima(String(nominal))}
                      className="px-2.5 py-1 text-xs border border-line rounded text-ink/60 hover:border-ledger hover:text-ledger"
                    >
                      {nominal === totalSetelahDiskon ? "Uang Pas" : formatRupiah(nominal)}
                    </button>
                  ))}
              </div>

              {(() => {
                const diterima = parseFloat(uangDiterima || "0");
                const kembalian = diterima - totalSetelahDiskon;
                const cukup = diterima >= totalSetelahDiskon && diterima > 0;
                return (
                  <>
                    <div
                      className={`rounded p-3 mb-4 flex justify-between items-center ${
                        cukup ? "bg-ledger-dark/[0.05]" : "bg-rust/10"
                      }`}
                    >
                      <span className="text-sm">
                        {diterima > 0 && diterima < totalSetelahDiskon
                          ? "Uang kurang"
                          : "Kembalian"}
                      </span>
                      <span
                        className={`font-mono text-xl font-semibold ${
                          cukup ? "text-ledger" : "text-rust"
                        }`}
                      >
                        {formatRupiah(Math.abs(kembalian))}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCashPopup(false)}
                        disabled={prosesBayar}
                        className="btn-secondary flex-1"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => {
                          setShowCashPopup(false);
                          handleBayar({ uangDiterima: diterima, kembalian });
                        }}
                        disabled={!cukup || prosesBayar}
                        className="btn-primary flex-1"
                      >
                        {prosesBayar ? "Memproses..." : "✓ Konfirmasi"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Popup QRIS -- muncul besar & jelas saat metode bayar QRIS dipilih */}
        {showQrisPopup && (
          <div
            className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4"
            onClick={() => !prosesBayar && setShowQrisPopup(false)}
          >
            <div
              className="card p-6 w-full max-w-sm text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {metodeBayar === "qris_sendiri" && pengaturanBayar?.qris_sendiri_url && (
                <>
                  <h3 className="font-display text-lg mb-1">Scan QRIS untuk Bayar</h3>
                  <p className="font-mono text-2xl font-semibold text-ledger mb-4">
                    {formatRupiah(totalSetelahDiskon)}
                  </p>
                  <img
                    src={pengaturanBayar.qris_sendiri_url}
                    alt="QRIS"
                    className="w-64 h-64 object-contain mx-auto border-2 border-ledger rounded-lg bg-white p-3"
                  />
                  <p className="text-xs text-ink/50 mt-4">
                    Tunjukkan layar ini ke pelanggan untuk di-scan.
                    <br />
                    Tekan tombol di bawah setelah pembayaran diterima.
                  </p>
                </>
              )}

              {metodeBayar === "qris_midtrans" && (
                <>
                  <h3 className="font-display text-lg mb-1">🧪 QRIS Midtrans (Demo)</h3>
                  <p className="font-mono text-2xl font-semibold text-ledger mb-4">
                    {formatRupiah(totalSetelahDiskon)}
                  </p>
                  <div className="border-2 border-dashed border-line rounded-lg p-10 mb-2">
                    <p className="text-sm text-ink/50">
                      Belum terhubung ke Midtrans sungguhan.
                      <br />
                      Ini cuma simulasi tampilan pembayaran.
                    </p>
                  </div>
                  <p className="text-xs text-ink/50">
                    Tekan tombol di bawah untuk menganggap pembayaran ini "berhasil"
                    (demo).
                  </p>
                </>
              )}

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowQrisPopup(false)}
                  disabled={prosesBayar}
                  className="btn-secondary flex-1"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleBayar()}
                  disabled={prosesBayar}
                  className="btn-primary flex-1"
                >
                  {prosesBayar ? "Memproses..." : "✓ Pembayaran Diterima"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
