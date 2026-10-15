// Waktu bisnis dalam WIB (Asia/Jakarta). Disimpan UTC; tanggal/jam/periode bisnis dihitung di sini.
// Murni: tidak pernah membaca jam sistem — setiap fungsi menerima waktunya sebagai argumen.
// Asia/Jakarta = UTC+7 tetap (tanpa waktu musim panas sejak 1964), jadi cukup geser 7 jam.

export const OFFSET_WIB_MENIT = 7 * 60;
const MS_MENIT = 60_000;
const MS_JAM = 3_600_000;
const MS_OFFSET = OFFSET_WIB_MENIT * MS_MENIT;

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;
const POLA_PERIODE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const dua = (n: number) => String(n).padStart(2, "0");

function ms(t: Date): number {
  const v = t.getTime();
  if (!Number.isFinite(v)) throw new RangeError("Waktu tidak sah");
  return v;
}

/** Date yang komponen UTC-nya = komponen jam dinding WIB. Hanya untuk dibaca dengan getUTC*. */
function dinding(t: Date): Date {
  return new Date(ms(t) + MS_OFFSET);
}

/** Tanggal WIB `YYYY-MM-DD`. */
export function tanggalWib(t: Date): string {
  const d = dinding(t);
  return `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}-${dua(d.getUTCDate())}`;
}

/** Tanggal WIB `YYYYMMDD` (untuk kode terbaca). */
export function tanggalWibKompak(t: Date): string {
  return tanggalWib(t).replaceAll("-", "");
}

/** Periode WIB `YYYY-MM`. */
export function periodeWib(t: Date): string {
  return tanggalWib(t).slice(0, 7);
}

/** Jam WIB 0–23. */
export function jamWib(t: Date): number {
  return dinding(t).getUTCHours();
}

/** Jam & menit WIB `HH.MM`. */
export function jamMenitWib(t: Date): string {
  const d = dinding(t);
  return `${dua(d.getUTCHours())}.${dua(d.getUTCMinutes())}`;
}

/** Awal hari WIB (00.00 WIB) sebagai instan UTC. */
export function awalHariWib(tanggal: string): Date {
  const m = POLA_TANGGAL.exec(tanggal);
  if (!m) throw new RangeError(`Format tanggal YYYY-MM-DD: ${tanggal}`);
  const [th, bl, hr] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(th, bl - 1, hr);
  const cek = new Date(utc);
  if (cek.getUTCFullYear() !== th || cek.getUTCMonth() !== bl - 1 || cek.getUTCDate() !== hr) {
    throw new RangeError(`Tanggal tidak ada: ${tanggal}`);
  }
  return new Date(utc - MS_OFFSET);
}

function uraiPeriode(periode: string): [number, number] {
  const m = POLA_PERIODE.exec(periode);
  if (!m) throw new RangeError(`Format periode YYYY-MM: ${periode}`);
  return [Number(m[1]), Number(m[2])];
}

/** Awal periode WIB (tanggal 1, 00.00 WIB) sebagai instan UTC. */
export function awalPeriodeWib(periode: string): Date {
  const [th, bl] = uraiPeriode(periode);
  return new Date(Date.UTC(th, bl - 1, 1) - MS_OFFSET);
}

/** Akhir periode WIB (eksklusif) = awal periode berikutnya. */
export function akhirPeriodeWib(periode: string): Date {
  const [th, bl] = uraiPeriode(periode);
  return new Date(Date.UTC(th, bl, 1) - MS_OFFSET);
}

/** Periode sebelumnya, mis. `2027-01` → `2026-12`. */
export function periodeSebelumnya(periode: string): string {
  const [th, bl] = uraiPeriode(periode);
  return bl === 1 ? `${th - 1}-12` : `${th}-${dua(bl - 1)}`;
}

/** Jam penuh yang berlalu dari `dari` ke `sampai` (integer, dibulatkan ke nol). */
export function selisihJam(dari: Date, sampai: Date): number {
  return Math.trunc((ms(sampai) - ms(dari)) / MS_JAM);
}

/** Menit penuh yang berlalu dari `dari` ke `sampai` (integer, dibulatkan ke nol). */
export function selisihMenit(dari: Date, sampai: Date): number {
  return Math.trunc((ms(sampai) - ms(dari)) / MS_MENIT);
}

/** `t` + `jam` jam (integer). */
export function tambahJam(t: Date, jam: number): Date {
  if (!Number.isSafeInteger(jam)) throw new RangeError("Jam harus integer");
  return new Date(ms(t) + jam * MS_JAM);
}
