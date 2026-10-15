// Inisialisasi role basis data di Postgres terkelola (Railway), dijalankan sebelum migrasi (preDeploy).
// Memakai scripts/db-init.sql yang sama dengan lokal & CI, tetapi sandbox role diganti dengan sandi dari lingkungan.
// Idempoten: dijalankan tiap deploy. Tanpa DB_SUPER_URL → dilewati (lingkungan lokal/CI memakai db-init.sql langsung).
//
// Variabel (hanya di Railway): DB_SUPER_URL (superuser), DB_APP_SANDI, DB_MIGRASI_SANDI.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const akar = resolve(fileURLToPath(import.meta.url), "../..");
// pg hanya terpasang di packages/db (pnpm), jadi dimuat dari sana.
const pg = createRequire(resolve(akar, "packages/db/package.json"))("pg");

const { DB_SUPER_URL, DB_APP_SANDI, DB_MIGRASI_SANDI } = process.env;
if (!DB_SUPER_URL) {
  process.stdout.write("db-init-prod: DB_SUPER_URL tidak ada — dilewati\n");
  process.exit(0);
}
const sandiSah = (s) => typeof s === "string" && /^[A-Za-z0-9]{32,}$/.test(s);
if (!sandiSah(DB_APP_SANDI) || !sandiSah(DB_MIGRASI_SANDI)) {
  process.stderr.write("db-init-prod: DB_APP_SANDI/DB_MIGRASI_SANDI harus alfanumerik ≥32 karakter\n");
  process.exit(1);
}

const berkas = resolve(akar, "scripts/db-init.sql");
const sql = readFileSync(berkas, "utf8").replaceAll("serah_migrasi_dev", DB_MIGRASI_SANDI).replaceAll("serah_app_dev", DB_APP_SANDI);

const k = new pg.Client({ connectionString: DB_SUPER_URL });
await k.connect();
try {
  await k.query(sql);
  // Selaraskan sandi bila role sudah ada dari deploy sebelumnya (sandi diputar).
  await k.query(`ALTER ROLE serah_app PASSWORD '${DB_APP_SANDI}'`);
  await k.query(`ALTER ROLE serah_migrasi PASSWORD '${DB_MIGRASI_SANDI}'`);
  process.stdout.write("db-init-prod: role serah_app & serah_migrasi siap\n");
} finally {
  await k.end();
}
