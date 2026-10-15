import { z } from "zod";
import { JenisNotifikasi } from "../enum";
import { BoolKueri, Id, TanpaMasukan, WaktuIso, keluaranBerkas, rute } from "./primitif";

// Live sync (SSE) & notifikasi in-app (S17). Notifikasi ditujukan ke peran dalam organisasi, bukan orang.

/** Payload event SSE `serah` — tanpa data pribadi. */
export const EventLangsung = z.object({ jenis: z.string(), kode: z.string(), versi: z.number().int().min(0) });
export const JENIS_EVENT_SSE = ["serah", "notifikasi", "ping"] as const;

export const Notifikasi = z.object({
  id: Id,
  jenis: JenisNotifikasi,
  objekKode: z.string(),
  data: z.record(z.string(), z.union([z.string(), z.number().int(), z.boolean(), z.null()])),
  dibuatPada: WaktuIso,
  dibaca: z.boolean(),
});

export const NotifikasiDaftarKueri = z.object({ belumDibaca: BoolKueri.optional() }).strict();
export const NotifikasiDaftarKeluaran = z.object({ notifikasi: z.array(Notifikasi) });
export const NotifikasiParams = z.object({ id: Id });
export const NotifikasiBacaKeluaran = z.object({ id: Id, dibaca: z.literal(true) });
export const NotifikasiBacaSemuaKeluaran = z.object({ jumlah: z.number().int().min(0) });

export const RUTE_NOTIFIKASI = [
  rute({ metode: "GET", jalur: "/api/langsung", akses: ["SESI"], masukan: TanpaMasukan, keluaran: keluaranBerkas(["text/event-stream"]) }),
  rute({ metode: "GET", jalur: "/api/notifikasi", akses: ["SESI"], kueri: NotifikasiDaftarKueri, masukan: TanpaMasukan, keluaran: NotifikasiDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/notifikasi/[id]/baca", akses: ["SESI"], params: NotifikasiParams, masukan: TanpaMasukan, keluaran: NotifikasiBacaKeluaran }),
  rute({ metode: "POST", jalur: "/api/notifikasi/baca-semua", akses: ["SESI"], masukan: TanpaMasukan, keluaran: NotifikasiBacaSemuaKeluaran }),
] as const;
