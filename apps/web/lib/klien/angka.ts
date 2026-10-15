// SEMENTARA — dipakai sampai SINYAL S02 MERGED (jalur A membuat packages/core/angka).
// Setelah itu berkas ini diganti re-export dari "@serah/core/angka" (parseBeratKgKeGram, formatGramKeKg).
// Aturan sama dengan CLAUDE.md §2.1: integer saja, tanpa Float/parseFloat.

const POLA_KG = /^(\d{1,4})(?:[.,](\d{1,3}))?$/;

/** "42,5" → 42500 (gram). Mengembalikan null untuk masukan tidak sah. */
export function parseBeratKgKeGram(masukan: string): number | null {
  const m = POLA_KG.exec(masukan.trim());
  if (!m) return null;
  const kg = Number.parseInt(m[1] ?? "0", 10);
  const pecahan = (m[2] ?? "").padEnd(3, "0");
  const gram = kg * 1000 + Number.parseInt(pecahan || "0", 10);
  return gram >= 1 ? gram : null;
}

/** 42500 → "42,5". Hanya aritmetika bilangan bulat. */
export function formatGramKeKg(gram: number): string {
  const kg = Math.trunc(gram / 1000);
  const sisa = String(gram % 1000).padStart(3, "0").replace(/0+$/, "");
  return sisa === "" ? String(kg) : `${kg},${sisa}`;
}
