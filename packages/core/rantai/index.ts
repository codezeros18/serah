import { sha256Hex } from "./sha256";

export { sha256Hex };

// Rantai hash per kawasan (BLUEPRINT §F.3). Implementasi ini HARUS identik dengan fungsi SQL
// `hash_event` (S01-4); kesamaan dijaga oleh fixture.json (test silang).
//
//   hash = hex(SHA-256(utf8( prev_hash | jenis | (serah_kode atau "-") | peran | payload_kanonis | diterima_pada_ISO )))

export const HASH_AWAL = "0".repeat(64);
const PEMISAH = "|";

export type DataEvent = {
  jenis: string;
  serahKode: string | null;
  peran: string;
  payload: unknown;
  /** Waktu server (diterima_pada), bukan waktu perangkat. */
  diterimaPada: Date;
};

export type EventTersimpan = DataEvent & { urutanRantai: number; prevHash: string; hash: string };

export type HasilVerifikasi = { utuh: boolean; jumlah: number; patahDiUrutan: number | null };

function kanonisNilai(v: unknown, jalur: string): string {
  if (v === null) return "null";
  switch (typeof v) {
    case "string":
      return JSON.stringify(v);
    case "boolean":
      return v ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(v)) throw new TypeError(`Payload ${jalur}: angka harus integer aman`);
      return String(v === 0 ? 0 : v);
    case "object": {
      if (Array.isArray(v)) {
        return `[${v.map((x, i) => {
          if (x === undefined) throw new TypeError(`Payload ${jalur}[${i}]: undefined di larik`);
          return kanonisNilai(x, `${jalur}[${i}]`);
        }).join(",")}]`;
      }
      const proto = Object.getPrototypeOf(v) as unknown;
      if (proto !== Object.prototype && proto !== null) throw new TypeError(`Payload ${jalur}: hanya objek polos`);
      const obj = v as Record<string, unknown>;
      const kunci = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
      return `{${kunci.map((k) => `${JSON.stringify(k)}:${kanonisNilai(obj[k], `${jalur}.${k}`)}`).join(",")}}`;
    }
    default:
      throw new TypeError(`Payload ${jalur}: tipe ${typeof v} tidak boleh`);
  }
}

/**
 * JSON kanonis: tanpa spasi, kunci objek terurut (kode unit UTF-16; = urutan byte untuk kunci ASCII),
 * properti undefined dibuang, angka hanya integer aman, string di-escape seperti JSON.stringify.
 */
export function kanonis(nilai: unknown): string {
  return kanonisNilai(nilai, "$");
}

/** Teks yang di-hash (berguna untuk men-debug kecocokan dengan SQL). */
export function praGambarEvent(prevHash: string, e: DataEvent): string {
  return [prevHash, e.jenis, e.serahKode ?? "-", e.peran, kanonis(e.payload), e.diterimaPada.toISOString()].join(PEMISAH);
}

export function hashEvent(prevHash: string, e: DataEvent): string {
  return sha256Hex(praGambarEvent(prevHash, e));
}

/**
 * Hitung ulang rantai satu kawasan. Urutan diambil dari `urutanRantai` (harus 1, 2, 3, …).
 * `patahDiUrutan` = urutan pertama yang tidak utuh (hilang, prev tidak cocok, atau hash tidak cocok).
 */
export function verifikasiRantai(events: readonly EventTersimpan[]): HasilVerifikasi {
  const urut = [...events].sort((a, b) => a.urutanRantai - b.urutanRantai);
  let prev = HASH_AWAL;
  for (let i = 0; i < urut.length; i++) {
    const e = urut[i]!;
    const harap = i + 1;
    const patah =
      e.urutanRantai !== harap ||
      e.prevHash !== prev ||
      hashEvent(e.prevHash, e) !== e.hash;
    if (patah) return { utuh: false, jumlah: urut.length, patahDiUrutan: harap };
    prev = e.hash;
  }
  return { utuh: true, jumlah: urut.length, patahDiUrutan: null };
}
