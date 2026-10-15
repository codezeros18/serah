import { z } from "zod";
import { KeyakinanAi } from "../enum";
import { Id, rute } from "./primitif";

// Pembacaan tiket/nota timbang (S06 adaptor, S08 rute). Hasil = saran berlabel; manusia mengonfirmasi.
// Berat dikembalikan sebagai TEKS kg apa adanya; konversi ke gram hanya lewat parseBeratKgKeGram().

export const TiketBacaMasukan = z.object({ fotoId: Id }).strict();
export const TiketBacaKeluaran = z.object({
  nomorTiket: z.string().nullable(),
  beratKgTeks: z.string().nullable(),
  tanggal: z.string().nullable(),
  keyakinan: KeyakinanAi,
  model: z.string(),
});
export type TiketBacaKeluaran = z.infer<typeof TiketBacaKeluaran>;

export const RUTE_TIKET = [
  rute({ metode: "POST", jalur: "/api/tiket/baca", akses: ["PENERIMA"], masukan: TiketBacaMasukan, keluaran: TiketBacaKeluaran }),
] as const;
