import { z } from "zod";
import { Id, KodeTps, LatE6, LonE6, RefKode, TanpaMasukan, keluaranBerkas, rute } from "./primitif";

// TPS & QR (S13). Koordinat = lokasi tetap TPS yang diisi pengelola, bukan lokasi perangkat.

export const Tps = z.object({
  id: Id,
  kawasanId: Id,
  kode: KodeTps,
  nama: z.string(),
  latE6: LatE6,
  lonE6: LonE6,
  aktif: z.boolean(),
  qrVersi: z.number().int().min(1),
});
export type Tps = z.infer<typeof Tps>;

export const TpsBuatMasukan = z
  .object({ kawasanId: Id, nama: z.string().trim().min(2).max(80), latE6: LatE6, lonE6: LonE6 })
  .strict();
export const TpsUbahMasukan = z
  .object({ nama: z.string().trim().min(2).max(80).optional(), latE6: LatE6.optional(), lonE6: LonE6.optional(), aktif: z.boolean().optional() })
  .strict();
export const TpsParams = z.object({ id: Id });
export const TpsDaftarKueri = z.object({ kawasanId: Id.optional() }).strict();
export const TpsKeluaran = z.object({ tps: Tps });
export const TpsDaftarKeluaran = z.object({ tps: z.array(Tps) });

export const TpsQrBaruKeluaran = z.object({ qrVersi: z.number().int().min(1), qrToken: z.string() });
// `v` = versi QR, hanya pemecah cache di sisi klien (diabaikan server).
export const TpsQrKueri = z.object({ format: z.enum(["png", "svg"]).default("svg"), v: z.coerce.number().int().min(1).optional() }).strict();

export const TpsQrTokenParams = z.object({ token: z.string().min(16).max(200) });
export const TpsQrTokenKeluaran = z.object({ tps: RefKode, kawasan: RefKode });

export const RUTE_TPS = [
  rute({ metode: "POST", jalur: "/api/tps", akses: ["PENGELOLA"], masukan: TpsBuatMasukan, keluaran: TpsKeluaran }),
  rute({ metode: "GET", jalur: "/api/tps", akses: ["PENGELOLA"], kueri: TpsDaftarKueri, masukan: TanpaMasukan, keluaran: TpsDaftarKeluaran }),
  rute({ metode: "PATCH", jalur: "/api/tps/[id]", akses: ["PENGELOLA"], params: TpsParams, masukan: TpsUbahMasukan, keluaran: TpsKeluaran }),
  rute({ metode: "POST", jalur: "/api/tps/[id]/qr-baru", akses: ["PENGELOLA"], params: TpsParams, masukan: TanpaMasukan, keluaran: TpsQrBaruKeluaran }),
  rute({ metode: "GET", jalur: "/api/tps/[id]/qr", akses: ["PENGELOLA"], params: TpsParams, kueri: TpsQrKueri, masukan: TanpaMasukan, keluaran: keluaranBerkas(["image/png", "image/svg+xml"]) }),
  rute({ metode: "GET", jalur: "/api/tps/qr/[token]", akses: ["PETUGAS", "PENGELOLA"], params: TpsQrTokenParams, masukan: TanpaMasukan, keluaran: TpsQrTokenKeluaran }),
] as const;
