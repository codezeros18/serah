// Pengurai ringan skema Prisma untuk guard (d) & (e).

export type FieldPrisma = { nama: string; tipe: string; map: string | null; indeks: number };
export type ModelPrisma = { nama: string; map: string | null; field: FieldPrisma[] };

/** Hapus komentar `//` (termasuk `///`) dengan spasi, mempertahankan indeks. */
export function tanpaKomentarPrisma(isi: string): string {
  return isi.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

export function uraiModel(isi: string): ModelPrisma[] {
  const bersih = tanpaKomentarPrisma(isi);
  const keluar: ModelPrisma[] = [];
  for (const m of bersih.matchAll(/\bmodel\s+(\w+)\s*\{([^}]*)\}/g)) {
    const awalBadan = (m.index ?? 0) + m[0].indexOf("{") + 1;
    const badan = m[2] ?? "";
    const field: FieldPrisma[] = [];
    let mapModel: string | null = null;
    let offset = 0;
    for (const baris of badan.split("\n")) {
      const t = baris.trim();
      const mm = /^@@map\(\s*"([^"]+)"\s*\)/.exec(t);
      if (mm) mapModel = mm[1] ?? null;
      const f = /^(\w+)\s+([\w.]+(?:\[\])?\??)(.*)$/.exec(t);
      if (f && !t.startsWith("@@")) {
        const mapField = /@map\(\s*"([^"]+)"\s*\)/.exec(f[3] ?? "");
        field.push({ nama: f[1] ?? "", tipe: f[2] ?? "", map: mapField?.[1] ?? null, indeks: awalBadan + offset + baris.indexOf(t) });
      }
      offset += baris.length + 1;
    }
    keluar.push({ nama: m[1] ?? "", map: mapModel, field });
  }
  return keluar;
}

/** Normalisasi nama model/tabel untuk perbandingan: huruf kecil tanpa garis bawah. */
export function normalNama(s: string): string {
  return s.toLowerCase().replace(/_/g, "");
}

/** Pecah nama kolom menjadi segmen: snake_case & camelCase. */
export function segmen(nama: string): string[] {
  return nama
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/_+/)
    .filter(Boolean);
}

export const adalahBerkasPrisma = (j: string) => j.startsWith("packages/db/") && j.endsWith(".prisma");
export const adalahBerkasSql = (j: string) => j.startsWith("packages/db/") && j.endsWith(".sql");
