import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dalamRollback, galatKueri, idAcak, klienPg } from "./koneksi.ts";

// T20 — Append-only: UPDATE/DELETE tabel 🔒 ditolak oleh DUA lapis (hak role runtime & trigger).
// Daftar mengikat BLUEPRINT §H.3 "Daftar 🔒". Menambah tabel 🔒 = tambah di sini + trigger + REVOKE di migrasi.
const DAFTAR_CATAT_SAJA = [
  "teks_persetujuan",
  "persetujuan_pdp",
  "izin_putusan",
  "wadah_catat",
  "event",
  "foto",
  "tiket_timbang",
  "penutupan_rincian",
  "koreksi",
  "permintaan_koreksi",
  "permintaan_koreksi_putusan",
  "aturan_versi",
  "prakiraan_cuaca",
  "peringatan_cuaca",
  "prioritas_tercatat",
  "harga_material",
  "ekspor",
  "bayangan_entri",
  "tagihan_angkut",
  "perubahan_paket",
  "peristiwa_langganan",
  "peristiwa_bayar",
  "konfirmasi_manual",
  "audit_log",
] as const;

let app: pg.Client;
let migrasi: pg.Client;
const kolomPertama = new Map<string, string>();

beforeAll(async () => {
  app = await klienPg("app");
  migrasi = await klienPg("migrasi");
  const { rows } = await migrasi.query<{ table_name: string; column_name: string }>(
    `SELECT DISTINCT ON (table_name) table_name, column_name FROM information_schema.columns
     WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position`,
  );
  for (const r of rows) kolomPertama.set(r.table_name, r.column_name);
});

afterAll(async () => {
  await app?.end();
  await migrasi?.end();
});

describe("T20 catat-saja", () => {
  it("daftar tabel bertrigger catat-saja di DB = daftar 🔒 §H.3 (tidak lebih, tidak kurang)", async () => {
    const { rows } = await migrasi.query<{ tabel: string }>(
      `SELECT DISTINCT c.relname AS tabel FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = current_schema() AND t.tgname = c.relname || '_catat_saja' AND NOT t.tgisinternal`,
    );
    expect(rows.map((r) => r.tabel).sort()).toEqual([...DAFTAR_CATAT_SAJA].sort());
  });

  describe.each(DAFTAR_CATAT_SAJA)("%s", (tabel) => {
    it("lapis hak: serah_app tidak punya UPDATE, DELETE, TRUNCATE; tetap boleh INSERT & SELECT", async () => {
      const { rows } = await app.query<{ u: boolean; d: boolean; t: boolean; i: boolean; s: boolean }>(
        `SELECT has_table_privilege(current_user, $1, 'UPDATE') u, has_table_privilege(current_user, $1, 'DELETE') d,
                has_table_privilege(current_user, $1, 'TRUNCATE') t, has_table_privilege(current_user, $1, 'INSERT') i,
                has_table_privilege(current_user, $1, 'SELECT') s`,
        [tabel],
      );
      expect(rows[0]).toEqual({ u: false, d: false, t: false, i: true, s: true });
      const kolom = kolomPertama.get(tabel);
      await dalamRollback(app, async () => {
        expect((await galatKueri(app, `UPDATE ${tabel} SET ${kolom} = ${kolom} WHERE false`))?.code).toBe("42501");
        expect((await galatKueri(app, `DELETE FROM ${tabel} WHERE false`))?.code).toBe("42501");
      });
    });

    it("lapis trigger: pemilik tabel pun ditolak UPDATE/DELETE/TRUNCATE", async () => {
      const kolom = kolomPertama.get(tabel);
      await dalamRollback(migrasi, async () => {
        for (const sql of [`UPDATE ${tabel} SET ${kolom} = ${kolom} WHERE false`, `DELETE FROM ${tabel} WHERE false`, `TRUNCATE ${tabel} CASCADE`]) {
          const g = await galatKueri(migrasi, sql);
          expect(g?.message, sql).toMatch(/CATAT_SAJA/);
        }
      });
    });
  });

  it("retensi foto: hanya fungsi SECURITY DEFINER dari konteks sistem yang boleh menandai dihapus_retensi_pada", async () => {
    await dalamRollback(migrasi, async () => {
      const org = idAcak("o");
      const foto = idAcak("f");
      await migrasi.query(`INSERT INTO organisasi (id, kode, nama, jenis) VALUES ($1, $2, 'Organisasi uji', 'PENGANGKUT')`, [org, `ORG-${org}`]);
      await migrasi.query(
        `INSERT INTO foto (id, jenis, organisasi_id, object_key, dhash, ukuran_byte, lebar, tinggi)
         VALUES ($1, 'MUATAN', $2, 'uji/x.webp', '0123456789abcdef', 10, 1, 1)`,
        [foto, org],
      );
      expect((await galatKueri(migrasi, `SELECT tandai_foto_dihapus_retensi($1)`, [foto]))?.code).toBe("42501");
      await migrasi.query(`SELECT set_config('app.sistem', 'true', true)`);
      const { rows } = await migrasi.query<{ ok: boolean }>(`SELECT tandai_foto_dihapus_retensi($1) AS ok`, [foto]);
      expect(rows[0]?.ok).toBe(true);
      const r2 = await migrasi.query(`SELECT dihapus_retensi_pada FROM foto WHERE id = $1`, [foto]);
      expect(r2.rows[0]?.dihapus_retensi_pada).toBeInstanceOf(Date);
      // Setelah fungsi selesai, UPDATE langsung kembali ditolak.
      expect((await galatKueri(migrasi, `UPDATE foto SET object_key = 'lain' WHERE id = $1`, [foto]))?.message).toMatch(/CATAT_SAJA/);
    });
  });

  it("CHECK wadah_catat: wajib berat atau jumlah; berat 1..5.000.000 gram", async () => {
    await dalamRollback(migrasi, async () => {
      const g = (sql: string) => galatKueri(migrasi, sql);
      const sisip = (berat: string, jumlah: string) =>
        `INSERT INTO wadah_catat (id, tps_id, kawasan_id, org_kawasan_id, aliran, berat_g, jumlah_wadah, terjadi_pada, idempotency_key)
         VALUES ('${idAcak("w")}', 'x', 'x', 'x', 'HIJAU', ${berat}, ${jumlah}, now(), '${idAcak("k")}')`;
      expect((await g(sisip("NULL", "NULL")))?.message).toMatch(/wadah_catat_berat_atau_jumlah/);
      expect((await g(sisip("0", "NULL")))?.message).toMatch(/wadah_catat_berat_rentang/);
      expect((await g(sisip("5000001", "NULL")))?.message).toMatch(/wadah_catat_berat_rentang/);
    });
  });
});
