import { MidtransSandbox, tandaTanganMidtrans } from "./index";

// Pembantu test: penyedia sandbox TIRUAN di balik fetch palsu. Kosakata penyedia tetap tinggal di adaptor (guard h);
// test di luar adaptor hanya memakai kosakata domain di bawah. Tidak pernah menghubungi jaringan.

export const KUNCI_SERVER_UJI = "SB-Mid-server-uji-tiruan";

export type StatusTiruan = "settlement" | "capture" | "pending" | "expire" | "cancel" | "deny" | "refund";
type Transaksi = { status: StatusTiruan; jumlahIdr: number; idTransaksi: string; fraud?: string };

export class SandboxTiruan {
  /** Status yang akan dikembalikan Get Status per nomor tagihan; tidak ada → 404. */
  readonly transaksi = new Map<string, Transaksi>();
  /** Jejak panggilan "METODE url". */
  readonly panggilan: string[] = [];
  /** Bila diisi, Get Status melempar galat jaringan. */
  gagalJaringan = false;
  readonly penyedia: MidtransSandbox;
  /** fetch palsu (dapat dipasang ke MidtransSandbox lain, mis. dengan kunci salah). */
  readonly ambil = (url: string, init?: RequestInit): Promise<Response> => this.tangani(url, init);

  constructor(private readonly kunci = KUNCI_SERVER_UJI) {
    this.penyedia = new MidtransSandbox(kunci, this.ambil);
  }

  private async tangani(url: string, init?: RequestInit): Promise<Response> {
    const metode = init?.method ?? "GET";
    this.panggilan.push(`${metode} ${url}`);
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== `Basic ${Buffer.from(`${this.kunci}:`).toString("base64")}`) return Response.json({ status_code: "401" }, { status: 401 });
    if (metode === "POST") {
      const isi = JSON.parse(String(init?.body)) as { transaction_details: { order_id: string; gross_amount: number } };
      const nomor = isi.transaction_details.order_id;
      return Response.json({ token: `tok-${nomor}`, redirect_url: `https://app.sandbox.midtrans.com/snap/v4/redirection/tok-${nomor}` }, { status: 201 });
    }
    if (this.gagalJaringan) throw new TypeError("fetch failed");
    const nomor = decodeURIComponent(/\/v2\/([^/]+)\/status$/.exec(url)?.[1] ?? "");
    const t = this.transaksi.get(nomor);
    if (!t) return Response.json({ status_code: "404", status_message: "Transaction doesn't exist." }, { status: 200 });
    return Response.json({
      status_code: t.status === "settlement" || t.status === "capture" ? "200" : "201",
      transaction_id: t.idTransaksi,
      order_id: nomor,
      gross_amount: `${t.jumlahIdr}.00`,
      transaction_status: t.status,
      ...(t.fraud ? { fraud_status: t.fraud } : {}),
    });
  }

  /** Atur status transaksi yang akan ditarik ulang. */
  atur(nomorTagihan: string, t: Transaksi): void {
    this.transaksi.set(nomorTagihan, t);
  }

  /** Badan notifikasi bertanda tangan (tandaSalah → tanda tangan dirusak). */
  notifikasi(nomorTagihan: string, t: Transaksi, opsi: { tandaSalah?: boolean } = {}): Record<string, unknown> {
    const kode = t.status === "settlement" || t.status === "capture" ? "200" : "201";
    const jumlah = `${t.jumlahIdr}.00`;
    const tanda = tandaTanganMidtrans(nomorTagihan, kode, jumlah, opsi.tandaSalah ? `${this.kunci}x` : this.kunci);
    return {
      transaction_time: "2026-10-15 10:00:00",
      transaction_status: t.status,
      transaction_id: t.idTransaksi,
      status_code: kode,
      signature_key: tanda,
      payment_type: "bank_transfer",
      order_id: nomorTagihan,
      gross_amount: jumlah,
      ...(t.fraud ? { fraud_status: t.fraud } : {}),
    };
  }
}
