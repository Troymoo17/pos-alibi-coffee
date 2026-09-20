-- ============================================================
-- SCHEMA: Aplikasi HPP & Pembukuan (versi simpel)
-- Jalankan file ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- RESET: hapus semua tabel lama dulu. Hapus blok ini kalau kamu
-- TIDAK mau reset data yang sudah ada.
drop table if exists resep_produk cascade;
drop table if exists transaksi_penjualan cascade;
drop table if exists produksi cascade;
drop table if exists kas_umum cascade;
drop table if exists biaya_overhead cascade;
drop table if exists pengaturan cascade;
drop table if exists platform cascade;
drop table if exists produk cascade;
drop table if exists bahan_baku cascade;

-- 1. BAHAN BAKU
-- satuan selalu disimpan dalam satuan TERKECIL (gram/ml/pcs) walau kamu
-- input pembelian dalam kg/liter di form -- konversi terjadi otomatis di
-- aplikasi, bukan di database.
create table if not exists bahan_baku (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  satuan text not null,              -- gram, ml, atau pcs
  harga_per_satuan numeric(14,4) not null default 0,
  stok numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- 2. PRODUK
create table if not exists produk (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  harga_jual numeric(14,2) not null default 0,
  target_margin_persen numeric(5,2) not null default 30,
  created_at timestamptz not null default now()
);

-- 3. RESEP PRODUK
create table if not exists resep_produk (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  bahan_baku_id uuid not null references bahan_baku(id) on delete cascade,
  qty numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);

-- 4. PENGATURAN (single row) -- pengganti tabel biaya_overhead yang lama.
-- Cukup 1 angka biaya operasional bulanan + 1 angka estimasi total produksi
-- semua produk per bulan. Overhead per unit = biaya_operasional_bulanan
-- dibagi estimasi_unit_bulanan, berlaku sama untuk semua produk.
create table if not exists pengaturan (
  id boolean primary key default true,
  biaya_operasional_bulanan numeric(14,2) not null default 0,
  estimasi_unit_bulanan numeric(14,2) not null default 1,
  constraint pengaturan_singleton check (id)
);
insert into pengaturan (id) values (true) on conflict (id) do nothing;

-- 5. PRODUKSI (batch produksi & tenaga kerja langsung, opsional)
create table if not exists produksi (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  jumlah_diproduksi numeric(14,2) not null default 0,
  biaya_tenaga_kerja numeric(14,2) not null default 0,
  tanggal date not null default current_date,
  catatan text,
  created_at timestamptz not null default now()
);

-- 6. PLATFORM -- daftar channel jualan + komisi masing-masing
create table if not exists platform (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  komisi_persen numeric(5,2) not null default 0,
  urutan int not null default 0,
  created_at timestamptz not null default now()
);
insert into platform (nama, komisi_persen, urutan)
values
  ('Offline / Langsung', 0, 1),
  ('GoFood', 0, 2),
  ('ShopeeFood', 0, 3),
  ('GrabFood', 0, 4)
on conflict (nama) do nothing;

-- 7. TRANSAKSI PENJUALAN
create table if not exists transaksi_penjualan (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  platform_id uuid references platform(id),
  qty numeric(14,2) not null default 0,
  harga_jual_saat_itu numeric(14,2) not null default 0,
  komisi_persen_saat_itu numeric(5,2) not null default 0,
  hpp_saat_itu numeric(14,2) not null default 0,
  tanggal date not null default current_date,
  catatan text,
  created_at timestamptz not null default now()
);

-- 8. BUKU KAS UMUM
create table if not exists kas_umum (
  id uuid primary key default gen_random_uuid(),
  tipe text not null check (tipe in ('masuk', 'keluar')),
  kategori text not null,
  jumlah numeric(14,2) not null default 0,
  keterangan text,
  tanggal date not null default current_date,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_resep_produk_id on resep_produk(produk_id);
create index if not exists idx_produksi_produk_id on produksi(produk_id);
create index if not exists idx_transaksi_produk_id on transaksi_penjualan(produk_id);
create index if not exists idx_transaksi_tanggal on transaksi_penjualan(tanggal);
create index if not exists idx_kas_tanggal on kas_umum(tanggal);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table bahan_baku enable row level security;
alter table produk enable row level security;
alter table resep_produk enable row level security;
alter table pengaturan enable row level security;
alter table produksi enable row level security;
alter table platform enable row level security;
alter table transaksi_penjualan enable row level security;
alter table kas_umum enable row level security;

create policy "allow all - bahan_baku" on bahan_baku for all using (true) with check (true);
create policy "allow all - produk" on produk for all using (true) with check (true);
create policy "allow all - resep_produk" on resep_produk for all using (true) with check (true);
create policy "allow all - pengaturan" on pengaturan for all using (true) with check (true);
create policy "allow all - produksi" on produksi for all using (true) with check (true);
create policy "allow all - platform" on platform for all using (true) with check (true);
create policy "allow all - transaksi_penjualan" on transaksi_penjualan for all using (true) with check (true);
create policy "allow all - kas_umum" on kas_umum for all using (true) with check (true);
