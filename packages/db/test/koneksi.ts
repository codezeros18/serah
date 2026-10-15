import pg from "pg";
import { uraiUrlDb } from "../url.ts";

// Koneksi pg langsung untuk test DB: `app` = role runtime serah_app, `migrasi` = pemilik serah_migrasi.

export function urlDb(peran: "app" | "migrasi"): string {
  const url = peran === "app" ? process.env.DATABASE_URL : process.env.DATABASE_URL_MIGRASI;
  if (!url) throw new Error(`${peran === "app" ? "DATABASE_URL" : "DATABASE_URL_MIGRASI"} kosong — test DB butuh PostgreSQL (pnpm db:up)`);
  return url;
}

export async function klienPg(peran: "app" | "migrasi"): Promise<pg.Client> {
  const { connectionString, skema } = uraiUrlDb(urlDb(peran));
  const klien = new pg.Client({ connectionString, options: `-c search_path=${skema}` });
  await klien.connect();
  return klien;
}

export function idAcak(awalan = "t"): string {
  return `${awalan}${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

/** Jalankan fn dalam transaksi yang selalu di-ROLLBACK (tidak meninggalkan data). */
export async function dalamRollback<T>(k: pg.Client, fn: () => Promise<T>): Promise<T> {
  await k.query("BEGIN");
  try {
    return await fn();
  } finally {
    await k.query("ROLLBACK");
  }
}

/** Galat Postgres dari sebuah kueri (atau null bila sukses). Memakai SAVEPOINT agar transaksi tetap hidup. */
export async function galatKueri(k: pg.Client, sql: string, nilai: unknown[] = []): Promise<{ code?: string; message: string } | null> {
  await k.query("SAVEPOINT uji");
  try {
    await k.query(sql, nilai);
    await k.query("RELEASE SAVEPOINT uji");
    return null;
  } catch (e) {
    await k.query("ROLLBACK TO SAVEPOINT uji");
    const g = e as { code?: string; message: string };
    return { code: g.code, message: g.message };
  }
}
