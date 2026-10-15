import type { Guard, Temuan } from "./jenis.ts";
import { adalahKode, adalahTest, ambilString, bersihkanKode, diperiksa, nomorBaris } from "./util.ts";

// (c) Literal teks berbahasa Indonesia ≥4 kata di app/** atau ui/** di luar teks.ts.
// Heuristik: ≥4 kata huruf DAN memuat minimal satu kata fungsi bahasa Indonesia.

export const KATA_FUNGSI = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "tidak", "ini", "itu", "pada", "atau", "akan",
  "sudah", "belum", "anda", "kami", "saya", "dapat", "harus", "bila", "jika", "karena", "oleh", "dalam",
  "sebagai", "adalah", "juga", "agar", "setelah", "sebelum", "silakan", "telah", "sedang", "masih", "mohon",
]);

const KATA = /^[\p{L}][\p{L}'’-]*[.,!?…:;)"]*$/u;

export function tampakTeksIndonesia(s: string): boolean {
  const token = s.trim().split(/\s+/).filter(Boolean);
  if (token.length < 4) return false;
  const kata = token.filter((t) => KATA.test(t));
  if (kata.length < 4 || kata.length < token.length * 0.75) return false;
  return kata.some((t) => KATA_FUNGSI.has(t.toLowerCase().replace(/[^\p{L}]/gu, "")));
}

function dalamCakupan(jalur: string): boolean {
  if (!adalahKode(jalur) || adalahTest(jalur)) return false;
  return jalur.startsWith("apps/web/app/") || jalur.startsWith("packages/ui/");
}

export const guardLiteralTeks: Guard = {
  kode: "c",
  nama: "literal-teks",
  keterangan: "Literal teks Indonesia ≥4 kata di app/** & ui/** di luar teks.ts",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!dalamCakupan(b.jalur)) continue;
      const kode = bersihkanKode(b.isi);
      for (const s of ambilString(kode)) {
        if (tampakTeksIndonesia(s.nilai)) {
          temuan.push({ berkas: b.jalur, baris: nomorBaris(b.isi, s.indeks), pesan: `literal teks "${s.nilai.slice(0, 50)}" — ambil dari teks.ts` });
        }
      }
      if (b.jalur.endsWith("x")) {
        // Teks JSX di antara tag: >…<
        const tanpaString = bersihkanKode(b.isi, { kosongkanString: true });
        for (const m of tanpaString.matchAll(/>([^<>{}=;]+)</g)) {
          const teks = m[1] ?? "";
          if (tampakTeksIndonesia(teks)) {
            temuan.push({ berkas: b.jalur, baris: nomorBaris(b.isi, m.index ?? 0), pesan: `teks JSX "${teks.trim().slice(0, 50)}" — ambil dari teks.ts` });
          }
        }
      }
    }
    return diperiksa(temuan);
  },
};
