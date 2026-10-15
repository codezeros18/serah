import { z } from "zod";
import { StatusTagihan } from "../enum";
import { Id, Idr, NomorTagihan, Periode, Tanggal, TanpaMasukan, WaktuIso, rute } from "./primitif";

// Tagihan langganan & pembayaran (S19). Payload penyedia pembayaran hanya divalidasi di adaptor bayar;
// kontrak hanya menerima objek mentah agar kosakata penyedia tidak bocor ke luar adaptor.

export const Tagihan = z.object({
  id: Id,
  nomor: NomorTagihan,
  periode: Periode,
  jumlahTps: z.number().int().min(0),
  hargaPerTpsIdr: Idr,
  totalIdr: Idr,
  status: StatusTagihan,
  jatuhTempo: Tanggal,
  dibuatPada: WaktuIso,
});
export type Tagihan = z.infer<typeof Tagihan>;

export const TagihanParams = z.object({ nomor: NomorTagihan });
export const TagihanDaftarKeluaran = z.object({ tagihan: z.array(Tagihan) });
export const TagihanKeluaran = z.object({ tagihan: Tagihan });

export const TagihanBayarKeluaran = z.object({ snapToken: z.string(), redirectUrl: z.url() });
export const TagihanTransferMasukan = z.object({ fotoBuktiId: Id }).strict();

export const WebhookPembayaranMasukan = z.record(z.string(), z.unknown());
/** Webhook selalu 200 setelah peristiwa tercatat. */
export const WebhookPembayaranKeluaran = z.object({ diterima: z.literal(true) });

export const RUTE_TAGIHAN = [
  rute({ metode: "GET", jalur: "/api/tagihan", akses: ["PENGELOLA"], masukan: TanpaMasukan, keluaran: TagihanDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/tagihan/[nomor]/bayar", akses: ["PENGELOLA"], params: TagihanParams, masukan: TanpaMasukan, keluaran: TagihanBayarKeluaran }),
  rute({ metode: "POST", jalur: "/api/tagihan/[nomor]/transfer", akses: ["PENGELOLA"], params: TagihanParams, masukan: TagihanTransferMasukan, keluaran: TagihanKeluaran }),
  rute({ metode: "POST", jalur: "/api/webhook/midtrans", akses: ["WEBHOOK"], masukan: WebhookPembayaranMasukan, keluaran: WebhookPembayaranKeluaran }),
  rute({ metode: "GET", jalur: "/api/tagihan/[nomor]/status", akses: ["PENGELOLA"], params: TagihanParams, masukan: TanpaMasukan, keluaran: TagihanKeluaran }),
] as const;
