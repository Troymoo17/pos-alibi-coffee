-- ============================================================
-- MIGRASI: Jenis Kategori (Minuman/Makanan) untuk split struk dapur
-- Aman dijalankan berkali-kali, tidak hapus data lama.
-- ============================================================

alter table kategori_menu add column if not exists jenis text not null default 'makanan'
  check (jenis in ('minuman', 'makanan'));
