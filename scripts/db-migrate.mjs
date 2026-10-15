// `pnpm --filter @serah/db db:migrate` — terapkan migrasi Prisma memakai role serah_migrasi.
// Sebelum skema ada (sebelum S01) keluar 0 dengan pesan.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { akar, pnpm } from "./lib/wt.mjs";

const dirDb = resolve(akar, "packages/db");
if (existsSync(resolve(akar, ".env"))) process.loadEnvFile(resolve(akar, ".env"));

if (!existsSync(resolve(dirDb, "prisma/schema.prisma"))) {
  console.log("Belum ada skema Prisma (packages/db/prisma/schema.prisma) — tidak ada yang dimigrasi.");
  process.exit(0);
}
if (!process.env.DATABASE_URL_MIGRASI) {
  console.error("DATABASE_URL_MIGRASI kosong — migrasi tidak jalan.");
  process.exit(1);
}
pnpm(["exec", "prisma", "migrate", "deploy"], { cwd: dirDb, env: process.env });
