// `pnpm wt:baru Sxx A|B` — worktree sprint: ../wt-sxx, cabang a/sxx|b/sxx dari origin/main,
// .env dengan skema DB sendiri (wt_sxx) & PORT 3000+xx, CLAUDE.md penunjuk kit, pnpm install,
// skema + grant ke serah_app, dan migrasi bila sudah ada.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { akar, denganSkema, jalankan, keluaran, pnpm, sql, uraiSprint } from "./lib/wt.mjs";

const [argSprint, argJalur] = process.argv.slice(2);
const s = uraiSprint(argSprint);
const jalur = (argJalur ?? "").toUpperCase();
if (jalur !== "A" && jalur !== "B") {
  console.error("Pakai: pnpm wt:baru Sxx A|B");
  process.exit(2);
}
const cabang = `${jalur.toLowerCase()}/s${s.xx}`;

if (existsSync(s.dir)) {
  console.error(`Folder sudah ada: ${s.dir}`);
  process.exit(1);
}
if (keluaran("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${cabang}`], { cwd: akar }).ok) {
  console.error(`Cabang ${cabang} sudah ada. Hapus dulu (pnpm wt:hapus ${s.kode}) atau pakai worktree yang ada.`);
  process.exit(1);
}

const berkasEnv = resolve(akar, ".env");
if (!existsSync(berkasEnv)) {
  console.error("Berkas .env tidak ada di folder app. Salin dari .env.example lalu isi.");
  process.exit(1);
}

console.log(`→ worktree ${s.dir} · cabang ${cabang} · skema ${s.skema} · port ${s.port}`);
jalankan("git", ["fetch", "origin"], { cwd: akar });
jalankan("git", ["worktree", "add", "-b", cabang, s.dir, "origin/main"], { cwd: akar });

// .env worktree
const env = Object.fromEntries(
  readFileSync(berkasEnv, "utf8")
    .split(/\r?\n/)
    .map((b) => /^([A-Z0-9_]+)=(.*)$/.exec(b))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const isiEnv = readFileSync(berkasEnv, "utf8")
  .split(/\r?\n/)
  .map((b) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(b);
    if (!m) return b;
    const [, k, v] = m;
    if ((k === "DATABASE_URL" || k === "DATABASE_URL_MIGRASI") && v) return `${k}=${denganSkema(v, s.skema)}`;
    if (k === "PORT") return `PORT=${s.port}`;
    if (k === "BASE_URL") return `BASE_URL=http://localhost:${s.port}`;
    return b;
  });
if (!("PORT" in env)) isiEnv.push(`PORT=${s.port}`);
writeFileSync(resolve(s.dir, ".env"), isiEnv.join("\n"));
writeFileSync(resolve(s.dir, "CLAUDE.md"), "@../kit/CLAUDE.md\n");

pnpm(["install", "--frozen-lockfile"], { cwd: s.dir });

const urlMigrasi = env.DATABASE_URL_MIGRASI;
if (urlMigrasi) {
  await sql(urlMigrasi, [
    `CREATE SCHEMA IF NOT EXISTS ${s.skema} AUTHORIZATION serah_migrasi`,
    `GRANT USAGE ON SCHEMA ${s.skema} TO serah_app`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE serah_migrasi IN SCHEMA ${s.skema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO serah_app`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE serah_migrasi IN SCHEMA ${s.skema} GRANT USAGE, SELECT ON SEQUENCES TO serah_app`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE serah_migrasi IN SCHEMA ${s.skema} GRANT EXECUTE ON FUNCTIONS TO serah_app`,
  ]);
  console.log(`✓ skema ${s.skema} dibuat, hak serah_app diberikan`);
} else {
  console.log("! DATABASE_URL_MIGRASI kosong — skema DB tidak dibuat");
}

const dirMigrasi = resolve(s.dir, "packages/db/prisma/migrations");
const adaMigrasi = existsSync(dirMigrasi) && readdirSync(dirMigrasi, { withFileTypes: true }).some((d) => d.isDirectory());
if (adaMigrasi) {
  pnpm(["--filter", "@serah/db", "db:migrate"], { cwd: s.dir });
  console.log("✓ migrasi diterapkan");
} else {
  console.log("· belum ada migrasi");
}

console.log(`\nSelesai. Buka Claude Code di ${s.dir} (cabang ${cabang}, port ${s.port}).`);
