-- ============================================================
-- MIGRASI: Void/Audit Trail, Diskon, Tutup Kasir, Self-Service
-- Aman dijalankan berkali-kali, tidak hapus data lama.
-- ============================================================

-- 1. Kolom audit trail pembatalan + diskon di PESANAN
alter table pesanan add column if not exists alasan_batal text;
alter table pesanan add column if not exists dibatalkan_oleh text;
alter table pesanan add column if not exists dibatalkan_pada timestamptz;
alter table pesanan add column if not exists diskon_nominal numeric(14,2) not null default 0;
alter table pesanan add column if not exists subtotal_sebelum_diskon numeric(14,2);
alter table pesanan add column if not exists sumber text not null default 'kasir'
  check (sumber in ('kasir', 'self_service'));

-- 2. Kolom void di TRANSAKSI_PENJUALAN (supaya laporan HPP bisa exclude
--    transaksi yang dibatalkan, tanpa perlu hapus datanya -- audit trail)
alter table transaksi_penjualan add column if not exists dibatalkan boolean not null default false;

-- 3. TUTUP KASIR / SHIFT -- rekap kas per shift
create table if not exists tutup_kasir (
  id uuid primary key default gen_random_uuid(),
  kasir_nama text not null,
  waktu_mulai timestamptz not null,
  waktu_tutup timestamptz not null default now(),
  total_cash numeric(14,2) not null default 0,
  total_qris numeric(14,2) not null default 0,
  total_semua numeric(14,2) not null default 0,
  jumlah_transaksi int not null default 0,
  catatan text,
  created_at timestamptz not null default now()
);

alter table tutup_kasir enable row level security;
drop policy if exists "allow all - tutup_kasir" on tutup_kasir;
create policy "allow all - tutup_kasir" on tutup_kasir for all using (true) with check (true);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_transaksi_dibatalkan on transaksi_penjualan(dibatalkan);
create index if not exists idx_pesanan_status2 on pesanan(status, created_at);
create index if not exists idx_tutup_kasir_waktu on tutup_kasir(waktu_tutup);
