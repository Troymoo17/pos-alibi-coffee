// Koneksi ke printer thermal BLE (Bluetooth Low Energy) lewat Web Bluetooth API.
// CATATAN PENTING: ini HANYA jalan untuk printer BLE, bukan Bluetooth Classic/SPP
// (yang dipakai kebanyakan printer 58mm murah). Kalau printer kamu Classic,
// requestDevice() di bawah ini tidak akan menemukan printernya sama sekali --
// itu bukan bug, itu keterbatasan browser (lihat penjelasan di chat).

// Beberapa UUID service/characteristic yang umum dipakai printer BLE generik.
// Kita coba satu-satu sampai ketemu yang cocok dengan printer kamu.
const CANDIDATE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

const CANDIDATE_CHARACTERISTICS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
];

export function bluetoothTersedia(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export type PrinterBluetooth = {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
};

export async function hubungkanPrinterBluetooth(): Promise<PrinterBluetooth> {
  if (!bluetoothTersedia()) {
    throw new Error(
      "Browser ini tidak mendukung Web Bluetooth (cuma Chrome/Edge di Android & Laptop yang bisa)."
    );
  }

  // acceptAllDevices supaya semua printer BLE di sekitar muncul di daftar
  // pilihan, karena kita tidak tahu persis merk/UUID printer kamu.
  const device = await navigator.bluetooth!.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATE_SERVICES,
  });

  const server = await device.gatt!.connect();

  for (const serviceUuid of CANDIDATE_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of CANDIDATE_CHARACTERISTICS) {
        try {
          const characteristic = await service.getCharacteristic(charUuid);
          return { device, characteristic };
        } catch {
          // coba characteristic berikutnya
        }
      }
    } catch {
      // coba service berikutnya
    }
  }

  throw new Error(
    "Printer terhubung tapi service/characteristic-nya tidak dikenali. " +
      "Kemungkinan printer ini pakai Bluetooth Classic (bukan BLE), atau UUID custom yang belum didukung."
  );
}

export async function kirimKePrinter(
  printer: PrinterBluetooth,
  data: Uint8Array
): Promise<void> {
  // Chunk lebih besar + jeda lebih kecil dari sebelumnya (dulu 20 byte/20ms,
  // sekarang 128 byte/8ms) -- aman dipakai karena printer kamu sudah terbukti
  // bisa connect & print dengan stabil. Ini bikin proses kirim ±8x lebih
  // cepat, kerasa banget bedanya pas ada gambar logo (data besar).
  const CHUNK_SIZE = 128;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    await printer.characteristic.writeValue(chunk);
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}
