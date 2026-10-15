import { awalHariWib, tambahJam, tanggalWib } from "../waktu";

// Modul langganan — mesin lengkap diisi S19. S13 hanya butuh akhir masa uji coba organisasi kawasan baru (FITUR §3.1).

/** Masa uji coba otomatis sejak organisasi kawasan dibuat. */
export const HARI_UJI_COBA = 14;

/** Awal masa uji coba = awal hari WIB `sekarang`; selesai = awal hari WIB 14 hari kemudian (tepat tengah malam WIB). */
export function masaUjiCoba(sekarang: Date): { mulai: Date; selesai: Date } {
  const mulai = awalHariWib(tanggalWib(sekarang));
  return { mulai, selesai: tambahJam(mulai, HARI_UJI_COBA * 24) };
}
