// Statistik ringan untuk dasbor (tampilan saja): ringkas total, persen, perubahan, deret harian.
// Semua berat dalam gram bilangan bulat; persen hanya untuk tampilan.

export type TotalBerat = { beratTpsG: number; beratDiterimaG: number; beratDitolakG: number };

export function jumlahTotal(t: readonly TotalBerat[]): { tps: number; diterima: number; ditolak: number } {
  return t.reduce(
    (a, x) => ({ tps: a.tps + x.beratTpsG, diterima: a.diterima + x.beratDiterimaG, ditolak: a.ditolak + x.beratDitolakG }),
    { tps: 0, diterima: 0, ditolak: 0 },
  );
}

/** Persen bagian terhadap total (0 bila total 0), satu desimal. */
export function persen(bagian: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((bagian / total) * 1000) / 10;
}

/** Mutu pemilahan = berat diterima ÷ (diterima + ditolak). Null bila belum ada serah tertutup. */
export function mutuPemilahan(t: readonly TotalBerat[]): number | null {
  const { diterima, ditolak } = jumlahTotal(t);
  const tutup = diterima + ditolak;
  return tutup <= 0 ? null : persen(diterima, tutup);
}

/** Perubahan persen sekarang vs sebelum; null bila pembanding 0. */
export function perubahanPersen(sekarang: number, sebelum: number): number | null {
  if (sebelum <= 0) return null;
  return Math.round(((sekarang - sebelum) / sebelum) * 1000) / 10;
}

/** "2026-01" → "2025-12". */
export function periodeSebelum(p: string): string {
  const [t, b] = p.split("-");
  const tahun = Number(t);
  const bulan = Number(b);
  return bulan === 1 ? `${tahun - 1}-12` : `${tahun}-${String(bulan - 1).padStart(2, "0")}`;
}

export function hariDalamBulan(p: string): number {
  const [t, b] = p.split("-");
  return new Date(Date.UTC(Number(t), Number(b), 0)).getUTCDate();
}

export type TitikHarian = { hari: number; label: string; tpsG: number; diterimaG: number; ditolakG: number };

/**
 * Deret harian berat dalam satu bulan dari baris laporan. `sampaiHari` membatasi hari terakhir
 * (mis. hari ini untuk bulan berjalan); hari tanpa serah bernilai 0.
 */
export function deretHarian(
  baris: readonly (TotalBerat & { tanggalWib: string })[],
  periode: string,
  sampaiHari?: number,
): TitikHarian[] {
  const akhir = Math.min(hariDalamBulan(periode), sampaiHari ?? 31);
  const peta = new Map<number, TitikHarian>();
  for (let h = 1; h <= akhir; h++) peta.set(h, { hari: h, label: String(h), tpsG: 0, diterimaG: 0, ditolakG: 0 });
  for (const b of baris) {
    const hari = Number(b.tanggalWib.slice(8, 10));
    const t = peta.get(hari);
    if (!t) continue;
    t.tpsG += b.beratTpsG;
    t.diterimaG += b.beratDiterimaG;
    t.ditolakG += b.beratDitolakG;
  }
  return [...peta.values()];
}
