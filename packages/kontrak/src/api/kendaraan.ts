import { z } from "zod";
import { Id, Plat, TanpaMasukan, rute } from "./primitif";

// Kendaraan pengangkut (S13). Tanpa nama sopir.

export const Kendaraan = z.object({ id: Id, plat: Plat, aktif: z.boolean() });
export type Kendaraan = z.infer<typeof Kendaraan>;

export const KendaraanBuatMasukan = z.object({ plat: Plat }).strict();
export const KendaraanParams = z.object({ id: Id });
export const KendaraanKeluaran = z.object({ kendaraan: Kendaraan });
export const KendaraanDaftarKeluaran = z.object({ kendaraan: z.array(Kendaraan) });

export const RUTE_KENDARAAN = [
  rute({ metode: "POST", jalur: "/api/kendaraan", akses: ["PENGANGKUT", "PENGURUS"], masukan: KendaraanBuatMasukan, keluaran: KendaraanKeluaran }),
  rute({ metode: "GET", jalur: "/api/kendaraan", akses: ["PENGANGKUT"], masukan: TanpaMasukan, keluaran: KendaraanDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/kendaraan/[id]/nonaktif", akses: ["PENGANGKUT", "PENGURUS"], params: KendaraanParams, masukan: TanpaMasukan, keluaran: KendaraanKeluaran }),
] as const;
