// Builder sederhana untuk perintah ESC/POS (dipakai printer thermal kasir).
// Referensi: Epson ESC/POS Command Reference.

const ESC = 0x1b;
const GS = 0x1d;

function textToBytes(text: string): number[] {
  // Buang emoji/karakter non-ASCII -- kebanyakan printer thermal murah
  // tidak bisa render emoji, hasilnya jadi kotak-kotak aneh kalau dipaksa.
  const bersih = text.replace(/[^\x00-\x7F]/g, "");
  return Array.from(new TextEncoder().encode(bersih));
}

export class EscPosBuilder {
  private bytes: number[] = [];

  init() {
    this.bytes.push(ESC, 0x40); // ESC @ -- reset printer
    return this;
  }

  align(mode: "left" | "center" | "right") {
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    this.bytes.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean) {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleSize(on: boolean) {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  text(line: string) {
    this.bytes.push(...textToBytes(line));
    return this;
  }

  line(line: string = "") {
    this.text(line);
    this.newline();
    return this;
  }

  // 2 kolom rata kiri-kanan (untuk "Nama Item ... Harga"). Kalau teksnya
  // kepanjangan buat 1 baris (kertas 58mm cuma muat ±32 karakter), otomatis
  // pecah jadi 2 baris: nama di atas, angka rata kanan di bawahnya --
  // supaya tidak berdempetan/kepotong aneh.
  row(kiri: string, kanan: string, lebar: number = 32) {
    if (kiri.length + kanan.length + 1 > lebar) {
      this.line(kiri);
      const spasiKanan = Math.max(0, lebar - kanan.length);
      this.line(" ".repeat(spasiKanan) + kanan);
    } else {
      const spasi = lebar - kiri.length - kanan.length;
      this.line(kiri + " ".repeat(spasi) + kanan);
    }
    return this;
  }

  newline() {
    this.bytes.push(0x0a);
    return this;
  }

  dashedLine(lebar: number = 32) {
    this.line("-".repeat(lebar));
    return this;
  }

  feed(jumlahBaris: number = 3) {
    for (let i = 0; i < jumlahBaris; i++) this.newline();
    return this;
  }

  cut() {
    // GS V 1 -- partial cut. Aman dikirim walau printernya tidak punya
    // auto-cutter (kebanyakan printer 58mm murah), perintah ini akan
    // diabaikan begitu saja oleh printer tanpa cutter.
    this.bytes.push(GS, 0x56, 0x01);
    return this;
  }

  // Cetak gambar bitmap (logo) pakai perintah GS v 0 (raster bit image).
  // widthBytes = lebar gambar dalam byte (lebar_piksel / 8).
  // heightPx = tinggi gambar dalam piksel.
  // data = piksel yang sudah dikonversi jadi 1-bit monokrom (dari fungsi
  // imageUrlToEscPosBitmap di bawah).
  image(widthBytes: number, heightPx: number, data: Uint8Array) {
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = heightPx & 0xff;
    const yH = (heightPx >> 8) & 0xff;
    this.bytes.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    this.bytes.push(...Array.from(data));
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

/**
 * Konversi gambar (dari URL, misal logo toko) jadi bitmap 1-bit monokrom
 * yang siap dikirim ke printer thermal via ESC/POS.
 *
 * Prosesnya: load gambar -> gambar ke <canvas> -> baca tiap piksel ->
 * ubah jadi hitam/putih (threshold) -> susun jadi byte (8 piksel/byte).
 */
export async function imageUrlToEscPosBitmap(
  url: string,
  maxWidthPx: number = 180
): Promise<{ widthBytes: number; heightPx: number; data: Uint8Array } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });

    // Lebar WAJIB kelipatan 8 (1 byte = 8 piksel horizontal)
    let width = Math.min(maxWidthPx, img.width);
    width = width - (width % 8);
    if (width <= 0) width = 8;
    const height = Math.round((img.height / img.width) * width);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Latar putih dulu (jaga-jaga kalau logo PNG transparan, biar tidak
    // ikut dianggap "hitam" oleh printer)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height).data;
    const widthBytes = width / 8;
    const data = new Uint8Array(widthBytes * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = imgData[i];
        const g = imgData[i + 1];
        const bch = imgData[i + 2];
        const grayscale = 0.299 * r + 0.587 * g + 0.114 * bch;
        const hitam = grayscale < 150; // threshold -- makin kecil makin "berani" jadi hitam

        if (hitam) {
          const byteIndex = y * widthBytes + Math.floor(x / 8);
          const bitIndex = 7 - (x % 8);
          data[byteIndex] |= 1 << bitIndex;
        }
      }
    }

    return { widthBytes, heightPx: height, data };
  } catch {
    // Gagal load gambar (misal CORS/offline) -- jangan sampai bikin
    // seluruh proses cetak gagal, cukup skip logonya saja.
    return null;
  }
}

export type StrukData = {
  namaToko: string;
  logoUrl: string | null;
  waktu: string;
  namaKasir: string;
  namaPelanggan: string;
  labelTipeOrder: string;
  items: {
    nama: string;
    qty: number;
    subtotal: number;
    addons: { nama: string }[];
  }[];
  subtotalSebelumDiskon: number;
  diskonNominal: number;
  total: number;
  metodeBayar: string;
  uangDiterima: number | null;
  kembalian: number | null;
};

export async function buildStrukBytes(
  data: StrukData,
  formatRupiah: (n: number) => string
): Promise<Uint8Array> {
  const b = new EscPosBuilder();
  b.init();
  b.align("center");

  if (data.logoUrl) {
    const bitmap = await imageUrlToEscPosBitmap(data.logoUrl);
    if (bitmap) {
      b.image(bitmap.widthBytes, bitmap.heightPx, bitmap.data);
      b.feed(1);
    } else {
      // Logo gagal diproses (misal masalah CORS) -- fallback ke nama teks
      b.bold(true);
      b.line(data.namaToko);
      b.bold(false);
    }
  } else {
    b.bold(true);
    b.line(data.namaToko);
    b.bold(false);
  }

  b.line("Struk Pembayaran");
  b.newline();
  b.align("left");
  b.dashedLine();
  b.row("Waktu", data.waktu);
  b.row("Kasir", data.namaKasir);
  b.row("Pelanggan", data.namaPelanggan);
  b.row("Tipe Order", data.labelTipeOrder);
  b.dashedLine();

  data.items.forEach((item) => {
    b.row(`${item.qty}x ${item.nama}`, formatRupiah(item.subtotal));
    item.addons.forEach((a) => b.line(`  + ${a.nama}`));
  });

  b.dashedLine();
  if (data.diskonNominal > 0) {
    b.row("Subtotal", formatRupiah(data.subtotalSebelumDiskon));
    b.row("Diskon", `-${formatRupiah(data.diskonNominal)}`);
    b.newline();
  }
  b.bold(true);
  b.row("TOTAL", formatRupiah(data.total));
  b.bold(false);
  b.newline();
  b.line(
    `Bayar: ${
      data.metodeBayar === "cash"
        ? "Cash"
        : data.metodeBayar === "qris_sendiri"
        ? "QRIS"
        : "QRIS (Demo)"
    }`
  );
  if (data.metodeBayar === "cash" && data.uangDiterima !== null) {
    b.row("Uang Diterima", formatRupiah(data.uangDiterima));
    b.bold(true);
    b.row("Kembalian", formatRupiah(data.kembalian ?? 0));
    b.bold(false);
  }
  b.dashedLine();
  b.align("center");
  b.newline();
  b.line("Terima kasih!");
  b.line("Sampai jumpa lagi");
  b.feed(4);
  b.cut();

  return b.build();
}

export type TiketDapurData = {
  jenis: "minuman" | "makanan";
  nomorNota: number;
  waktu: string;
  namaPelanggan: string;
  labelTipeOrder: string;
  items: {
    nama: string;
    qty: number;
    addons: { nama: string }[];
    catatan?: string;
  }[];
};

/**
 * Struk dapur (kitchen ticket) -- TANPA harga, cuma daftar item yang perlu
 * disiapkan. Dipisah per jenis (minuman/makanan) supaya bisa dikirim ke
 * meja/station yang berbeda.
 */
export function buildTiketDapurBytes(data: TiketDapurData): Uint8Array {
  const b = new EscPosBuilder();
  b.init();
  b.align("center");
  b.doubleSize(true);
  b.bold(true);
  b.line(data.jenis === "minuman" ? "TIKET MINUMAN" : "TIKET MAKANAN");
  b.bold(false);
  b.doubleSize(false);
  b.line("Bukan struk pembayaran");
  b.align("left");
  b.dashedLine();
  b.row("Waktu", data.waktu);
  b.row("Pelanggan", data.namaPelanggan);
  b.row("Tipe Order", data.labelTipeOrder);
  b.dashedLine();

  data.items.forEach((item) => {
    b.bold(true);
    b.line(`${item.qty}x ${item.nama}`);
    b.bold(false);
    item.addons.forEach((a) => b.line(`  + ${a.nama}`));
    if (item.catatan) b.line(`  "${item.catatan}"`);
  });

  b.dashedLine();
  b.align("center");
  b.line(`#${String(data.nomorNota).padStart(4, "0")}`);
  b.feed(4);
  b.cut();

  return b.build();
}
