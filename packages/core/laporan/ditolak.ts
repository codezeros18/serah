import type { AlasanTolak, BarisLaporan } from "@serah/kontrak";

// Penyebab ditolak (K3, FITUR F16): kg KUNING diterima vs ditolak, alasan teratas, dan perkiraan selisih nilai.
// Selisih rupiah = kg ditolak × (harga bersih − harga kotor) dan HANYA dihitung dari baris harga bersumber yang
// punya harga bersih DAN kotor (RISET R-HM-02). Material lain: berat ditolak tanpa rupiah. Tanpa tanggal sumber
// berformat tanggal, harga dianggap tidak tersedia (CLAUDE.md §5: harga selalu berlabel sumber & tanggal).

export type HargaMaterialMasukan = {
  sumberKode: string;
  bersihIdrPerKg: number;
  kotorIdrPerKg: number | null;
  /** Label tanggal apa adanya dari RISET; hanya `YYYY-MM-DD` yang dipakai. */
  tanggalSumber: string | null;
};

/**
 * Label sumber untuk tampilan K3_SUMBER_HARGA — disalin dari kolom Material & Sumber RISET §5.
 * Tabel harga_material tidak punya kolom label; kode yang belum terdaftar tampil sebagai kodenya.
 */
export const LABEL_SUMBER_HARGA: Readonly<Record<string, string>> = {
  "R-HM-02": "PET bening, bank sampah binaan IMIP",
};

const POLA_TANGGAL = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Harga acuan selisih: berharga bersih > kotor, bertanggal sah; terbaru menang, lalu kode terkecil. */
export function pilihHargaAcuan(daftar: readonly HargaMaterialMasukan[]): HargaMaterialMasukan | null {
  const kandidat = daftar
    .filter((h) => h.kotorIdrPerKg !== null && h.bersihIdrPerKg > h.kotorIdrPerKg && h.kotorIdrPerKg >= 0 && h.tanggalSumber !== null && POLA_TANGGAL.test(h.tanggalSumber))
    .sort((a, b) => (b.tanggalSumber! < a.tanggalSumber! ? -1 : b.tanggalSumber! > a.tanggalSumber! ? 1 : a.sumberKode < b.sumberKode ? -1 : 1));
  return kandidat[0] ?? null;
}

export type HasilDitolak = {
  kuning: { diterimaG: number; ditolakG: number };
  alasan: { alasan: AlasanTolak; ditolakG: number; jumlahSerah: number; selisihIdr: number | null }[];
  sumberHarga: { sumber: string; tanggal: string } | null;
};

/** Pembagian bulat setengah-naik: (a / b) dibulatkan, a ≥ 0, b > 0, tanpa float. */
function bagiBulat(a: bigint, b: bigint): bigint {
  return (2n * a + b) / (2n * b);
}

/**
 * Dari baris laporan kawasan (hasil susunBaris) — angkanya selalu sama dengan laporan.
 * Hanya aliran KUNING. Alasan diurutkan dari kg ditolak terbesar, lalu nama alasan.
 */
export function ringkasDitolak(baris: readonly BarisLaporan[], harga: HargaMaterialMasukan | null): HasilDitolak {
  const kuning = baris.filter((b) => b.aliran === "KUNING");
  const diterimaG = kuning.reduce((s, b) => s + b.beratDiterimaG, 0);
  const ditolakG = kuning.reduce((s, b) => s + b.beratDitolakG, 0);

  const selisihPerKg = harga && harga.kotorIdrPerKg !== null ? harga.bersihIdrPerKg - harga.kotorIdrPerKg : null;
  const acuanSah = harga !== null && selisihPerKg !== null && selisihPerKg > 0 && harga.tanggalSumber !== null && POLA_TANGGAL.test(harga.tanggalSumber);

  const per = new Map<AlasanTolak, { ditolakG: number; serah: Set<string> }>();
  for (const b of kuning) {
    if (b.beratDitolakG <= 0 || b.alasanTolak === null) continue;
    const a = per.get(b.alasanTolak) ?? { ditolakG: 0, serah: new Set<string>() };
    a.ditolakG += b.beratDitolakG;
    a.serah.add(b.kodeSerah);
    per.set(b.alasanTolak, a);
  }

  const alasan = [...per.entries()]
    .map(([k, a]) => ({
      alasan: k,
      ditolakG: a.ditolakG,
      jumlahSerah: a.serah.size,
      selisihIdr: acuanSah ? Number(bagiBulat(BigInt(a.ditolakG) * BigInt(selisihPerKg), 1000n)) : null,
    }))
    .sort((x, y) => y.ditolakG - x.ditolakG || (x.alasan < y.alasan ? -1 : 1));

  return {
    kuning: { diterimaG, ditolakG },
    alasan,
    sumberHarga: acuanSah ? { sumber: LABEL_SUMBER_HARGA[harga.sumberKode] ?? harga.sumberKode, tanggal: harga.tanggalSumber! } : null,
  };
}
