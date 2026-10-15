// Bantu waktu WIB (UTC+7, tanpa DST) untuk aturan. Murni: waktu selalu argumen.
// Sementara berdiri sendiri sampai core/waktu (S02) tersedia.

export const MS_PER_JAM = 3_600_000;
export const MS_PER_HARI = 86_400_000;
const OFFSET_WIB_MS = 7 * MS_PER_JAM;

function geserWib(d: Date): Date {
  return new Date(d.getTime() + OFFSET_WIB_MS);
}

/** Tanggal bisnis `YYYY-MM-DD` di Asia/Jakarta. */
export function tanggalWib(d: Date): string {
  return geserWib(d).toISOString().slice(0, 10);
}

/** Jam (0–23) di Asia/Jakarta. */
export function jamWib(d: Date): number {
  return geserWib(d).getUTCHours();
}

/** `HH.MM` di Asia/Jakarta. */
export function formatJamWib(d: Date): string {
  const g = geserWib(d);
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${dua(g.getUTCHours())}.${dua(g.getUTCMinutes())}`;
}

/** Selisih ms (sampai − dari), tidak negatif. */
export function umurMs(dari: Date, sampai: Date): number {
  return Math.max(0, sampai.getTime() - dari.getTime());
}

/** Umur dalam jam penuh (dibulatkan ke bawah). */
export function umurJamPenuh(dari: Date, sampai: Date): number {
  return Math.floor(umurMs(dari, sampai) / MS_PER_JAM);
}
