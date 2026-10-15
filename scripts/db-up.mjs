// `pnpm db:up` — jalankan Postgres 16 lokal (Docker) lalu pastikan role runtime aman.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(akar, ".env"))) process.loadEnvFile(resolve(akar, ".env"));

const up = spawnSync("docker", ["compose", "up", "-d", "--wait"], { cwd: akar, stdio: "inherit", shell: false });
if (up.status !== 0) {
  console.error("Gagal menjalankan Postgres. Pastikan Docker Desktop berjalan.");
  process.exit(up.status ?? 1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("Postgres berjalan. DATABASE_URL belum diisi di .env — pemeriksaan role dilewati.");
  process.exit(0);
}

const klien = new pg.Client({ connectionString: url });
try {
  await klien.connect();
  const { rows } = await klien.query(
    "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user",
  );
  const r = rows[0];
  if (!r || r.rolsuper || r.rolbypassrls) {
    console.error(`Role runtime ${r?.rolname ?? "?"} tidak aman (superuser/bypassrls).`);
    process.exit(1);
  }
  console.log(`Postgres siap. Role runtime ${r.rolname}: bukan superuser, NOBYPASSRLS.`);
} finally {
  await klien.end();
}
