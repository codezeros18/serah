import { posix } from "node:path";
import type { Berkas, Temuan } from "./jenis.ts";

export const EKSTENSI_KODE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
export const POLA_TEST = /(\.|\/)(test|spec)\.[cm]?[jt]sx?$|\/__tests__\/|\/__fixtures__\//;

export function adalahKode(jalur: string): boolean {
  return EKSTENSI_KODE.test(jalur);
}

export function adalahTest(jalur: string): boolean {
  return POLA_TEST.test(jalur);
}

/** Folder guard sendiri berisi pola terlarang sebagai data; tidak diperiksa. */
export function adalahGuard(jalur: string): boolean {
  return jalur.startsWith("scripts/guard/");
}

export function nomorBaris(isi: string, indeks: number): number {
  let n = 1;
  for (let i = 0; i < indeks && i < isi.length; i++) if (isi.charCodeAt(i) === 10) n++;
  return n;
}

type Rentang = { dari: number; sampai: number };
export type HasilPindai = { komentar: Rentang[]; string: Rentang[] };

/**
 * Pemindai leksikal ringan JS/TS: rentang komentar dan rentang ISI literal string
 * ('…', "…", bagian statis template `…`, tanpa tanda kutip). Regex literal tidak dikenali (heuristik).
 */
export function pindai(isi: string): HasilPindai {
  const komentar: Rentang[] = [];
  const string: Rentang[] = [];
  const n = isi.length;
  const tumpukan: number[] = []; // kedalaman kurawal saat masuk ${…}
  let kurawal = 0;
  let i = 0;

  const templat = () => {
    // i tepat setelah ` atau } penutup ${…}
    const mulai = i;
    while (i < n) {
      const c = isi[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        string.push({ dari: mulai, sampai: i });
        i++;
        return;
      }
      if (c === "$" && isi[i + 1] === "{") {
        string.push({ dari: mulai, sampai: i });
        i += 2;
        tumpukan.push(kurawal);
        kurawal = 0;
        return;
      }
      i++;
    }
    string.push({ dari: mulai, sampai: n });
  };

  while (i < n) {
    const c = isi[i];
    const d = isi[i + 1];
    if (c === "/" && d === "/") {
      const mulai = i;
      while (i < n && isi[i] !== "\n") i++;
      komentar.push({ dari: mulai, sampai: i });
    } else if (c === "/" && d === "*") {
      const mulai = i;
      const akhir = isi.indexOf("*/", i + 2);
      i = akhir < 0 ? n : akhir + 2;
      komentar.push({ dari: mulai, sampai: i });
    } else if (c === '"' || c === "'") {
      const mulai = ++i;
      while (i < n && isi[i] !== c && isi[i] !== "\n") i += isi[i] === "\\" ? 2 : 1;
      string.push({ dari: mulai, sampai: Math.min(i, n) });
      i++;
    } else if (c === "`") {
      i++;
      templat();
    } else if (c === "{") {
      kurawal++;
      i++;
    } else if (c === "}") {
      i++;
      if (kurawal === 0 && tumpukan.length > 0) {
        kurawal = tumpukan.pop() ?? 0;
        templat();
      } else {
        kurawal = Math.max(0, kurawal - 1);
      }
    } else {
      i++;
    }
  }
  return { komentar, string };
}

function kosongkan(isi: string, rentang: Rentang[]): string {
  const k = isi.split("");
  for (const r of rentang) for (let j = r.dari; j < r.sampai; j++) if (k[j] !== "\n") k[j] = " ";
  return k.join("");
}

/** Kode dengan komentar (dan opsional isi string) diganti spasi; panjang & baris tetap sama. */
export function bersihkanKode(isi: string, opsi: { kosongkanString?: boolean } = {}): string {
  const p = pindai(isi);
  return kosongkan(isi, opsi.kosongkanString ? [...p.komentar, ...p.string] : p.komentar);
}

export type LiteralString = { nilai: string; indeks: number };

/** Isi literal string (bukan di dalam komentar). */
export function ambilString(isi: string): LiteralString[] {
  return pindai(isi).string.map((r) => ({ nilai: isi.slice(r.dari, r.sampai), indeks: r.dari }));
}

export type Impor = { spesifier: string; indeks: number };

/** Spesifier impor/ekspor/require/dynamic import dari kode tanpa komentar. */
export function ambilImpor(kodeTanpaKomentar: string): Impor[] {
  const pola = [
    /(?:^|[^\w$.])(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?["']([^"'\n]+)["']/g,
    /(?:^|[^\w$.])import\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
    /(?:^|[^\w$.])require\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
  ];
  const keluar: Impor[] = [];
  for (const p of pola) {
    for (const m of kodeTanpaKomentar.matchAll(p)) {
      const spesifier = m[1];
      if (spesifier) keluar.push({ spesifier, indeks: (m.index ?? 0) + m[0].lastIndexOf(spesifier) });
    }
  }
  return keluar;
}

/** Selesaikan spesifier relatif / alias `@/` (apps/web) ke jalur repo; paket bare dikembalikan apa adanya. */
export function selesaikan(dariBerkas: string, spesifier: string): { jenis: "jalur" | "paket"; nilai: string } {
  if (spesifier.startsWith(".")) return { jenis: "jalur", nilai: posix.normalize(posix.join(posix.dirname(dariBerkas), spesifier)) };
  if (spesifier.startsWith("@/") && dariBerkas.startsWith("apps/web/")) return { jenis: "jalur", nilai: `apps/web/${spesifier.slice(2)}` };
  return { jenis: "paket", nilai: spesifier };
}

/** Semua kecocokan regex pada teks (sudah dibersihkan, indeks = indeks sumber) → temuan berbaris. */
export function temukan(berkas: Berkas, teks: string, pola: RegExp, pesan: (m: RegExpMatchArray) => string): Temuan[] {
  const global = pola.flags.includes("g") ? pola : new RegExp(pola.source, pola.flags + "g");
  const keluar: Temuan[] = [];
  for (const m of teks.matchAll(global)) {
    keluar.push({ berkas: berkas.jalur, baris: nomorBaris(berkas.isi, m.index ?? 0), pesan: pesan(m) });
  }
  return keluar;
}

export function diperiksa(temuan: Temuan[]) {
  return { status: "diperiksa" as const, temuan };
}

export function dilewati(sebab: string) {
  return { status: "dilewati" as const, sebab };
}
