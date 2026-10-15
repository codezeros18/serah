import type { Guard, Temuan } from "./jenis.ts";
import { adalahBerkasPrisma, adalahBerkasSql, tanpaKomentarPrisma } from "./prisma.ts";
import { dilewati, diperiksa, temukan } from "./util.ts";

// (d) Integer saja: nol Float/Decimal/numeric di skema Prisma & SQL migrasi.
// Dilewati selama belum ada skema (sebelum S01); aktif otomatis begitu berkas ada.

export const guardFloatDecimal: Guard = {
  kode: "d",
  nama: "float-decimal",
  keterangan: "Nol Float/Decimal/numeric di schema.prisma & SQL packages/db",
  periksa(k) {
    const prisma = k.berkas.filter((b) => adalahBerkasPrisma(b.jalur));
    const sql = k.berkas.filter((b) => adalahBerkasSql(b.jalur));
    if (prisma.length === 0 && sql.length === 0) return dilewati("schema.prisma belum ada");
    const temuan: Temuan[] = [];
    for (const b of prisma) {
      const bersih = tanpaKomentarPrisma(b.isi);
      temuan.push(...temukan(b, bersih, /(?<=\s)(Float|Decimal)\b(?:\[\])?\??/g, (m) => `tipe ${m[1]} — pakai Int (_g/_idr/_bp/_e6)`));
      temuan.push(...temukan(b, bersih, /@db\.(Decimal|DoublePrecision|Real|Money)\b/g, (m) => `@db.${m[1]} — pakai Int`));
    }
    for (const b of sql) {
      const bersih = b.isi.replace(/--[^\n]*/g, (m) => " ".repeat(m.length));
      temuan.push(...temukan(b, bersih, /\b(numeric|decimal|real|double\s+precision|float[48]?|money)\b/gi, (m) => `tipe SQL ${m[1]} — pakai integer`));
    }
    return diperiksa(temuan);
  },
};
