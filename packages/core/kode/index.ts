import { tanggalWibKompak } from "../waktu";

// Kode terbaca manusia (CLAUDE.md §5). Nomor urut diambil server dari tabel `penomoran` (FOR UPDATE);
// di sini hanya pembentukan & validasi format. Tanggal selalu WIB.

export type HasilKode = { ok: true; kode: string } | { ok: false; galat: "FORMAT" | "NOMOR_DI_LUAR_RENTANG" };

const FORMAT: HasilKode = { ok: false, galat: "FORMAT" };
const RENTANG: HasilKode = { ok: false, galat: "NOMOR_DI_LUAR_RENTANG" };

const POLA_HURUF_KAWASAN = /^[A-Z]{3,5}$/;
const POLA_KODE_KAWASAN = /^KWS-([A-Z]{3,5})$/;
const POLA_PERIODE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Nomor urut 1..(10^digit − 1), diisi nol di depan. */
function nomor(n: number, digit: number): string | null {
  if (!Number.isSafeInteger(n) || n < 1 || n >= 10 ** digit) return null;
  return String(n).padStart(digit, "0");
}

function dengan(awalan: string, n: number, digit: number): HasilKode {
  const no = nomor(n, digit);
  return no === null ? RENTANG : { ok: true, kode: `${awalan}-${no}` };
}

function periodeKompak(periode: string): string | null {
  const m = POLA_PERIODE.exec(periode);
  return m ? `${m[1]}${m[2]}` : null;
}

/** `KWS-<3–5 huruf>`; huruf dinormalkan ke kapital. */
export function kodeKawasan(huruf: string): HasilKode {
  const h = huruf.trim().toUpperCase();
  return POLA_HURUF_KAWASAN.test(h) ? { ok: true, kode: `KWS-${h}` } : FORMAT;
}

const ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Usulan 3–5 huruf kode kawasan dari nama. Percobaan 0: huruf awal tiap kata (≥3; kurang → lanjut dari huruf
 * kata pertama; maks 5). Percobaan n>0 mengganti huruf terakhir (atau menambah huruf) agar unik. Deterministik.
 */
export function hurufKodeKawasan(nama: string, percobaan = 0): string {
  const bersih = nama
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .trim();
  const kata = bersih.split(/\s+/).filter((k) => /[A-Z]/.test(k)).map((k) => k.replace(/[^A-Z]/g, ""));
  let huruf = kata.map((k) => k[0] ?? "").join("").slice(0, 5);
  const semua = kata.join("");
  for (let i = 1; huruf.length < 3 && i <= semua.length; i++) huruf = (huruf + (kata[0]?.[i] ?? "")).slice(0, 5);
  while (huruf.length < 3) huruf += "X";
  if (percobaan <= 0) return huruf;
  const pangkal = huruf.length >= 5 ? huruf.slice(0, 4) : huruf;
  const tambahan = ALFABET[(percobaan - 1) % 26] ?? "A";
  const putaran = Math.floor((percobaan - 1) / 26);
  return putaran === 0 ? (pangkal + tambahan).slice(0, 5) : (pangkal.slice(0, 3) + (ALFABET[putaran % 26] ?? "A") + tambahan).slice(0, 5);
}

/** `TPS-<KWS>-NN` dari kode kawasan `KWS-<KWS>`. */
export function kodeTps(kodeKawasan: string, n: number): HasilKode {
  const m = POLA_KODE_KAWASAN.exec(kodeKawasan);
  return m ? dengan(`TPS-${m[1]}`, n, 2) : FORMAT;
}

/** `SRH-YYYYMMDD-NNNN`, tanggal WIB `sekarang`, nomor urut harian global. */
export function kodeSerah(sekarang: Date, n: number): HasilKode {
  return dengan(`SRH-${tanggalWibKompak(sekarang)}`, n, 4);
}

/** `PKR-YYYYMMDD-NNN`, tanggal WIB `sekarang`. */
export function kodePermintaanKoreksi(sekarang: Date, n: number): HasilKode {
  return dengan(`PKR-${tanggalWibKompak(sekarang)}`, n, 3);
}

/** `TGH-YYYYMM-NNNN` untuk periode `YYYY-MM`. */
export function kodeTagihan(periode: string, n: number): HasilKode {
  const p = periodeKompak(periode);
  return p ? dengan(`TGH-${p}`, n, 4) : FORMAT;
}

/** `TGA-YYYYMM-NNNN` untuk periode `YYYY-MM`. */
export function kodeTagihanAngkut(periode: string, n: number): HasilKode {
  const p = periodeKompak(periode);
  return p ? dengan(`TGA-${p}`, n, 4) : FORMAT;
}
