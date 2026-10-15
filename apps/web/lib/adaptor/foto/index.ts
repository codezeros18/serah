// Pemrosesan foto (BLUEPRINT §P.1, §N.1): validasi, decode ulang, rotasi EXIF, BUANG EXIF,
// resize ≤1600 px, webp; plus dHash 64-bit (hex 16) untuk deteksi foto ulang (R-04).
import sharp, { type Metadata } from "sharp";

export const FOTO_BYTE_MAKS = 5 * 1024 * 1024;
export const FOTO_SISI_MAKS_PX = 1600;
export const MIME_DITERIMA = ["image/jpeg", "image/png", "image/webp"] as const;

export type GalatFoto = "TERLALU_BESAR" | "JENIS_TIDAK_DITERIMA" | "TIDAK_BISA_DIDECODE";

export type HasilFoto =
  | { ok: true; buffer: Buffer; mime: "image/webp"; lebar: number; tinggi: number; dhash: string }
  | { ok: false; galat: GalatFoto };

/** Format sebenarnya dari byte (bukan dari klaim klien). */
function formatSah(f: string | undefined): boolean {
  return f === "jpeg" || f === "png" || f === "webp";
}

/**
 * Proses satu unggahan. Gagal decode → ditolak. Hasil: webp tanpa metadata (`sharp` membuang EXIF/ICC
 * kecuali diminta), orientasi sudah diterapkan ke piksel.
 */
export async function proses(buffer: Buffer): Promise<HasilFoto> {
  if (buffer.length === 0 || buffer.length > FOTO_BYTE_MAKS) return { ok: false, galat: "TERLALU_BESAR" };
  let meta: Metadata;
  try {
    meta = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    return { ok: false, galat: "TIDAK_BISA_DIDECODE" };
  }
  if (!formatSah(meta.format)) return { ok: false, galat: "JENIS_TIDAK_DITERIMA" };
  try {
    const { data, info } = await sharp(buffer, { failOn: "error" })
      .rotate() // terapkan orientasi EXIF ke piksel
      .resize({ width: FOTO_SISI_MAKS_PX, height: FOTO_SISI_MAKS_PX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { ok: true, buffer: data, mime: "image/webp", lebar: info.width, tinggi: info.height, dhash: await dhash(data) };
  } catch {
    return { ok: false, galat: "TIDAK_BISA_DIDECODE" };
  }
}

/**
 * dHash 64-bit: perkecil ke 9×8 abu-abu, bandingkan piksel kiri < kanan per baris → 64 bit → hex 16.
 * Hanya aritmetika bilangan bulat.
 */
export async function dhash(buffer: Buffer): Promise<string> {
  const piksel = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();
  let bit = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const kiri = piksel[y * 9 + x] ?? 0;
      const kanan = piksel[y * 9 + x + 1] ?? 0;
      bit = (bit << 1n) | (kiri < kanan ? 1n : 0n);
    }
  }
  return bit.toString(16).padStart(16, "0");
}

/** Jarak Hamming dua dHash hex 16. */
export function jarakHamming(a: string, b: string): number {
  if (!/^[0-9a-f]{16}$/.test(a) || !/^[0-9a-f]{16}$/.test(b)) throw new Error("dHash harus hex 16");
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x > 0n) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}
