// Menyalin teks §M dari spesifikasi kit ke packages/kontrak/src/teks.ts dan fixture test.
//   node scripts/teks-dari-blueprint.ts --tulis   [--blueprint <path>]
//   node scripts/teks-dari-blueprint.ts --periksa [--blueprint <path>]   (gagal bila berbeda)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { salinBlokM, uraiEntri, tulisSumberTeks } from "./lib/teks-m.ts";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argBp = args[args.indexOf("--blueprint") + 1];
const jalurBp = args.includes("--blueprint") && argBp ? resolve(argBp) : resolve(akar, "../kit/BLUEPRINT.md");
const jalurTeks = resolve(akar, "packages/kontrak/src/teks.ts");
const jalurFixture = resolve(akar, "packages/kontrak/src/__fixtures__/blueprint-m.txt");

if (!existsSync(jalurBp)) {
  console.error(`Spesifikasi tidak ditemukan: ${jalurBp}`);
  process.exit(2);
}

const salinan = salinBlokM(readFileSync(jalurBp, "utf8"));
const entri = uraiEntri(salinan);
const sumber = tulisSumberTeks(entri);

if (args.includes("--tulis")) {
  writeFileSync(jalurTeks, sumber);
  writeFileSync(jalurFixture, salinan);
  console.log(`teks.ts ditulis: ${entri.length} kunci.`);
} else if (args.includes("--periksa")) {
  const teksSama = existsSync(jalurTeks) && readFileSync(jalurTeks, "utf8").replace(/\r\n/g, "\n") === sumber;
  const fixtureSama = existsSync(jalurFixture) && readFileSync(jalurFixture, "utf8").replace(/\r\n/g, "\n") === salinan;
  console.log(`§M: ${entri.length} kunci · teks.ts ${teksSama ? "sama" : "BERBEDA"} · fixture ${fixtureSama ? "sama" : "BERBEDA"}`);
  process.exit(teksSama && fixtureSama ? 0 : 1);
} else {
  console.error("Pakai --tulis atau --periksa");
  process.exit(2);
}
