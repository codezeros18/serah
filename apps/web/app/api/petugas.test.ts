import { randomUUID } from "node:crypto";
import { hashEvent } from "@serah/core/rantai";
import { beforeAll, describe, expect, it } from "vitest";
import { data, demo, denganPemilik, masuk, panggil, satu, semua, type DemoS08 } from "@/lib/server/uji/klien";
import { GET as daftarSerah, POST as buatSerah } from "./serah/route";
import { GET as menunggu } from "./tps/[id]/menunggu/route";
import { GET as qrTps } from "./tps/qr/[token]/route";
import { POST as catatWadah } from "./wadah/route";

// S08-1 & S08-2 — integrasi: rute petugas (sukses, peran salah, idempoten) + T15 versi DB (hash SQL = hash core).
// Butuh DEMO_MODE=true dan DB ber-seed demo.

let d: DemoS08;
let petugas: string;
let pengangkut: string;
let penerima: string;

beforeAll(async () => {
  d = await demo();
  petugas = await masuk("PETUGAS");
  pengangkut = await masuk("PENGANGKUT");
  penerima = await masuk("PENERIMA");
});

const sekarangIso = () => new Date().toISOString();
const catat = (aliran: string, beratG: number | undefined, kunci?: string, cookie = petugas) =>
  panggil(catatWadah, { jalur: "/api/wadah", cookie, kunci, body: { tpsId: d.tps1, aliran, ...(beratG ? { beratG } : { jumlahWadah: 2 }), terjadiPada: sekarangIso() } });

describe("GET /api/tps/qr/[token]", () => {
  it("token QR TPS demo → TPS & kawasan", async () => {
    const h = await panggil(qrTps, { jalur: "/api/tps/qr/demo-qr-TPS-PCS-01", cookie: petugas, params: { token: "demo-qr-TPS-PCS-01" } });
    expect(h.status).toBe(200);
    expect(data(h)).toMatchObject({ tps: { id: d.tps1, kode: "TPS-PCS-01" }, kawasan: { kode: "KWS-PCS", nama: "Pasar Contoh Sejahtera" } });
  });
  it("token tidak dikenal → 404 dengan teks G_QR_TIDAK_DIKENAL", async () => {
    const h = await panggil(qrTps, { jalur: "/api/tps/qr/x", cookie: petugas, params: { token: "token-qr-yang-tidak-ada" } });
    expect(h.status).toBe(404);
    expect(h.json.galat?.pesan).toBe("Kode QR tidak dikenal. Pastikan Anda memindai QR dari SERAH.");
  });
  it("peran pengangkut → 403", async () => {
    const h = await panggil(qrTps, { jalur: "/api/tps/qr/x", cookie: pengangkut, params: { token: "demo-qr-TPS-PCS-01" } });
    expect(h.status).toBe(403);
  });
});

describe("POST /api/wadah", () => {
  it("sukses → id + diterimaPada server; baris 🔒 + event WADAH_DICATAT berkunci sama", async () => {
    const kunci = randomUUID();
    const h = await catat("KUNING", 12_500, kunci);
    expect(h.status).toBe(200);
    const isi = data<{ id: string; diterimaPada: string }>(h);
    const w = await satu<{ berat_g: number; idempotency_key: string; offline: boolean }>(`SELECT berat_g, idempotency_key, offline FROM wadah_catat WHERE id = $1`, [isi.id]);
    expect(w).toEqual({ berat_g: 12_500, idempotency_key: kunci, offline: false });
    const e = await satu<{ jenis: string; peran: string }>(`SELECT jenis::text, peran::text FROM event WHERE idempotency_key = $1`, [kunci]);
    expect(e).toEqual({ jenis: "WADAH_DICATAT", peran: "PETUGAS" });
  });

  it("kiriman ganda (kunci sama) → satu efek, respons sama + Idempotent-Replay", async () => {
    const kunci = randomUUID();
    const a = await catat("ABU", 30_000, kunci);
    const b = await catat("ABU", 30_000, kunci);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.header.get("idempotent-replay")).toBe("true");
    expect(a.header.get("idempotent-replay")).toBeNull();
    expect(b.json).toEqual(a.json);
    const n = await satu<{ n: string }>(`SELECT count(*) AS n FROM wadah_catat WHERE idempotency_key = $1`, [kunci]);
    expect(Number(n.n)).toBe(1);
  });

  it("kiriman bersamaan dengan kunci sama → tetap satu efek", async () => {
    const kunci = randomUUID();
    const [a, b] = await Promise.all([catat("HIJAU", 4_000, kunci), catat("HIJAU", 4_000, kunci)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(b.json).toEqual(a.json);
    const n = await satu<{ n: string }>(`SELECT count(*) AS n FROM event WHERE idempotency_key = $1`, [kunci]);
    expect(Number(n.n)).toBe(1);
  });

  it("tanpa Idempotency-Key → 400", async () => {
    expect((await catat("KUNING", 1_000, null as unknown as string)).status).toBe(400);
  });

  it("field hasil hitung dari klien → FIELD_TIDAK_DIKENAL", async () => {
    const h = await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: 1_000, umurJam: 3, terjadiPada: sekarangIso() } });
    expect(h.status).toBe(400);
    expect(h.json.galat?.kode).toBe("FIELD_TIDAK_DIKENAL");
  });

  it("peran pengangkut/penerima → 403", async () => {
    expect((await catat("KUNING", 1_000, undefined, pengangkut)).status).toBe(403);
    expect((await catat("KUNING", 1_000, undefined, penerima)).status).toBe(403);
  });
});

describe("GET /api/tps/[id]/menunggu & POST /api/serah", () => {
  it("wadah baru muncul menunggu; serah dibuat DRAF, wadah tidak menunggu lagi; replay sama", async () => {
    const w1 = data<{ id: string }>(await catat("KUNING", 21_000));
    const w2 = data<{ id: string }>(await catat("ABU", 9_000));
    const m = data<{ wadah: { id: string; umurJam: number }[]; peringatan: unknown[] }>(
      await panggil(menunggu, { jalur: `/api/tps/${d.tps1}/menunggu`, cookie: petugas, params: { id: d.tps1 } }),
    );
    expect(m.wadah.map((w) => w.id)).toEqual(expect.arrayContaining([w1.id, w2.id]));
    expect(m.wadah.find((w) => w.id === w1.id)?.umurJam).toBe(0);
    expect(Array.isArray(m.peringatan)).toBe(true);

    const kunci = randomUUID();
    const s = await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, kunci, body: { tpsId: d.tps1, wadahIds: [w1.id, w2.id] } });
    expect(s.status).toBe(200);
    const serah = data<{ kode: string; qrToken: string }>(s);
    expect(serah.kode).toMatch(/^SRH-\d{8}-\d{4}$/);
    expect(serah.qrToken).toBe(serah.kode);
    const ulang = await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, kunci, body: { tpsId: d.tps1, wadahIds: [w1.id, w2.id] } });
    expect(ulang.json).toEqual(s.json);
    expect(ulang.header.get("idempotent-replay")).toBe("true");

    const baris = await satu<{ status: string; versi: number; n: string }>(
      `SELECT s.status::text, s.versi, (SELECT count(*) FROM serah_wadah sw WHERE sw.serah_id = s.id) AS n FROM serah s WHERE kode = $1`,
      [serah.kode],
    );
    expect(baris).toEqual({ status: "DRAF", versi: 1, n: "2" });

    const sesudah = data<{ wadah: { id: string }[] }>(await panggil(menunggu, { jalur: "/", cookie: petugas, params: { id: d.tps1 } }));
    expect(sesudah.wadah.map((w) => w.id)).not.toContain(w1.id);

    // Wadah yang sama tidak boleh masuk serah lain.
    const lagi = await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: [w1.id] } });
    expect(lagi.status).toBe(400);
    expect(lagi.json.galat?.kode).toBe("VALIDASI_GAGAL");

    const daftar = data<{ serah: { kode: string; aliran: string[] }[] }>(await panggil(daftarSerah, { jalur: "/api/serah?status=DRAF", cookie: petugas }));
    expect(daftar.serah.find((x) => x.kode === serah.kode)?.aliran).toEqual(["KUNING", "ABU"]);
  });

  it("peran penerima tidak boleh membuat serah", async () => {
    const h = await panggil(buatSerah, { jalur: "/api/serah", cookie: penerima, body: { tpsId: d.tps1, wadahIds: [randomUUID().replaceAll("-", "").slice(0, 24)] } });
    expect(h.status).toBe(403);
  });
});

describe("T15 versi DB — rantai kawasan dari layanan", () => {
  it("hash setiap event layanan = hash_event SQL = hashEvent core; rantai utuh", async () => {
    await Promise.all([catat("KUNING", 1_111), catat("ABU", 2_222), catat("HIJAU", 3_333)]);
    const baris = await semua<{ urutan_rantai: number; prev_hash: string; hash: string; jenis: string; kode: string | null; peran: string; payload: Record<string, unknown>; diterima_pada: Date; hash_sql: string }>(
      `SELECT e.urutan_rantai, e.prev_hash, e.hash, e.jenis::text, s.kode, e.peran::text, e.payload, e.diterima_pada,
              hash_event(e.prev_hash, e.jenis::text, s.kode, e.peran::text, e.payload, e.diterima_pada) AS hash_sql
       FROM event e LEFT JOIN serah s ON s.id = e.serah_id
       WHERE e.kawasan_id = $1 AND e.idempotency_key NOT LIKE 'demo-%' ORDER BY e.urutan_rantai`,
      [d.kawasan],
    );
    expect(baris.length).toBeGreaterThanOrEqual(3);
    for (const e of baris) {
      expect(e.hash_sql).toBe(e.hash);
      expect(hashEvent(e.prev_hash, { jenis: e.jenis, serahKode: e.kode, peran: e.peran, payload: e.payload, diterimaPada: e.diterima_pada })).toBe(e.hash);
    }
    const v = await denganPemilik(async (k) => {
      await k.query("BEGIN");
      await k.query("SELECT set_config('app.sistem', 'true', true)");
      const r = await k.query<{ utuh: boolean; jumlah: number; patah_di_urutan: number | null }>(`SELECT * FROM verifikasi_rantai($1)`, [d.kawasan]);
      await k.query("ROLLBACK");
      return r.rows[0];
    });
    expect(v).toMatchObject({ utuh: true, patah_di_urutan: null });
  });

  it("payload satu event diubah diam-diam (dalam transaksi uji) → patah tepat di urutannya", async () => {
    const target = await satu<{ urutan_rantai: number }>(
      `SELECT urutan_rantai FROM event WHERE kawasan_id = $1 AND jenis = 'WADAH_DICATAT' AND idempotency_key NOT LIKE 'demo-%' ORDER BY urutan_rantai DESC LIMIT 1 OFFSET 1`,
      [d.kawasan],
    );
    const v = await denganPemilik(async (k) => {
      await k.query("BEGIN");
      try {
        await k.query("ALTER TABLE event DISABLE TRIGGER event_catat_saja");
        await k.query(`UPDATE event SET payload = jsonb_set(payload, '{beratG}', '999999') WHERE kawasan_id = $1 AND urutan_rantai = $2`, [d.kawasan, target.urutan_rantai]);
        await k.query("SELECT set_config('app.sistem', 'true', true)");
        return (await k.query<{ utuh: boolean; patah_di_urutan: number | null }>(`SELECT * FROM verifikasi_rantai($1)`, [d.kawasan])).rows[0];
      } finally {
        await k.query("ROLLBACK");
      }
    });
    expect(v).toMatchObject({ utuh: false, patah_di_urutan: target.urutan_rantai });
  });

  it("urutan_rantai tetap berurutan tanpa celah walau ditulis bersamaan", async () => {
    await Promise.all(Array.from({ length: 6 }, (_, i) => catat("KUNING", 100 + i)));
    const r = await satu<{ n: string; maks: number }>(`SELECT count(*) AS n, max(urutan_rantai) AS maks FROM event WHERE kawasan_id = $1`, [d.kawasan]);
    expect(Number(r.n)).toBe(r.maks);
  });
});
