// Peluncur Next.js untuk monorepo: memuat `.env` di akar repo, memvalidasi env (dev/start),
// lalu menjalankan `next <perintah>` di apps/web dengan port dari PORT (bawaan 3000).
//   node scripts/next.mjs dev|build|start [argumen next lain]
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dirWeb = resolve(akar, "apps/web");
const [perintah, ...lain] = process.argv.slice(2);

if (!["dev", "build", "start"].includes(perintah ?? "")) {
  console.error("Pakai: node scripts/next.mjs dev|build|start");
  process.exit(2);
}

// Variabel yang sudah ada di lingkungan (mis. Railway) tidak ditimpa berkas.
const berkasEnv = resolve(akar, ".env");
if (existsSync(berkasEnv)) process.loadEnvFile(berkasEnv);

if (perintah !== "build") {
  const { bacaEnv } = await import("../apps/web/lib/server/env.ts");
  const hasil = bacaEnv({ ...process.env, NODE_ENV: perintah === "start" ? "production" : "development" });
  if (!hasil.ok) {
    console.error(`SERAH menolak start — variabel lingkungan tidak sah:\n- ${hasil.masalah.join("\n- ")}`);
    process.exit(1);
  }
}

const require = createRequire(resolve(dirWeb, "package.json"));
const binNext = require.resolve("next/dist/bin/next");
const argumen = [binNext, perintah, ...(perintah === "build" ? [] : ["-p", process.env.PORT ?? "3000"]), ...lain];
const anak = spawn(process.execPath, argumen, { cwd: dirWeb, stdio: "inherit", env: process.env });
for (const sinyal of ["SIGINT", "SIGTERM"]) process.on(sinyal, () => anak.kill(sinyal));
anak.on("exit", (kode) => process.exit(kode ?? 1));
