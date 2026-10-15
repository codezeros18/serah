import { z } from "zod";
import { Aliran, ModeData, SumberCuaca } from "../enum";
import { Adm4, Id, Jam, TanpaMasukan, WaktuIso, rute } from "./primitif";

// Cuaca BMKG & prioritas angkut R-10 (S05, S08). Prioritas bukan peringatan dini resmi.

export const CuacaParams = z.object({ adm4: Adm4 });
export const SlotPrakiraan = z.object({ slotUtc: WaktuIso, weatherDesc: z.string(), weatherDescEn: z.string().nullable() });
export const CuacaKeluaran = z.object({
  adm4: Adm4,
  mode: ModeData,
  analysisDate: WaktuIso,
  basi: z.boolean(),
  slot: z.array(SlotPrakiraan),
});

export const PrioritasParams = z.object({ id: Id });
export const PrioritasKeluaran = z.object({
  prioritas: z
    .object({
      sumber: SumberCuaca,
      /** slot_utc (PRAKIRAAN) atau identifier CAP (NOWCAST). */
      acuan: z.string(),
      aliran: Aliran,
      umurJam: Jam,
      teks: z.string(),
      /** Selalu R10_CATATAN. */
      catatan: z.string(),
    })
    .nullable(),
});

export const RUTE_CUACA = [
  rute({ metode: "GET", jalur: "/api/cuaca/[adm4]", akses: ["SESI"], params: CuacaParams, masukan: TanpaMasukan, keluaran: CuacaKeluaran }),
  rute({ metode: "GET", jalur: "/api/tps/[id]/prioritas", akses: ["PETUGAS", "PENGELOLA", "PENGANGKUT"], params: PrioritasParams, masukan: TanpaMasukan, keluaran: PrioritasKeluaran }),
] as const;
