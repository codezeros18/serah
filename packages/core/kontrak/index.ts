import type { Aliran, StatusKontrak } from "@serah/kontrak";

// Aturan murni kontrak kawasan–pengangkut–penerima (S13, BLUEPRINT §H.3 kontrak, §J R-02/R-11).
// Pihak & aliran tidak boleh berubah setelah AKTIF; perubahan lain teraudit. Tanggal = 'YYYY-MM-DD' (WIB).

export type PihakKonfirmasi = "PENGANGKUT" | "PENERIMA";

export type KontrakKonfirmasi = {
  status: StatusKontrak;
  dikonfirmasiPengangkutPada: Date | null;
  dikonfirmasiPenerimaPada: Date | null;
};

export type PerubahanKontrak = Partial<{
  pengangkutId: string;
  penerimaId: string;
  aliran: readonly Aliran[];
  berlakuDari: string;
  berlakuSampai: string;
  tarifPerRitIdr: number | null;
  tarifPerKgIdr: number | null;
}>;

export type SebabTolakUbah = "STATUS_TERTUTUP" | "PIHAK_TERKUNCI" | "ALIRAN_TERKUNCI" | "RENTANG_TIDAK_SAH" | "TARIF_TIDAK_SAH";

export type HasilUbah = { ok: true; perluKonfirmasiUlang: boolean; teraudit: boolean } | { ok: false; sebab: SebabTolakUbah };

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Rentang berlaku sah: kedua tanggal berformat benar dan sampai ≥ dari (perbandingan teks YYYY-MM-DD = urutan kalender). */
export function rentangSah(dari: string, sampai: string): boolean {
  return POLA_TANGGAL.test(dari) && POLA_TANGGAL.test(sampai) && sampai >= dari;
}

/**
 * Apakah perubahan ini boleh pada kontrak berstatus `status`.
 * - USULAN: semua boleh; konfirmasi yang sudah masuk harus diulang bila pihak/aliran/rentang/tarif berubah.
 * - AKTIF: pihak & aliran terkunci; rentang & tarif boleh tetapi teraudit.
 * - BERAKHIR / DIBATALKAN: tidak ada yang boleh.
 */
export function bolehUbahKontrak(
  kini: { status: StatusKontrak; berlakuDari: string; berlakuSampai: string },
  perubahan: PerubahanKontrak,
): HasilUbah {
  if (kini.status === "BERAKHIR" || kini.status === "DIBATALKAN") return { ok: false, sebab: "STATUS_TERTUTUP" };
  if (kini.status === "AKTIF") {
    if (perubahan.pengangkutId !== undefined || perubahan.penerimaId !== undefined) return { ok: false, sebab: "PIHAK_TERKUNCI" };
    if (perubahan.aliran !== undefined) return { ok: false, sebab: "ALIRAN_TERKUNCI" };
  }
  const dari = perubahan.berlakuDari ?? kini.berlakuDari;
  const sampai = perubahan.berlakuSampai ?? kini.berlakuSampai;
  if (!rentangSah(dari, sampai)) return { ok: false, sebab: "RENTANG_TIDAK_SAH" };
  for (const t of [perubahan.tarifPerRitIdr, perubahan.tarifPerKgIdr]) {
    if (t !== undefined && t !== null && (!Number.isSafeInteger(t) || t < 0)) return { ok: false, sebab: "TARIF_TIDAK_SAH" };
  }
  return { ok: true, perluKonfirmasiUlang: kini.status === "USULAN", teraudit: kini.status === "AKTIF" };
}

export type HasilKonfirmasi =
  | { ok: true; status: StatusKontrak; dikonfirmasiPengangkutPada: Date | null; dikonfirmasiPenerimaPada: Date | null; aktifBaru: boolean }
  | { ok: false; sebab: "BUKAN_USULAN" };

/**
 * Konfirmasi satu pihak. Dua pihak sudah konfirmasi → AKTIF. Konfirmasi ulang oleh pihak yang sama tidak
 * mengubah waktu konfirmasi pertama (idempoten). R-11 dinilai oleh pemanggil sebelum memanggil fungsi ini.
 */
export function terapkanKonfirmasi(k: KontrakKonfirmasi, pihak: PihakKonfirmasi, sekarang: Date): HasilKonfirmasi {
  if (k.status !== "USULAN") return { ok: false, sebab: "BUKAN_USULAN" };
  const pengangkut = pihak === "PENGANGKUT" ? (k.dikonfirmasiPengangkutPada ?? sekarang) : k.dikonfirmasiPengangkutPada;
  const penerima = pihak === "PENERIMA" ? (k.dikonfirmasiPenerimaPada ?? sekarang) : k.dikonfirmasiPenerimaPada;
  const aktif = pengangkut !== null && penerima !== null;
  return { ok: true, status: aktif ? "AKTIF" : "USULAN", dikonfirmasiPengangkutPada: pengangkut, dikonfirmasiPenerimaPada: penerima, aktifBaru: aktif };
}

export type HasilAkhiri = { ok: true; statusBaru: "BERAKHIR" | "DIBATALKAN" } | { ok: false; sebab: "SUDAH_SELESAI" };

/** Akhiri: AKTIF → BERAKHIR; USULAN (belum berlaku) → DIBATALKAN; selain itu ditolak. */
export function akhiriKontrak(status: StatusKontrak): HasilAkhiri {
  if (status === "AKTIF") return { ok: true, statusBaru: "BERAKHIR" };
  if (status === "USULAN") return { ok: true, statusBaru: "DIBATALKAN" };
  return { ok: false, sebab: "SUDAH_SELESAI" };
}
