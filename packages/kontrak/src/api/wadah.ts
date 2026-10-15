import { z } from "zod";
import { Aliran } from "../enum";
import { RujukanAturan } from "../galat";
import { BeratG, Id, Jam, JumlahWadah, TanpaMasukan, WaktuIso, rute } from "./primitif";

// Catat wadah per aliran (S08). Berat dikirim dalam gram bulat (hasil parseBeratKgKeGram di klien);
// server tetap memvalidasi & menghitung ulang semua turunan.

export const WadahCatatMasukan = z
  .object({
    tpsId: Id,
    aliran: Aliran,
    beratG: BeratG.optional(),
    jumlahWadah: JumlahWadah.optional(),
    terjadiPada: WaktuIso,
  })
  .strict()
  .refine((m) => m.beratG !== undefined || m.jumlahWadah !== undefined, {
    message: "Isi berat atau jumlah wadah",
    path: ["beratG"],
  });
export type WadahCatatMasukan = z.infer<typeof WadahCatatMasukan>;
export const WadahCatatKeluaran = z.object({ id: Id, diterimaPada: WaktuIso });

export const WadahMenunggu = z.object({
  id: Id,
  aliran: Aliran,
  beratG: BeratG.nullable(),
  jumlahWadah: JumlahWadah.nullable(),
  terjadiPada: WaktuIso,
  umurJam: Jam,
});
export const TpsMenungguParams = z.object({ id: Id });
export const TpsMenungguKeluaran = z.object({
  wadah: z.array(WadahMenunggu),
  peringatan: z.array(RujukanAturan),
});

export const RUTE_WADAH = [
  rute({ metode: "POST", jalur: "/api/wadah", akses: ["PETUGAS", "PENGELOLA"], masukan: WadahCatatMasukan, keluaran: WadahCatatKeluaran, idempoten: true }),
  rute({ metode: "GET", jalur: "/api/tps/[id]/menunggu", akses: ["PETUGAS", "PENGELOLA"], params: TpsMenungguParams, masukan: TanpaMasukan, keluaran: TpsMenungguKeluaran }),
] as const;
