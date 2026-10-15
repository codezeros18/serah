import { createHash, timingSafeEqual } from "node:crypto";

// Adaptor penyedia pembayaran (S19-4/5). SATU-SATUNYA tempat kosakata Midtrans boleh muncul (guard h):
// order_id, transaction_status, gross_amount, snap. Layanan di luar adaptor hanya melihat kosakata domain di bawah.
//
// Sumber (GAP-MID-01, dibaca 15 Okt 2026):
// - Notifikasi HTTP(S): https://docs.midtrans.com/docs/https-notification-webhooks
//   signature_key = SHA512(order_id + status_code + gross_amount + ServerKey); balas HTTP 200; verifikasi ulang
//   lewat Get Status API; sukses bila transaction_status settlement, atau capture dengan fraud_status accept.
// - Snap: https://docs.midtrans.com/reference/backend-integration — POST https://app.sandbox.midtrans.com/snap/v1/transactions,
//   Authorization Basic Base64(SERVER_KEY + ":"), transaction_details.order_id (string) & gross_amount (integer).
// - Get Status: https://docs.midtrans.com/reference/get-transaction-status — GET https://api.sandbox.midtrans.com/v2/{order_id}/status;
//   404 = transaksi tidak ada; gross_amount berupa teks "30000.00".
// HANYA SANDBOX: URL produksi tidak ada di berkas ini dan MIDTRANS_IS_PRODUCTION=true membuat aplikasi gagal start.

const SNAP_SANDBOX = "https://app.sandbox.midtrans.com/snap/v1/transactions";
const API_SANDBOX = "https://api.sandbox.midtrans.com";

/** Status pembayaran dalam kosakata domain. */
export type StatusBayar = "LUNAS" | "MENUNGGU" | "KEDALUWARSA" | "GAGAL" | "TIDAK_ADA" | "DIKEMBALIKAN";

export type HasilStatus = {
  status: StatusBayar;
  /** Nominal rupiah bulat bila dapat diurai tanpa pecahan; null bila tidak ada/berpecahan. */
  jumlahIdr: number | null;
  idTransaksi: string | null;
  mentah: Record<string, unknown>;
};

export type NotifikasiTerverifikasi = {
  nomorTagihan: string;
  /** Kunci idempotensi peristiwa: id transaksi + status penyedia. */
  kunciPeristiwa: string;
  jenis: string;
  jumlahIdr: number | null;
  mentah: Record<string, unknown>;
};

export interface PenyediaBayar {
  readonly nama: "MIDTRANS";
  buatPembayaran(m: { nomorTagihan: string; totalIdr: number }): Promise<{ token: string; urlBayar: string }>;
  tarikStatus(nomorTagihan: string): Promise<HasilStatus>;
  /** null bila tanda tangan tidak sah atau isi tidak lengkap. */
  verifikasiNotifikasi(isi: Record<string, unknown>): NotifikasiTerverifikasi | null;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const teks = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);

/** "350000.00" / "350000" → 350000; berpecahan atau tidak sah → null (tanpa float). */
export function uraiRupiah(v: unknown): number | null {
  const s = teks(v);
  const m = s ? /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(s.trim()) : null;
  if (!m || (m[2] && /[1-9]/.test(m[2]))) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

/** Status penyedia → domain. capture hanya LUNAS bila fraud_status accept (atau tidak ada). */
export function petakanStatus(statusPenyedia: string | null, fraud: string | null): StatusBayar {
  switch (statusPenyedia) {
    case "settlement":
      return fraud === null || fraud === "accept" ? "LUNAS" : "MENUNGGU";
    case "capture":
      return fraud === "accept" ? "LUNAS" : "MENUNGGU";
    case "pending":
    case "authorize":
      return "MENUNGGU";
    case "expire":
      return "KEDALUWARSA";
    case "cancel":
    case "deny":
    case "failure":
      return "GAGAL";
    case "refund":
    case "partial_refund":
      return "DIKEMBALIKAN";
    default:
      return "MENUNGGU";
  }
}

function samaWaktuKonstan(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** signature_key = SHA512(order_id + status_code + gross_amount + ServerKey), hex. */
export function tandaTanganMidtrans(orderId: string, statusCode: string, grossAmount: string, serverKey: string): string {
  return createHash("sha512").update(orderId + statusCode + grossAmount + serverKey, "utf8").digest("hex");
}

export class MidtransSandbox implements PenyediaBayar {
  readonly nama = "MIDTRANS" as const;

  constructor(
    private readonly serverKey: string,
    private readonly ambil: Fetch = (u, i) => fetch(u, i),
  ) {
    if (!serverKey) throw new Error("Kunci server sandbox kosong");
  }

  private otorisasi(): string {
    return `Basic ${Buffer.from(`${this.serverKey}:`, "utf8").toString("base64")}`;
  }

  async buatPembayaran(m: { nomorTagihan: string; totalIdr: number }): Promise<{ token: string; urlBayar: string }> {
    if (!Number.isSafeInteger(m.totalIdr) || m.totalIdr <= 0) throw new Error("total tagihan harus bilangan bulat positif");
    const r = await this.ambil(SNAP_SANDBOX, {
      method: "POST",
      headers: { Authorization: this.otorisasi(), Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_details: { order_id: m.nomorTagihan, gross_amount: m.totalIdr } }),
    });
    const isi = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const token = teks(isi.token);
    const url = teks(isi.redirect_url);
    if (!r.ok || !token || !url) throw new Error(`Pembuatan pembayaran gagal: HTTP ${r.status}`);
    return { token, urlBayar: url };
  }

  async tarikStatus(nomorTagihan: string): Promise<HasilStatus> {
    const r = await this.ambil(`${API_SANDBOX}/v2/${encodeURIComponent(nomorTagihan)}/status`, {
      method: "GET",
      headers: { Authorization: this.otorisasi(), Accept: "application/json" },
    });
    const isi = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (teks(isi.status_code) === "404" || r.status === 404) return { status: "TIDAK_ADA", jumlahIdr: null, idTransaksi: null, mentah: isi };
    if (!r.ok) throw new Error(`Tarik status gagal: HTTP ${r.status}`);
    return {
      status: petakanStatus(teks(isi.transaction_status), teks(isi.fraud_status)),
      jumlahIdr: uraiRupiah(isi.gross_amount),
      idTransaksi: teks(isi.transaction_id),
      mentah: isi,
    };
  }

  verifikasiNotifikasi(isi: Record<string, unknown>): NotifikasiTerverifikasi | null {
    const orderId = teks(isi.order_id);
    const statusCode = teks(isi.status_code);
    const gross = teks(isi.gross_amount);
    const tanda = teks(isi.signature_key);
    const status = teks(isi.transaction_status);
    const idTransaksi = teks(isi.transaction_id);
    if (!orderId || !statusCode || !gross || !tanda || !status || !idTransaksi) return null;
    if (!samaWaktuKonstan(tandaTanganMidtrans(orderId, statusCode, gross, this.serverKey), tanda.toLowerCase())) return null;
    return { nomorTagihan: orderId, kunciPeristiwa: `${idTransaksi}:${status}`, jenis: status, jumlahIdr: uraiRupiah(gross), mentah: isi };
  }
}

let pengganti: PenyediaBayar | null | undefined;

/** Hanya untuk test: pasang penyedia tiruan (null = tidak ada penyedia; undefined = kembali ke bawaan). */
export function setelPenyediaUji(p: PenyediaBayar | null | undefined): void {
  pengganti = p;
}

/** Penyedia aktif: bawaan Midtrans sandbox bila kunci server terisi; selain itu null (hanya transfer manual). */
export function penyediaBayar(c: { serverKey?: string | undefined }): PenyediaBayar | null {
  if (pengganti !== undefined) return pengganti;
  return c.serverKey ? new MidtransSandbox(c.serverKey) : null;
}
