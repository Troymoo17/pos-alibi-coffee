"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Pesanan, PesananItem, Platform } from "@/lib/types";
import { formatRupiah } from "@/lib/hpp";
import { kembalikanStokDariPenjualan } from "@/lib/stok";
import { useToast } from "@/components/Toast";

export default function RiwayatPesananPage() {
  const [pesananList, setPesananList] = useState<(Pesanan & { platform?: Platform })[]>([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState("");
  const [filterStatus, setFilterStatus] = useState<"semua" | "sudah_bayar" | "batal">("semua");
  const [detailTerbuka, setDetailTerbuka] = useState<string | null>(null);
  const [itemPesanan, setItemPesanan] = useState<Record<string, PesananItem[]>>({});
  const [popupBatal, setPopupBatal] = useState<Pesanan | null>(null);
  const [alasanBatal, setAlasanBatal] = useState("");
  const [memproses, setMemproses] = useState(false);
  const { showToast } = useToast();

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("pesanan")
      .select("*, platform(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    setPesananList((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleDetail(pesananId: string) {
    if (detailTerbuka === pesananId) {
      setDetailTerbuka(null);
      return;
    }
    setDetailTerbuka(pesananId);
    if (!itemPesanan[pesananId]) {
      const { data } = await supabase
        .from("pesanan_item")
        .select("*, pesanan_item_addon(*)")
        .eq("pesanan_id", pesananId);
      setItemPesanan((prev) => ({
        ...prev,
        [pesananId]: ((data as any) ?? []).map((it: any) => ({
          ...it,
          addons: it.pesanan_item_addon ?? [],
        })),
      }));
    }
  }

  function bukaPopupBatal(p: Pesanan) {
    setPopupBatal(p);
    setAlasanBatal("");
  }

  async function konfirmasiBatal() {
    if (!popupBatal) return;
    if (!alasanBatal.trim()) {
      showToast("Alasan pembatalan wajib diisi.", "error");
      return;
    }
    setMemproses(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let namaAdmin = "Admin";
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nama")
        .eq("id", user.id)
        .single();
      if (profile?.nama) namaAdmin = profile.nama;
    }

    // 1. Ambil item pesanan untuk kembalikan stok
    const { data: items } = await supabase
      .from("pesanan_item")
      .select("*")
      .eq("pesanan_id", popupBatal.id);

    for (const item of items ?? []) {
      await kembalikanStokDariPenjualan(item.produk_id, item.qty);
    }

    // 2. Tandai transaksi_penjualan sebagai dibatalkan (bukan dihapus --
    //    supaya jejak audit tetap ada, tapi otomatis exclude dari laporan)
    await supabase
      .from("transaksi_penjualan")
      .update({ dibatalkan: true })
      .eq("pesanan_id", popupBatal.id);

    // 3. Update status pesanan
    const { error } = await supabase
      .from("pesanan")
      .update({
        status: "batal",
        alasan_batal: alasanBatal,
        dibatalkan_oleh: namaAdmin,
        dibatalkan_pada: new Date().toISOString(),
      })
      .eq("id", popupBatal.id);

    if (error) {
      showToast("Gagal membatalkan: " + error.message, "error");
    } else {
      showToast("Pesanan berhasil dibatalkan, stok sudah dikembalikan.", "success");
    }

    setMemproses(false);
    setPopupBatal(null);
    loadData();
  }

  const pesananDitampilkan = pesananList.filter((p) => {
    const cocokStatus = filterStatus === "semua" || p.status === filterStatus;
    const cocokCari =
      cari === "" ||
      p.nama_pelanggan?.toLowerCase().includes(cari.toLowerCase()) ||
      String(p.nomor_urut).includes(cari);
    return cocokStatus && cocokCari;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl mb-1">Riwayat Pesanan</h1>
        <p className="text-sm text-ink/50">
          Semua pesanan dari kasir POS. Bisa dibatalkan (void) kalau ada
          kesalahan input — stok otomatis dikembalikan.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          className="input-field"
          placeholder="🔍 Cari nama pelanggan / no. nota..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <div className="flex gap-1 shrink-0">
          {[
            { key: "semua", label: "Semua" },
            { key: "sudah_bayar", label: "Sukses" },
            { key: "batal", label: "Dibatalkan" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key as typeof filterStatus)}
              className={`px-3 py-2 rounded text-sm font-medium border whitespace-nowrap ${
                filterStatus === f.key
                  ? "bg-ledger text-white border-ledger"
                  : "border-line text-ink/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-ledger">
            <thead>
              <tr>
                <th></th>
                <th>No. Nota</th>
                <th>Waktu</th>
                <th>Pelanggan</th>
                <th>Tipe</th>
                <th>Bayar</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-ink/50">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading &&
                pesananDitampilkan.map((p) => (
                  <>
                    <tr key={p.id}>
                      <td>
                        <button
                          onClick={() => toggleDetail(p.id)}
                          className="text-ink/40 hover:text-ledger"
                        >
                          {detailTerbuka === p.id ? "▼" : "▶"}
                        </button>
                      </td>
                      <td>#{String(p.nomor_urut).padStart(4, "0")}</td>
                      <td className="whitespace-nowrap">
                        {new Date(p.created_at).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="font-body">{p.nama_pelanggan || "Umum"}</td>
                      <td className="font-body text-xs">
                        {p.tipe_order === "dinein"
                          ? `Dine-in #${p.nomor_meja}`
                          : p.tipe_order === "takeaway"
                          ? "Takeaway"
                          : p.platform?.nama ?? "Merchant"}
                      </td>
                      <td className="font-body text-xs">{p.metode_bayar}</td>
                      <td>{formatRupiah(p.total)}</td>
                      <td>
                        {p.status === "sudah_bayar" ? (
                          <span className="text-ledger text-xs font-medium">✓ Sukses</span>
                        ) : p.status === "batal" ? (
                          <span className="text-rust text-xs font-medium">✕ Batal</span>
                        ) : (
                          <span className="text-ink/40 text-xs">Belum Bayar</span>
                        )}
                      </td>
                      <td>
                        {p.status === "sudah_bayar" && (
                          <button
                            onClick={() => bukaPopupBatal(p)}
                            className="text-rust text-xs hover:underline font-body whitespace-nowrap"
                          >
                            Batalkan
                          </button>
                        )}
                      </td>
                    </tr>
                    {detailTerbuka === p.id && (
                      <tr>
                        <td colSpan={9} className="bg-ledger-dark/[0.03] p-4">
                          <div className="space-y-1">
                            {(itemPesanan[p.id] ?? []).map((it: any) => (
                              <div key={it.id} className="flex justify-between text-xs">
                                <span>
                                  {it.qty}x {it.nama_produk_saat_itu}
                                  {it.addons?.length > 0 && (
                                    <span className="text-ink/40">
                                      {" "}
                                      (+{it.addons.map((a: any) => a.nama_addon_saat_itu).join(", ")})
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono">
                                  {formatRupiah(it.harga_saat_itu * it.qty)}
                                </span>
                              </div>
                            ))}
                            {p.status === "batal" && (
                              <div className="mt-2 pt-2 border-t border-line/60 text-xs text-rust">
                                <p>Dibatalkan oleh: {p.dibatalkan_oleh}</p>
                                <p>Alasan: {p.alasan_batal}</p>
                                <p>
                                  Waktu:{" "}
                                  {p.dibatalkan_pada &&
                                    new Date(p.dibatalkan_pada).toLocaleString("id-ID")}
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              {!loading && pesananDitampilkan.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-ink/50">
                    Tidak ada pesanan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {popupBatal && (
        <div
          className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4"
          onClick={() => !memproses && setPopupBatal(null)}
        >
          <div className="card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-1">Batalkan Pesanan</h3>
            <p className="text-sm text-ink/50 mb-4">
              #{String(popupBatal.nomor_urut).padStart(4, "0")} —{" "}
              {formatRupiah(popupBatal.total)}. Stok bahan baku akan otomatis
              dikembalikan.
            </p>
            <label className="label-field">Alasan Pembatalan (wajib)</label>
            <textarea
              className="input-field mb-4"
              rows={3}
              placeholder="Contoh: salah input menu, pelanggan batal"
              value={alasanBatal}
              onChange={(e) => setAlasanBatal(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPopupBatal(null)}
                disabled={memproses}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={konfirmasiBatal}
                disabled={memproses}
                className="bg-rust hover:bg-rust/90 text-white px-4 py-2 rounded text-sm font-medium flex-1"
              >
                {memproses ? "Memproses..." : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
