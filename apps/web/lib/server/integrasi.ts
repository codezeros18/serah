import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { formatGramKeKg } from "@serah/core/angka";
import type { KeyakinanAi, ModeData } from "@serah/kontrak";
import { buatPembaca, AiTidakTersedia, type PembacaTiket as PembacaTiketAdaptor } from "../adaptor/ai";
import { buatSumberCuaca, type SumberCuaca as SumberCuacaAdaptor } from "../adaptor/bmkg";
import { proses as prosesFotoAdaptor } from "../adaptor/foto";
import { buatPenyimpanan } from "../adaptor/penyimpanan";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";
import { log } from "./log";

// Pintu integrasi produksi (S28-1): satu-satunya tempat server memilih adaptor nyata — pemroses foto (sharp: EXIF
// dibuang, orientasi diterapkan, ≤1600 px, WebP, dHash visual), penyimpanan (lokal | R2 privat), pembaca tiket
// (Claude bila ANTHROPIC_API_KEY, selain itu manual), dan sumber cuaca BMKG (live dengan cadangan snapshot).
// Stub sudah dipindahkan ke lib/server/uji/ (khusus test).

// ── Antarmuka ──────────────────────────────────────────────────────────────

export type FotoTerproses = { isi: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp"; ekstensi: string; dhash: string; lebar: number; tinggi: number };

export interface PemrosesFoto {
  proses(isi: Uint8Array): Promise<FotoTerproses>;
}

export interface Penyimpanan {
  simpan(kunci: string, isi: Uint8Array, mime: string): Promise<void>;
  /** null bila objek tidak ada. */
  baca(kunci: string): Promise<Uint8Array | null>;
  hapus(kunci: string): Promise<void>;
  urlBertanda(kunci: string, sekarang: Date): { url: string; kedaluwarsaPada: Date };
}

export type HasilBacaTiket = { nomorTiket: string | null; beratKgTeks: string | null; tanggal: string | null; keyakinan: KeyakinanAi; model: string };

export interface PembacaTiket {
  /** Melempar GalatApi AI_TIDAK_TERSEDIA bila tidak ada pembaca otomatis. */
  baca(foto: { isi: Uint8Array; mime: string }): Promise<HasilBacaTiket>;
}

export type PrakiraanMentah = { adm4: string; analysisDate: Date; mode: ModeData; slot: { slotUtc: Date; weatherDesc: string; weatherDescEn: string | null }[] };
export type NowcastMentah = {
  identifierCap: string;
  provinsi: string;
  event: string;
  headline: string;
  deskripsi: string;
  effective: Date;
  expires: Date;
  /** [latE6, lonE6] */
  poligonE6: [number, number][];
};

export interface SumberCuaca {
  /** null = gagal diambil (tanpa tebakan). */
  prakiraan(adm4: string): Promise<PrakiraanMentah | null>;
  /** Peringatan aktif untuk provinsi yang diminta. null = gagal diambil; [] = tidak ada peringatan. */
  nowcast(provinsi: readonly string[]): Promise<NowcastMentah[] | null>;
}

export type Integrasi = { foto: PemrosesFoto; penyimpanan: Penyimpanan; pembacaTiket: PembacaTiket; cuaca: SumberCuaca };

// ── Penyimpanan lokal + URL bertanda tangan 5 menit ────────────────────────

export const UMUR_URL_FOTO_MS = 5 * 60_000;
const POLA_KUNCI = /^[a-z0-9]+\/[A-Z_]+\/[0-9a-f]{64}\.(jpg|png|webp)$/;

export function kunciObjekSah(kunci: string): boolean {
  return POLA_KUNCI.test(kunci);
}

function tanda(kunci: string, kedaluwarsa: number): string {
  return createHmac("sha256", muatEnv().SESI_SECRET).update(`foto|${kunci}|${kedaluwarsa}`).digest("base64url");
}

/** Periksa tanda URL foto; kedaluwarsa dibandingkan dengan `sekarang`. */
export function tandaFotoSah(kunci: string, kedaluwarsa: number, t: string, sekarang: Date): boolean {
  if (!kunciObjekSah(kunci) || !Number.isSafeInteger(kedaluwarsa) || kedaluwarsa < sekarang.getTime()) return false;
  const a = Buffer.from(tanda(kunci, kedaluwarsa));
  const b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}

function direktoriData(): string {
  return resolve(process.env.SERAH_DATA_DIR ?? resolve(process.cwd(), ".data"), "foto");
}

function jalurLokal(kunci: string): string {
  if (!kunciObjekSah(kunci)) throw new GalatApi("VALIDASI_GAGAL");
  return resolve(direktoriData(), kunci);
}

export async function bacaObjekLokal(kunci: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(jalurLokal(kunci)));
  } catch {
    return null;
  }
}

export const penyimpananLokal: Penyimpanan = {
  async simpan(kunci, isi) {
    const jalur = jalurLokal(kunci);
    await mkdir(dirname(jalur), { recursive: true });
    await writeFile(jalur, isi);
  },
  baca: bacaObjekLokal,
  async hapus(kunci) {
    // Kunci di luar format penyimpanan ini (mis. seed demo) tidak pernah punya objek lokal.
    if (!kunciObjekSah(kunci)) return;
    await rm(jalurLokal(kunci), { force: true });
  },
  urlBertanda(kunci, sekarang) {
    const kedaluwarsa = sekarang.getTime() + UMUR_URL_FOTO_MS;
    const q = new URLSearchParams({ k: kunci, e: String(kedaluwarsa), t: tanda(kunci, kedaluwarsa) });
    return { url: `${new URL(muatEnv().BASE_URL).origin}/api/foto/berkas?${q}`, kedaluwarsaPada: new Date(kedaluwarsa) };
  },
};

/** Bagian adaptor Penyimpanan (lib/adaptor/penyimpanan) yang dipakai server. */
export type AdaptorObjek = {
  simpan(kunci: string, buffer: Buffer, mime: string): Promise<void>;
  baca(kunci: string): Promise<Buffer | null>;
  hapus(kunci: string): Promise<void>;
};

/**
 * Penyimpanan berbasis adaptor objek (R2). Bucket PRIVAT: URL yang diberikan ke klien selalu URL aplikasi
 * bertanda tangan HMAC (5 menit) yang disajikan /api/foto/berkas — sama persis dengan mode lokal, sehingga CSP,
 * antarmuka sinkron `urlBertanda`, dan pemeriksaan hak akses tidak berubah.
 */
export function penyimpananDariAdaptor(a: AdaptorObjek): Penyimpanan {
  return {
    async simpan(kunci, isi, mime) {
      if (!kunciObjekSah(kunci)) throw new GalatApi("VALIDASI_GAGAL");
      await a.simpan(kunci, Buffer.from(isi), mime);
    },
    async baca(kunci) {
      if (!kunciObjekSah(kunci)) return null;
      const b = await a.baca(kunci);
      return b ? new Uint8Array(b) : null;
    },
    async hapus(kunci) {
      // Kunci di luar format penyimpanan ini (mis. seed demo) tidak pernah punya objek.
      if (!kunciObjekSah(kunci)) return;
      await a.hapus(kunci);
    },
    urlBertanda: penyimpananLokal.urlBertanda,
  };
}

function penyimpananR2(): Penyimpanan {
  const e = muatEnv();
  return penyimpananDariAdaptor(
    buatPenyimpanan({
      PENYIMPANAN_MODE: "r2",
      ...(e.R2_ACCOUNT_ID ? { R2_ACCOUNT_ID: e.R2_ACCOUNT_ID } : {}),
      ...(e.R2_ACCESS_KEY_ID ? { R2_ACCESS_KEY_ID: e.R2_ACCESS_KEY_ID } : {}),
      ...(e.R2_SECRET_ACCESS_KEY ? { R2_SECRET_ACCESS_KEY: e.R2_SECRET_ACCESS_KEY } : {}),
      ...(e.R2_BUCKET ? { R2_BUCKET: e.R2_BUCKET } : {}),
    }) as unknown as AdaptorObjek,
  );
}

// ── Adaptor nyata ──────────────────────────────────────────────────────────

const KODE_GALAT_FOTO: Record<string, string> = {
  TERLALU_BESAR: "berkas_terlalu_besar",
  JENIS_TIDAK_DITERIMA: "jenis_tidak_diterima",
  TIDAK_BISA_DIDECODE: "tidak_bisa_didecode",
};

/** Pemroses foto nyata: decode ulang (sharp), EXIF dibuang, orientasi diterapkan, ≤1600 px, WebP, dHash visual. */
export function pemrosesFotoNyata(): PemrosesFoto {
  return {
    async proses(isi) {
      const h = await prosesFotoAdaptor(Buffer.from(isi));
      if (!h.ok) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["berkas"], kode: KODE_GALAT_FOTO[h.galat] ?? "tidak_sah" }] });
      return { isi: new Uint8Array(h.buffer), mime: h.mime, ekstensi: "webp", dhash: h.dhash, lebar: h.lebar, tinggi: h.tinggi };
    },
  };
}

/**
 * Pembaca tiket nyata: Claude bila ANTHROPIC_API_KEY terisi, selain itu manual. Kegagalan APA PUN (jaringan, kuota,
 * keluaran tak sah) berakhir sebagai AI_TIDAK_TERSEDIA → layar memakai isian manual (CLAUDE.md §2.4).
 * Berat dikembalikan sebagai teks kg dari gram hasil urai adaptor (satuan ton sudah dikonversi di sana).
 */
function pembacaTiketNyata(): PembacaTiket {
  const e = muatEnv();
  return pembacaTiketDari(buatPembaca({ ...(e.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY } : {}), AI_MODEL: e.AI_MODEL, AI_MODEL_CADANGAN: e.AI_MODEL_CADANGAN }));
}

/** Pembungkus atas adaptor pembaca tiket (disuntik agar dapat diuji tanpa memanggil API sungguhan). */
export function pembacaTiketDari(p: PembacaTiketAdaptor): PembacaTiket {
  return {
    async baca(foto) {
      let h;
      try {
        h = await p.baca(Buffer.from(foto.isi), foto.mime);
      } catch (err) {
        if (!(err instanceof AiTidakTersedia)) log().warn("pembaca tiket gagal", { galat: err });
        throw new GalatApi("AI_TIDAK_TERSEDIA");
      }
      if (!h.tersedia) throw new GalatApi("AI_TIDAK_TERSEDIA");
      return {
        nomorTiket: h.nomorTiket,
        beratKgTeks: h.beratG !== null ? formatGramKeKg(h.beratG) : null,
        tanggal: h.tanggalTeks,
        keyakinan: h.keyakinan,
        model: h.model,
      };
    },
  };
}

/**
 * Sumber cuaca nyata (BMKG_MODE): live dengan cadangan snapshot. Gagal → null (R-10 tidak menebak). Satu peringatan
 * dengan beberapa cincin poligon dipecah satu baris per cincin (identifier + "#n") agar penilaian titik-dalam-poligon
 * di core tetap sederhana.
 */
function cuacaNyata(): SumberCuaca {
  return cuacaDari(buatSumberCuaca(muatEnv().BMKG_MODE));
}

/** Pembungkus atas sumber cuaca adaptor (disuntik agar dapat diuji dengan snapshot/pengganti). */
export function cuacaDari(s: SumberCuacaAdaptor): SumberCuaca {
  return {
    async prakiraan(adm4) {
      try {
        return await s.prakiraan(adm4);
      } catch (err) {
        log().warn("prakiraan BMKG gagal", { adm4, galat: err });
        return null;
      }
    },
    async nowcast(provinsi) {
      if (provinsi.length === 0) return [];
      try {
        const daftar = await s.nowcast(provinsi);
        return daftar.flatMap((n) => {
          const cincin = n.poligonE6.length > 0 ? n.poligonE6 : [[]];
          return cincin.map((c, i) => ({
            identifierCap: i === 0 ? n.identifierCap : `${n.identifierCap}#${i + 1}`,
            provinsi: n.provinsi,
            event: n.event,
            headline: n.headline,
            deskripsi: n.deskripsi,
            effective: n.effective,
            expires: n.expires,
            poligonE6: c.map(([lat, lon]): [number, number] => [lat, lon]),
          }));
        });
      } catch (err) {
        log().warn("nowcast BMKG gagal", { galat: err });
        return null;
      }
    },
  };
}

// ── Pemasangan ─────────────────────────────────────────────────────────────

// Setiap bagian dibuat saat pertama dipakai (env baru dibaca saat itu) dan dapat ditimpa test (aturIntegrasi).
const timpa: Partial<Integrasi> = {};
const tersimpan: Partial<Integrasi> = {};

function ambil<K extends keyof Integrasi>(k: K, buat: () => Integrasi[K]): Integrasi[K] {
  return (timpa[k] ?? (tersimpan[k] ??= buat())) as Integrasi[K];
}

export function integrasi(): Integrasi {
  return {
    get foto() {
      return ambil("foto", pemrosesFotoNyata);
    },
    get penyimpanan() {
      return ambil("penyimpanan", () => (muatEnv().PENYIMPANAN_MODE === "r2" ? penyimpananR2() : penyimpananLokal));
    },
    get pembacaTiket() {
      return ambil("pembacaTiket", pembacaTiketNyata);
    },
    get cuaca() {
      return ambil("cuaca", cuacaNyata);
    },
  };
}

/** Ganti sebagian integrasi (test memasang stub dari lib/server/uji/stub-integrasi.ts). */
export function aturIntegrasi(ganti: Partial<Integrasi>): void {
  Object.assign(timpa, ganti);
}
