import { z } from "zod";
import { JenisOrganisasi, StatusLangganan } from "../enum";
import { Hak } from "../hak";
import { Idr, Periode, TanpaMasukan, Tanggal, rute } from "./primitif";

// Paket & langganan (S19). Kode paket adalah data; tidak ada literal kode paket di kontrak.

export const Paket = z.object({
  kode: z.string(),
  urutan: z.number().int(),
  hargaPerTpsIdr: Idr,
  berlakuUntuk: JenisOrganisasi,
  aktif: z.boolean(),
  hak: z.array(Hak),
});
export type Paket = z.infer<typeof Paket>;
export const PaketDaftarKeluaran = z.object({ paket: z.array(Paket) });

export const LanggananKeluaran = z.object({
  paketKode: z.string(),
  status: StatusLangganan,
  ujiCobaSelesai: Tanggal.nullable(),
  hargaDibekukanPerTpsIdr: Idr.nullable(),
  periodeBerjalan: Periode.nullable(),
  tpsDitagih: z.number().int().min(0),
});

export const RUTE_LANGGANAN = [
  rute({ metode: "GET", jalur: "/api/paket", akses: ["PUBLIK", "SESI"], masukan: TanpaMasukan, keluaran: PaketDaftarKeluaran }),
  rute({ metode: "GET", jalur: "/api/langganan", akses: ["PENGELOLA"], masukan: TanpaMasukan, keluaran: LanggananKeluaran }),
] as const;
