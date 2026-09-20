-- ============================================================
-- RESET DATA: Hapus BENAR-BENAR SEMUA data (0 baris di semua tabel)
-- Jalankan di Supabase SQL Editor
-- ============================================================

truncate table
  resep_produk,
  transaksi_penjualan,
  produksi,
  kas_umum,
  bahan_baku,
  produk,
  platform,
  pengaturan
restart identity cascade;

-- ⚠️ PENTING: tabel `pengaturan` didesain harus selalu punya 1 baris
-- (dipakai aplikasi untuk hitung overhead). Kalau tabel ini benar-benar
-- kosong, halaman Produk/Produksi/Laporan bisa error saat load data.
-- Kalau nanti muncul error itu, jalankan baris di bawah ini SATU KALI
-- untuk mengembalikan 1 baris kosong (angkanya tetap 0, bukan data):
--
-- insert into pengaturan (id, biaya_operasional_bulanan, estimasi_unit_bulanan)
-- values (true, 0, 1);
