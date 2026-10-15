import { z } from "zod";
import { Aliran } from "../enum";
import { BeratG, BeratGTotal, Id, Periode, SelisihG, TanpaMasukan, rute } from "./primitif";

// Mode bayangan (S24): angka catatan lama vs SERAH, selisih dua arah tanpa menilai pihak mana pun.

export const BayanganBuatMasukan = z
  .object({ kawasanId: Id, periode: Periode, aliran: Aliran, beratG: BeratG, sumberCatatan: z.string().trim().min(2).max(60) })
  .strict();
export const BayanganBuatKeluaran = z.object({ id: Id });

export const BayanganPerbandinganKueri = z.object({ kawasanId: Id, periode: Periode }).strict();
export const BayanganPerbandinganKeluaran = z.object({
  periode: Periode,
  baris: z.array(
    z.object({
      aliran: Aliran,
      serahG: BeratGTotal,
      bayanganG: BeratGTotal,
      /** bayangan − serah; positif = catatan lama lebih besar. */
      selisihG: SelisihG,
      sumberCatatan: z.array(z.string()),
    }),
  ),
});

export const RUTE_BAYANGAN = [
  rute({ metode: "POST", jalur: "/api/bayangan", akses: ["PENGELOLA"], masukan: BayanganBuatMasukan, keluaran: BayanganBuatKeluaran }),
  rute({ metode: "GET", jalur: "/api/bayangan/perbandingan", akses: ["PENGELOLA"], kueri: BayanganPerbandinganKueri, masukan: TanpaMasukan, keluaran: BayanganPerbandinganKeluaran }),
] as const;
