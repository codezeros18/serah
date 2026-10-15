import type { Guard, Temuan } from "./jenis.ts";
import { adalahGuard, adalahKode, bersihkanKode, diperiksa, temukan } from "./util.ts";

// (i) Status serah hanya berubah lewat layananTransisi (CLAUDE.md §2.2).

const DIIZINKAN = "apps/web/lib/server/layanan/transisi.ts";
const POLA_ORM = /\bserah\s*\.\s*(update|updateMany|upsert)\s*\(/g;
const POLA_SQL = /\bupdate\s+(?:"?\w+"?\s*\.\s*)?"?serah"?\s+set\b/gi;

export const guardUbahSerah: Guard = {
  kode: "i",
  nama: "ubah-serah",
  keterangan: "serah.update / UPDATE serah hanya di lib/server/layanan/transisi.ts",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!adalahKode(b.jalur) || adalahGuard(b.jalur) || b.jalur === DIIZINKAN) continue;
      const kode = bersihkanKode(b.isi);
      temuan.push(...temukan(b, kode, POLA_ORM, (m) => `serah.${m[1]} di luar ${DIIZINKAN}`));
      temuan.push(...temukan(b, kode, POLA_SQL, () => `UPDATE serah di luar ${DIIZINKAN}`));
    }
    return diperiksa(temuan);
  },
};
