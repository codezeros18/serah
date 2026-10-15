import { randomBytes } from "node:crypto";
import pg from "pg";
import { uraiUrlDb } from "../url.ts";

// Alat bersama seed. Seed memakai pg langsung sebagai serah_migrasi (pemilik; tabel catat-saja hanya INSERT).

export type Klien = pg.Client;

export async function sambung(): Promise<Klien> {
  const url = process.env.DATABASE_URL_MIGRASI;
  if (!url) throw new Error("DATABASE_URL_MIGRASI kosong — seed tidak dapat berjalan");
  const { connectionString, skema } = uraiUrlDb(url);
  const k = new pg.Client({ connectionString, options: `-c search_path=${skema}` });
  await k.connect();
  return k;
}

/** ID berformat cuid2 (huruf kecil awal + 23 karakter base36). */
export function idBaru(): string {
  const b = randomBytes(24);
  let s = String.fromCharCode(97 + (b[0] ?? 0) % 26);
  for (let i = 1; i < 24; i++) s += ((b[i] ?? 0) % 36).toString(36);
  return s;
}

/** INSERT satu baris; nilai objek/larik non-enum dikirim sebagai JSON bila `json` disebut. */
export async function sisip(k: Klien, tabel: string, baris: Record<string, unknown>, opsi: { json?: string[]; abaikanKonflik?: boolean } = {}): Promise<void> {
  const kolom = Object.keys(baris);
  const nilai = kolom.map((c) => (opsi.json?.includes(c) ? JSON.stringify(baris[c]) : baris[c]));
  const tanda = kolom.map((c, i) => (opsi.json?.includes(c) ? `$${i + 1}::jsonb` : `$${i + 1}`));
  await k.query(
    `INSERT INTO ${tabel} (${kolom.join(", ")}) VALUES (${tanda.join(", ")})${opsi.abaikanKonflik ? " ON CONFLICT DO NOTHING" : ""}`,
    nilai,
  );
}

/** PRNG deterministik (mulberry32) agar jumlah & bentuk data demo identik setiap reset. */
export function acakBerbenih(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const JAM_MS = 60 * 60 * 1000;
export const HARI_MS = 24 * JAM_MS;
const WIB_MS = 7 * JAM_MS;

/** Tanggal WIB "YYYYMMDD". */
export function tanggalWib(t: Date): string {
  return new Date(t.getTime() + WIB_MS).toISOString().slice(0, 10).replace(/-/g, "");
}

/** Awal hari WIB (00.00 WIB) untuk waktu t, digeser `hari` hari. */
export function awalHariWib(t: Date, hari = 0): Date {
  const wib = new Date(t.getTime() + WIB_MS);
  const awal = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_MS;
  return new Date(awal + hari * HARI_MS);
}

export function tulis(pesan: string): void {
  process.stdout.write(`${pesan}\n`);
}
