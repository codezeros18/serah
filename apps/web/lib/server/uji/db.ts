import { uraiUrlDb } from "@serah/db/url";
import pg from "pg";

// Pembantu test: kueri sebagai pemilik (serah_migrasi, tanpa RLS) untuk memeriksa isi DB dari luar aplikasi.
export async function kueriPemilik<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, nilai: unknown[] = []): Promise<T[]> {
  const url = process.env.DATABASE_URL_MIGRASI;
  if (!url) throw new Error("DATABASE_URL_MIGRASI kosong — test integrasi butuh PostgreSQL");
  const { connectionString, skema } = uraiUrlDb(url);
  const k = new pg.Client({ connectionString, options: `-c search_path=${skema}` });
  await k.connect();
  try {
    return (await k.query<T>(sql, nilai)).rows;
  } finally {
    await k.end();
  }
}
