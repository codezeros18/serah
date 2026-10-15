import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dalamRollback, galatKueri, idAcak, klienPg } from "./koneksi.ts";

// T19 — Isolasi lintas organisasi lewat RLS, diuji sebagai role runtime serah_app (NOBYPASSRLS).
// Bukti "bisa merah": jalankan sekali setelah RLS dimatikan → test ini gagal (dicatat di PROGRESS-A).

let app: pg.Client;
beforeAll(async () => {
  app = await klienPg("app");
});
afterAll(async () => {
  await app?.end();
});

async function konteks(k: { org?: string[]; sistem?: boolean; pengguna?: string }) {
  await app.query(
    `SELECT set_config('app.org_ids', $1, true), set_config('app.sistem', $2, true), set_config('app.pengguna_id', $3, true),
            set_config('app.admin', 'false', true), set_config('app.auth', 'false', true)`,
    [`{${(k.org ?? []).join(",")}}`, String(k.sistem ?? false), k.pengguna ?? ""],
  );
}

async function hitung(tabel: string, kolom: string, id: string): Promise<number> {
  const { rows } = await app.query<{ n: string }>(`SELECT count(*) AS n FROM ${tabel} WHERE ${kolom} = $1`, [id]);
  return Number(rows[0]?.n ?? 0);
}

/** Dua kawasan (A, B) lengkap + pengangkut C berkontrak AKTIF hanya dengan A. Dibuat dalam konteks sistem. */
async function siapkan() {
  await konteks({ sistem: true });
  const id = { A: idAcak("a"), B: idAcak("b"), C: idAcak("c") };
  const r: Record<string, string> = {};
  for (const [n, jenis] of [["A", "KAWASAN"], ["B", "KAWASAN"], ["C", "PENGANGKUT"]] as const) {
    await app.query(`INSERT INTO organisasi (id, kode, nama, jenis) VALUES ($1, $2, $3, $4)`, [id[n], `ORG-${id[n]}`, `Organisasi uji ${n}`, jenis]);
  }
  for (const n of ["A", "B"] as const) {
    const kws = idAcak("k");
    const tps = idAcak("t");
    const wadah = idAcak("w");
    const serah = idAcak("s");
    const foto = idAcak("f");
    await app.query(
      `INSERT INTO kawasan (id, organisasi_id, kode, nama, jenis, alamat, adm4, kota) VALUES ($1, $2, $3, 'Kawasan uji', 'KOMERSIAL', 'Alamat uji', '31.71.03.1001', 'Kota uji')`,
      [kws, id[n], `KWS-${kws}`],
    );
    await app.query(
      `INSERT INTO tps (id, kawasan_id, organisasi_id, kode, nama, lat_e6, lon_e6, qr_token_hash) VALUES ($1, $2, $3, $4, 'TPS uji', 0, 0, $5)`,
      [tps, kws, id[n], `TPS-${tps}`, `${tps}`.padEnd(64, "0").slice(0, 64)],
    );
    await app.query(
      `INSERT INTO wadah_catat (id, tps_id, kawasan_id, org_kawasan_id, aliran, berat_g, terjadi_pada, idempotency_key) VALUES ($1, $2, $3, $4, 'KUNING', 1000, now(), $5)`,
      [wadah, tps, kws, id[n], idAcak("i")],
    );
    await app.query(`INSERT INTO serah (id, kode, tps_id, kawasan_id, org_kawasan_id) VALUES ($1, $2, $3, $4, $5)`, [serah, `SRH-${serah}`, tps, kws, id[n]]);
    await app.query(`INSERT INTO serah_wadah (serah_id, wadah_catat_id) VALUES ($1, $2)`, [serah, wadah]);
    await app.query(
      `INSERT INTO event (id, kawasan_id, urutan_rantai, serah_id, org_kawasan_id, jenis, peran, payload, prev_hash, hash, idempotency_key, terjadi_pada)
       VALUES ($1, $2, 1, $3, $4, 'SERAH_DIBUAT', 'PETUGAS', '{}', repeat('0', 64), repeat('a', 64), $5, now())`,
      [idAcak("e"), kws, serah, id[n], idAcak("i")],
    );
    await app.query(
      `INSERT INTO foto (id, jenis, organisasi_id, serah_id, object_key, dhash, ukuran_byte, lebar, tinggi) VALUES ($1, 'MUATAN', $2, NULL, 'uji', '0123456789abcdef', 1, 1, 1)`,
      [foto, id[n]],
    );
    Object.assign(r, { [`kawasan${n}`]: kws, [`tps${n}`]: tps, [`wadah${n}`]: wadah, [`serah${n}`]: serah, [`foto${n}`]: foto });
  }
  await app.query(
    `INSERT INTO kontrak (id, kawasan_id, org_kawasan_id, org_pengangkut_id, org_penerima_id, aliran, berlaku_dari, berlaku_sampai, status)
     VALUES ($1, $2, $3, $4, $3, '{KUNING}', current_date, current_date + 30, 'AKTIF')`,
    [idAcak("c"), r.kawasanA, id.A, id.C],
  );
  return { ...id, ...r } as Record<"A" | "B" | "C" | "kawasanA" | "kawasanB" | "tpsA" | "tpsB" | "wadahA" | "wadahB" | "serahA" | "serahB" | "fotoA" | "fotoB", string>;
}

describe("T19 isolasi lintas organisasi (RLS)", () => {
  it("tanpa konteks: semua tabel operasional kosong bagi serah_app", async () => {
    await dalamRollback(app, async () => {
      const d = await siapkan();
      await konteks({});
      for (const [t, kolom, nilai] of [
        ["organisasi", "id", d.A],
        ["kawasan", "id", d.kawasanA],
        ["tps", "id", d.tpsA],
        ["wadah_catat", "id", d.wadahA],
        ["serah", "id", d.serahA],
        ["serah_wadah", "serah_id", d.serahA],
        ["event", "serah_id", d.serahA],
        ["foto", "id", d.fotoA],
        ["kontrak", "kawasan_id", d.kawasanA],
      ] as const) {
        expect(await hitung(t, kolom, nilai), t).toBe(0);
      }
    });
  });

  it("kawasan A hanya melihat datanya sendiri, tidak satu baris pun milik B", async () => {
    await dalamRollback(app, async () => {
      const d = await siapkan();
      await konteks({ org: [d.A], pengguna: "uji" });
      expect(await hitung("wadah_catat", "id", d.wadahA)).toBe(1);
      expect(await hitung("serah", "id", d.serahA)).toBe(1);
      expect(await hitung("event", "serah_id", d.serahA)).toBe(1);
      expect(await hitung("foto", "id", d.fotoA)).toBe(1);
      for (const [t, kolom, nilai] of [
        ["organisasi", "id", d.B],
        ["kawasan", "id", d.kawasanB],
        ["tps", "id", d.tpsB],
        ["wadah_catat", "id", d.wadahB],
        ["serah", "id", d.serahB],
        ["serah_wadah", "serah_id", d.serahB],
        ["event", "serah_id", d.serahB],
        ["foto", "id", d.fotoB],
      ] as const) {
        expect(await hitung(t, kolom, nilai), `${t} milik B`).toBe(0);
      }
    });
  });

  it("kawasan A tidak dapat menulis atas nama B (WITH CHECK)", async () => {
    await dalamRollback(app, async () => {
      const d = await siapkan();
      await konteks({ org: [d.A], pengguna: "uji" });
      const g = await galatKueri(
        app,
        `INSERT INTO wadah_catat (id, tps_id, kawasan_id, org_kawasan_id, aliran, berat_g, terjadi_pada, idempotency_key) VALUES ($1, $2, $3, $4, 'ABU', 1, now(), $5)`,
        [idAcak("w"), d.tpsB, d.kawasanB, d.B, idAcak("i")],
      );
      expect(g?.code).toBe("42501");
    });
  });

  it("pengangkut C: melihat serah DRAF & wadah kawasan berkontrak (A), tidak melihat B", async () => {
    await dalamRollback(app, async () => {
      const d = await siapkan();
      await konteks({ org: [d.C], pengguna: "uji" });
      expect(await hitung("serah", "id", d.serahA)).toBe(1);
      expect(await hitung("wadah_catat", "id", d.wadahA)).toBe(1);
      expect(await hitung("kawasan", "id", d.kawasanA)).toBe(1);
      expect(await hitung("organisasi", "id", d.A)).toBe(1);
      expect(await hitung("serah", "id", d.serahB)).toBe(0);
      expect(await hitung("wadah_catat", "id", d.wadahB)).toBe(0);
      expect(await hitung("kawasan", "id", d.kawasanB)).toBe(0);
      expect(await hitung("organisasi", "id", d.B)).toBe(0);
      // Foto milik kawasan A tanpa serah tidak terlihat oleh pengangkut.
      expect(await hitung("foto", "id", d.fotoA)).toBe(0);
    });
  });

  it("data global terbaca semua sesi; tulisnya hanya admin/sistem", async () => {
    await dalamRollback(app, async () => {
      await konteks({ org: ["x"], pengguna: "uji" });
      const g = await galatKueri(app, `INSERT INTO alasan_tolak (kode, urutan) VALUES ('LAINNYA', 99)`);
      expect(g?.code).toBe("42501");
    });
  });
});
