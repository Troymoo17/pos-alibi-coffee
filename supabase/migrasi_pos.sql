-- ============================================================
-- MIGRASI: Sistem POS Kasir
-- Jalankan di SQL Editor -- TIDAK menghapus data lama kamu.
-- ============================================================

-- 1. KATEGORI MENU
create table if not exists kategori_menu (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  urutan int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Tambah kategori ke tabel produk yang sudah ada
alter table produk add column if not exists kategori_id uuid references kategori_menu(id);

-- 3. ADDON (Extra Shot, Whipped Cream, dll)
create table if not exists addon (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  harga numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Relasi produk <-> addon (addon mana berlaku untuk produk mana)
create table if not exists produk_addon (
  id uuid primary key default gen_random_uuid(),
  produk_id uuid not null references produk(id) on delete cascade,
  addon_id uuid not null references addon(id) on delete cascade,
  unique (produk_id, addon_id)
);

-- 5. PESANAN (1 transaksi kasir / 1 nota)
create table if not exists pesanan (
  id uuid primary key default gen_random_uuid(),
  nomor_urut bigint generated always as identity,
  nama_pelanggan text,
  tipe_order text not null check (tipe_order in ('dinein', 'takeaway', 'merchant')),
  platform_id uuid references platform(id),
  nomor_meja text,
  metode_bayar text check (metode_bayar in ('cash', 'qris_sendiri', 'qris_midtrans')),
  status text not null default 'belum_bayar' check (status in ('belum_bayar', 'sudah_bayar', 'batal')),
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- 6. ITEM DALAM PESANAN
create table if not exists pesanan_item (
  id uuid primary key default gen_random_uuid(),
  pesanan_id uuid not null references pesanan(id) on delete cascade,
  produk_id uuid not null references produk(id),
  nama_produk_saat_itu text not null,
  qty numeric(14,2) not null default 1,
  harga_saat_itu numeric(14,2) not null default 0,
  hpp_saat_itu numeric(14,2) not null default 0,
  catatan text,
  created_at timestamptz not null default now()
);

-- 7. ADDON YANG DIPILIH PER ITEM
create table if not exists pesanan_item_addon (
  id uuid primary key default gen_random_uuid(),
  pesanan_item_id uuid not null references pesanan_item(id) on delete cascade,
  nama_addon_saat_itu text not null,
  harga_addon_saat_itu numeric(14,2) not null default 0
);

-- 8. Tambah kolom pesanan_id ke transaksi_penjualan (link ke pembukuan HPP)
alter table transaksi_penjualan add column if not exists pesanan_id uuid references pesanan(id);

-- 9. Kolom tambahan untuk pembayaran cash (nominal diterima & kembalian)
alter table pesanan add column if not exists uang_diterima numeric(14,2);
alter table pesanan add column if not exists kembalian numeric(14,2);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_produk_kategori on produk(kategori_id);
create index if not exists idx_produk_addon_produk on produk_addon(produk_id);
create index if not exists idx_pesanan_item_pesanan on pesanan_item(pesanan_id);
create index if not exists idx_pesanan_item_addon_item on pesanan_item_addon(pesanan_item_id);
create index if not exists idx_pesanan_status on pesanan(status);

-- ============================================================
-- RLS
-- ============================================================
alter table kategori_menu enable row level security;
alter table addon enable row level security;
alter table produk_addon enable row level security;
alter table pesanan enable row level security;
alter table pesanan_item enable row level security;
alter table pesanan_item_addon enable row level security;

drop policy if exists "allow all - kategori_menu" on kategori_menu;
create policy "allow all - kategori_menu" on kategori_menu for all using (true) with check (true);
drop policy if exists "allow all - addon" on addon;
create policy "allow all - addon" on addon for all using (true) with check (true);
drop policy if exists "allow all - produk_addon" on produk_addon;
create policy "allow all - produk_addon" on produk_addon for all using (true) with check (true);
drop policy if exists "allow all - pesanan" on pesanan;
create policy "allow all - pesanan" on pesanan for all using (true) with check (true);
drop policy if exists "allow all - pesanan_item" on pesanan_item;
create policy "allow all - pesanan_item" on pesanan_item for all using (true) with check (true);
drop policy if exists "allow all - pesanan_item_addon" on pesanan_item_addon;
create policy "allow all - pesanan_item_addon" on pesanan_item_addon for all using (true) with check (true);

-- ============================================================
-- STORAGE: bucket untuk gambar QRIS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('qris', 'qris', true)
on conflict (id) do nothing;

drop policy if exists "qris - allow all read" on storage.objects;
create policy "qris - allow all read" on storage.objects
  for select using (bucket_id = 'qris');

drop policy if exists "qris - allow all write" on storage.objects;
create policy "qris - allow all write" on storage.objects
  for insert with check (bucket_id = 'qris');

drop policy if exists "qris - allow all update" on storage.objects;
create policy "qris - allow all update" on storage.objects
  for update using (bucket_id = 'qris');
