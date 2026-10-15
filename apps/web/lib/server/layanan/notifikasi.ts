import type { Prisma } from "@serah/db";
import type { JenisNotifikasi, Peran } from "@serah/kontrak";
import type { Tx } from "../db";

// Catat notifikasi ke tabel saja (S08). Pengiriman push/email & SSE di S17.
// Ditujukan ke PERAN dalam organisasi, bukan orang; `data` tanpa data pribadi.

export type NotifikasiBaru = {
  organisasiId: string | null;
  peranTujuan: Peran[];
  jenis: JenisNotifikasi;
  objekKode: string;
  data?: Record<string, string | number | boolean | null>;
};

/**
 * createMany (tanpa RETURNING): pelaku sering menulis notifikasi untuk organisasi LAIN yang barisnya tidak boleh
 * ia baca (RLS SELECT), sehingga INSERT … RETURNING akan ditolak.
 */
export async function catatNotifikasi(tx: Tx, daftar: readonly NotifikasiBaru[], sekarang: Date): Promise<number> {
  const baris = daftar
    .filter((x): x is NotifikasiBaru & { organisasiId: string } => x.organisasiId !== null)
    .map((x) => ({
      organisasiId: x.organisasiId,
      peranTujuan: x.peranTujuan,
      jenis: x.jenis,
      objekKode: x.objekKode,
      data: (x.data ?? {}) as Prisma.InputJsonValue,
      dibuatPada: sekarang,
    }));
  if (baris.length === 0) return 0;
  return (await tx.notifikasi.createMany({ data: baris })).count;
}
