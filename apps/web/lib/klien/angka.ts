// Pintu angka untuk klien: satu-satunya konversi masukan berat dan satu-satunya tampilan berat.
// Seluruh logika ada di @serah/core/angka (CLAUDE.md §2.1); berkas ini hanya menyederhanakan hasilnya
// bagi layar: gram integer, atau null bila masukan tidak sah.
import {
  formatE6,
  formatGramKeKg,
  parseBeratKgKeGram as uraiBeratKgKeGram,
  parseKoordinatKeE6 as uraiKoordinatKeE6,
} from "@serah/core/angka";

/** "42,5" → 42500 (gram). null untuk masukan kosong/tidak sah. */
export function parseBeratKgKeGram(masukan: string): number | null {
  const h = uraiBeratKgKeGram(masukan);
  return h.ok ? h.nilai : null;
}

/** "-6.161234" → -6161234 (integer e6). null untuk masukan kosong/tidak sah. */
export function parseKoordinat(masukan: string, sumbu: "lat" | "lon"): number | null {
  const h = uraiKoordinatKeE6(masukan, sumbu);
  return h.ok ? h.nilai : null;
}

export { formatE6, formatGramKeKg };

