import { z } from "zod";
import { AksiAturan, KodeAturan } from "./enum";

// Kode galat & status HTTP (§K.1) + amplop respons.

export const STATUS_HTTP_GALAT = {
  VALIDASI_GAGAL: 400,
  FIELD_TIDAK_DIKENAL: 400,
  SESI_HABIS: 401,
  PERAN_TIDAK_BOLEH: 403,
  HAK_PAKET_TIDAK_ADA: 403,
  TIDAK_DITEMUKAN: 404,
  TRANSISI_TIDAK_SAH: 409,
  KONFLIK_VERSI: 409,
  ATURAN_DITOLAK: 422,
  BATAS_LAJU: 429,
  AI_TIDAK_TERSEDIA: 503,
  BMKG_TIDAK_TERSEDIA: 503,
  GALAT_SERVER: 500,
} as const;

export type KodeGalat = keyof typeof STATUS_HTTP_GALAT;
export const KODE_GALAT = Object.keys(STATUS_HTTP_GALAT) as [KodeGalat, ...KodeGalat[]];
export const KodeGalat = z.enum(KODE_GALAT);

export function statusHttp(kode: KodeGalat): number {
  return STATUS_HTTP_GALAT[kode];
}

export const RujukanAturan = z.object({
  kode: KodeAturan,
  aksi: AksiAturan,
  teks: z.string(),
});
export type RujukanAturan = z.infer<typeof RujukanAturan>;

export const RincianGalat = z.object({
  jalur: z.array(z.union([z.string(), z.number().int()])),
  kode: z.string(),
});

export const Galat = z.object({
  kode: KodeGalat,
  pesan: z.string(),
  aturan: RujukanAturan.optional(),
  rincian: z.array(RincianGalat).optional(),
});
export type Galat = z.infer<typeof Galat>;

export const AmplopGagal = z.object({ ok: z.literal(false), galat: Galat });
export type AmplopGagal = z.infer<typeof AmplopGagal>;

/** Amplop sukses `{ ok: true, data }` untuk skema keluaran apa pun. */
export function amplopSukses<T extends z.ZodType>(data: T) {
  return z.object({ ok: z.literal(true), data });
}

export type AmplopSukses<T> = { ok: true; data: T };
export type Amplop<T> = AmplopSukses<T> | AmplopGagal;

/** Header respons duplikat idempoten. */
export const HEADER_IDEMPOTENT_REPLAY = "Idempotent-Replay";
/** Header masukan aksi lapangan. */
export const HEADER_IDEMPOTENCY_KEY = "Idempotency-Key";
/** Header alasan admin (≥15 karakter). */
export const HEADER_ALASAN_ADMIN = "X-Alasan";
/** Header sidik isi berkas ekspor. */
export const HEADER_SIDIK_ISI = "X-Sidik-Isi";
