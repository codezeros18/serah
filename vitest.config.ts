import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Test DB & integrasi membaca .env akar repo (lokal/worktree). Di CI variabel sudah ada di lingkungan.
if (existsSync(".env")) process.loadEnvFile(".env");

// Satu konfigurasi, beberapa proyek (pengganti berkas vitest.workspace yang sudah usang di Vitest ≥3.2).
export default defineConfig({
  test: {
    projects: [
      { test: { name: "kontrak", include: ["packages/kontrak/**/*.test.ts"] } },
      { test: { name: "core", include: ["packages/core/**/*.test.ts"] } },
      { test: { name: "db", include: ["packages/db/**/*.test.ts"], exclude: ["**/node_modules/**", "**/generated/**"] } },
      { test: { name: "ui", include: ["packages/ui/**/*.test.{ts,tsx}"] } },
      {
        resolve: { alias: { "@/": `${resolve("apps/web")}/` } },
        // Integrasi web memakai Postgres sungguhan (+ argon2 di auth). Semua berkas menulis ke kawasan demo yang sama,
        // sehingga penulisan event mengantre pada kunci rantai kawasan; terlalu banyak berkas paralel menghabiskan
        // kolam koneksi (P2028). Batasi pekerja & beri waktu yang wajar untuk alur penuh (T06, T18).
        test: {
          name: "web",
          include: ["apps/web/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "apps/web/e2e/**", "apps/web/.next/**"],
          fileParallelism: false,
          setupFiles: ["apps/web/vitest.setup.ts"],
          sequence: { groupOrder: 1 },
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      { test: { name: "scripts", include: ["scripts/**/*.test.ts"] } },
    ],
    passWithNoTests: true,
    // Vite mengisi BASE_URL="/" (base path) dan menimpa BASE_URL aplikasi; kembalikan nilai dari lingkungan.
    env: process.env.BASE_URL ? { BASE_URL: process.env.BASE_URL } : {},
  },
});
