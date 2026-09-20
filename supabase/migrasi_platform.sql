-- ============================================================
-- MIGRASI: Fitur Platform (GoFood/ShopeeFood/GrabFood/Offline)
-- Jalankan file ini di SQL Editor -- TIDAK menghapus data lama kamu.
-- ============================================================

-- 1. Tabel PLATFORM -- daftar channel jualan + komisi masing-masing
create table if not exists platform (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  komisi_persen numeric(5,2) not null default 0,
  urutan int not null default 0,
  created_at timestamptz not null default now()
);

-- Seed 4 platform default (aman dijalankan berkali-kali, tidak akan dobel)
insert into platform (nama, komisi_persen, urutan)
values
  ('Offline / Langsung', 0, 1),
  ('GoFood', 0, 2),
  ('ShopeeFood', 0, 3),
  ('GrabFood', 0, 4)
on conflict (nama) do nothing;

-- 2. Tambah kolom platform_id & snapshot komisi ke transaksi_penjualan
alter table transaksi_penjualan
  add column if not exists platform_id uuid references platform(id);

alter table transaksi_penjualan
  add column if not exists komisi_persen_saat_itu numeric(5,2) not null default 0;

-- 3. RLS untuk tabel platform
alter table platform enable row level security;

drop policy if exists "allow all - platform" on platform;
create policy "allow all - platform" on platform for all using (true) with check (true);

-- 4. Index bantu
create index if not exists idx_transaksi_platform_id on transaksi_penjualan(platform_id);
