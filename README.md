# Buku HPP — Aplikasi Perhitungan HPP & Pembukuan Pribadi

Dibangun dengan **Next.js 14** (App Router, full-stack dalam satu project) dan
**Supabase** (Postgres + auto REST API) sebagai database.

## Fitur

- **Bahan Baku** — tambah bahan pakai info pembelian aslinya (pilih satuan
  kg/liter/gram/ml/pcs + jumlah + total bayar), harga per satuan terkecil
  dihitung **otomatis**, tidak perlu konversi manual.
- **Produk & Resep** — susun resep per produk (bisa tambah bahan baku baru
  langsung dari halaman ini, tanpa pindah halaman), HPP per unit terhitung
  otomatis.
- **💡 Saran Harga Jual Otomatis** — set target margin (%), aplikasi otomatis
  menghitung & menyarankan harga jual, tinggal klik "Pakai Harga Ini".
- **Biaya Operasional Bulanan** — overhead disederhanakan jadi 1 angka
  (gabungan listrik, sewa, dll per bulan), dibagi otomatis ke semua produk.
- **Produksi** — catat batch produksi & tenaga kerja langsung (opsional).
- **Penjualan** — catat transaksi jual; HPP di-snapshot saat itu juga.
- **Kas Umum** — pembukuan kas masuk/keluar di luar penjualan.
- **📱 Platform (GoFood/ShopeeFood/GrabFood/Offline)** — atur komisi tiap
  channel jualan (preset atau manual), aplikasi otomatis hitung harga yang
  harus dipasang di tiap platform, dan otomatis potong komisi saat transaksi
  dicatat.
- **Laporan** — laporan laba rugi bulanan + rekap laba per platform + per
  produk, sudah memperhitungkan potongan komisi platform.

- **🧾 Kasir POS** — halaman kasir terpisah (login role "kasir"): pilih tipe
  order (Dine-in/Takeaway/Merchant), menu dikategorikan, popup addon per
  produk, keranjang, checkout (Cash/QRIS), struk otomatis. Semua penjualan
  dari kasir otomatis tersinkron ke laporan HPP.
- **📋 Kelola Menu** (admin) — atur kategori menu & daftar addon/tambahan.
- **💳 Pembayaran** (admin) — upload QRIS sendiri, toggle QRIS Midtrans (demo).

- **Stok Bahan Baku Otomatis** — setiap ada penjualan (kasir maupun self-service),
  stok bahan baku otomatis berkurang sesuai resep. Kalau pesanan dibatalkan,
  stok otomatis dikembalikan.
- **Riwayat Pesanan & Pembatalan (Void)** — admin bisa lihat semua pesanan,
  cari/filter, dan membatalkan transaksi yang salah input (dengan alasan wajib
  diisi) — stok otomatis dikembalikan, laporan otomatis exclude transaksi itu,
  tapi jejaknya tetap tersimpan (audit trail).
- **Tutup Kasir / Shift** — kasir bisa lihat rekap cash/QRIS sejak shift
  terakhir, lalu "tutup kasir" untuk menyimpan snapshot dan mulai shift baru.
- **Diskon per Transaksi** — kasir bisa kasih diskon nominal Rp di halaman
  checkout, otomatis kepotong dari total & tercatat rapi di laporan.
- **Pencarian** — cari cepat di daftar menu kasir & bahan baku.
- **Notifikasi custom** — pesan sukses/error pakai toast bertema aplikasi,
  bukan `alert()` browser bawaan.
- **Dashboard "Hari Ini"** — kartu ringkasan harian menonjol di atas dashboard,
  terpisah dari statistik bulanan.
- **🧾 Self-Service Order** (`/order`) — halaman publik (tanpa login) untuk
  pelanggan pesan sendiri lewat scan barcode di meja. Mirip alur kasir tapi
  tanpa opsi Merchant, dan pembayaran cuma lewat Midtrans (masih demo/simulasi
  sampai kamu benar-benar hubungkan ke akun Midtrans asli).

## Setup Login (Admin & Kasir)

Aplikasi ini sekarang punya sistem login dengan 2 role:
- **Admin** → masuk ke sistem HPP & Pembukuan (semua halaman yang sudah ada)
- **Kasir** → masuk ke halaman POS (menyusul di fase berikutnya)

### Langkah setup:

1. Jalankan `supabase/migrasi_auth.sql` di SQL Editor (aman, tidak hapus data lama)
2. Buka **Supabase Dashboard > Authentication > Users > Add user**, buat 2 akun
   (login di aplikasi nanti pakai **username**, tapi Supabase tetap perlu
   format email di baliknya — pakai pola `username@pos.local`):
   - Email `admin@pos.local`, password bebas
   - Email `kasir@pos.local`, password bebas
3. Copy **User UID** masing-masing akun dari halaman itu
4. Jalankan SQL ini di SQL Editor (ganti UUID sesuai punya kamu):
   ```sql
   insert into profiles (id, nama, role) values
     ('uuid-admin-kamu', 'Admin', 'admin'),
     ('uuid-kasir-kamu', 'Kasir', 'kasir');
   ```
5. Buka `localhost:3000` — otomatis diarahkan ke `/login`. Coba login pakai
   akun admin (masuk ke dashboard HPP) atau kasir (masuk ke halaman kasir
   sementara).

## Update: Rekap Penjualan, Menu Cepat, Kategori Minuman/Makanan, Tiket Dapur

Jalankan `supabase/migrasi_jenis_kategori.sql` di SQL Editor (aman, tidak
hapus data lama). Fitur baru:

- **Rekap Penjualan** (admin) — halaman baru, toggle Harian/Mingguan/Bulanan,
  ada grafik + tabel laba per periode.
- **Kelola Menu → Tambah Menu Cepat** — tambah menu (nama+harga+kategori)
  tanpa perlu susun resep dulu. HPP-nya 0 sampai resepnya diisi belakangan
  (opsional) di halaman Produk & Resep.
- **Kategori Minuman/Makanan** — tiap kategori sekarang wajib ditandai
  jenisnya (🍹 Minuman / 🍽️ Makanan) waktu dibuat di Kelola Menu. Kasir POS
  otomatis kepisah jadi 2 bagian besar sesuai ini.
- **Tiket Dapur** — di halaman struk kasir, sekarang ada tombol tambahan
  "🍹 Cetak Tiket Minuman" dan "🍽️ Cetak Tiket Makanan" (muncul cuma kalau ada
  item jenis itu di pesanan) — isinya cuma daftar item tanpa harga, buat
  dikasih ke station minuman/dapur. Kamu yang pencet tombolnya secara manual,
  tidak otomatis kecetak sendiri.

## Setup Payment Gateway DOKU (untuk Self-Service Order)

Halaman `/order` sekarang terhubung ke **DOKU QRIS** sungguhan (bukan lagi
demo). Ini yang perlu disiapkan:

### 1. Jalankan migrasi database
```sql
-- Jalankan supabase/migrasi_doku.sql di SQL Editor
```

### 2. Kumpulkan kredensial dari Dashboard DOKU
Buka **dashboard.doku.com > Settings > API Keys**, catat:
- **Client ID** (format `BRN-xxxx-xxxxxxxxxxxxx`)
- **Secret Key**

Catatan: DOKU tidak punya "Merchant ID" terpisah — Client ID kamu yang
dipakai juga untuk keperluan itu, jadi tidak perlu dicari lagi.

### 3. Generate & daftarkan key pair kamu sendiri
```bash
openssl genrsa -out private.key 2048
openssl pkcs8 -topk8 -inform PEM -outform PEM -in private.key -out pkcs8.key -v1 PBE-SHA1-3DES
openssl rsa -in private.key -outform PEM -pubout -out public.pem
```
Upload isi `public.pem` ke Dashboard DOKU (**Settings > API Keys**, cari
bagian **"Merchant Public Key"**).

### 4. Ambil Service Role Key dari Supabase
Buka **Supabase Dashboard > Project Settings > API**, copy **`service_role`
key** (BUKAN `anon` key — ini kunci rahasia, jangan pernah sebarkan atau
commit ke Git).

### 5. Isi Environment Variables

Di `.env.local` (development):
```
SUPABASE_SERVICE_ROLE_KEY=isi-service-role-key-kamu

DOKU_CLIENT_ID=isi-client-id-kamu
DOKU_SECRET_KEY=isi-secret-key-kamu
DOKU_PARTNER_ID=isi-client-id-kamu-lagi
DOKU_PRIVATE_KEY_PASSPHRASE=password-yang-kamu-buat-di-langkah-3
DOKU_IS_PRODUCTION=false

# Isi seluruh isi file pkcs8.key, ganti tiap baris baru jadi \n
DOKU_PRIVATE_KEY="-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFHDBOBgkqhkiG9w0BBQ0...\n-----END ENCRYPTED PRIVATE KEY-----"
```

Di **Vercel** (production): buka Project Settings > Environment Variables,
tambahkan semua variabel yang sama. Untuk `DOKU_PRIVATE_KEY`, paste isi
`pkcs8.key` apa adanya (Vercel otomatis handle multi-baris, tidak perlu ganti
jadi `\n` manual seperti di `.env.local`).

### 6. Daftarkan Webhook URL di Dashboard DOKU
Di Dashboard DOKU (biasanya di **Settings > API Keys** atau menu bernama
**"Notification"**, tergantung versi dashboard), isi **Notification URL**:
```
https://domain-vercel-kamu.vercel.app/api/doku/webhook
```
Ini yang bikin status pesanan otomatis berubah jadi "sudah_bayar" begitu
pelanggan selesai scan & bayar.

### 7. Test di Sandbox dulu
Pastikan `DOKU_IS_PRODUCTION=false` dulu, coba transaksi kecil di `/order`
sampai selesai. Baru ganti ke `true` + kredensial production kalau sudah
yakin semua jalan lancar.

## Setup Revisi Besar (Void, Diskon, Tutup Kasir, Self-Service)

Jalankan `supabase/migrasi_revisi_besar.sql` di SQL Editor (aman, tidak hapus
data lama). Setelah itu:
- Halaman **Riwayat Pesanan** (admin) siap dipakai untuk lihat & batalkan pesanan
- Halaman **Tutup Kasir** bisa diakses dari tombol "📕 Tutup Kasir" di header kasir
- Diskon otomatis muncul di halaman checkout kasir
- Halaman **`/order`** (self-service) langsung bisa diakses tanpa login siapa saja
  yang tahu URL-nya — cocok untuk di-generate jadi barcode/QR code dan ditempel
  di meja

## Setup Logo & Nama Toko

Jalankan `supabase/migrasi_toko.sql` di SQL Editor (aman, tidak hapus data
lama). Ini bikin tabel `pengaturan_toko` + storage bucket `logo`. Setelah itu,
login admin, buka halaman **Toko & Pembayaran** → upload logo & atur nama toko
— otomatis muncul di header struk kasir (menggantikan tulisan default).

## Setup Sistem Kasir POS

1. Jalankan `supabase/migrasi_pos.sql` di SQL Editor (aman, tidak hapus data
   lama). Ini juga otomatis membuat storage bucket `qris` untuk upload gambar
   QRIS. **Kalau sebelumnya sudah pernah menjalankan file ini**, cukup jalankan
   `supabase/migrasi_pos_v2.sql` untuk menambah kolom cash payment yang baru.
2. Login sebagai **admin**, buka halaman **Kelola Menu** → buat kategori
   (misal "Kopi", "Non-Kopi") dan addon (misal "Extra Shot", harga 5000).
3. Buka halaman **Produk & Resep** → pilih produk → tab **"Kategori & Addon"**
   → set kategori dan centang addon yang berlaku untuk produk itu.
4. Buka halaman **Pembayaran** → upload gambar QRIS kamu (kalau mau
   menyediakan opsi bayar QRIS di kasir).
5. Login sebagai **kasir** → isi info pesanan → pilih menu → checkout → struk
   otomatis muncul. Data penjualan otomatis masuk ke laporan HPP admin.

### Catatan penting: harga otomatis menyesuaikan platform

Kalau tipe order dipilih **"Merchant"** (GoFood/ShopeeFood/GrabFood), semua
harga di menu kasir **otomatis naik** sesuai komisi platform itu (pakai rumus
yang sama seperti di halaman Produk) — supaya pendapatan bersih yang tercatat
di pembukuan tetap sama dengan harga offline setelah dipotong komisi. Ada
banner kuning di halaman menu kasir yang menandakan ini sedang aktif.

## Cara Menjalankan

### 1. Setup Supabase

**Kalau ini instalasi baru dari nol:**
1. Buat akun & project baru di [supabase.com](https://supabase.com) (gratis).
2. Buka **SQL Editor**, copy-paste seluruh isi `supabase/schema.sql`, Run.

**Kalau kamu sudah punya project & data sebelumnya (upgrade fitur Platform):**
1. Buka **SQL Editor**, copy-paste seluruh isi `supabase/migrasi_platform.sql`, Run.
   Ini AMAN — tidak menghapus data yang sudah ada, cuma menambah tabel &
   kolom baru untuk fitur platform.

Setelah itu, buka **Project Settings > API**, catat:
- `Project URL` (JANGAN tambahkan `/rest/v1/` di belakangnya)
- `anon public` key

### 2. Setup Project Lokal

```bash
npm install
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=isi-anon-key-kamu
```

### 3. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### 4. Deploy Online

Push ke GitHub → import di [vercel.com](https://vercel.com) → isi Environment
Variables yang sama → Deploy.

## Struktur Perhitungan HPP

```
HPP per unit = Biaya Bahan Baku Langsung
             + Biaya Tenaga Kerja Langsung (opsional, per batch produksi)
             + Overhead per Unit (biaya operasional bulanan ÷ estimasi unit bulanan)

Harga Jual Disarankan = HPP ÷ (1 - target margin%)
```

Logika ini ada di `src/lib/hpp.ts`.

## Konversi Satuan

Saat input bahan baku, kamu boleh pilih satuan **kg** atau **liter** dan isi
angka dalam satuan itu — aplikasi otomatis mengonversi ke satuan terkecil
(gram/ml) untuk disimpan, supaya perhitungan resep tetap presisi. Logikanya
ada di `SATUAN_OPTIONS` dan `faktorKonversi()` di `src/lib/hpp.ts`.

## Catatan Keamanan

RLS diset **allow all** untuk pemakaian pribadi solo tanpa login. Kalau nanti
mau tambah Supabase Auth, tambahkan kolom `user_id` di tiap tabel dan ganti
policy jadi `using (auth.uid() = user_id)`.

## Struktur Folder

```
src/
├── app/
│   ├── page.tsx           → Ringkasan/Dashboard
│   ├── bahan-baku/        → CRUD bahan baku + konversi satuan otomatis
│   ├── produk/             → Produk, resep, HPP, saran harga jual
│   ├── produksi/           → Batch produksi & pengaturan overhead
│   ├── transaksi/          → Penjualan & kas umum
│   └── laporan/            → Laporan laba rugi
├── components/
│   ├── Nav.tsx
│   └── BahanBakuQuickAdd.tsx → form tambah bahan baku inline
└── lib/
    ├── supabase.ts        → Supabase client
    ├── types.ts           → Tipe data
    └── hpp.ts             → Logika perhitungan HPP, konversi satuan, saran harga
supabase/
└── schema.sql             → Schema database (termasuk reset tabel lama)
```

