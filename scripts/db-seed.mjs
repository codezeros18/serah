// `pnpm --filter @serah/db db:seed` — isi data global + demo (demo hanya bila DEMO_MODE=true).
// Sebelum seed ada (sebelum S01) keluar 0 dengan pesan.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { akar, jalankan } from "./lib/wt.mjs";

if (existsSync(resolve(akar, ".env"))) process.loadEnvFile(resolve(akar, ".env"));
const berkasSeed = resolve(akar, "packages/db/seed/index.ts");
if (!existsSync(berkasSeed)) {
  console.log("Belum ada seed (packages/db/seed/index.ts) — tidak ada yang diisi.");
  process.exit(0);
}
jalankan(process.execPath, [berkasSeed], { cwd: resolve(akar, "packages/db"), env: process.env });
