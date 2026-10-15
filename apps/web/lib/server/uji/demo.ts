import { uraiUrlDb } from "@serah/db/url";
import pg from "pg";

// Pembantu test integrasi: membaca ID data demo sebagai pemilik (tanpa RLS). Butuh `pnpm db:reset` (DEMO_MODE=true).

export type IdDemo = { orgKawasan: string; orgPengangkut: string; orgInternal: string; kawasan: string; jumlahWadah: number; jumlahEvent: number };

export async function idDemo(): Promise<IdDemo> {
  const url = process.env.DATABASE_URL_MIGRASI;
  if (!url) throw new Error("DATABASE_URL_MIGRASI kosong — test integrasi butuh PostgreSQL ber-seed demo");
  const { connectionString, skema } = uraiUrlDb(url);
  const k = new pg.Client({ connectionString, options: `-c search_path=${skema}` });
  await k.connect();
  try {
    const { rows } = await k.query<{ kode: string; id: string }>(`SELECT kode, id FROM organisasi WHERE demo AND kode IN ('ORG-PCS', 'ORG-ACB', 'ORG-INTERNAL')`);
    const per = Object.fromEntries(rows.map((r) => [r.kode, r.id]));
    if (!per["ORG-PCS"]) throw new Error("Data demo belum ada — jalankan pnpm db:reset dengan DEMO_MODE=true");
    const kws = await k.query<{ id: string }>(`SELECT id FROM kawasan WHERE kode = 'KWS-PCS'`);
    const kawasan = kws.rows[0]?.id ?? "";
    const w = await k.query<{ n: string }>(`SELECT count(*) AS n FROM wadah_catat WHERE kawasan_id = $1`, [kawasan]);
    const e = await k.query<{ n: string }>(`SELECT count(*) AS n FROM event WHERE kawasan_id = $1`, [kawasan]);
    return {
      orgKawasan: per["ORG-PCS"] ?? "",
      orgPengangkut: per["ORG-ACB"] ?? "",
      orgInternal: per["ORG-INTERNAL"] ?? "",
      kawasan,
      jumlahWadah: Number(w.rows[0]?.n ?? 0),
      jumlahEvent: Number(e.rows[0]?.n ?? 0),
    };
  } finally {
    await k.end();
  }
}
