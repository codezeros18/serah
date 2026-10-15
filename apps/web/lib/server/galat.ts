import { STATUS_HTTP_GALAT, TEKS, type AmplopGagal, type KodeGalat, type KunciTeks, type RujukanAturan } from "@serah/kontrak";
import type { z } from "zod";
import { log } from "./log";
import { laporGalat } from "./sentry";

// Galat API beramplop (§K.1). Pesan selalu dari teks.ts.

const KUNCI_PESAN: Record<KodeGalat, KunciTeks> = {
  VALIDASI_GAGAL: "G_VALIDASI",
  FIELD_TIDAK_DIKENAL: "G_VALIDASI",
  SESI_HABIS: "G_SESI_HABIS",
  PERAN_TIDAK_BOLEH: "G_PERAN_TIDAK_BOLEH",
  HAK_PAKET_TIDAK_ADA: "G_HAK_PAKET",
  TIDAK_DITEMUKAN: "G_TIDAK_DITEMUKAN",
  TRANSISI_TIDAK_SAH: "G_SINKRON_TOLAK",
  KONFLIK_VERSI: "G_KONFLIK_VERSI",
  ATURAN_DITOLAK: "ATURAN_JUDUL_TOLAK",
  BATAS_LAJU: "G_SERVER",
  AI_TIDAK_TERSEDIA: "G_AI_MATI",
  BMKG_TIDAK_TERSEDIA: "G_BMKG_MATI",
  GALAT_SERVER: "G_SERVER",
};

type Rincian = { jalur: (string | number)[]; kode: string };

export class GalatApi extends Error {
  readonly kode: KodeGalat;
  readonly aturan?: RujukanAturan;
  readonly rincian?: Rincian[];
  readonly pesanPengguna: string;

  constructor(kode: KodeGalat, opsi: { kunciPesan?: KunciTeks; pesan?: string; aturan?: RujukanAturan; rincian?: Rincian[] } = {}) {
    super(kode);
    this.kode = kode;
    this.aturan = opsi.aturan;
    this.rincian = opsi.rincian;
    this.pesanPengguna = opsi.pesan ?? TEKS[opsi.kunciPesan ?? KUNCI_PESAN[kode]];
  }

  amplop(): AmplopGagal {
    return {
      ok: false,
      galat: {
        kode: this.kode,
        pesan: this.pesanPengguna,
        ...(this.aturan ? { aturan: this.aturan } : {}),
        ...(this.rincian ? { rincian: this.rincian } : {}),
      },
    };
  }
}

export function sukses<T>(data: T, init: ResponseInit = {}): Response {
  return Response.json({ ok: true, data }, init);
}

export function responsGalat(g: GalatApi, init: ResponseInit = {}): Response {
  return Response.json(g.amplop(), { ...init, status: STATUS_HTTP_GALAT[g.kode] });
}

/** Bungkus route handler: GalatApi → amplop; galat lain → 500 tanpa membocorkan isi (tanpa PII di log). */
export function tanganiRute<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof GalatApi) return responsGalat(e);
      const nama = e instanceof Error ? e.name : "unknown";
      const kode = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "-";
      log().error("galat tak tertangani", { nama, kode });
      laporGalat(e);
      return responsGalat(new GalatApi("GALAT_SERVER"));
    }
  };
}

/** Validasi masukan dengan skema zod strict: field tak dikenal → FIELD_TIDAK_DIKENAL, lainnya → VALIDASI_GAGAL. */
export function validasi<S extends z.ZodType>(skema: S, nilai: unknown): z.infer<S> {
  const hasil = skema.safeParse(nilai);
  if (hasil.success) return hasil.data;
  const rincian = hasil.error.issues.map((i) => ({
    jalur: i.path.map((p) => (typeof p === "number" ? p : String(p))),
    kode: i.code,
  }));
  const asing = hasil.error.issues.some((i) => i.code === "unrecognized_keys");
  throw new GalatApi(asing ? "FIELD_TIDAK_DIKENAL" : "VALIDASI_GAGAL", { rincian });
}

/** Baca body JSON lalu validasi. Body kosong dianggap `{}`. */
export async function bacaJson<S extends z.ZodType>(request: Request, skema: S): Promise<z.infer<S>> {
  const teks = await request.text();
  let nilai: unknown = {};
  if (teks.trim() !== "") {
    try {
      nilai = JSON.parse(teks);
    } catch {
      throw new GalatApi("VALIDASI_GAGAL");
    }
  }
  return validasi(skema, nilai);
}
