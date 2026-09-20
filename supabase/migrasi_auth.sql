-- ============================================================
-- MIGRASI: Sistem Login Admin & Kasir
-- Jalankan di SQL Editor -- TIDAK menghapus data lama kamu.
-- ============================================================

-- 1. Tabel PROFILES -- menyimpan role tiap akun (terhubung ke Supabase Auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role text not null check (role in ('admin', 'kasir')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Setiap orang yang login boleh baca profilnya sendiri (dibutuhkan untuk
-- menentukan diarahkan ke halaman admin atau kasir)
drop policy if exists "profiles - baca profil sendiri" on profiles;
create policy "profiles - baca profil sendiri" on profiles
  for select using (auth.uid() = id);

-- 2. Tabel PENGATURAN PEMBAYARAN -- untuk fase kasir nanti (QRIS, dll)
create table if not exists pengaturan_pembayaran (
  id boolean primary key default true,
  qris_sendiri_url text,
  qris_midtrans_aktif boolean not null default false,
  constraint pengaturan_pembayaran_singleton check (id)
);
insert into pengaturan_pembayaran (id) values (true) on conflict (id) do nothing;

alter table pengaturan_pembayaran enable row level security;
drop policy if exists "allow all - pengaturan_pembayaran" on pengaturan_pembayaran;
create policy "allow all - pengaturan_pembayaran" on pengaturan_pembayaran
  for all using (true) with check (true);

-- ============================================================
-- LANGKAH MANUAL SETELAH INI (wajib, tidak bisa lewat SQL):
--
-- CATATAN: Aplikasi ini login pakai USERNAME (bukan email), tapi
-- Supabase Auth di baliknya tetap wajib format email. Solusinya:
-- pas bikin akun, isi emailnya pakai pola "username@pos.local".
-- Kamu sendiri tinggal ketik "admin" atau "kasir" di halaman login,
-- aplikasi otomatis terjemahkan ke email itu di belakang layar.
--
-- 1. Buka Supabase Dashboard > Authentication > Users > "Add user"
--    Buat 2 user:
--      - Email: admin@pos.local   Password: (bebas, minimal 6 karakter)
--      - Email: kasir@pos.local   Password: (bebas, minimal 6 karakter)
--
-- 2. Setelah kedua user dibuat, copy UUID masing-masing dari kolom
--    "User UID" di halaman Authentication > Users
--
-- 3. Jalankan SQL ini (ganti UUID sesuai punya kamu):
--
-- insert into profiles (id, nama, role) values
--   ('paste-uuid-admin-di-sini', 'Admin', 'admin'),
--   ('paste-uuid-kasir-di-sini', 'Kasir', 'kasir');
--
-- Nanti login-nya: Username "admin" / Username "kasir" (bukan email).
-- ============================================================
