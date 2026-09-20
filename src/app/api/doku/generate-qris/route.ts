import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { generateQrisDoku } from "@/lib/doku";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { pesananId } = await request.json();
    if (!pesananId) {
      return NextResponse.json({ error: "pesananId wajib diisi" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: pesanan, error } = await supabase
      .from("pesanan")
      .select("*")
      .eq("id", pesananId)
      .single();

    if (error || !pesanan) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    const referenceNo = `NOTA${String(pesanan.nomor_urut).padStart(6, "0")}-${pesanan.id.slice(0, 8)}`;

    const { qrContent } = await generateQrisDoku({
      referenceNo,
      amount: pesanan.total,
    });

    // Simpan referenceNo ke pesanan supaya webhook nanti bisa mencocokkan
    // notifikasi DOKU dengan pesanan yang tepat.
    await supabase
      .from("pesanan")
      .update({ doku_reference_no: referenceNo })
      .eq("id", pesananId);

    // Render qrContent (string EMV QRIS mentah dari DOKU) jadi gambar PNG
    // base64, supaya frontend tinggal <img src="..."> tanpa perlu library
    // tambahan di sisi client.
    const qrImageDataUrl = await QRCode.toDataURL(qrContent, {
      width: 400,
      margin: 1,
    });

    return NextResponse.json({ qrImageDataUrl, referenceNo });
  } catch (err: any) {
    console.error("Error generate QRIS DOKU:", err);
    return NextResponse.json(
      { error: err.message ?? "Gagal generate QRIS" },
      { status: 500 }
    );
  }
}
