import { GalatBmkg, type TitikE6 } from "./tipe";

// Derajat desimal (string) → integer ×1.000.000, tanpa Float (CLAUDE.md §2.1, BLUEPRINT §O.2).
// Pisah di titik desimal, padding/pemotongan 6 digit (pemotongan ke arah nol).

const POLA_DERAJAT = /^(-|\+)?(\d{1,3})(?:\.(\d+))?$/;

export function derajatKeE6(teks: string): number {
  const m = POLA_DERAJAT.exec(teks.trim());
  if (!m) throw new GalatBmkg("FORMAT", "Koordinat CAP tidak dapat dibaca");
  const utuh = Number(m[2]);
  const pecahan = Number((m[3] ?? "").padEnd(6, "0").slice(0, 6));
  const nilai = utuh * 1_000_000 + pecahan;
  return m[1] === "-" ? -nilai : nilai;
}

/** "lat,lon lat,lon …" → [[latE6, lonE6], …]. Titik penutup yang sama dengan titik awal dibuang. */
export function poligonCapKeE6(teks: string): TitikE6[] {
  const titik = teks
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((pasang): TitikE6 => {
      const bagian = pasang.split(",");
      if (bagian.length !== 2) throw new GalatBmkg("FORMAT", "Pasangan koordinat CAP tidak sah");
      return [derajatKeE6(bagian[0]!), derajatKeE6(bagian[1]!)];
    });
  const awal = titik[0];
  const akhir = titik[titik.length - 1];
  if (titik.length > 1 && awal && akhir && awal[0] === akhir[0] && awal[1] === akhir[1]) titik.pop();
  return titik;
}
