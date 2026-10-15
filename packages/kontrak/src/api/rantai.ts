import { z } from "zod";
import { Id, TanpaMasukan, rute } from "./primitif";

// Verifikasi rantai catatan per kawasan (S08). Hanya mengembalikan keutuhan, bukan isi event.

export const RantaiVerifikasiKueri = z.object({ kawasanId: Id }).strict();
export const RantaiVerifikasiKeluaran = z.object({
  utuh: z.boolean(),
  jumlah: z.number().int().min(0),
  patahDiUrutan: z.number().int().min(1).nullable(),
});

export const RUTE_RANTAI = [
  rute({ metode: "GET", jalur: "/api/rantai/verifikasi", akses: ["PENGELOLA", "PENGANGKUT", "PENERIMA", "PETUGAS"], kueri: RantaiVerifikasiKueri, masukan: TanpaMasukan, keluaran: RantaiVerifikasiKeluaran }),
] as const;
