// `pnpm guard` — menjalankan semua guard struktural atas berkas repo. Keluar 1 bila ada temuan.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DAFTAR_GUARD } from "./daftar.ts";
import type { Berkas, Konteks } from "./jenis.ts";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EKSTENSI_TEKS = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|json|md|mdx|prisma|sql|css|html|ya?ml)$/;

function git(...args: string[]): string[] {
  return execFileSync("git", args, { cwd: akar, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean);
}

function muatKonteks(): Konteks {
  const tertrack = git("ls-files", "-z");
  const semua = [...new Set([...tertrack, ...git("ls-files", "-z", "--others", "--exclude-standard")])];
  const berkas: Berkas[] = [];
  for (const jalur of semua) {
    if (!EKSTENSI_TEKS.test(jalur)) continue;
    const penuh = resolve(akar, jalur);
    try {
      if (!statSync(penuh).isFile()) continue;
    } catch {
      continue; // terhapus di working tree
    }
    berkas.push({ jalur, isi: readFileSync(penuh, "utf8").replace(/\r\n/g, "\n") });
  }
  return { berkas, tertrack };
}

const konteks = muatKonteks();
console.log(`Guard SERAH — ${DAFTAR_GUARD.length} pemeriksaan atas ${konteks.berkas.length} berkas`);
let jumlahTemuan = 0;
for (const g of DAFTAR_GUARD) {
  const label = `(${g.kode}) ${g.nama}`.padEnd(22, " ");
  const hasil = g.periksa(konteks);
  if (hasil.status === "dilewati") {
    console.log(`  ⏭  ${label} dilewati: ${hasil.sebab} — ${g.keterangan}`);
    continue;
  }
  jumlahTemuan += hasil.temuan.length;
  console.log(`  ${hasil.temuan.length === 0 ? "✔" : "✖"}  ${label} ${hasil.temuan.length} temuan — ${g.keterangan}`);
  for (const t of hasil.temuan) console.log(`       ${t.berkas}${t.baris ? `:${t.baris}` : ""}  ${t.pesan}`);
}
console.log(jumlahTemuan === 0 ? "Guard lulus." : `Guard GAGAL: ${jumlahTemuan} temuan.`);
process.exit(jumlahTemuan === 0 ? 0 : 1);
