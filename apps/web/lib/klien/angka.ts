// Pintu angka untuk klien: satu-satunya konversi masukan berat dan satu-satunya tampilan berat.
// Seluruh logika ada di @serah/core/angka (CLAUDE.md §2.1); berkas ini hanya menyederhanakan hasilnya
// bagi layar: gram integer, atau null bila masukan tidak sah.
import { formatGramKeKg, parseBeratKgKeGram as uraiBeratKgKeGram } from "@serah/core/angka";

/** "42,5" → 42500 (gram). null untuk masukan kosong/tidak sah. */
export function parseBeratKgKeGram(masukan: string): number | null {
  const h = uraiBeratKgKeGram(masukan);
  return h.ok ? h.nilai : null;
}

export { formatGramKeKg };
