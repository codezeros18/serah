import { z } from "zod";
import { Aliran, AlasanTolak, JenisPenerima, PihakLaporan, StatusSerah } from "../enum";
import { RujukanAturan } from "../galat";
import {
  BeratGBolehNol,
  BeratGTotal,
  Id,
  KodeSerah,
  KodeTps,
  Periode,
  SelisihIdr,
  Tanggal,
  TanpaMasukan,
  keluaranBerkas,
  rute,
} from "./primitif";

// Tiga laporan dari data yang sama, ekspor, ringkasan & penyebab ditolak (S11, S23).

/** Satu baris = satu aliran dalam satu serah tertutup (Ps. 23(3) huruf a–h). */
export const BarisLaporan = z.object({
  tanggalWib: Tanggal,
  kodeSerah: KodeSerah,
  aliran: Aliran,
  beratTpsG: BeratGBolehNol,
  beratDiterimaG: BeratGBolehNol,
  beratDitolakG: BeratGBolehNol,
  alasanTolak: AlasanTolak.nullable(),
  tpsKode: KodeTps,
  kawasanNama: z.string(),
  kawasanAlamat: z.string(),
  pengangkutNama: z.string().nullable(),
  plat: z.string().nullable(),
  penerimaNama: z.string().nullable(),
  penerimaJenis: JenisPenerima.nullable(),
  status: StatusSerah,
  sidikEvent: z.string().length(64),
});
export type BarisLaporan = z.infer<typeof BarisLaporan>;

export const TotalAliran = z.object({
  aliran: Aliran,
  beratTpsG: BeratGTotal,
  beratDiterimaG: BeratGTotal,
  beratDitolakG: BeratGTotal,
});

export const LaporanParams = z.object({ pihak: PihakLaporan });
export const LaporanKueri = z.object({ periode: Periode, kawasanId: Id.optional() }).strict();
export const LaporanKeluaran = z.object({
  pihak: PihakLaporan,
  periode: Periode,
  baris: z.array(BarisLaporan),
  total: z.array(TotalAliran),
});

export const EksporKueri = z
  .object({ periode: Periode, format: z.enum(["csv", "pdf"]), kawasanId: Id.optional() })
  .strict();
export const LembarNeracaParams = z.object({ id: Id });
export const PeriodeKueri = z.object({ periode: Periode }).strict();

export const RingkasanKeluaran = z.object({
  periode: Periode,
  hariIni: z.array(TotalAliran),
  bulanIni: z.array(TotalAliran),
  menungguSetuju: z.number().int().min(0),
  menggantung: z.number().int().min(0),
  prioritas: z.array(z.object({ tpsId: Id, tpsKode: KodeTps, teks: z.string() })),
  peringatan: z.array(RujukanAturan),
});

export const DitolakKeluaran = z.object({
  periode: Periode,
  kuning: z.object({ diterimaG: BeratGTotal, ditolakG: BeratGTotal }),
  alasan: z.array(
    z.object({
      alasan: AlasanTolak,
      ditolakG: BeratGTotal,
      jumlahSerah: z.number().int().min(0),
      /** Perkiraan selisih nilai = kg ditolak × (harga bersih − harga kotor); null bila harga tidak tersedia. */
      selisihIdr: SelisihIdr.nullable(),
    }),
  ),
  sumberHarga: z.object({ sumber: z.string(), tanggal: Tanggal }).nullable(),
});

export const RUTE_LAPORAN = [
  rute({ metode: "GET", jalur: "/api/laporan/[pihak]", akses: ["PENGELOLA", "PENGANGKUT", "PENERIMA"], params: LaporanParams, kueri: LaporanKueri, masukan: TanpaMasukan, keluaran: LaporanKeluaran }),
  rute({ metode: "GET", jalur: "/api/laporan/[pihak]/ekspor", akses: ["PENGELOLA", "PENGANGKUT", "PENERIMA"], params: LaporanParams, kueri: EksporKueri, masukan: TanpaMasukan, keluaran: keluaranBerkas(["text/csv", "application/pdf"]) }),
  rute({ metode: "GET", jalur: "/api/kawasan/[id]/lembar-neraca", akses: ["PENGELOLA"], params: LembarNeracaParams, kueri: PeriodeKueri, masukan: TanpaMasukan, keluaran: keluaranBerkas(["application/pdf"]) }),
  rute({ metode: "GET", jalur: "/api/kawasan/[id]/ringkasan", akses: ["PENGELOLA"], params: LembarNeracaParams, kueri: PeriodeKueri, masukan: TanpaMasukan, keluaran: RingkasanKeluaran }),
  rute({ metode: "GET", jalur: "/api/kawasan/[id]/ditolak", akses: ["PENGELOLA"], params: LembarNeracaParams, kueri: PeriodeKueri, masukan: TanpaMasukan, keluaran: DitolakKeluaran }),
] as const;
