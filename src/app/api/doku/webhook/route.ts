import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { kurangiStokUntukPenjualan } from "@/lib/stok";
import { hitungHPP } from "@/lib/hpp";

/**
 * Endpoint ini yang didaftarkan di Dashboard DOKU sebagai "Notification URL":
 *   https://domainkamu.com/api/doku/webhook
 *
 * DOKU akan otomatis kirim POST ke sini setiap kali status pembayaran
 * berubah (termasuk saat customer selesai scan & bayar QRIS).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Struktur notifikasi SNAP QRIS DOKU umumnya berisi originalReferenceNo
    // (partnerReferenceNo yang kita kirim waktu generate) & transactionStatusDesc
    const referenceNo: string | undefined =
      body.originalPartnerReferenceNo || body.originalReferenceNo || body.partnerReferenceNo;
    const statusSukses =
      body.transactionStatusDesc === "Success" ||
      body.latestTransactionStatus === "00" ||
      body.transactionStatusDesc === "success";

    if (!referenceNo) {
      return NextResponse.json({ error: "referenceNo tidak ditemukan di body" }, { status: 400 });
    }

    if (!statusSukses) {
      // Notifikasi selain sukses (pending/gagal) -- cukup diterima, tidak
      // perlu diproses lebih lanjut untuk sekarang.
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    const { data: pesanan } = await supabase
      .from("pesanan")
      .select("*")
      .eq("doku_reference_no", referenceNo)
      .single();

    if (!pesanan) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    // Cegah proses dobel kalau DOKU kirim notifikasi berkali-kali untuk
    // transaksi yang sama (umum terjadi di payment gateway manapun).
    if (pesanan.status === "sudah_bayar") {
      return NextResponse.json({ received: true, note: "sudah diproses sebelumnya" });
    }

    // Update status pesanan jadi sudah dibayar
    await supabase
      .from("pesanan")
      .update({ status: "sudah_bayar" })
      .eq("id", pesanan.id);

    // Ambil item pesanan, generate transaksi_penjualan (biar masuk laporan
    // HPP admin), dan kurangi stok bahan baku otomatis -- persis seperti
    // alur kasir/self-service biasa.
    const { data: items } = await supabase
      .from("pesanan_item")
      .select("*")
      .eq("pesanan_id", pesanan.id);

    const { data: pengaturan } = await supabase
      .from("pengaturan")
      .select("*")
      .limit(1)
      .single();

    for (const item of items ?? []) {
      const { data: resep } = await supabase
        .from("resep_produk")
        .select("*, bahan_baku(*)")
        .eq("produk_id", item.produk_id);

      const hpp = hitungHPP({ resep: resep ?? [], pengaturan }).hppPerUnit;

      await supabase.from("transaksi_penjualan").insert({
        produk_id: item.produk_id,
        platform_id: null,
        pesanan_id: pesanan.id,
        qty: item.qty,
        harga_jual_saat_itu: item.harga_saat_itu,
        komisi_persen_saat_itu: 0,
        hpp_saat_itu: hpp,
        tanggal: new Date().toISOString().slice(0, 10),
      });

      await kurangiStokUntukPenjualan(item.produk_id, item.qty, supabase);
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (err: any) {
    console.error("Error webhook DOKU:", err);
    return NextResponse.json({ error: err.message ?? "Gagal proses webhook" }, { status: 500 });
  }
}
