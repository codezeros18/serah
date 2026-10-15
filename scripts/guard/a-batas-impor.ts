import type { Guard, Temuan } from "./jenis.ts";
import { adalahGuard, adalahKode, adalahTest, ambilImpor, bersihkanKode, diperiksa, nomorBaris, selesaikan, temukan } from "./util.ts";

// (a) Batas impor antarpaket (CLAUDE.md §3) + larangan jam sistem/acak/fetch di packages/core.

type Zona = "kontrak" | "core" | "core/angka" | "db" | "ui" | "server" | "klien" | "adaptor" | "app" | "apps" | "luar";

function zonaJalur(j: string): Zona {
  if (j.startsWith("packages/kontrak/")) return "kontrak";
  if (j === "packages/core/angka" || j.startsWith("packages/core/angka/")) return "core/angka";
  if (j.startsWith("packages/core/") || j === "packages/core") return "core";
  if (j.startsWith("packages/db/") || j === "packages/db") return "db";
  if (j.startsWith("packages/ui/") || j === "packages/ui") return "ui";
  if (j.startsWith("apps/web/lib/server/")) return "server";
  if (j.startsWith("apps/web/lib/klien/")) return "klien";
  if (j.startsWith("apps/web/lib/adaptor/")) return "adaptor";
  if (j.startsWith("apps/web/app/")) return "app";
  if (j.startsWith("apps/")) return "apps";
  return "luar";
}

function zonaPaket(p: string): Zona | null {
  if (p === "@serah/kontrak" || p.startsWith("@serah/kontrak/")) return "kontrak";
  if (p === "@serah/core/angka" || p.startsWith("@serah/core/angka/")) return "core/angka";
  if (p === "@serah/core" || p.startsWith("@serah/core/")) return "core";
  if (p === "@serah/db" || p.startsWith("@serah/db/")) return "db";
  if (p === "@serah/ui" || p.startsWith("@serah/ui/")) return "ui";
  if (p === "@serah/web" || p.startsWith("@serah/web/")) return "apps";
  return null;
}

const nodeBawaan = (p: string) => p.startsWith("node:");
const test = (p: string) => p === "vitest" || p.startsWith("vitest/") || nodeBawaan(p);

type Aturan = {
  /** Zona sumber yang boleh diimpor (selain zona sendiri). null = tidak dibatasi. */
  zonaBoleh: Zona[] | null;
  zonaDilarang: Zona[];
  /** Paket luar yang boleh; null = semua boleh. */
  paketBoleh: ((p: string) => boolean) | null;
};

function aturanUntuk(jalur: string): Aturan | null {
  const z = zonaJalur(jalur);
  const t = adalahTest(jalur);
  switch (z) {
    case "kontrak":
      return { zonaBoleh: ["kontrak"], zonaDilarang: [], paketBoleh: (p) => p === "zod" || (t && test(p)) };
    case "core":
    case "core/angka":
      return { zonaBoleh: ["core", "core/angka", "kontrak"], zonaDilarang: [], paketBoleh: (p) => t && test(p) };
    case "ui":
      return {
        zonaBoleh: ["ui", "kontrak", "core/angka"],
        zonaDilarang: [],
        paketBoleh: (p) => p === "react" || p.startsWith("react/") || p === "react-dom" || p.startsWith("react-dom/") || (t && test(p)),
      };
    case "db":
      return {
        zonaBoleh: ["db", "kontrak"],
        zonaDilarang: [],
        paketBoleh: (p) => p.startsWith("@prisma/") || p === "prisma" || p.startsWith("prisma/") || p === "pg" || nodeBawaan(p) || (t && test(p)),
      };
    case "server":
      return { zonaBoleh: null, zonaDilarang: ["klien"], paketBoleh: null };
    case "klien":
      return { zonaBoleh: null, zonaDilarang: ["server", "db", "adaptor", "core"], paketBoleh: null };
    case "app": {
      const api = jalur.startsWith("apps/web/app/api/");
      return { zonaBoleh: null, zonaDilarang: api ? ["db"] : ["db", "core", "adaptor"], paketBoleh: null };
    }
    default:
      return null;
  }
}

const POLA_CORE_TERLARANG: [RegExp, string][] = [
  [/\bDate\s*\.\s*now\s*\(/g, "Date.now() di core — terima `sekarang: Date` sebagai argumen"],
  [/\bnew\s+Date\s*\(\s*\)/g, "new Date() tanpa argumen di core — terima `sekarang: Date` sebagai argumen"],
  [/\bMath\s*\.\s*random\b/g, "Math.random di core"],
  [/(?<![\w$.])fetch\s*\(/g, "fetch di core"],
];

export const guardBatasImpor: Guard = {
  kode: "a",
  nama: "batas-impor",
  keterangan: "Batas impor antarpaket (CLAUDE.md §3); core tanpa jam sistem, acak, fetch",
  periksa(k) {
    const temuan: Temuan[] = [];
    for (const b of k.berkas) {
      if (!adalahKode(b.jalur) || adalahGuard(b.jalur)) continue;
      const aturan = aturanUntuk(b.jalur);
      if (!aturan) continue;
      const kode = bersihkanKode(b.isi);
      const zonaSendiri = zonaJalur(b.jalur);
      for (const imp of ambilImpor(kode)) {
        const r = selesaikan(b.jalur, imp.spesifier);
        const zona = r.jenis === "jalur" ? zonaJalur(r.nilai) : zonaPaket(r.nilai);
        const baris = nomorBaris(b.isi, imp.indeks);
        if (zona === null || zona === "luar") {
          if (r.jenis === "paket" && aturan.paketBoleh && !aturan.paketBoleh(r.nilai)) {
            temuan.push({ berkas: b.jalur, baris, pesan: `paket "${r.nilai}" tidak boleh diimpor dari ${zonaSendiri}` });
          }
          continue;
        }
        const sesama = zona === zonaSendiri || (zonaSendiri === "core/angka" && zona === "core") || (zonaSendiri === "core" && zona === "core/angka");
        if (sesama) continue;
        if (aturan.zonaDilarang.includes(zona) || (aturan.zonaBoleh && !aturan.zonaBoleh.includes(zona))) {
          temuan.push({ berkas: b.jalur, baris, pesan: `${zonaSendiri} tidak boleh mengimpor ${zona} ("${imp.spesifier}")` });
        }
      }
      if ((zonaSendiri === "core" || zonaSendiri === "core/angka") && !adalahTest(b.jalur)) {
        for (const [pola, pesan] of POLA_CORE_TERLARANG) temuan.push(...temukan(b, kode, pola, () => pesan));
      }
    }
    return diperiksa(temuan);
  },
};
