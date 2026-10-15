// Evaluator hak paket murni (FITUR §3.2). Nilai entitlement adalah DATA (tabel `entitlement`); kode paket tidak
// pernah muncul di sini (guard j). Satu pintu server: lib/server/hak.ts boleh()/batas().

/** Hak "boleh": hanya `true` yang membuka fitur. Nilai tidak dikenal/tidak ada → tertutup. */
export function evaluasiBoleh(nilai: unknown): boolean {
  return nilai === true;
}

/** Hak "batas": bilangan bulat ≥0, atau `null` = tak terbatas. Nilai tidak dikenal/tidak ada → 0 (paling aman). */
export function evaluasiBatas(nilai: unknown): number | null {
  if (nilai === null) return null;
  return typeof nilai === "number" && Number.isSafeInteger(nilai) && nilai >= 0 ? nilai : 0;
}

/** Masih boleh menambah satu lagi? `terpakai` = jumlah yang sudah ada. */
export function masihDalamBatas(batas: number | null, terpakai: number): boolean {
  return batas === null || terpakai < batas;
}

/**
 * Yang TIDAK PERNAH dikunci paket (FITUR §3.3, CLAUDE.md §2.7) — kewajiban hukum pengguna. Rute & layanan untuk hal
 * ini tidak boleh memanggil boleh()/batas(); test T24 memeriksa berkasnya.
 */
export const TIDAK_PERNAH_DIKUNCI = [
  "catat wadah",
  "buat/ambil/setujui/tutup serah",
  "koreksi berat",
  "permintaan koreksi",
  "tiga laporan di layar",
  "ekspor CSV",
  "verifikasi rantai",
  "penyebab ditolak",
  "prioritas angkut",
  "notifikasi in-app",
  "hapus akun & unduh data",
] as const;
