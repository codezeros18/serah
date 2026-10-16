import { createHash } from "node:crypto";
import { GalatApi } from "../galat";
import type { FotoTerproses, PembacaTiket, PemrosesFoto, SumberCuaca } from "../integrasi";

// KHUSUS TEST (dipasang oleh vitest.setup lewat aturIntegrasi). Tidak pernah diimpor kode produksi
// (dijaga guard o): produksi memakai adaptor nyata di lib/server/integrasi.ts.
//
// - pemrosesFotoStub: pembersih metadata tanpa `sharp` yang menerima berkas uji sintetis (PNG/JPEG/WebP buatan
//   tangan yang tidak dapat didekode), dengan dHash = sidik isi (bukan dHash visual).
// - manualPembaca & cuacaTanpaJaringan: jalur "tanpa AI & tanpa jaringan" (T18).

// ── Pemroses foto uji: buang metadata, ukur, sidik ─────────────────────────────

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
