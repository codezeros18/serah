// Pengurai bagian teks UI (§M) dari dokumen spesifikasi: setiap baris `KUNCI = nilai`
// di dalam blok kode. Dipakai oleh teks-dari-blueprint.ts (tulis & periksa).

export type EntriTeks = { kunci: string; nilai: string; bagian: string };

const POLA_JUDUL_M = /^## (M\.\d+ .*)$/;
const POLA_KUNCI = /^([A-Z][A-Z0-9_]*)\s*=\s?(.*)$/;

/** Ambil isi bagian `# M — …` sampai judul tingkat-1 berikutnya. */
export function ambilBagianM(md: string): string[] {
  const baris = md.replace(/\r\n/g, "\n").split("\n");
  const mulai = baris.findIndex((b) => /^# M\b/.test(b));
  if (mulai < 0) throw new Error("Bagian '# M' tidak ditemukan");
  const sisa = baris.slice(mulai + 1);
  const akhir = sisa.findIndex((b) => /^# [A-Z]\b/.test(b));
  return akhir < 0 ? sisa : sisa.slice(0, akhir);
}

/** Salinan blok-blok §M apa adanya: judul `## M.x` + isi blok kode. Ini bentuk berkas fixture. */
export function salinBlokM(md: string): string {
  const keluar: string[] = [];
  let dalamBlok = false;
  for (const b of ambilBagianM(md)) {
    if (b.startsWith("```")) {
      dalamBlok = !dalamBlok;
      continue;
    }
    if (dalamBlok) keluar.push(b.replace(/\s+$/, ""));
    else if (POLA_JUDUL_M.test(b)) keluar.push(b);
  }
  return keluar.join("\n") + "\n";
}

/** Urai teks fixture (hasil salinBlokM) menjadi entri berurutan. Kunci ganda = galat. */
export function uraiEntri(salinan: string): EntriTeks[] {
  const hasil: EntriTeks[] = [];
  const terlihat = new Set<string>();
  let bagian = "";
  for (const b of salinan.replace(/\r\n/g, "\n").split("\n")) {
    const judul = POLA_JUDUL_M.exec(b);
    if (judul) {
      bagian = judul[1] ?? "";
      continue;
    }
    const m = POLA_KUNCI.exec(b);
    if (!m) continue;
    const kunci = m[1] ?? "";
    const nilai = (m[2] ?? "").replace(/\s+$/, "");
    if (terlihat.has(kunci)) throw new Error(`Kunci ganda di §M: ${kunci}`);
    terlihat.add(kunci);
    hasil.push({ kunci, nilai, bagian });
  }
  return hasil;
}

/** Bentuk sumber teks.ts dari entri. */
export function tulisSumberTeks(entri: EntriTeks[]): string {
  const baris: string[] = [
    "// BERKAS DIHASILKAN oleh scripts/teks-dari-blueprint.ts dari spesifikasi teks §M — JANGAN diubah manual.",
    "// Teks disalin persis. Perubahan teks hanya lewat keputusan [Kit], lalu jalankan ulang skrip.",
    "",
    "export const TEKS = {",
  ];
  let bagianTerakhir = "";
  for (const e of entri) {
    if (e.bagian !== bagianTerakhir) {
      baris.push(`  // ${e.bagian}`);
      bagianTerakhir = e.bagian;
    }
    baris.push(`  ${e.kunci}: ${JSON.stringify(e.nilai)},`);
  }
  baris.push(
    "} as const;",
    "",
    "export type KunciTeks = keyof typeof TEKS;",
    "",
    "type Placeholder<S extends string> = S extends `${string}{${infer P}}${infer R}` ? P | Placeholder<R> : never;",
    "",
    "/** Nama placeholder `{…}` di teks kunci K. */",
    "export type PlaceholderTeks<K extends KunciTeks> = Placeholder<(typeof TEKS)[K]>;",
    "",
    "/** Isian placeholder; kosong bila teks tidak punya placeholder. */",
    "export type IsianTeks<K extends KunciTeks> = [PlaceholderTeks<K>] extends [never]",
    "  ? []",
    "  : [nilai: Record<PlaceholderTeks<K>, string | number>];",
    "",
    "/** Ambil teks dan isi placeholder `{nama}`. Placeholder yang tidak diisi = galat. */",
    "export function isi<K extends KunciTeks>(kunci: K, ...isian: IsianTeks<K>): string {",
    "  const templat: string = TEKS[kunci];",
    "  const nilai: Record<string, string | number> = isian[0] ?? {};",
    "  return templat.replace(/\\{([a-z0-9_]+)\\}/g, (_cocok, nama: string) => {",
    "    const v = nilai[nama];",
    "    if (v === undefined) throw new Error(`Placeholder {${nama}} untuk ${kunci} tidak diisi`);",
    "    return String(v);",
    "  });",
    "}",
    "",
  );
  return baris.join("\n");
}
