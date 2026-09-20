import crypto from "crypto";

// ============================================================
// KONFIGURASI DOKU -- diambil dari environment variables.
// Isi semua ini di .env.local (development) dan di Vercel Project
// Settings > Environment Variables (production).
// ============================================================
const DOKU_BASE_URL = process.env.DOKU_IS_PRODUCTION === "true"
  ? "https://api.doku.com"
  : "https://api-sandbox.doku.com";

const CLIENT_ID = process.env.DOKU_CLIENT_ID as string;
const SECRET_KEY = process.env.DOKU_SECRET_KEY as string;
const PARTNER_ID = process.env.DOKU_PARTNER_ID as string; // biasanya sama dengan Client ID
// Catatan: DOKU tidak punya "Merchant ID" terpisah -- Client ID (format
// BRN-xxxx-xxxxxxxxxxxxx) itu sendiri yang dipakai sebagai merchantId.
const MERCHANT_ID = process.env.DOKU_CLIENT_ID as string;
const PRIVATE_KEY_PEM = (process.env.DOKU_PRIVATE_KEY as string)?.replace(/\\n/g, "\n");
const PRIVATE_KEY_PASSPHRASE = process.env.DOKU_PRIVATE_KEY_PASSPHRASE as string;

function timestampIso(): string {
  // Format wajib DOKU: yyyy-MM-ddTHH:mm:ssZ (UTC, tanpa milidetik)
  return new Date().toISOString().split(".")[0] + "Z";
}

/**
 * LANGKAH 1: Ambil access token B2B dari DOKU.
 * Pakai signature ASYMMETRIC (ditandatangani private key kita sendiri).
 */
async function getAccessToken(): Promise<string> {
  const timestamp = timestampIso();
  const stringToSign = `${CLIENT_ID}|${timestamp}`;

  const privateKey = crypto.createPrivateKey({
    key: PRIVATE_KEY_PEM,
    passphrase: PRIVATE_KEY_PASSPHRASE,
    format: "pem",
  });

  const signature = crypto.sign("RSA-SHA256", Buffer.from(stringToSign), privateKey).toString("base64");

  const res = await fetch(`${DOKU_BASE_URL}/authorization/v1/access-token/b2b`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CLIENT-KEY": CLIENT_ID,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });

  const data = await res.json();
  if (!res.ok || !data.accessToken) {
    throw new Error(`Gagal ambil token DOKU: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

/**
 * LANGKAH 2: Generate QRIS dinamis untuk 1 nominal transaksi.
 * Pakai signature SYMMETRIC (HMAC-SHA512 pakai Secret Key + access token).
 */
export async function generateQrisDoku(params: {
  referenceNo: string; // ID unik transaksi kita (pakai nomor_urut pesanan)
  amount: number;
}): Promise<{ qrContent: string; referenceNo: string }> {
  const accessToken = await getAccessToken();
  const timestamp = timestampIso();
  const externalId = `${params.referenceNo}-${Date.now()}`;
  const endpointPath = "/snap-adapter/b2b/v1.0/qr/qr-mpm-generate";

  const body = {
    partnerReferenceNo: params.referenceNo,
    amount: {
      value: params.amount.toFixed(2),
      currency: "IDR",
    },
    merchantId: MERCHANT_ID,
    additionalInfo: {
      feeType: "01", // 01 = fee ditanggung merchant (paling umum)
    },
  };

  const minifiedBody = JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(minifiedBody).digest("hex").toLowerCase();
  const stringToSign = `POST:${endpointPath}:${accessToken}:${bodyHash}:${timestamp}`;
  const signature = crypto.createHmac("sha512", SECRET_KEY).update(stringToSign).digest("base64");

  const res = await fetch(`${DOKU_BASE_URL}${endpointPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PARTNER-ID": PARTNER_ID,
      "X-EXTERNAL-ID": externalId,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
      "CHANNEL-ID": "DOKU",
      Authorization: `Bearer ${accessToken}`,
    },
    body: minifiedBody,
  });

  const data = await res.json();
  if (!res.ok || !data.qrContent) {
    throw new Error(`Gagal generate QRIS DOKU: ${JSON.stringify(data)}`);
  }

  return { qrContent: data.qrContent, referenceNo: params.referenceNo };
}

/**
 * Verifikasi signature notifikasi yang dikirim DOKU ke webhook kita --
 * supaya tidak sembarang orang bisa "palsu" kirim notifikasi bayar sukses.
 */
export function verifikasiSignatureWebhook(params: {
  signature: string;
  timestamp: string;
  requestBody: string;
  httpMethod: string;
  endpointPath: string;
  accessToken: string;
}): boolean {
  const bodyHash = crypto
    .createHash("sha256")
    .update(params.requestBody)
    .digest("hex")
    .toLowerCase();
  const stringToSign = `${params.httpMethod}:${params.endpointPath}:${params.accessToken}:${bodyHash}:${params.timestamp}`;
  const expected = crypto.createHmac("sha512", SECRET_KEY).update(stringToSign).digest("base64");
  return expected === params.signature;
}
