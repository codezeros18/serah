import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { muatEnv } from "@/lib/server/env";
import { bacaObjekLokal, penyimpananLokal } from "@/lib/server/integrasi-stub";
import { jalankanCron } from "@/lib/server/layanan/cron";
import { asal, data, demo, denganPemilik, formFoto, masuk, panggil, pngContoh, satu, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as cronHarian } from "./cron/harian/route";
import { POST as cronSepuluh } from "./cron/sepuluh-menit/route";
import { POST as unggah } from "./foto/route";
import { GET as health } from "./health/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { POST as catatWadah } from "./wadah/route";

// S08-7 — cron: T06 (R-07 → MENGGANTUNG, idempoten), Bearer CRON_SECRET, pekerjaan_cron, retensi foto. + health.

const JAM = 3_600_000;
let d: DemoS08;
let petugas: string;
let pengelola: string;
let pengangkut: string;
let penerima: string;

beforeAll(async () => {
  d = await demo();
  [petugas, pengelola, pengangkut, penerima] = await Promise.all([masuk("PETUGAS"), masuk("PENGELOLA"), masuk("PENGANGKUT"), masuk("PENERIMA")]);
});

async function serahDiangkut(): Promise<string> {
  const w = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: 6_000, terjadiPada: new Date().toISOString() } }));
  const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: [w.id] } })).kode;
  const fotoId = data<{ fotoId: string }>(
    await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) }),
  ).fotoId;
  data(await panggil(ambil, { jalur: "/", cookie: pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }));
  data(await panggil(setujui, { jalur: "/", cookie: pengelola, params: { kode }, body: {} }));
  return kode;
}

const cron = (handler: unknown, token: string | null) =>
  (handler as (r: Request) => Promise<Response>)(
    new Request(`${asal()}/api/cron/x`, { method: "POST", headers: token === null ? {} : { authorization: `Bearer ${token}` } }),
  );

describe("T06 — R-07 lewat cron sepuluh-menit", () => {
  it("DIANGKUT > 12 jam sejak disetujui → MENGGANTUNG (event SISTEM, notifikasi 3 pihak); diulang = satu efek", async () => {
    const kode = await serahDiangkut();
    const nanti = new Date(Date.now() + 12 * JAM + 5 * 60_000);
    const jendela = `uji-${randomUUID()}`;

    // 11 jam 59 menit: belum.
    await jalankanCron("sepuluh-menit", new Date(Date.now() + 12 * JAM - 60_000), { hanyaSerah: [kode], hanyaR07: true, jendela: `${jendela}-awal` });
    expect((await satu<{ status: string }>(`SELECT status::text FROM serah WHERE kode = $1`, [kode])).status).toBe("DIANGKUT");

    const a = await jalankanCron("sepuluh-menit", nanti, { hanyaSerah: [kode], hanyaR07: true, jendela });
    expect(a).toEqual({ pekerjaan: "sepuluh-menit", jendela, dilewati: false });
    expect(await satu<{ status: string; versi: number }>(`SELECT status::text, versi FROM serah WHERE kode = $1`, [kode])).toEqual({ status: "MENGGANTUNG", versi: 4 });
    const e = await satu<{ peran: string; idempotency_key: string }>(
      `SELECT e.peran::text, e.idempotency_key FROM event e JOIN serah s ON s.id = e.serah_id WHERE s.kode = $1 AND e.jenis = 'SERAH_MENGGANTUNG'`,
      [kode],
    );
    expect(e.peran).toBe("SISTEM");
    const n = await satu<{ n: string }>(`SELECT count(*) AS n FROM notifikasi WHERE objek_kode = $1 AND jenis = 'SERAH_MENGGANTUNG'`, [kode]);
    expect(Number(n.n)).toBe(3);

    // Jendela sama → dilewati. Jendela berikutnya → serah sudah MENGGANTUNG, tidak ada event kedua.
    expect((await jalankanCron("sepuluh-menit", nanti, { hanyaSerah: [kode], hanyaR07: true, jendela })).dilewati).toBe(true);
    await jalankanCron("sepuluh-menit", new Date(nanti.getTime() + 10 * 60_000), { hanyaSerah: [kode], hanyaR07: true, jendela: `${jendela}-lanjut` });
    const jumlah = await satu<{ n: string }>(`SELECT count(*) AS n FROM event e JOIN serah s ON s.id = e.serah_id WHERE s.kode = $1 AND e.jenis = 'SERAH_MENGGANTUNG'`, [kode]);
    expect(Number(jumlah.n)).toBe(1);

    // Serah menggantung tetap boleh ditutup penerima (§I.1).
    const t = await panggil(tutup, { jalur: "/", cookie: penerima, params: { kode }, body: { tiket: { beratG: 6_000, sumber: "MANUAL" }, rincian: [{ aliran: "KUNING", diterimaG: 6_000, ditolakG: 0 }] } });
    expect(data(t)).toMatchObject({ status: "DITERIMA" });
  });
});

describe("Rute cron — Bearer CRON_SECRET & pekerjaan_cron", () => {
  it("tanpa/dengan token salah → 401; token benar dipanggil 2× → panggilan kedua dilewati (jendela sama)", async () => {
    expect((await cron(cronSepuluh, null)).status).toBe(401);
    expect((await cron(cronSepuluh, "salah-salah-salah-salah-salah-salah")).status).toBe(401);
    const rahasia = muatEnv().CRON_SECRET;
    expect(rahasia, "CRON_SECRET wajib di .env untuk test ini").toBeTruthy();
    const a = await cron(cronSepuluh, rahasia!);
    const b = await cron(cronSepuluh, rahasia!);
    expect(a.status).toBe(200);
    const [ia, ib] = [(await a.json()).data, (await b.json()).data];
    expect(ib).toEqual({ pekerjaan: "sepuluh-menit", jendela: ia.jendela, dilewati: true });
    const row = await satu<{ selesai: boolean }>(`SELECT selesai_pada IS NOT NULL AS selesai FROM pekerjaan_cron WHERE nama = 'sepuluh-menit' AND jendela = $1`, [ia.jendela]);
    expect(row.selesai).toBe(true);
  });

  it("harian: rute dengan token benar → 200 (dilewati bila jendela hari ini sudah jalan)", async () => {
    const r = await cron(cronHarian, muatEnv().CRON_SECRET!);
    expect(r.status).toBe(200);
    expect((await r.json()).data.pekerjaan).toBe("harian");
  });
});

describe("Cron harian — retensi foto", () => {
  it("foto melewati RETENSI_FOTO_HARI: objek dihapus, baris tetap & ditandai; foto baru tidak tersentuh", async () => {
    const isi = pngContoh(randomUUID());
    const kunci = `${d.org.pengangkut}/MUATAN/${createHash("sha256").update(isi).digest("hex")}.png`;
    await penyimpananLokal.simpan(kunci, isi, "image/png");
    const lama = `ujis08foto${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const umur = (muatEnv().RETENSI_FOTO_HARI + 1) * 24 * JAM;
    await denganPemilik((k) =>
      k.query(
        `INSERT INTO foto (id, jenis, organisasi_id, object_key, dhash, ukuran_byte, lebar, tinggi, diterima_pada)
         VALUES ($1, 'MUATAN', $2, $3, '0123456789abcdef', $4, 4, 3, $5)`,
        [lama, d.org.pengangkut, kunci, isi.length, new Date(Date.now() - umur)],
      ),
    );
    const sebelum = await satu<{ n: string }>(`SELECT count(*) AS n FROM foto WHERE dihapus_retensi_pada IS NULL`);
    const h = await jalankanCron("harian", new Date(), { jendela: `uji-${randomUUID()}` });
    expect(h.dilewati).toBe(false);
    expect((await satu<{ ditandai: boolean }>(`SELECT dihapus_retensi_pada IS NOT NULL AS ditandai FROM foto WHERE id = $1`, [lama])).ditandai).toBe(true);
    expect(await bacaObjekLokal(kunci)).toBeNull();
    const sesudah = await satu<{ n: string }>(`SELECT count(*) AS n FROM foto WHERE dihapus_retensi_pada IS NULL`);
    expect(Number(sesudah.n)).toBeGreaterThanOrEqual(Number(sebelum.n) - 1);
  });
});

describe("GET /api/health", () => {
  it("versi, db ok, umur BMKG (jam atau null)", async () => {
    const r = await health();
    expect(r.status).toBe(200);
    const isi = (await r.json()).data;
    expect(isi).toMatchObject({ db: "ok" });
    expect(typeof isi.versi).toBe("string");
    expect(isi.bmkgUmurJam === null || Number.isInteger(isi.bmkgUmurJam)).toBe(true);
  });
});
