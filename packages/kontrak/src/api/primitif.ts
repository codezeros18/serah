import { z } from "zod";
import type { Peran } from "../enum";

// Primitif bersama skema API. Semua angka bisnis bilangan bulat:
// berat `G` (gram), uang `Idr` (rupiah), persen `Bp` (basis poin), koordinat `E6` (derajat × 1.000.000).

export const Id = z.cuid2();
export const IdempotencyKey = z.uuid();
export const WaktuIso = z.iso.datetime({ offset: true });
export const Tanggal = z.iso.date();
export const Periode = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format periode YYYY-MM");
export const Adm4 = z.string().regex(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/, "Format adm4 NN.NN.NN.NNNN");
export const Plat = z.string().regex(/^[A-Z]{1,2} \d{1,4}( [A-Z]{1,3})?$/, "Format plat, mis. B 1234 ABC");

export const KodeKawasan = z.string().regex(/^KWS-[A-Z]{3,5}$/);
export const KodeTps = z.string().regex(/^TPS-[A-Z]{3,5}-\d{2}$/);
export const KodeSerah = z.string().regex(/^SRH-\d{8}-\d{4}$/);
export const NomorTagihan = z.string().regex(/^TGH-\d{6}-\d{4}$/);
export const KodePermintaanKoreksi = z.string().regex(/^PKR-\d{8}-\d{3}$/);
export const KodeTagihanAngkut = z.string().regex(/^TGA-\d{6}-\d{4}$/);

/** Batas berat satu catatan (gram), selaras CHECK `wadah_catat.berat_g BETWEEN 1 AND 5000000`. */
export const BERAT_G_MAKS = 5_000_000;
export const BeratG = z.number().int().min(1).max(BERAT_G_MAKS);
export const BeratGBolehNol = z.number().int().min(0).max(BERAT_G_MAKS);
export const BeratGTotal = z.number().int().min(0);
export const SelisihG = z.number().int();
export const Idr = z.number().int().min(0);
export const SelisihIdr = z.number().int();
export const Bp = z.number().int().min(0).max(10_000);
export const LatE6 = z.number().int().min(-90_000_000).max(90_000_000);
export const LonE6 = z.number().int().min(-180_000_000).max(180_000_000);
export const JumlahWadah = z.number().int().min(1).max(1_000);
export const Jam = z.number().int().min(0);

export const Email = z.email().max(254);
/** Sandi minimal 10 karakter (DAFTAR_SANDI_ATURAN). */
export const Sandi = z.string().min(10).max(200);
export const TokenSekali = z.string().min(20).max(200);
export const Alasan = z.string().trim().min(1).max(500);
/** Alasan admin minimal 15 karakter, dikirim lewat header X-Alasan. */
export const AlasanAdmin = z.string().trim().min(15).max(500);

/** Masukan kosong (rute tanpa body/kueri). Field apa pun → FIELD_TIDAK_DIKENAL. */
export const TanpaMasukan = z.object({}).strict();
export const Kosong = z.object({});
export const Oke = z.object({ ok: z.literal(true) });

/** Kueri boolean dari string URL. */
export const BoolKueri = z.enum(["true", "false"]).transform((v) => v === "true");

/** Keluaran berupa berkas/aliran (CSV, PDF, PNG/SVG, SSE), bukan amplop JSON. */
export function keluaranBerkas(mime: readonly string[]) {
  return z.custom<Uint8Array | ReadableStream | string>(() => true).meta({ mime: [...mime] });
}

export const RefRingkas = z.object({ id: Id, nama: z.string() });
export const RefKode = z.object({ id: Id, kode: z.string(), nama: z.string() });

// ── Registri rute ───────────────────────────────────────────────────────────

export type Metode = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AksesRute = Peran | "PUBLIK" | "SESI" | "PENGURUS" | "CRON" | "WEBHOOK";

export type DefinisiRute = {
  metode: Metode;
  /** Jalur gaya App Router, mis. `/api/serah/[kode]/ambil`. */
  jalur: string;
  akses: readonly AksesRute[];
  /** Parameter segmen dinamis. */
  params?: z.ZodType;
  /** Kueri URL (GET). */
  kueri?: z.ZodType;
  /** Body JSON/multipart. Rute tanpa body memakai TanpaMasukan. */
  masukan: z.ZodType;
  /** Isi `data` pada amplop sukses, atau keluaranBerkas(). */
  keluaran: z.ZodType;
  /** Wajib header Idempotency-Key (aksi lapangan). */
  idempoten?: boolean;
};

export function rute<const R extends DefinisiRute>(r: R): R {
  return r;
}
