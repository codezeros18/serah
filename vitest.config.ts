import { defineConfig } from "vitest/config";

// Satu konfigurasi, beberapa proyek (pengganti berkas vitest.workspace yang sudah usang di Vitest ≥3.2).
export default defineConfig({
  test: {
    projects: [
      { test: { name: "kontrak", include: ["packages/kontrak/**/*.test.ts"] } },
      { test: { name: "core", include: ["packages/core/**/*.test.ts"] } },
      { test: { name: "db", include: ["packages/db/**/*.test.ts"], exclude: ["**/node_modules/**", "**/generated/**"] } },
      { test: { name: "ui", include: ["packages/ui/**/*.test.{ts,tsx}"] } },
      { test: { name: "web", include: ["apps/web/**/*.test.{ts,tsx}"], exclude: ["**/node_modules/**", "apps/web/e2e/**", "apps/web/.next/**"] } },
      { test: { name: "scripts", include: ["scripts/**/*.test.ts"] } },
    ],
    passWithNoTests: true,
  },
});
