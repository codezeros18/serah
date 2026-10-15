import { z } from "zod";

// Nama kunci hak paket (entitlement). Nilai per paket adalah DATA di tabel `entitlement`;
// di sini hanya nama kuncinya dan jenis nilainya.

export const KUNCI_HAK_BATAS = ["tps.maks", "anggota.maks"] as const;
export const KUNCI_HAK_BOLEH = [
  "ekspor.pdf",
  "lembar_neraca",
  "mode_bayangan",
  "tagihan_angkut",
  "notifikasi.email",
  "notifikasi.push",
] as const;
export const KUNCI_HAK = [...KUNCI_HAK_BATAS, ...KUNCI_HAK_BOLEH] as const;

export type KunciHakBatas = (typeof KUNCI_HAK_BATAS)[number];
export type KunciHakBoleh = (typeof KUNCI_HAK_BOLEH)[number];
export type KunciHak = (typeof KUNCI_HAK)[number];

export const KunciHak = z.enum(KUNCI_HAK);

/** Nilai entitlement: batas = bilangan bulat ≥0 atau null (tak terbatas); boleh = boolean. */
export const NilaiHakBatas = z.number().int().min(0).nullable();
export const NilaiHakBoleh = z.boolean();
export const NilaiHak = z.union([NilaiHakBatas, NilaiHakBoleh]);
export type NilaiHak = z.infer<typeof NilaiHak>;

export const Hak = z.object({ kunci: KunciHak, nilai: NilaiHak });
export type Hak = z.infer<typeof Hak>;
