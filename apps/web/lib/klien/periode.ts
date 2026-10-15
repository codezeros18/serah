// Periode laporan "YYYY-MM" menurut Asia/Jakarta (CLAUDE.md §5). Hanya pemformatan tanggal, bukan hitungan bisnis.

const POLA = /^\d{4}-(0[1-9]|1[0-2])$/;

export function periodeSekarangWib(sekarang: Date = new Date()): string {
  const bagian = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).formatToParts(sekarang);
  const tahun = bagian.find((b) => b.type === "year")?.value ?? "1970";
  const bulan = bagian.find((b) => b.type === "month")?.value ?? "01";
  return `${tahun}-${bulan}`;
}

export function periodeSah(p: string): boolean {
  return POLA.test(p);
}

/** Waktu ISO → teks tanggal & jam WIB untuk tampilan. */
export function tanggalJamWib(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
