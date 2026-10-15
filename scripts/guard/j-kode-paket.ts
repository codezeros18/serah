import type { Guard, Temuan } from "./jenis.ts";
import { adalahGuard, adalahKode, adalahTest, ambilString, bersihkanKode, diperiksa, nomorBaris } from "./util.ts";

// (j) Hak paket adalah data: literal kode paket hanya di lib/server/hak.ts & seed (CLAUDE.md §2.7).
// `INTERNAL` juga nilai JenisOrganisasi, jadi hanya dianggap kode paket bila barisnya menyebut "paket".

const KODE_KHAS = new Set(["KAWASAN_UJI_COBA", "KAWASAN_STANDAR", "KAWASAN_DASAR", "MITRA"]);

function diizinkan(jalur: string): boolean {
  return jalur === "apps/web/lib/server/hak.ts" || jalur.startsWith("packages/db/seed/") || adalahTest(jalur);
}

export const guardKodePaket: Guard = {
  kode: "j",
  nama: "kode-paket",
  keterangan: "Literal kode paket hanya di lib/server/hak.ts & seed",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!adalahKode(b.jalur) || adalahGuard(b.jalur) || diizinkan(b.jalur)) continue;
      const kode = bersihkanKode(b.isi);
      const baris = kode.split("\n");
      for (const s of ambilString(kode)) {
        const nomor = nomorBaris(b.isi, s.indeks);
        const kenaInternal = s.nilai === "INTERNAL" && /paket/i.test(baris[nomor - 1] ?? "");
        if (KODE_KHAS.has(s.nilai) || kenaInternal) {
          temuan.push({ berkas: b.jalur, baris: nomor, pesan: `literal kode paket "${s.nilai}" — pakai boleh()/batas()` });
        }
      }
    }
    return diperiksa(temuan);
  },
};
