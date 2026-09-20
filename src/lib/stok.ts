import { supabase as supabaseBrowser } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mengurangi stok bahan baku otomatis berdasarkan resep produk yang terjual.
 * Dipanggil setiap kali ada transaksi penjualan (kasir POS, self-service,
 * atau webhook payment gateway server-side).
 *
 * Parameter `client` opsional -- default pakai browser client (dipakai di
 * komponen "use client"), tapi API routes server-side WAJIB kirim admin
 * client sendiri (lihat lib/supabase-admin.ts), karena browser client tidak
 * bisa jalan normal di lingkungan server Node.js.
 */
export async function kurangiStokUntukPenjualan(
  produkId: string,
  qtyTerjual: number,
  client: SupabaseClient = supabaseBrowser
): Promise<void> {
  const { data: resep } = await client
    .from("resep_produk")
    .select("bahan_baku_id, qty")
    .eq("produk_id", produkId);

  if (!resep || resep.length === 0) return;

  for (const item of resep) {
    const { data: bahan } = await client
      .from("bahan_baku")
      .select("stok")
      .eq("id", item.bahan_baku_id)
      .single();

    if (!bahan) continue;

    const stokBaru = bahan.stok - item.qty * qtyTerjual;
    await client
      .from("bahan_baku")
      .update({ stok: stokBaru })
      .eq("id", item.bahan_baku_id);
  }
}

/**
 * Kebalikan dari di atas -- dipakai saat pesanan DIBATALKAN/di-void,
 * supaya stok yang tadi terpotong dikembalikan lagi.
 */
export async function kembalikanStokDariPenjualan(
  produkId: string,
  qtyDibatalkan: number,
  client?: SupabaseClient
): Promise<void> {
  await kurangiStokUntukPenjualan(produkId, -qtyDibatalkan, client);
}
