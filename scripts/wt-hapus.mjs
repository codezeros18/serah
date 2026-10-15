// `pnpm wt:hapus Sxx` — kebalikan wt:baru: hapus skema DB wt_sxx, worktree ../wt-sxx,
// dan cabang lokal a/sxx|b/sxx bila sudah ter-merge ke origin/main.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { akar, jalankan, keluaran, sql, uraiSprint } from "./lib/wt.mjs";

const s = uraiSprint(process.argv[2]);

const berkasEnv = resolve(akar, ".env");
const env = existsSync(berkasEnv)
  ? Object.fromEntries(
      readFileSync(berkasEnv, "utf8")
        .split(/\r?\n/)
        .map((b) => /^([A-Z0-9_]+)=(.*)$/.exec(b))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    )
  : {};

if (env.DATABASE_URL_MIGRASI) {
  await sql(env.DATABASE_URL_MIGRASI, [`DROP SCHEMA IF EXISTS ${s.skema} CASCADE`]);
  console.log(`✓ skema ${s.skema} dihapus`);
} else {
  console.log("! DATABASE_URL_MIGRASI kosong — skema DB tidak dihapus");
}

if (existsSync(s.dir)) {
  const bersih = keluaran("git", ["status", "--porcelain"], { cwd: s.dir });
  if (bersih.teks) {
    console.error(`Worktree ${s.dir} punya perubahan yang belum di-commit:\n${bersih.teks}\nBerhenti.`);
    process.exit(1);
  }
  // Status bersih → hapus folder (termasuk node_modules, .env, CLAUDE.md yang ter-ignore).
  // `git worktree remove` sering gagal di Windows pada junction/jalur panjang node_modules pnpm;
  // rmSync menghapus junction tanpa mengikutinya, lalu metadata worktree dibersihkan dengan prune.
  rmSync(s.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  if (existsSync(s.dir)) {
    console.error(`Folder ${s.dir} tidak dapat dihapus seluruhnya (berkas sedang dipakai?). Tutup proses yang memakainya lalu ulangi.`);
    process.exit(1);
  }
  console.log(`✓ worktree ${s.dir} dihapus`);
} else {
  console.log(`· worktree ${s.dir} tidak ada`);
}
jalankan("git", ["worktree", "prune"], { cwd: akar });

for (const cabang of [`a/s${s.xx}`, `b/s${s.xx}`]) {
  if (!keluaran("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${cabang}`], { cwd: akar }).ok) continue;
  const termerge = keluaran("git", ["merge-base", "--is-ancestor", cabang, "origin/main"], { cwd: akar }).ok;
  if (termerge) {
    jalankan("git", ["branch", "-D", cabang], { cwd: akar });
    console.log(`✓ cabang ${cabang} dihapus (sudah di origin/main)`);
  } else {
    console.log(`· cabang ${cabang} dipertahankan (belum ter-merge ke origin/main)`);
  }
}
