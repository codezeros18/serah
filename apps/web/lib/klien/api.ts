import type { z } from "zod";
import type { Galat, KodeGalat } from "@serah/kontrak/galat";
import { HEADER_ALASAN_ADMIN, HEADER_IDEMPOTENCY_KEY } from "@serah/kontrak/galat";
import { TEKS, isi } from "@serah/kontrak/teks";
import type {
  RUTE_ADMIN,
  RUTE_AKUN,
  RUTE_AUTH,
  RUTE_BAYANGAN,
  RUTE_CUACA,
  RUTE_FOTO,
  RUTE_KAWASAN,
  RUTE_KENDARAAN,
  RUTE_KONTRAK,
  RUTE_LANGGANAN,
  RUTE_LAPORAN,
  RUTE_NOTIFIKASI,
  RUTE_ORGANISASI,
  RUTE_PERMINTAAN_KOREKSI,
  RUTE_PUSH,
  RUTE_RANTAI,
  RUTE_SERAH,
  RUTE_SINKRON,
  RUTE_SISTEM,
  RUTE_TAGIHAN,
  RUTE_TAGIHAN_ANGKUT,
  RUTE_TIKET,
  RUTE_TPS,
  RUTE_WADAH,
} from "@serah/kontrak";

// Klien API bertipe (S04-7). Tipe masukan/keluaran diturunkan dari skema zod rute §K.2 di
// packages/kontrak — satu sumber kebenaran. Klien hanya mengirim niat & masukan mentah.

type SemuaRute =
  | (typeof RUTE_AUTH)[number]
  | (typeof RUTE_AKUN)[number]
  | (typeof RUTE_ORGANISASI)[number]
  | (typeof RUTE_KAWASAN)[number]
  | (typeof RUTE_TPS)[number]
  | (typeof RUTE_KENDARAAN)[number]
  | (typeof RUTE_KONTRAK)[number]
  | (typeof RUTE_WADAH)[number]
  | (typeof RUTE_SERAH)[number]
  | (typeof RUTE_FOTO)[number]
  | (typeof RUTE_TIKET)[number]
  | (typeof RUTE_SINKRON)[number]
  | (typeof RUTE_RANTAI)[number]
  | (typeof RUTE_CUACA)[number]
  | (typeof RUTE_LAPORAN)[number]
  | (typeof RUTE_PERMINTAAN_KOREKSI)[number]
  | (typeof RUTE_NOTIFIKASI)[number]
  | (typeof RUTE_PUSH)[number]
  | (typeof RUTE_LANGGANAN)[number]
  | (typeof RUTE_TAGIHAN)[number]
  | (typeof RUTE_TAGIHAN_ANGKUT)[number]
  | (typeof RUTE_BAYANGAN)[number]
  | (typeof RUTE_ADMIN)[number]
  | (typeof RUTE_SISTEM)[number];

type Metode = SemuaRute["metode"];
type JalurDari<M extends Metode> = Extract<SemuaRute, { metode: M }>["jalur"];
type Cari<M extends Metode, J extends string> = Extract<SemuaRute, { metode: M; jalur: J }>;

type Masuk<S> = S extends z.ZodType ? z.input<S> : never;
type Keluar<S> = S extends z.ZodType ? z.output<S> : never;

type Opsi<R extends SemuaRute> = (R extends { params: infer P } ? { params: Masuk<P> } : { params?: undefined }) &
  (R extends { kueri: infer K } ? { kueri?: Masuk<K> } : { kueri?: undefined }) & {
    body?: Masuk<R["masukan"]>;
    /** Wajib untuk rute `idempoten` (UUID dibuat di perangkat). */
    idempotencyKey?: string;
    /** Header X-Alasan (≥15 karakter) — wajib untuk SEMUA rute /api/admin/* (baca maupun ubah). */
    alasan?: string;
    signal?: AbortSignal;
  };

export type OpsiMentah = {
  params?: Record<string, string>;
  kueri?: Record<string, unknown>;
  body?: unknown;
  idempotencyKey?: string;
  alasan?: string;
  signal?: AbortSignal;
};

export type HasilApi<T> =
  | { ok: true; data: T }
  | { ok: false; galat: Galat; /** Teks pengguna dari TEKS (§M.5), siap ditampilkan. */ pesan: string };

/** Mock aktif hanya bila NEXT_PUBLIC_API_MOCK=true (nilai disisipkan saat build). */
export const MOCK_AKTIF = process.env.NEXT_PUBLIC_API_MOCK === "true";

/** Kode galat → teks pengguna. Teks berasal dari TEKS; aturan menyebut teks aturan dari server. */
export function teksGalat(galat: Galat, menitTunggu = 1): string {
  const kode: KodeGalat = galat.kode;
  switch (kode) {
    case "VALIDASI_GAGAL":
    case "FIELD_TIDAK_DIKENAL":
      return TEKS.G_VALIDASI;
    case "SESI_HABIS":
      return TEKS.G_SESI_HABIS;
    case "PERAN_TIDAK_BOLEH":
      return TEKS.G_PERAN_TIDAK_BOLEH;
    case "HAK_PAKET_TIDAK_ADA":
      return TEKS.G_HAK_PAKET;
    case "TIDAK_DITEMUKAN":
      return TEKS.G_TIDAK_DITEMUKAN;
    case "KONFLIK_VERSI":
      return TEKS.G_KONFLIK_VERSI;
    case "BATAS_LAJU":
      return isi("G_BATAS_LAJU", { menit: menitTunggu });
    case "AI_TIDAK_TERSEDIA":
      return TEKS.G_AI_MATI;
    case "BMKG_TIDAK_TERSEDIA":
      return TEKS.G_BMKG_MATI;
    case "ATURAN_DITOLAK":
    case "TRANSISI_TIDAK_SAH":
      return galat.aturan?.teks ?? TEKS.G_SERVER;
    case "GALAT_SERVER":
      return TEKS.G_SERVER;
  }
}

function gagal(galat: Galat, menit?: number): HasilApi<never> {
  return { ok: false, galat, pesan: teksGalat(galat, menit) };
}

/** Galat jaringan = perangkat offline; pesan `G_OFFLINE`. */
function galatJaringan(): HasilApi<never> {
  return { ok: false, galat: { kode: "GALAT_SERVER", pesan: "jaringan" }, pesan: TEKS.G_OFFLINE };
}

export function isiJalur(jalur: string, params: Record<string, string> | undefined): string {
  return jalur.replace(/\[([a-zA-Z0-9_]+)\]/g, (_c, nama: string) => {
    const v = params?.[nama];
    if (v === undefined) throw new Error(`Parameter ${nama} untuk ${jalur} tidak diisi`);
    return encodeURIComponent(v);
  });
}

export function kueriKeString(kueri: Record<string, unknown> | undefined): string {
  if (!kueri) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(kueri)) {
    if (v !== undefined && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** True bila kegagalan karena perangkat tidak tersambung (bukan penolakan server). */
export function adalahGalatJaringan(h: HasilApi<unknown>): boolean {
  return !h.ok && h.galat.pesan === "jaringan";
}

/** Panggilan tak bertipe: dipakai `panggil` dan antrean offline. */
export async function panggilMentah(metode: string, jalur: string, opsi: OpsiMentah = {}): Promise<HasilApi<unknown>> {
  if (MOCK_AKTIF) {
    // Mock meniru perangkat tanpa sambungan agar antrean offline dapat diuji tanpa server.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return galatJaringan();
    const { panggilMock } = await import("./mock");
    return panggilMock(metode, jalur, opsi);
  }
  const url = `${isiJalur(jalur, opsi.params)}${kueriKeString(opsi.kueri)}`;
  const header: Record<string, string> = {};
  if (opsi.body !== undefined) header["Content-Type"] = "application/json";
  if (opsi.idempotencyKey) header[HEADER_IDEMPOTENCY_KEY] = opsi.idempotencyKey;
  if (opsi.alasan) header[HEADER_ALASAN_ADMIN] = opsi.alasan;
  let res: Response;
  try {
    res = await fetch(url, {
      method: metode,
      headers: header,
      body: opsi.body === undefined ? undefined : JSON.stringify(opsi.body),
      credentials: "same-origin",
      signal: opsi.signal,
    });
  } catch {
    return galatJaringan();
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return gagal({ kode: "GALAT_SERVER", pesan: "respons tidak terbaca" });
  }
  const amplop = json as { ok?: boolean; data?: unknown; galat?: Galat };
  if (amplop.ok === true) return { ok: true, data: amplop.data };
  if (amplop.galat) {
    const retry = Number.parseInt(res.headers.get("Retry-After") ?? "", 10);
    return gagal(amplop.galat, Number.isFinite(retry) ? Math.max(1, Math.ceil(retry / 60)) : undefined);
  }
  return gagal({ kode: "GALAT_SERVER", pesan: "amplop tidak dikenal" });
}

/**
 * Panggilan bertipe. Contoh:
 *   const h = await panggil("GET", "/api/serah/[kode]", { params: { kode: "SRH-20261015-0001" } });
 *   if (h.ok) h.data.status; else h.pesan;
 */
export async function panggil<M extends Metode, J extends JalurDari<M>>(
  metode: M,
  jalur: J,
  ...[opsi]: Opsi<Cari<M, J>> extends { params: unknown } ? [Opsi<Cari<M, J>>] : [Opsi<Cari<M, J>>?]
): Promise<HasilApi<Keluar<Cari<M, J>["keluaran"]>>> {
  return panggilMentah(metode, jalur, (opsi ?? {}) as OpsiMentah) as Promise<HasilApi<Keluar<Cari<M, J>["keluaran"]>>>;
}
