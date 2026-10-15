import type { JenisOrganisasi, JenisPersetujuan, JenisTokenSekali, Peran } from "@serah/kontrak";

// Aturan murni akun & token sekali pakai (S07). Waktu selalu masuk sebagai argumen.

const JAM_MS = 60 * 60 * 1000;

/** Umur token: verifikasi email 24 jam (DAFTAR_CEK_EMAIL), reset sandi 1 jam, undangan 7 hari (AGT_UNDANGAN_TERKIRIM). */
export const UMUR_TOKEN_MS: Record<JenisTokenSekali, number> = {
  VERIFIKASI_EMAIL: 24 * JAM_MS,
  RESET_SANDI: 1 * JAM_MS,
  UNDANGAN: 7 * 24 * JAM_MS,
};

export function kedaluwarsaToken(jenis: JenisTokenSekali, sekarang: Date): Date {
  return new Date(sekarang.getTime() + UMUR_TOKEN_MS[jenis]);
}

export type StatusToken = "BERLAKU" | "KEDALUWARSA" | "DIPAKAI";

export function statusToken(t: { kedaluwarsaPada: Date; dipakaiPada: Date | null }, sekarang: Date): StatusToken {
  if (t.dipakaiPada) return "DIPAKAI";
  if (t.kedaluwarsaPada.getTime() <= sekarang.getTime()) return "KEDALUWARSA";
  return "BERLAKU";
}

/** Email disimpan & dibandingkan dalam huruf kecil tanpa spasi tepi. */
export function normalisasiEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Peran yang dapat dipegang anggota organisasi berjenis tertentu (§G). */
export const PERAN_PER_JENIS: Record<JenisOrganisasi, readonly Peran[]> = {
  KAWASAN: ["PETUGAS", "PENGELOLA"],
  PENGANGKUT: ["PENGANGKUT"],
  PENERIMA: ["PENERIMA"],
  INTERNAL: ["ADMIN"],
};

export function peranCocokJenis(jenis: JenisOrganisasi, peran: Peran): boolean {
  return PERAN_PER_JENIS[jenis].includes(peran);
}

/** Persetujuan berlaku bila catatan terakhir (menurut waktu) berjenis LAYANAN. Tarik = baris baru TARIK. */
export function persetujuanBerlaku(riwayat: readonly { jenis: JenisPersetujuan; pada: Date }[]): boolean {
  let terakhir: { jenis: JenisPersetujuan; pada: Date } | undefined;
  for (const r of riwayat) if (!terakhir || r.pada.getTime() >= terakhir.pada.getTime()) terakhir = r;
  return terakhir?.jenis === "LAYANAN";
}

/** Pilih organisasi & peran aktif setelah masuk: keanggotaan aktif tertua. */
export function pilihKonteksAwal<T extends { organisasiId: string; peran: Peran; aktif: boolean; dibuatPada: Date }>(
  keanggotaan: readonly T[],
): T | null {
  const aktif = keanggotaan.filter((k) => k.aktif).sort((a, b) => a.dibuatPada.getTime() - b.dibuatPada.getTime());
  return aktif[0] ?? null;
}
