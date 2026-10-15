import { randomUUID } from "node:crypto";
import { namaUnik } from "@/lib/server/uji/nama";
import { periodeWib } from "@serah/core/waktu";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { denganAkses } from "@/lib/server/db";
import { GalatApi } from "@/lib/server/galat";
import { aturIntegrasi, penyimpananLokal } from "@/lib/server/integrasi-stub";
import { terbitkanTagihanAngkut } from "@/lib/server/layanan/tagihan-angkut";
import { bacaSesi, konteksAkses } from "@/lib/server/sesi";
import { orgBaru, type OrgUji } from "@/lib/server/uji/akun";
import { data, demo, formFoto, masuk, panggil, pngContoh, satu, semua, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { POST as bayanganBuat } from "./bayangan/route";
import { GET as bayanganBanding } from "./bayangan/perbandingan/route";
import { POST as buatKawasan } from "./kawasan/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { GET as tagihanAngkutGet } from "./tagihan-angkut/route";
import { POST as terbitkan } from "./tagihan-angkut/terbitkan/route";
import { POST as buatTps } from "./tps/route";
import { POST as catatWadah } from "./wadah/route";

// S24 — T27 (tagihan angkut hanya dari DITERIMA/DITERIMA_SEBAGIAN), akses & hak paket, mode bayangan.
// Butuh DB ber-seed demo (DEMO_MODE=true). Data dibuat di kawasan baru agar angka pasti.

vi.setConfig({ testTimeout: 90_000 });

const HARI = 86_400_000;
const rekam = new PengirimRekam();
let d: DemoS08;
let k: OrgUji & { kawasanId: string; tps: string };
let pengangkut: string;
let penerima: string;
let kontrakId: string;
const periode = periodeWib(new Date());

beforeAll(async () => {
  setelPengirimUji(rekam);
  aturIntegrasi({ penyimpanan: penyimpananLokal });
  d = await demo();
  [pengangkut, penerima] = await Promise.all([masuk("PENGANGKUT"), masuk("PENERIMA")]);

  const o = await orgBaru(rekam, { jenis: "KAWASAN" });
  const kws = data<{ kawasan: { id: string } }>(
    await panggil(buatKawasan, { jalur: "/api/kawasan", cookie: o.cookie, body: { nama: namaUnik("Kawasan Tagihan Angkut Uji"), jenis: "KOMERSIAL", alamat: "Alamat uji", adm4: "31.71.03.1001", kota: "Jakarta Pusat" } }),
  ).kawasan;
  const tps = data<{ tps: { id: string } }>(await panggil(buatTps, { jalur: "/api/tps", cookie: o.cookie, body: { kawasanId: kws.id, nama: "TPS 1", latE6: -6_161_234, lonE6: 106_845_678 } })).tps;
  k = { ...o, kawasanId: kws.id, tps: tps.id };

  kontrakId = `ujis24ktr${randomUUID().replaceAll("-", "").slice(0, 15)}`;
  await satu(
    `INSERT INTO kontrak (id, kawasan_id, org_kawasan_id, org_pengangkut_id, org_penerima_id, aliran, berlaku_dari, berlaku_sampai, tarif_per_rit_idr, tarif_per_kg_idr, status, dibuat_pada)
     VALUES ($1, $2, $3, $4, $5, ARRAY['KUNING']::"Aliran"[], current_date - 30, current_date + 365, 150000, 500, 'AKTIF', now()) RETURNING id`,
    [kontrakId, k.kawasanId, k.organisasiId, d.org.pengangkut, d.org.daurUlang],
  );
}, 120_000);
afterAll(() => setelPengirimUji(null));

/** Serah KUNING satu wadah `beratG`, sampai status yang diminta. Mengembalikan kode serah. */
async function serahSampai(beratG: number, tahap: "DIANGKUT" | "DITUTUP", rincian?: { diterimaG: number; ditolakG: number }): Promise<string> {
  const w = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: k.cookie, body: { tpsId: k.tps, aliran: "KUNING", beratG, terjadiPada: new Date().toISOString() } }));
  const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: k.cookie, body: { tpsId: k.tps, wadahIds: [w.id] } })).kode;
  const fotoId = data<{ fotoId: string }>(await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) })).fotoId;
  data(await panggil(ambil, { jalur: "/", cookie: pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }));
  data(await panggil(setujui, { jalur: "/", cookie: k.cookie, params: { kode }, body: {} }));
  if (tahap === "DITUTUP") {
    const r = rincian ?? { diterimaG: beratG, ditolakG: 0 };
    data(
      await panggil(tutup, {
        jalur: "/",
        cookie: penerima,
        params: { kode },
        body: { tiket: { beratG, sumber: "MANUAL", nomor: "TKT-UJI" }, rincian: [{ aliran: "KUNING", diterimaG: r.diterimaG, ditolakG: r.ditolakG, ...(r.ditolakG > 0 ? { alasan: "BASAH_KOTOR" } : {}) }] },
      }),
    );
  }
  return kode;
}

const kode: Record<"penuh" | "sebagian" | "ditolak" | "diangkut", string> = { penuh: "", sebagian: "", ditolak: "", diangkut: "" };

describe("T27 — tagihan angkut hanya dari serah DITERIMA / DITERIMA_SEBAGIAN", () => {
  beforeAll(async () => {
    kode.penuh = await serahSampai(10_000, "DITUTUP");
    kode.sebagian = await serahSampai(20_000, "DITUTUP", { diterimaG: 12_345, ditolakG: 7_655 });
    kode.ditolak = await serahSampai(10_000, "DITUTUP", { diterimaG: 0, ditolakG: 10_000 });
    kode.diangkut = await serahSampai(10_000, "DIANGKUT");
  }, 180_000);

  // panggil() menyusun URL dari `jalur`; kueri disertakan di jalur.
  const lihatKueri = (cookie: string, kueri: string) => panggil(tagihanAngkutGet, { jalur: `/api/tagihan-angkut?${kueri}`, cookie });

  it("status akhir sesuai skenario (DITERIMA, DITERIMA_SEBAGIAN, DITOLAK, DIANGKUT)", async () => {
    const baris = await semua<{ kode: string; status: string; kontrak_id: string | null }>(`SELECT kode, status::text, kontrak_id FROM serah WHERE kode = ANY($1)`, [Object.values(kode)]);
    const per = Object.fromEntries(baris.map((b) => [b.kode, b]));
    expect(per[kode.penuh]).toMatchObject({ status: "DITERIMA", kontrak_id: kontrakId });
    expect(per[kode.sebagian]).toMatchObject({ status: "DITERIMA_SEBAGIAN", kontrak_id: kontrakId });
    expect(per[kode.ditolak]).toMatchObject({ status: "DITOLAK", kontrak_id: kontrakId });
    expect(per[kode.diangkut]).toMatchObject({ status: "DIANGKUT", kontrak_id: kontrakId });
  });

  it("pratinjau pengangkut: rit 2, 22.345 g, total 2×150.000 + ⌊22.345×500/1000⌋ = 311.172; yang tidak termasuk = 2", async () => {
    const r = await lihatKueri(pengangkut, `kontrakId=${kontrakId}&periode=${periode}`);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    const { pratinjau } = r.json.data as { pratinjau: Record<string, unknown> & { rincian: { kodeSerah: string; subtotalIdr: number }[] } };
    expect(pratinjau).toMatchObject({ kontrakId, periode, ritTertutup: 2, kgDiterimaG: 22_345, totalIdr: 311_172, tidakTermasuk: 2 });
    expect(pratinjau.rincian.map((x) => x.kodeSerah).sort()).toEqual([kode.penuh, kode.sebagian].sort());
    expect(pratinjau.rincian.reduce((a, b) => a + b.subtotalIdr, 0)).toBe(311_172);
  });

  it("pengelola kawasan melihat pratinjau yang sama; penerima & petugas ditolak; kontrak milik pihak lain 404", async () => {
    const r = await lihatKueri(k.cookie, `kontrakId=${kontrakId}&periode=${periode}`);
    expect(r.status).toBe(200);
    expect((r.json.data as { pratinjau: { totalIdr: number } }).pratinjau.totalIdr).toBe(311_172);
    expect((await lihatKueri(penerima, `kontrakId=${kontrakId}&periode=${periode}`)).status).toBe(403);
    const lain = await orgBaru(rekam, { jenis: "KAWASAN" });
    expect((await lihatKueri(lain.cookie, `kontrakId=${kontrakId}&periode=${periode}`)).status).toBe(404);
    // kontrakId tanpa periode (atau sebaliknya) → 400
    expect((await lihatKueri(pengangkut, `kontrakId=${kontrakId}`)).status).toBe(400);
    expect((await lihatKueri(pengangkut, `periode=${periode}`)).status).toBe(400);
  });

  it("terbitkan: hanya PENGANGKUT; periode berjalan ditolak 400; tanpa sesi 401", async () => {
    const pakai = (cookie: string) => panggil(terbitkan, { jalur: "/api/tagihan-angkut/terbitkan", cookie, kunci: null, body: { kontrakId, periode } });
    expect((await pakai(k.cookie)).status).toBe(403);
    expect((await pakai(penerima)).status).toBe(403);
    const r = await pakai(pengangkut);
    expect(r.status).toBe(400);
    expect(r.json.galat?.kode).toBe("VALIDASI_GAGAL");
    expect((await panggil(terbitkan, { jalur: "/api/tagihan-angkut/terbitkan", kunci: null, body: { kontrakId, periode } })).status).toBe(401);
  });

  it("terbitkan periode berakhir: dua permintaan bersamaan → tepat satu tagihan; nilai sesuai; ulangan 409", async () => {
    const sesi = await bacaSesi(new Request("http://x/", { headers: { cookie: pengangkut } }));
    expect(sesi).not.toBeNull();
    // Penanda waktu 40 hari ke depan: periode data (bulan ini) sudah berakhir menurut jam WIB penerbitan.
    const nanti = new Date(Date.now() + 40 * HARI);
    const coba = () => denganAkses(konteksAkses(sesi!), (tx) => terbitkanTagihanAngkut(tx, sesi!, { kontrakId, periode }, nanti)).then(
      (t) => ({ ok: true as const, t }),
      (e: unknown) => ({ ok: false as const, kode: e instanceof GalatApi ? e.kode : "LAIN" }),
    );
    const hasil = await Promise.all([coba(), coba()]);
    expect(hasil.filter((h) => h.ok)).toHaveLength(1);
    expect(hasil.find((h) => !h.ok)).toMatchObject({ kode: "TRANSISI_TIDAK_SAH" });
    const t = (hasil.find((h) => h.ok) as { ok: true; t: { kode: string; totalIdr: number; ritTertutup: number; kgDiterimaG: number; rincian: unknown[] } }).t;
    expect(t).toMatchObject({ totalIdr: 311_172, ritTertutup: 2, kgDiterimaG: 22_345 });
    expect(t.kode).toMatch(/^TGA-\d{6}-\d{4}$/);
    expect(t.rincian).toHaveLength(2);

    expect((await coba()).ok).toBe(false);
    expect(await semua(`SELECT 1 FROM tagihan_angkut WHERE kontrak_id = $1 AND periode = $2`, [kontrakId, periode])).toHaveLength(1);
    // Tarif yang dipakai tersimpan bersama rincian.
    const tersimpan = await satu<{ rincian: { tarifPerRitIdr: number; tarifPerKgIdr: number } }>(`SELECT rincian FROM tagihan_angkut WHERE kontrak_id = $1`, [kontrakId]);
    expect(tersimpan.rincian).toMatchObject({ tarifPerRitIdr: 150_000, tarifPerKgIdr: 500 });
  });

  it("daftar tagihan: terlihat oleh pengangkut & pengelola kawasan, tidak oleh kawasan lain", async () => {
    for (const cookie of [pengangkut, k.cookie]) {
      const r = await lihatKueri(cookie, "");
      expect(r.status).toBe(200);
      const { pratinjau, tagihan } = r.json.data as { pratinjau: unknown; tagihan: { kontrakId: string; totalIdr: number }[] };
      expect(pratinjau).toBeNull();
      expect(tagihan.find((t) => t.kontrakId === kontrakId)?.totalIdr).toBe(311_172);
    }
    const lain = await orgBaru(rekam, { jenis: "KAWASAN" });
    expect(((await lihatKueri(lain.cookie, "")).json.data as { tagihan: unknown[] }).tagihan).toEqual([]);
  });

  it("hak paket: kawasan tanpa `tagihan_angkut` (paket dasar) → 403 HAK_PAKET_TIDAK_ADA, pengangkut (paket mitra) tetap boleh", async () => {
    await satu(`UPDATE langganan SET status = 'BERAKHIR', uji_coba_selesai = now() - interval '1 day' WHERE organisasi_id = $1 RETURNING id`, [k.organisasiId]);
    const r = await lihatKueri(k.cookie, "");
    expect(r.status).toBe(403);
    expect(r.json.galat?.kode).toBe("HAK_PAKET_TIDAK_ADA");
    expect((await lihatKueri(pengangkut, "")).status).toBe(200);
  });
});

describe("S24-4 — mode bayangan", () => {
  // Kawasan terpisah supaya angka SERAH dicatat (TPS) tepat 50.000 g KUNING dan tidak terpengaruh test lain.
  let o: OrgUji & { kawasanId: string; tps: string };

  beforeAll(async () => {
    const baru = await orgBaru(rekam, { jenis: "KAWASAN" });
    const kws = data<{ kawasan: { id: string } }>(
      await panggil(buatKawasan, { jalur: "/api/kawasan", cookie: baru.cookie, body: { nama: namaUnik("Kawasan Bayangan Uji"), jenis: "KOMERSIAL", alamat: "Alamat uji", adm4: "31.71.03.1001", kota: "Jakarta Pusat" } }),
    ).kawasan;
    const tps = data<{ tps: { id: string } }>(await panggil(buatTps, { jalur: "/api/tps", cookie: baru.cookie, body: { kawasanId: kws.id, nama: "TPS B", latE6: -6_161_234, lonE6: 106_845_678 } })).tps;
    o = { ...baru, kawasanId: kws.id, tps: tps.id };
    for (const beratG of [30_000, 20_000]) {
      data(await panggil(catatWadah, { jalur: "/api/wadah", cookie: o.cookie, body: { tpsId: o.tps, aliran: "KUNING", beratG, terjadiPada: new Date().toISOString() } }));
    }
  }, 120_000);

  const tambah = (cookie: string, body: Record<string, unknown>) => panggil(bayanganBuat, { jalur: "/api/bayangan", cookie, kunci: null, body });
  const banding = (cookie: string, kawasanId: string, p = periode) => panggil(bayanganBanding, { jalur: `/api/bayangan/perbandingan?kawasanId=${kawasanId}&periode=${p}`, cookie });
  type Baris = { aliran: string; serahG: number; bayanganG: number; selisihG: number; sumberCatatan: string[] };
  const kuning = async (p = periode) => ((await banding(o.cookie, o.kawasanId, p)).json.data as { baris: Baris[] }).baris.find((b) => b.aliran === "KUNING");

  it("tanpa entri: SERAH 50.000 g tercatat, bayangan 0 → selisih negatif (catatan lama lebih kecil)", async () => {
    expect(await kuning()).toEqual({ aliran: "KUNING", serahG: 50_000, bayanganG: 0, selisihG: -50_000, sumberCatatan: [] });
  });

  it("selisih dua arah dan sama: 45.000 → −5.000; +5.000 → 0; +10.000 → +10.000; sumber dikumpulkan", async () => {
    const entri = async (beratG: number, sumberCatatan: string) => {
      const r = await tambah(o.cookie, { kawasanId: o.kawasanId, periode, aliran: "KUNING", beratG, sumberCatatan });
      expect(r.status, JSON.stringify(r.json)).toBe(200);
    };
    await entri(45_000, "buku TPS");
    expect(await kuning()).toMatchObject({ serahG: 50_000, bayanganG: 45_000, selisihG: -5_000, sumberCatatan: ["buku TPS"] });
    await entri(5_000, "laporan bulanan lama");
    expect(await kuning()).toMatchObject({ bayanganG: 50_000, selisihG: 0, sumberCatatan: ["buku TPS", "laporan bulanan lama"] });
    await entri(10_000, "buku TPS");
    expect(await kuning()).toMatchObject({ bayanganG: 60_000, selisihG: 10_000 });
    // Aliran lain hanya tampil bila ada angkanya.
    const semuaBaris = ((await banding(o.cookie, o.kawasanId)).json.data as { baris: Baris[] }).baris;
    expect(semuaBaris.map((b) => b.aliran)).toEqual(["KUNING"]);
  });

  it("periode lain terpisah; entri tersimpan catat-saja (tidak bisa diubah/dihapus)", async () => {
    expect(await kuning("2020-01")).toBeUndefined();
    expect((await tambah(o.cookie, { kawasanId: o.kawasanId, periode: "2020-01", aliran: "HIJAU", beratG: 1_000, sumberCatatan: "arsip" })).status).toBe(200);
    expect(((await banding(o.cookie, o.kawasanId, "2020-01")).json.data as { baris: Baris[] }).baris).toEqual([
      { aliran: "HIJAU", serahG: 0, bayanganG: 1_000, selisihG: 1_000, sumberCatatan: ["arsip"] },
    ]);
    await expect(satu(`UPDATE bayangan_entri SET berat_g = 1 WHERE kawasan_id = $1 RETURNING id`, [o.kawasanId])).rejects.toThrow(/CATAT_SAJA|permission/);
  });

  it("akses & validasi: kawasan lain 404, bukan pengelola 403, berat 0 / sumber kosong 400, hak paket dasar 403", async () => {
    const lain = await orgBaru(rekam, { jenis: "KAWASAN" });
    expect((await banding(lain.cookie, o.kawasanId)).status).toBe(404);
    expect((await tambah(lain.cookie, { kawasanId: o.kawasanId, periode, aliran: "KUNING", beratG: 1_000, sumberCatatan: "buku TPS" })).status).toBe(404);
    expect((await tambah(pengangkut, { kawasanId: o.kawasanId, periode, aliran: "KUNING", beratG: 1_000, sumberCatatan: "buku TPS" })).status).toBe(403);
    expect((await banding(penerima, o.kawasanId)).status).toBe(403);
    expect((await tambah(o.cookie, { kawasanId: o.kawasanId, periode, aliran: "KUNING", beratG: 0, sumberCatatan: "buku TPS" })).status).toBe(400);
    expect((await tambah(o.cookie, { kawasanId: o.kawasanId, periode, aliran: "KUNING", beratG: 1_000, sumberCatatan: " " })).status).toBe(400);
    expect((await tambah(o.cookie, { kawasanId: o.kawasanId, periode: "2026-13", aliran: "KUNING", beratG: 1_000, sumberCatatan: "buku TPS" })).status).toBe(400);

    await satu(`UPDATE langganan SET status = 'BERAKHIR', uji_coba_selesai = now() - interval '1 day' WHERE organisasi_id = $1 RETURNING id`, [o.organisasiId]);
    const r = await banding(o.cookie, o.kawasanId);
    expect(r.status).toBe(403);
    expect(r.json.galat?.kode).toBe("HAK_PAKET_TIDAK_ADA");
    expect((await tambah(o.cookie, { kawasanId: o.kawasanId, periode, aliran: "KUNING", beratG: 1_000, sumberCatatan: "buku TPS" })).status).toBe(403);
  });
});
