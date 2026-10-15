// `pnpm db:reset` — hapus & bangun ulang skema DB (semua migrasi), lalu seed global + demo.
// Tabel catat-saja tidak bisa dikosongkan dengan DELETE; reset membuang skema seluruhnya.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { akar, jalankan, pnpm } from "./lib/wt.mjs";

if (existsSync(resolve(akar, ".env"))) process.loadEnvFile(resolve(akar, ".env"));
if (!process.env.DATABASE_URL_MIGRASI) {
  console.error("DATABASE_URL_MIGRASI kosong — reset tidak jalan.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
  console.error("db:reset ditolak di lingkungan produksi.");
  process.exit(1);
}

const dirDb = resolve(akar, "packages/db");
pnpm(["exec", "prisma", "migrate", "reset", "--force"], { cwd: dirDb, env: process.env });
jalankan(process.execPath, [resolve(dirDb, "seed/index.ts")], { cwd: dirDb, env: process.env });
