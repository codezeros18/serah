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

export async function catatNotifikasi(tx: Tx, daftar: readonly NotifikasiBaru[], sekarang: Date): Promise<number> {
  let n = 0;
  for (const x of daftar) {
    if (!x.organisasiId) continue;
    await tx.notifikasi.create({
      data: {
        organisasiId: x.organisasiId,
        peranTujuan: x.peranTujuan,
        jenis: x.jenis,
        objekKode: x.objekKode,
        data: (x.data ?? {}) as Prisma.InputJsonValue,
        dibuatPada: sekarang,
      },
    });
    n += 1;
  }
  return n;
}
