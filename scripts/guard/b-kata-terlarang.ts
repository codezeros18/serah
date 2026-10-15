import { IZIN_KATA } from "./izin-kata.ts";
import type { Guard, Temuan } from "./jenis.ts";
import { adalahTest, diperiksa, nomorBaris } from "./util.ts";

// (b) Kata terlarang di teks pengguna: teks.ts, halaman (app/**), ui/**, templat email & push, README.

export const KATA_TERLARANG = [
  "melanggar",
  "pelanggaran",
  "pelanggar",
  "curang",
  "kecurangan",
  "nakal",
  "skor",
  "peringkat",
  "ranking",
  "kinerja",
  "terbaik",
  "terburuk",
  "dijamin",
  "menjamin",
  "pasti benar",
  "akurat",
  "mencegah banjir",
  "bebas banjir",
] as const;

const POLA = new RegExp(
  `(?<![\\p{L}\\p{N}])(${KATA_TERLARANG.map((k) => k.replace(/ /g, "\\s+")).join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

export function dalamCakupan(jalur: string): boolean {
  if (adalahTest(jalur)) return false;
  return (
    jalur === "packages/kontrak/src/teks.ts" ||
    jalur === "README.md" ||
    (jalur.startsWith("apps/web/app/") && /\.(tsx?|jsx?|mdx?|css)$/.test(jalur)) ||
    (jalur.startsWith("packages/ui/") && /\.(tsx?|jsx?|css)$/.test(jalur)) ||
    (/^apps\/web\/lib\/adaptor\/(email|push)\//.test(jalur) && /\.(tsx?|jsx?|html)$/.test(jalur))
  );
}

/** Ganti kalimat izin (persis) dengan spasi, hanya di berkas yang diizinkan. */
function hapusIzin(jalur: string, isi: string): string {
  let hasil = isi;
  for (const izin of IZIN_KATA) {
    if (!izin.berkas.includes(jalur)) continue;
    hasil = hasil.split(izin.kalimat).join(" ".repeat(izin.kalimat.length));
  }
  return hasil;
}

export const guardKataTerlarang: Guard = {
  kode: "b",
  nama: "kata-terlarang",
  keterangan: "Kata terlarang CLAUDE.md §2.8 di teks.ts, app/**, ui/**, email/push, README (dengan daftar izin)",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!dalamCakupan(b.jalur)) continue;
      const teks = hapusIzin(b.jalur, b.isi);
      for (const m of teks.matchAll(POLA)) {
        temuan.push({ berkas: b.jalur, baris: nomorBaris(b.isi, m.index ?? 0), pesan: `kata terlarang "${m[1]}"` });
      }
    }
    return diperiksa(temuan);
  },
};
