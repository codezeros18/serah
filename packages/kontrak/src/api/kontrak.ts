import { z } from "zod";
import { Aliran, JenisPenerima, StatusIzin, StatusKontrak } from "../enum";
import { Id, Idr, RefRingkas, Tanggal, TanpaMasukan, WaktuIso, rute } from "./primitif";

// Kontrak kawasan–pengangkut–penerima & direktori mitra (S13, S15).

export const Kontrak = z.object({
  id: Id,
  kawasanId: Id,
  kawasan: RefRingkas,
  pengangkut: RefRingkas,
  penerima: RefRingkas,
  aliran: z.array(Aliran),
  berlakuDari: Tanggal,
  berlakuSampai: Tanggal,
  tarifPerRitIdr: Idr.nullable(),
  tarifPerKgIdr: Idr.nullable(),
  status: StatusKontrak,
  dikonfirmasiPengangkutPada: WaktuIso.nullable(),
  dikonfirmasiPenerimaPada: WaktuIso.nullable(),
});
export type Kontrak = z.infer<typeof Kontrak>;

export const KontrakBuatMasukan = z
  .object({
    kawasanId: Id,
    pengangkutId: Id,
    penerimaId: Id,
    aliran: z.array(Aliran).min(1),
    berlakuDari: Tanggal,
    berlakuSampai: Tanggal,
    tarifPerRitIdr: Idr.optional(),
    tarifPerKgIdr: Idr.optional(),
  })
  .strict();
export const KontrakParams = z.object({ id: Id });
export const KontrakDaftarKueri = z.object({ status: StatusKontrak.optional() }).strict();
export const KontrakKeluaran = z.object({ kontrak: Kontrak });
export const KontrakDaftarKeluaran = z.object({ kontrak: z.array(Kontrak) });

export const DirektoriMitraKueri = z.object({ jenis: z.enum(["PENGANGKUT", "PENERIMA"]).optional() }).strict();
export const Mitra = z.object({
  id: Id,
  nama: z.string(),
  jenis: z.enum(["PENGANGKUT", "PENERIMA"]),
  jenisPenerima: JenisPenerima.nullable(),
  statusIzin: StatusIzin,
  aliranDiterima: z.array(Aliran),
});
export const DirektoriMitraKeluaran = z.object({ mitra: z.array(Mitra) });

export const RUTE_KONTRAK = [
  rute({ metode: "GET", jalur: "/api/direktori/mitra", akses: ["PENGELOLA"], kueri: DirektoriMitraKueri, masukan: TanpaMasukan, keluaran: DirektoriMitraKeluaran }),
  rute({ metode: "POST", jalur: "/api/kontrak", akses: ["PENGELOLA"], masukan: KontrakBuatMasukan, keluaran: KontrakKeluaran }),
  rute({ metode: "POST", jalur: "/api/kontrak/[id]/konfirmasi", akses: ["PENGANGKUT", "PENERIMA"], params: KontrakParams, masukan: TanpaMasukan, keluaran: KontrakKeluaran }),
  rute({ metode: "POST", jalur: "/api/kontrak/[id]/akhiri", akses: ["PENGELOLA"], params: KontrakParams, masukan: TanpaMasukan, keluaran: KontrakKeluaran }),
  rute({ metode: "GET", jalur: "/api/kontrak", akses: ["PENGELOLA", "PENGANGKUT", "PENERIMA"], kueri: KontrakDaftarKueri, masukan: TanpaMasukan, keluaran: KontrakDaftarKeluaran }),
] as const;
