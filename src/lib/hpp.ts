import { BahanBaku, Pengaturan, ResepProduk } from "./types";

// ============================================================
// KONVERSI SATUAN
// Bahan baku selalu disimpan dalam satuan terkecil (gram/ml/pcs) di
// database. User boleh input pembelian dalam satuan yang lebih besar
// (kg/liter) di form, lalu dikonversi otomatis di sini.
// ============================================================
export type SatuanBeli = "gram" | "kg" | "ml" | "liter" | "pcs";

export const SATUAN_OPTIONS: { value: SatuanBeli; label: string }[] = [
  { value: "gram", label: "Gram (g)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ml", label: "Mililiter (ml)" },
  { value: "liter", label: "Liter (L)" },
  { value: "pcs", label: "Pcs / Buah" },
];

// Satuan terkecil yang dipakai untuk menyimpan harga per satuan di DB.
export function satuanTerkecil(satuanBeli: SatuanBeli): "gram" | "ml" | "pcs" {
  if (satuanBeli === "kg") return "gram";
  if (satuanBeli === "liter") return "ml";
  return satuanBeli as "gram" | "ml" | "pcs";
}

// Faktor pengali untuk mengonversi angka yang diketik user (dalam satuan
// beli) ke satuan terkecil. Misal user pilih "kg" dan ketik 3 -> 3 * 1000 = 3000 gram.
export function faktorKonversi(satuanBeli: SatuanBeli): number {
  if (satuanBeli === "kg") return 1000;
  if (satuanBeli === "liter") return 1000;
  return 1;
}

/**
 * Menghitung biaya bahan baku langsung per 1 unit produk,
 * berdasarkan resep (qty bahan baku x harga per satuan terkecil).
 */
export function hitungBiayaBahanBaku(
  resep: (ResepProduk & { bahan_baku?: BahanBaku })[]
): number {
  return resep.reduce((total, item) => {
    const harga = item.bahan_baku?.harga_per_satuan ?? 0;
    return total + item.qty * harga;
  }, 0);
}

/**
 * Menghitung alokasi overhead per unit dengan cara paling simpel:
 * total biaya operasional bulanan dibagi rata dengan estimasi total
 * unit produksi semua produk per bulan. Berlaku sama untuk semua produk.
 */
export function hitungOverheadPerUnit(pengaturan: Pengaturan | null): number {
  if (!pengaturan || !pengaturan.estimasi_unit_bulanan) return 0;
  return pengaturan.biaya_operasional_bulanan / pengaturan.estimasi_unit_bulanan;
}

/**
 * Menghitung tenaga kerja langsung per unit dari satu batch produksi.
 */
export function hitungTenagaKerjaPerUnit(
  biayaTenagaKerja: number,
  jumlahDiproduksi: number
): number {
  if (!jumlahDiproduksi) return 0;
  return biayaTenagaKerja / jumlahDiproduksi;
}

export type RincianHPP = {
  biayaBahanBaku: number;
  overheadPerUnit: number;
  tenagaKerjaPerUnit: number;
  hppPerUnit: number;
};

/**
 * Menggabungkan semua komponen jadi HPP per unit.
 * HPP = Bahan Baku Langsung + Tenaga Kerja Langsung + Overhead
 */
export function hitungHPP(params: {
  resep: (ResepProduk & { bahan_baku?: BahanBaku })[];
  pengaturan: Pengaturan | null;
  biayaTenagaKerja?: number;
  jumlahDiproduksi?: number;
}): RincianHPP {
  const biayaBahanBaku = hitungBiayaBahanBaku(params.resep);
  const overheadPerUnit = hitungOverheadPerUnit(params.pengaturan);
  const tenagaKerjaPerUnit = hitungTenagaKerjaPerUnit(
    params.biayaTenagaKerja ?? 0,
    params.jumlahDiproduksi ?? 0
  );

  return {
    biayaBahanBaku,
    overheadPerUnit,
    tenagaKerjaPerUnit,
    hppPerUnit: biayaBahanBaku + overheadPerUnit + tenagaKerjaPerUnit,
  };
}

/**
 * Menghitung harga jual yang disarankan berdasarkan HPP dan target margin.
 * Margin dihitung sebagai persentase dari HARGA JUAL (bukan dari HPP).
 * Rumus: Harga Jual = HPP / (1 - margin%)
 */
export function hitungHargaJualDisarankan(
  hppPerUnit: number,
  targetMarginPersen: number
): number {
  const margin = Math.min(Math.max(targetMarginPersen, 0), 95) / 100;
  if (margin >= 1) return hppPerUnit;
  return hppPerUnit / (1 - margin);
}

/**
 * Membulatkan angka ke kelipatan terdekat (misal 500 atau 1000).
 * Selalu dibulatkan KE ATAS supaya harga jual tidak lebih rendah dari
 * yang seharusnya (aman untuk margin kamu).
 */
export function bulatkanKeAtas(angka: number, kelipatan: number = 500): number {
  if (kelipatan <= 0) return Math.round(angka);
  return Math.ceil(angka / kelipatan) * kelipatan;
}

/**
 * Menghitung harga yang harus dipasang di suatu platform (GoFood/ShopeeFood/
 * GrabFood/dll) supaya setelah dipotong komisi platform, kamu tetap
 * menerima sejumlah "harga dasar" (harga offline/harga normal produk).
 *
 * Rumus: Harga di Platform = Harga Dasar / (1 - komisi%)
 * Hasilnya dibulatkan ke atas ke kelipatan Rp500 supaya rapi.
 */
export function hitungHargaPlatform(
  hargaDasar: number,
  komisiPersen: number,
  bulatkanKe: number = 500
): number {
  const komisi = Math.min(Math.max(komisiPersen, 0), 90) / 100;
  if (komisi >= 1) return hargaDasar;
  const hargaMentah = hargaDasar / (1 - komisi);
  return bulatkanKeAtas(hargaMentah, bulatkanKe);
}

/**
 * Menghitung pendapatan bersih yang benar-benar diterima dari 1 transaksi
 * setelah dipotong komisi platform.
 */
export function hitungPendapatanBersih(
  hargaJualKotor: number,
  komisiPersen: number
): number {
  const komisi = Math.min(Math.max(komisiPersen, 0), 90) / 100;
  return hargaJualKotor * (1 - komisi);
}

export function formatRupiah(angka: number): string {
  const nilai = angka || 0;
  const perluDesimal = Math.abs(nilai) > 0 && Math.abs(nilai) < 1;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: perluDesimal ? 2 : 0,
    maximumFractionDigits: perluDesimal ? 4 : 0,
  }).format(nilai);
}
