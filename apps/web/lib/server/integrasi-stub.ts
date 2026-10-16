import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { KeyakinanAi, ModeData } from "@serah/kontrak";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";
import { buatPenyimpanan } from "../adaptor/penyimpanan";

// Pengganti sementara integrasi jalur B (S05 BMKG, S06 foto/penyimpanan/AI) — UTANG, disambung di S28.
// Antarmuka di sini adalah yang dipakai layanan S08; adaptor B nanti dipasang lewat aturIntegrasi().
//
// Privasi tetap ditegakkan tanpa `sharp`: metadata (EXIF/XMP/teks/komentar) dibuang dari JPEG, PNG, dan WebP
// dengan mengurai struktur berkas, sebelum apa pun disimpan. dHash di sini BUKAN dHash visual: sidik isi
// (SHA-256 terpotong 64 bit) — foto identik terdeteksi R-04, foto yang diubah ukurannya belum (butuh S06).

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
  /** null = gagal diambil; [] = tidak ada peringatan. */
  nowcast(): Promise<NowcastMentah[] | null>;
}

export type Integrasi = { foto: PemrosesFoto; penyimpanan: Penyimpanan; pembacaTiket: PembacaTiket; cuaca: SumberCuaca };

// ── Pemroses foto: buang metadata, ukur, sidik ─────────────────────────────

const be16 = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const be32 = (b: Uint8Array, i: number) => (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
const le32 = (b: Uint8Array, i: number) => ((b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16) | ((b[i + 3] ?? 0) << 24)) >>> 0;
const le24 = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
const tidakSah = () => new GalatApi("VALIDASI_GAGAL");

function gabung(bagian: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(bagian.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const x of bagian) {
    out.set(x, i);
    i += x.length;
  }
  return out;
}

/** APP0 (JFIF), APP2 (ICC), APP14 (Adobe) dipertahankan; APP1 (EXIF/XMP), APPn lain, dan COM dibuang. */
function bersihJpeg(b: Uint8Array): { isi: Uint8Array; lebar: number; tinggi: number } {
  const keluar: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  let lebar = 0;
  let tinggi = 0;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw tidakSah();
    const m = b[i + 1]!;
    if (m === 0xd9) {
      keluar.push(b.subarray(i, i + 2));
      break;
    }
    const panjang = be16(b, i + 2);
    if (panjang < 2 || i + 2 + panjang > b.length) throw tidakSah();
    const segmen = b.subarray(i, i + 2 + panjang);
    if (m === 0xda) {
      keluar.push(b.subarray(i)); // data terentropi sampai EOI
      break;
    }
    const app = m >= 0xe0 && m <= 0xef;
    const simpan = (!app && m !== 0xfe) || m === 0xe0 || m === 0xe2 || m === 0xee;
    if (simpan) keluar.push(segmen);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      tinggi = be16(b, i + 5);
      lebar = be16(b, i + 7);
    }
    i += 2 + panjang;
  }
  if (lebar <= 0 || tinggi <= 0) throw tidakSah();
  return { isi: gabung(keluar), lebar, tinggi };
}

const PNG_SIMPAN = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD"]);

/** Hanya chunk gambar yang dipertahankan; tEXt/zTXt/iTXt/eXIf/tIME dan lainnya dibuang. */
function bersihPng(b: Uint8Array): { isi: Uint8Array; lebar: number; tinggi: number } {
  const keluar: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let lebar = 0;
  let tinggi = 0;
  while (i + 12 <= b.length) {
    const panjang = be32(b, i);
    const jenis = ascii(b, i + 4, 4);
    const akhir = i + 12 + panjang;
    if (akhir > b.length) throw tidakSah();
    if (jenis === "IHDR") {
      lebar = be32(b, i + 8);
      tinggi = be32(b, i + 12);
    }
    if (PNG_SIMPAN.has(jenis)) keluar.push(b.subarray(i, akhir));
    i = akhir;
    if (jenis === "IEND") break;
  }
  if (lebar <= 0 || tinggi <= 0) throw tidakSah();
  return { isi: gabung(keluar), lebar, tinggi };
}

/** Chunk EXIF & XMP dibuang; penanda keduanya di VP8X dimatikan; ukuran RIFF dihitung ulang. */
function bersihWebp(b: Uint8Array): { isi: Uint8Array; lebar: number; tinggi: number } {
  const chunk: Uint8Array[] = [];
  let i = 12;
  let lebar = 0;
  let tinggi = 0;
  while (i + 8 <= b.length) {
    const jenis = ascii(b, i, 4);
    const panjang = le32(b, i + 4);
    const akhir = i + 8 + panjang + (panjang % 2);
    if (i + 8 + panjang > b.length) throw tidakSah();
    const d = i + 8;
    if (jenis === "VP8X") {
      lebar = le24(b, d + 4) + 1;
      tinggi = le24(b, d + 7) + 1;
      const salin = b.slice(i, Math.min(akhir, b.length));
      salin[8] = (salin[8] ?? 0) & ~0x0c; // bit EXIF (0x08) & XMP (0x04)
      chunk.push(salin);
    } else if (jenis !== "EXIF" && jenis !== "XMP ") {
      if (jenis === "VP8 " && lebar === 0) {
        lebar = be16(new Uint8Array([b[d + 7] ?? 0, b[d + 6] ?? 0]), 0) & 0x3fff;
        tinggi = be16(new Uint8Array([b[d + 9] ?? 0, b[d + 8] ?? 0]), 0) & 0x3fff;
      }
      if (jenis === "VP8L" && lebar === 0) {
        const bit = le32(b, d + 1);
        lebar = (bit & 0x3fff) + 1;
        tinggi = ((bit >>> 14) & 0x3fff) + 1;
      }
      chunk.push(b.subarray(i, Math.min(akhir, b.length)));
    }
    i = akhir;
  }
  if (lebar <= 0 || tinggi <= 0) throw tidakSah();
  const isi = gabung(chunk);
  const kepala = new Uint8Array(12);
  kepala.set(b.subarray(0, 4));
  new DataView(kepala.buffer).setUint32(4, isi.length + 4, true);
  kepala.set(b.subarray(8, 12), 8);
  return { isi: gabung([kepala, isi]), lebar, tinggi };
}

/** Jenis berkas ditentukan dari isi (magic bytes), bukan dari klaim klien. */
export function kenaliGambar(b: Uint8Array): FotoTerproses["mime"] | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(b, 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

export const pemrosesFotoStub: PemrosesFoto = {
  async proses(isi) {
    const mime = kenaliGambar(isi);
    if (!mime) throw tidakSah();
    const bersih = mime === "image/jpeg" ? bersihJpeg(isi) : mime === "image/png" ? bersihPng(isi) : bersihWebp(isi);
    const dhash = createHash("sha256").update(bersih.isi).digest("hex").slice(0, 16);
    const ekstensi = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    return { ...bersih, mime, ekstensi, dhash };
  },
};

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

// ── Pembaca tiket manual & sumber cuaca tanpa jaringan ─────────────────────

/** Jalur manual selalu ada (CLAUDE.md §2.4): tidak membaca apa pun, petugas mengisi berat sendiri. */
export const manualPembaca: PembacaTiket = {
  async baca() {
    throw new GalatApi("AI_TIDAK_TERSEDIA");
  },
};

/** Tanpa jaringan: prakiraan & nowcast "gagal diambil" (null) — R-10 tidak menebak. */
export const cuacaTanpaJaringan: SumberCuaca = {
  async prakiraan() {
    return null;
  },
  async nowcast() {
    return null;
  },
};

// ── Pemasangan ─────────────────────────────────────────────────────────────

let terpasang: Integrasi | null = null;

export function integrasi(): Integrasi {
  terpasang ??= {
    foto: pemrosesFotoStub,
    penyimpanan: muatEnv().PENYIMPANAN_MODE === "r2" ? penyimpananR2() : penyimpananLokal,
    pembacaTiket: manualPembaca,
    cuaca: cuacaTanpaJaringan,
  };
  return terpasang;
}

/** Ganti sebagian integrasi (test, atau adaptor B saat disambung). */
export function aturIntegrasi(ganti: Partial<Integrasi>): void {
  terpasang = { ...integrasi(), ...ganti };
}
