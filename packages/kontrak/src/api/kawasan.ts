import { z } from "zod";
import { JenisKawasan } from "../enum";
import { Adm4, Id, KodeKawasan, TanpaMasukan, rute } from "./primitif";

// Kawasan (S13).

export const Kawasan = z.object({
  id: Id,
  organisasiId: Id,
  kode: KodeKawasan,
  nama: z.string(),
  jenis: JenisKawasan,
  alamat: z.string(),
  adm4: Adm4,
  kodeKecamatan: z.string().nullable(),
  namaKelurahan: z.string().nullable(),
  namaKecamatan: z.string().nullable(),
  kota: z.string(),
});
export type Kawasan = z.infer<typeof Kawasan>;

const Teks = (maks: number) => z.string().trim().min(2).max(maks);

export const KawasanBuatMasukan = z
  .object({ nama: Teks(120), jenis: JenisKawasan, alamat: Teks(300), adm4: Adm4, kota: Teks(80) })
  .strict();
export const KawasanUbahMasukan = KawasanBuatMasukan.partial().strict();
export const KawasanParams = z.object({ id: Id });
export const KawasanKeluaran = z.object({ kawasan: Kawasan });
export const KawasanDaftarKeluaran = z.object({ kawasan: z.array(Kawasan) });

export const RUTE_KAWASAN = [
  rute({ metode: "POST", jalur: "/api/kawasan", akses: ["PENGELOLA"], masukan: KawasanBuatMasukan, keluaran: KawasanKeluaran }),
  rute({ metode: "GET", jalur: "/api/kawasan", akses: ["PENGELOLA"], masukan: TanpaMasukan, keluaran: KawasanDaftarKeluaran }),
  rute({ metode: "PATCH", jalur: "/api/kawasan/[id]", akses: ["PENGELOLA"], params: KawasanParams, masukan: KawasanUbahMasukan, keluaran: KawasanKeluaran }),
] as const;
