// Bersama untuk wt-baru.mjs & wt-hapus.mjs.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const akar = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** "S05" → { kode: "S05", xx: "05", nomor: 5, skema: "wt_s05", dir, port } */
export function uraiSprint(arg) {
  const m = /^S(\d{2})$/i.exec(arg ?? "");
  if (!m) throw new Error(`Kode sprint tidak sah: "${arg ?? ""}" (contoh: S05)`);
  const xx = m[1];
  return {
    kode: `S${xx}`,
    xx,
    nomor: Number(xx),
    skema: `wt_s${xx}`,
    dir: resolve(akar, "..", `wt-s${xx}`),
    port: 3000 + Number(xx),
  };
}

export function jalankan(perintah, args, opsi = {}) {
  const r = spawnSync(perintah, args, { stdio: "inherit", ...opsi });
  if (r.status !== 0) throw new Error(`Gagal: ${perintah} ${args.join(" ")}`);
}

export function keluaran(perintah, args, opsi = {}) {
  const r = spawnSync(perintah, args, { encoding: "utf8", ...opsi });
  return { ok: r.status === 0, teks: (r.stdout ?? "").trim() };
}

/** Jalankan pnpm memakai biner yang sama dengan pemanggil (`pnpm wt:…`), tanpa shell. */
export function pnpm(args, opsi = {}) {
  const execpath = process.env.npm_execpath;
  if (execpath && /pnpm/i.test(execpath)) jalankan(process.execPath, [execpath, ...args], opsi);
  else jalankan("pnpm", args, { shell: process.platform === "win32", ...opsi });
}

/** Ganti/tambah parameter `schema` di URL Postgres. */
export function denganSkema(url, skema) {
  const u = new URL(url);
  u.searchParams.set("schema", skema);
  return u.toString();
}

export function tanpaSkema(url) {
  const u = new URL(url);
  u.searchParams.delete("schema");
  return u.toString();
}

export async function sql(url, perintah) {
  const klien = new pg.Client({ connectionString: tanpaSkema(url) });
  await klien.connect();
  try {
    for (const q of perintah) await klien.query(q);
  } finally {
    await klien.end();
  }
}
