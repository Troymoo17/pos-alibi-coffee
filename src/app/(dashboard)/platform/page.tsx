"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Platform } from "@/lib/types";
import { formatRupiah, hitungHargaPlatform } from "@/lib/hpp";

const PRESET_KOMISI = [0, 5, 10, 15, 20, 25, 30, 35, 40];

export default function PlatformPage() {
  const [platformList, setPlatformList] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualInput, setManualInput] = useState<Record<string, string>>({});
  const [contohHarga, setContohHarga] = useState("10000");

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("platform")
      .select("*")
      .order("urutan", { ascending: true });
    setPlatformList((data as Platform[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handlePilihPreset(platformId: string, persen: number) {
    await supabase.from("platform").update({ komisi_persen: persen }).eq("id", platformId);
    loadData();
  }

  async function handleSimpanManual(platformId: string) {
    const nilai = parseFloat(manualInput[platformId] ?? "");
    if (isNaN(nilai) || nilai < 0) return;
    await supabase.from("platform").update({ komisi_persen: nilai }).eq("id", platformId);
    setManualInput((prev) => ({ ...prev, [platformId]: "" }));
    loadData();
  }

  const contoh = parseFloat(contohHarga || "0");

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg mb-1">Komisi Tiap Platform</h2>
        <p className="text-xs text-ink/50 mb-4">
          Atur berapa persen komisi yang dipotong tiap platform. Pilih preset
          di bawah, atau ketik manual kalau kamu sudah tahu persisnya (bisa
          dicek di dashboard merchant GoFood/ShopeeFood/GrabFood kamu).
        </p>

        <div className="flex items-center gap-2 mb-6 bg-ledger-dark/[0.04] rounded-md p-3">
          <label className="text-xs text-ink/60 whitespace-nowrap">
            Contoh harga dasar (offline):
          </label>
          <input
            type="number"
            className="input-field !py-1 w-32"
            value={contohHarga}
            onChange={(e) => setContohHarga(e.target.value)}
          />
        </div>

        {loading && <p className="text-ink/50 text-sm">Memuat...</p>}

        <div className="space-y-5">
          {platformList.map((p) => (
            <div key={p.id} className="border-b border-line pb-5 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{p.nama}</h3>
                <span className="font-mono text-sm text-ledger font-semibold">
                  Komisi: {p.komisi_persen}%
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_KOMISI.map((persen) => (
                  <button
                    key={persen}
                    onClick={() => handlePilihPreset(p.id, persen)}
                    className={`px-3 py-1.5 rounded-md text-sm font-mono border transition-colors ${
                      p.komisi_persen === persen
                        ? "bg-ledger text-white border-ledger"
                        : "border-line text-ink/60 hover:border-ledger hover:text-ledger"
                    }`}
                  >
                    {persen}%
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-center mb-3">
                <input
                  type="number"
                  step="0.1"
                  className="input-field !py-1.5 w-32 text-sm"
                  placeholder="Manual %"
                  value={manualInput[p.id] ?? ""}
                  onChange={(e) =>
                    setManualInput((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                />
                <button
                  onClick={() => handleSimpanManual(p.id)}
                  className="btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Simpan Manual
                </button>
              </div>

              {p.komisi_persen > 0 ? (
                <p className="text-xs text-ink/50">
                  Kalau harga offline {formatRupiah(contoh)}, harga yang harus
                  dipasang di {p.nama}:{" "}
                  <span className="font-mono font-semibold text-ledger">
                    {formatRupiah(hitungHargaPlatform(contoh, p.komisi_persen))}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-ink/40">
                  Komisi 0% — harga sama seperti harga offline (cocok untuk
                  "Offline / Langsung").
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 bg-ledger-dark/[0.03]">
        <h3 className="font-display text-base mb-2">Cara kerja perhitungannya</h3>
        <p className="text-sm text-ink/60 leading-relaxed">
          Harga di Platform = Harga Offline ÷ (1 − komisi%), lalu dibulatkan ke
          atas ke kelipatan Rp500. Ini memastikan pendapatan bersih kamu
          setelah dipotong komisi tetap sama dengan harga offline. Harga per
          platform ini otomatis muncul di halaman <b>Produk &amp; Resep</b>,
          dan dipakai otomatis saat kamu catat penjualan di halaman{" "}
          <b>Penjualan</b>.
        </p>
      </div>
    </div>
  );
}
