-- ============================================================
-- MIGRASI: Integrasi Payment Gateway DOKU
-- Aman dijalankan berkali-kali, tidak hapus data lama.
-- ============================================================

alter table pesanan add column if not exists doku_reference_no text;
create index if not exists idx_pesanan_doku_ref on pesanan(doku_reference_no);

-- Izinkan value baru "qris_doku" di kolom metode_bayar
alter table pesanan drop constraint if exists pesanan_metode_bayar_check;
alter table pesanan add constraint pesanan_metode_bayar_check
  check (metode_bayar in ('cash', 'qris_sendiri', 'qris_midtrans', 'qris_doku'));
