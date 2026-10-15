import { z } from "zod";
import { StatusSinkron } from "../enum";
import { Galat } from "../galat";
import { IdempotencyKey, KodeSerah, WaktuIso, rute } from "./primitif";
import { SerahAmbilMasukan, SerahBuatMasukan, SerahTutupMasukan } from "./serah";
import { WadahCatatMasukan } from "./wadah";

// Sinkron antrean offline (S08/S09). Batch ≤20; hasil per aksi DITERAPKAN | DUPLIKAT | DITOLAK.

export const SINKRON_BATCH_MAKS = 20;

const dasar = { idempotencyKey: IdempotencyKey, terjadiPada: WaktuIso };

export const AksiSinkron = z.discriminatedUnion("jenis", [
  z.object({ ...dasar, jenis: z.literal("WADAH_CATAT"), payload: WadahCatatMasukan }).strict(),
  z.object({ ...dasar, jenis: z.literal("SERAH_BUAT"), payload: SerahBuatMasukan }).strict(),
  z.object({ ...dasar, jenis: z.literal("SERAH_AMBIL"), payload: SerahAmbilMasukan.extend({ kode: KodeSerah }).strict() }).strict(),
  z.object({ ...dasar, jenis: z.literal("SERAH_TUTUP"), payload: SerahTutupMasukan.extend({ kode: KodeSerah }).strict() }).strict(),
]);
export type AksiSinkron = z.infer<typeof AksiSinkron>;

export const SinkronMasukan = z.object({ aksi: z.array(AksiSinkron).min(1).max(SINKRON_BATCH_MAKS) }).strict();
export const SinkronKeluaran = z.object({
  hasil: z.array(z.object({ idempotencyKey: IdempotencyKey, status: StatusSinkron, galat: Galat.optional() })),
});

export const RUTE_SINKRON = [
  rute({ metode: "POST", jalur: "/api/sinkron", akses: ["SESI"], masukan: SinkronMasukan, keluaran: SinkronKeluaran }),
] as const;
