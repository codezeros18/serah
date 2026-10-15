import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 tidak memuat .env otomatis; .env ada di akar repo. Variabel yang sudah ada tidak ditimpa.
const berkasEnv = resolve(import.meta.dirname, "../../.env");
if (existsSync(berkasEnv)) process.loadEnvFile(berkasEnv);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrasi selalu memakai role pemilik (serah_migrasi). `generate` tidak butuh koneksi.
  datasource: { url: process.env.DATABASE_URL_MIGRASI ?? "" },
});
