export type BahanBaku = {
  id: string;
  nama: string;
  satuan: string;
  harga_per_satuan: number;
  stok: number;
  created_at: string;
};

export type Produk = {
  id: string;
  nama: string;
  harga_jual: number;
  target_margin_persen: number;
  kategori_id: string | null;
  created_at: string;
};

export type JenisKategori = "minuman" | "makanan";

export type KategoriMenu = {
  id: string;
  nama: string;
  urutan: number;
  jenis: JenisKategori;
};

export type Addon = {
  id: string;
  nama: string;
  harga: number;
};

export type ProdukAddon = {
  id: string;
  produk_id: string;
  addon_id: string;
  addon?: Addon;
};

export type PengaturanToko = {
  id: boolean;
  nama_toko: string;
  logo_url: string | null;
};

export type PengaturanPembayaran = {
  id: boolean;
  qris_sendiri_url: string | null;
  qris_midtrans_aktif: boolean;
};

export type TipeOrder = "dinein" | "takeaway" | "merchant";
export type MetodeBayar = "cash" | "qris_sendiri" | "qris_midtrans" | "qris_doku";
export type StatusPesanan = "belum_bayar" | "sudah_bayar" | "batal";

export type Pesanan = {
  id: string;
  nomor_urut: number;
  nama_pelanggan: string | null;
  tipe_order: TipeOrder;
  platform_id: string | null;
  nomor_meja: string | null;
  metode_bayar: MetodeBayar | null;
  status: StatusPesanan;
  total: number;
  uang_diterima: number | null;
  kembalian: number | null;
  alasan_batal: string | null;
  dibatalkan_oleh: string | null;
  dibatalkan_pada: string | null;
  diskon_nominal: number;
  subtotal_sebelum_diskon: number | null;
  sumber: "kasir" | "self_service";
  created_at: string;
  platform?: Platform;
};

export type TutupKasir = {
  id: string;
  kasir_nama: string;
  waktu_mulai: string;
  waktu_tutup: string;
  total_cash: number;
  total_qris: number;
  total_semua: number;
  jumlah_transaksi: number;
  catatan: string | null;
};

export type PesananItemAddon = {
  id: string;
  pesanan_item_id: string;
  nama_addon_saat_itu: string;
  harga_addon_saat_itu: number;
};

export type PesananItem = {
  id: string;
  pesanan_id: string;
  produk_id: string;
  nama_produk_saat_itu: string;
  qty: number;
  harga_saat_itu: number;
  hpp_saat_itu: number;
  catatan: string | null;
  addons?: PesananItemAddon[];
};

export type ResepProduk = {
  id: string;
  produk_id: string;
  bahan_baku_id: string;
  qty: number;
  bahan_baku?: BahanBaku;
};

export type Pengaturan = {
  id: boolean;
  biaya_operasional_bulanan: number;
  estimasi_unit_bulanan: number;
};

export type Produksi = {
  id: string;
  produk_id: string;
  jumlah_diproduksi: number;
  biaya_tenaga_kerja: number;
  tanggal: string;
  catatan: string | null;
};

export type Platform = {
  id: string;
  nama: string;
  komisi_persen: number;
  urutan: number;
};

export type TransaksiPenjualan = {
  id: string;
  produk_id: string;
  platform_id: string | null;
  pesanan_id: string | null;
  qty: number;
  harga_jual_saat_itu: number;
  komisi_persen_saat_itu: number;
  hpp_saat_itu: number;
  dibatalkan: boolean;
  tanggal: string;
  catatan: string | null;
  produk?: Produk;
  platform?: Platform;
};

export type KasUmum = {
  id: string;
  tipe: "masuk" | "keluar";
  kategori: string;
  jumlah: number;
  keterangan: string | null;
  tanggal: string;
};
