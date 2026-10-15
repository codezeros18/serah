import { z } from "zod";
import { BeratGTotal, Id, Idr, KodeTagihanAngkut, KodeSerah, Periode, TanpaMasukan, WaktuIso, rute } from "./primitif";

// Tagihan angkut dari serah tertutup (S24). Hanya DITERIMA/DITERIMA_SEBAGIAN yang dihitung.

export const RincianTagihanAngkut = z.object({ kodeSerah: KodeSerah, kgDiterimaG: BeratGTotal, subtotalIdr: Idr });

export const PratinjauTagihanAngkut = z.object({
  kontrakId: Id,
  periode: Periode,
  ritTertutup: z.number().int().min(0),
  kgDiterimaG: BeratGTotal,
  totalIdr: Idr,
  rincian: z.array(RincianTagihanAngkut),
  /** Jumlah serah yang belum ditutup atau ditolak (TGA_TIDAK_TERMASUK). */
  tidakTermasuk: z.number().int().min(0),
});

export const TagihanAngkut = PratinjauTagihanAngkut.omit({ tidakTermasuk: true }).extend({
  id: Id,
  kode: KodeTagihanAngkut,
  diterbitkanPada: WaktuIso,
});

export const TagihanAngkutKueri = z.object({ kontrakId: Id.optional(), periode: Periode.optional() }).strict();
/** Dengan kontrakId+periode → `pratinjau` terisi; tanpa → daftar yang sudah terbit. */
export const TagihanAngkutKeluaran = z.object({
  pratinjau: PratinjauTagihanAngkut.nullable(),
  tagihan: z.array(TagihanAngkut),
});
export const TagihanAngkutTerbitkanMasukan = z.object({ kontrakId: Id, periode: Periode }).strict();
export const TagihanAngkutTerbitkanKeluaran = z.object({ tagihan: TagihanAngkut });

export const RUTE_TAGIHAN_ANGKUT = [
  rute({ metode: "GET", jalur: "/api/tagihan-angkut", akses: ["PENGANGKUT", "PENGELOLA"], kueri: TagihanAngkutKueri, masukan: TanpaMasukan, keluaran: TagihanAngkutKeluaran }),
  rute({ metode: "POST", jalur: "/api/tagihan-angkut/terbitkan", akses: ["PENGANGKUT"], masukan: TagihanAngkutTerbitkanMasukan, keluaran: TagihanAngkutTerbitkanKeluaran }),
] as const;
