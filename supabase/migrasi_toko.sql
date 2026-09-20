-- ============================================================
-- MIGRASI: Pengaturan Toko (nama & logo untuk struk)
-- Aman dijalankan berkali-kali, tidak hapus data lama.
-- ============================================================

create table if not exists pengaturan_toko (
  id boolean primary key default true,
  nama_toko text not null default 'Buku Kerja',
  logo_url text,
  constraint pengaturan_toko_singleton check (id)
);
insert into pengaturan_toko (id) values (true) on conflict (id) do nothing;

alter table pengaturan_toko enable row level security;
drop policy if exists "allow all - pengaturan_toko" on pengaturan_toko;
create policy "allow all - pengaturan_toko" on pengaturan_toko
  for all using (true) with check (true);

-- Storage bucket untuk logo
insert into storage.buckets (id, name, public)
values ('logo', 'logo', true)
on conflict (id) do nothing;

drop policy if exists "logo - allow all read" on storage.objects;
create policy "logo - allow all read" on storage.objects
  for select using (bucket_id = 'logo');

drop policy if exists "logo - allow all write" on storage.objects;
create policy "logo - allow all write" on storage.objects
  for insert with check (bucket_id = 'logo');

drop policy if exists "logo - allow all update" on storage.objects;
create policy "logo - allow all update" on storage.objects
  for update using (bucket_id = 'logo');
