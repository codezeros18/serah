import { isi } from "@serah/kontrak";
import { denganAuth } from "./db";
import { GalatApi } from "./galat";

// Batas laju jendela tetap (§P.1) di tabel batas_laju. Dihitung di transaksi tersendiri agar hitungan
// tetap tersimpan walau permintaan yang dibatasi kemudian gagal. Kunci = jenis + sidik (IP/email), tanpa data mentah.

export const BATAS_LAJU = {
  MASUK: { jumlah: 10, jendelaMenit: 15 },
  DAFTAR: { jumlah: 5, jendelaMenit: 60 },
  LUPA: { jumlah: 3, jendelaMenit: 60 },
} as const;

export type JenisBatas = keyof typeof BATAS_LAJU;

/** Tambah hitungan; kembalikan sisa menit bila batas terlampaui, atau null bila masih boleh. */
export async function hitungBatasLaju(jenis: JenisBatas, kunci: string, sekarang: Date = new Date()): Promise<number | null> {
  const { jumlah, jendelaMenit } = BATAS_LAJU[jenis];
  const jendelaMs = jendelaMenit * 60_000;
  const mulai = new Date(Math.floor(sekarang.getTime() / jendelaMs) * jendelaMs);
  const rows = await denganAuth(
    (tx) => tx.$queryRaw<{ hitungan: number }[]>`
      INSERT INTO batas_laju (kunci, jendela_mulai, hitungan) VALUES (${`${jenis}:${kunci}`}, ${mulai}, 1)
      ON CONFLICT (kunci, jendela_mulai) DO UPDATE SET hitungan = batas_laju.hitungan + 1
      RETURNING hitungan`,
  );
  if ((rows[0]?.hitungan ?? 0) <= jumlah) return null;
  return Math.max(1, Math.ceil((mulai.getTime() + jendelaMs - sekarang.getTime()) / 60_000));
}

/** Seperti hitungBatasLaju, tetapi melempar BATAS_LAJU (429) dengan teks G_BATAS_LAJU. */
export async function wajibDalamBatas(jenis: JenisBatas, kunci: string, sekarang?: Date): Promise<void> {
  const sisa = await hitungBatasLaju(jenis, kunci, sekarang);
  if (sisa !== null) throw new GalatApi("BATAS_LAJU", { pesan: isi("G_BATAS_LAJU", { menit: sisa }) });
}
