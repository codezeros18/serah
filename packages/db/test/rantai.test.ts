import { readFileSync } from "node:fs";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dalamRollback, galatKueri, idAcak, klienPg } from "./koneksi.ts";

// S01-4 — hash_event & verifikasi_rantai SQL cocok dengan fixture acuan (dipakai juga oleh test core S02, T15).
type EventFixture = {
  jenis: string;
  serahKode: string | null;
  peran: string | null;
  payload: unknown;
  payloadKanonis: string;
  diterimaPada: string;
  prevHash: string;
  hash: string;
};
const fixture = JSON.parse(readFileSync(new URL("./fixture-rantai.json", import.meta.url), "utf8")) as { event: EventFixture[] };

let migrasi: pg.Client;
beforeAll(async () => {
  migrasi = await klienPg("migrasi");
});
afterAll(async () => {
  await migrasi?.end();
});

describe("rantai hash SQL = fixture", () => {
  it("fixture berisi 3 event berantai mulai dari 0×64", () => {
    expect(fixture.event).toHaveLength(3);
    expect(fixture.event[0]?.prevHash).toBe("0".repeat(64));
    expect(fixture.event[1]?.prevHash).toBe(fixture.event[0]?.hash);
    expect(fixture.event[2]?.prevHash).toBe(fixture.event[1]?.hash);
  });

  it.each(fixture.event.map((e, i) => [i + 1, e] as const))("event %i: json_kanonis & hash_event sama dengan fixture", async (_n, e) => {
    const { rows } = await migrasi.query<{ kanonis: string; hash: string }>(
      `SELECT json_kanonis($1::jsonb) AS kanonis, hash_event($2, $3, $4, $5, $1::jsonb, $6::timestamptz) AS hash`,
      [JSON.stringify(e.payload), e.prevHash, e.jenis, e.serahKode, e.peran, e.diterimaPada],
    );
    expect(rows[0]?.kanonis).toBe(e.payloadKanonis);
    expect(rows[0]?.hash).toBe(e.hash);
  });
});

describe("verifikasi_rantai", () => {
  async function siapkanRantai() {
    const org = idAcak("o");
    const kawasan = idAcak("k");
    const tps = idAcak("t");
    const serah = idAcak("s");
    const kodeSerah = fixture.event[1]?.serahKode ?? "";
    await migrasi.query(`INSERT INTO organisasi (id, kode, nama, jenis) VALUES ($1, $2, 'Kawasan uji', 'KAWASAN')`, [org, `ORG-${org}`]);
    await migrasi.query(
      `INSERT INTO kawasan (id, organisasi_id, kode, nama, jenis, alamat, adm4, kota)
       VALUES ($1, $2, $3, 'Kawasan uji', 'KOMERSIAL', 'Alamat uji', '31.71.03.1001', 'Kota uji')`,
      [kawasan, org, `KWS-${kawasan}`],
    );
    await migrasi.query(
      `INSERT INTO tps (id, kawasan_id, organisasi_id, kode, nama, lat_e6, lon_e6, qr_token_hash)
       VALUES ($1, $2, $3, $4, 'TPS uji', 0, 0, $5)`,
      [tps, kawasan, org, `TPS-${tps}`, idAcak("q").padEnd(64, "0").slice(0, 64)],
    );
    // Hash hanya memakai teks kode serah. Bila kode fixture sudah dipakai data lain (mis. seed demo hari ini), pakai baris itu.
    const ada = await migrasi.query<{ id: string }>(`SELECT id FROM serah WHERE kode = $1`, [kodeSerah]);
    const serahId = ada.rows[0]?.id ?? serah;
    if (!ada.rows[0]) {
      await migrasi.query(`INSERT INTO serah (id, kode, tps_id, kawasan_id, org_kawasan_id) VALUES ($1, $2, $3, $4, $5)`, [
        serah,
        kodeSerah,
        tps,
        kawasan,
        org,
      ]);
    }
    for (const [i, e] of fixture.event.entries()) {
      await migrasi.query(
        `INSERT INTO event (id, kawasan_id, urutan_rantai, serah_id, org_kawasan_id, jenis, peran, payload, prev_hash, hash,
                            idempotency_key, terjadi_pada, diterima_pada)
         VALUES ($1, $2, $3, $4, $5, $6::"JenisEvent", $7::"Peran", $8::jsonb, $9, $10, $11, $12::timestamptz, $12::timestamptz)`,
        [idAcak("e"), kawasan, i + 1, e.serahKode ? serahId : null, org, e.jenis, e.peran, JSON.stringify(e.payload), e.prevHash, e.hash, idAcak("i"), e.diterimaPada],
      );
    }
    return { org, kawasan };
  }

  it("utuh untuk 3 event fixture; payload diubah → patah tepat di urutan 2; tanpa konteks → ditolak", async () => {
    await dalamRollback(migrasi, async () => {
      const { org, kawasan } = await siapkanRantai();

      expect((await galatKueri(migrasi, `SELECT * FROM verifikasi_rantai($1)`, [kawasan]))?.code).toBe("42501");

      await migrasi.query(`SELECT set_config('app.org_ids', $1, true)`, [`{${org}}`]);
      const utuh = await migrasi.query(`SELECT * FROM verifikasi_rantai($1)`, [kawasan]);
      expect(utuh.rows[0]).toEqual({ utuh: true, jumlah: 3, patah_di_urutan: null });

      // Simulasi perubahan diam-diam (melewati trigger hanya di transaksi uji ini).
      await migrasi.query(`ALTER TABLE event DISABLE TRIGGER event_catat_saja`);
      await migrasi.query(`UPDATE event SET payload = '{"wadahIds":["w1","w9"]}' WHERE kawasan_id = $1 AND urutan_rantai = 2`, [kawasan]);
      await migrasi.query(`ALTER TABLE event ENABLE TRIGGER event_catat_saja`);
      const patah = await migrasi.query(`SELECT * FROM verifikasi_rantai($1)`, [kawasan]);
      expect(patah.rows[0]).toEqual({ utuh: false, jumlah: 3, patah_di_urutan: 2 });
    });
  });
});
