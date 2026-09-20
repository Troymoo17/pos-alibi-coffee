-- ============================================================
-- MIGRASI TAMBAHAN: kolom uang diterima & kembalian untuk cash
-- Jalankan ini KALAU kamu sudah pernah menjalankan migrasi_pos.sql
-- sebelumnya. Aman dijalankan berkali-kali.
-- ============================================================

alter table pesanan add column if not exists uang_diterima numeric(14,2);
alter table pesanan add column if not exists kembalian numeric(14,2);
