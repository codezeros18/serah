// `pnpm demo:reset` — kembalikan basis data ke keadaan seed (global + demo). Hanya bila DEMO_MODE=true.
// Menghapus SEMUA data di skema ini (termasuk akun & catatan yang dibuat selama demo), lalu seed ulang.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { akar, jalankan } from "./lib/wt.mjs";

if (existsSync(resolve(akar, ".env"))) process.loadEnvFile(resolve(akar, ".env"));
if (process.env.DEMO_MODE !== "true") {
  console.error("demo:reset ditolak: DEMO_MODE bukan true.");
  process.exit(1);
}
if (!process.env.DATABASE_URL_MIGRASI) {
  console.error("DATABASE_URL_MIGRASI kosong — reset tidak jalan.");
  process.exit(1);
}
const dirDb = resolve(akar, "packages/db");
jalankan(process.execPath, [resolve(dirDb, "seed/reset-demo.ts")], { cwd: dirDb, env: process.env });
