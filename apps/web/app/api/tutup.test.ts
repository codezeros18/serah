import { randomUUID } from "node:crypto";
import { TEKS, isi } from "@serah/kontrak";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { aturIntegrasi } from "@/lib/server/integrasi";
import { manualPembaca } from "@/lib/server/uji/stub-integrasi";
import { data, demo, formFoto, masuk, panggil, pngContoh, satu, semua, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as kembalikan } from "./serah/[kode]/kembalikan/route";
import { POST as koreksi } from "./serah/[kode]/koreksi/route";
import { GET as detail } from "./serah/[kode]/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { POST as bacaTiket } from "./tiket/baca/route";
import { POST as catatWadah } from "./wadah/route";

// S08-4 — integrasi: setujui/kembalikan, baca tiket (manual & saran AI), tutup (terima/sebagian/tolak, R-08), koreksi (T16).

let d: DemoS08;
let petugas: string;
let pengelola: string;
let pengangkut: string;
let penerima: string;
let penerimaLain: string;

beforeAll(async () => {
  d = await demo();
  [petugas, pengelola, pengangkut, penerima] = await Promise.all([masuk("PETUGAS"), masuk("PENGELOLA"), masuk("PENGANGKUT"), masuk("PENERIMA")]);
  penerimaLain = await masuk("PENERIMA", d.org.pelapakBerkah);
});
afterEach(() => aturIntegrasi({ pembacaTiket: manualPembaca }));

/** Serah KUNING (2 wadah × 10 kg) sampai status yang diminta, ke Daur Ulang Contoh Mandiri. */
async function serahSampai(tahap: "MENUNGGU_SETUJU" | "DIANGKUT"): Promise<string> {
  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    const w = await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: 10_000, terjadiPada: new Date().toISOString() } });
    ids.push(data<{ id: string }>(w).id);
  }
  const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: ids } })).kode;
  const fotoId = data<{ fotoId: string }>(
    await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) }),
  ).fotoId;
  data(await panggil(ambil, { jalur: "/", cookie: pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }));
  if (tahap === "DIANGKUT") data(await panggil(setujui, { jalur: "/", cookie: pengelola, params: { kode }, body: {} }));
  return kode;
}

const tiketManual = (beratG: number) => ({ beratG, sumber: "MANUAL", nomor: "TKT-UJI" });
const tutupDengan = (kode: string, body: unknown, cookie = penerima, kunci?: string) => panggil(tutup, { jalur: "/", cookie, params: { kode }, body, kunci });

describe("SETUJUI & KEMBALIKAN", () => {
  it("pengelola menyetujui → DIANGKUT; notifikasi ke penerima & pengangkut; petugas → 403", async () => {
    const kode = await serahSampai("MENUNGGU_SETUJU");
    expect((await panggil(setujui, { jalur: "/", cookie: petugas, params: { kode }, body: {} })).status).toBe(403);
    const h = await panggil(setujui, { jalur: "/", cookie: pengelola, params: { kode }, body: {} });
    expect(data(h)).toEqual({ kode, status: "DIANGKUT", versi: 3 });
    const n = await semua<{ organisasi_id: string }>(`SELECT organisasi_id FROM notifikasi WHERE objek_kode = $1 AND jenis = 'SERAH_DIANGKUT'`, [kode]);
    expect(n.map((x) => x.organisasi_id).sort()).toEqual([d.org.daurUlang, d.org.pengangkut].sort());
  });

  it("dua persetujuan bersamaan (kunci berbeda) → satu 200, satu 409 KONFLIK_VERSI; hanya satu event SERAH_DISETUJUI", async () => {
    // Tanpa constraint unik yang menolong: hanya cek versi optimistik (§I.2) yang mencegah transisi ganda.
    const kode = await serahSampai("MENUNGGU_SETUJU");
    const hasil = await Promise.all([1, 2].map(() => panggil(setujui, { jalur: "/", cookie: pengelola, params: { kode }, body: {} })));
    expect(hasil.map((h) => h.status).sort()).toEqual([200, 409]);
    expect(hasil.find((h) => h.status === 409)?.json.galat?.kode).toBe("KONFLIK_VERSI");
    const n = await satu<{ n: string }>(`SELECT count(*) AS n FROM event e JOIN serah s ON s.id = e.serah_id WHERE s.kode = $1 AND e.jenis = 'SERAH_DISETUJUI'`, [kode]);
    expect(Number(n.n)).toBe(1);
  });

  it("kembalikan: alasan < 5 karakter ditolak dengan teks; alasan sah → DRAF, pihak dilepas, bisa diambil lagi", async () => {
    const kode = await serahSampai("MENUNGGU_SETUJU");
    const pendek = await panggil(kembalikan, { jalur: "/", cookie: pengelola, params: { kode }, body: { alasan: "abcd" } });
    expect(pendek.status).toBe(400);
    expect(pendek.json.galat?.pesan).toBe(TEKS.UMUM_ALASAN_WAJIB);
    const h = await panggil(kembalikan, { jalur: "/", cookie: pengelola, params: { kode }, body: { alasan: "Foto muatan buram" } });
    expect(data(h)).toMatchObject({ status: "DRAF", versi: 3 });
    const s = await satu<{ org_pengangkut_id: string | null; kendaraan_id: string | null; kontrak_id: string | null }>(
      `SELECT org_pengangkut_id, kendaraan_id, kontrak_id FROM serah WHERE kode = $1`,
      [kode],
    );
    expect(s).toEqual({ org_pengangkut_id: null, kendaraan_id: null, kontrak_id: null });
    const e = await satu<{ org_pengangkut_id: string | null }>(`SELECT e.org_pengangkut_id FROM event e JOIN serah s ON s.id = e.serah_id WHERE s.kode = $1 AND e.jenis = 'SERAH_DIKEMBALIKAN'`, [kode]);
    expect(e.org_pengangkut_id).toBe(d.org.pengangkut);
  });
});

describe("POST /api/tiket/baca", () => {
  async function fotoTiket(kode: string) {
    const h = await panggil(unggah, { jalur: "/api/foto", cookie: penerima, kunci: null, form: formFoto("TIKET", pngContoh(randomUUID()), "image/png", kode) });
    return data<{ fotoId: string }>(h).fotoId;
  }

  it("tanpa AI (ManualPembaca) → 503 AI_TIDAK_TERSEDIA dengan teks isian manual", async () => {
    const kode = await serahSampai("DIANGKUT");
    const h = await panggil(bacaTiket, { jalur: "/", cookie: penerima, kunci: null, body: { fotoId: await fotoTiket(kode) } });
    expect(h.status).toBe(503);
    expect(h.json.galat).toMatchObject({ kode: "AI_TIDAK_TERSEDIA", pesan: TEKS.G_AI_MATI });
  });

  it("saran AI divalidasi di kode kita: enum dikapitalkan; berat tak terbaca → null & RENDAH", async () => {
    const kode = await serahSampai("DIANGKUT");
    const fotoId = await fotoTiket(kode);
    aturIntegrasi({ pembacaTiket: { baca: async () => ({ nomorTiket: " TT-77 ", beratKgTeks: "42,5", tanggal: null, keyakinan: "tinggi" as "TINGGI", model: "claude-haiku-5-5" }) } });
    expect(data(await panggil(bacaTiket, { jalur: "/", cookie: penerima, kunci: null, body: { fotoId } }))).toEqual({
      nomorTiket: "TT-77",
      beratKgTeks: "42,5",
      tanggal: null,
      keyakinan: "TINGGI",
      model: "claude-haiku-5-5",
    });
    aturIntegrasi({ pembacaTiket: { baca: async () => ({ nomorTiket: null, beratKgTeks: "4x,2 ton", tanggal: null, keyakinan: "TINGGI", model: "m" }) } });
    expect(data(await panggil(bacaTiket, { jalur: "/", cookie: penerima, kunci: null, body: { fotoId } }))).toMatchObject({ beratKgTeks: null, keyakinan: "RENDAH" });
  });
});

describe("TUTUP", () => {
  it("DIANGKUT → DITERIMA_SEBAGIAN: tiket & rincian tercatat, notifikasi, tanpa peringatan R-08", async () => {
    const kode = await serahSampai("DIANGKUT");
    const body = { tiket: tiketManual(20_000), rincian: [{ aliran: "KUNING", diterimaG: 15_000, ditolakG: 5_000, alasan: "TERCAMPUR_ORGANIK", keterangan: "Ada sisa makanan" }] };
    const kunci = randomUUID();
    const h = await tutupDengan(kode, body, penerima, kunci);
    expect(data(h)).toEqual({ kode, status: "DITERIMA_SEBAGIAN", versi: 4, peringatan: [] });
    expect((await tutupDengan(kode, body, penerima, kunci)).json).toEqual(h.json);
    const r = await satu<{ diterima_g: number; ditolak_g: number; alasan: string; berat_g: number; sumber: string }>(
      `SELECT r.diterima_g, r.ditolak_g, r.alasan::text, t.berat_g, t.sumber::text FROM serah s
       JOIN penutupan_rincian r ON r.serah_id = s.id JOIN tiket_timbang t ON t.serah_id = s.id WHERE s.kode = $1`,
      [kode],
    );
    expect(r).toEqual({ diterima_g: 15_000, ditolak_g: 5_000, alasan: "TERCAMPUR_ORGANIK", berat_g: 20_000, sumber: "MANUAL" });
    const n = await semua<{ organisasi_id: string }>(`SELECT organisasi_id FROM notifikasi WHERE objek_kode = $1 AND jenis = 'SERAH_DITUTUP'`, [kode]);
    expect(n.map((x) => x.organisasi_id).sort()).toEqual([d.org.kawasan, d.org.pengangkut].sort());
  });

  it("R-08: selisih tiket 50% dari Σ TPS → peringatan dengan teks, tidak menolak", async () => {
    const kode = await serahSampai("DIANGKUT");
    const h = await tutupDengan(kode, { tiket: tiketManual(30_000), rincian: [{ aliran: "KUNING", diterimaG: 30_000, ditolakG: 0 }] });
    expect(data(h)).toMatchObject({
      status: "DITERIMA",
      peringatan: [{ kode: "R08", aksi: "PERINGATAN", teks: isi("ATURAN_R08", { berat_tiket: "30", persen: "50", berat_tps: "20" }) }],
    });
  });

  it("Σ tidak sama dengan tiket → 400 dengan teks P1_JUMLAH_TIDAK_SAMA; status tetap DIANGKUT", async () => {
    const kode = await serahSampai("DIANGKUT");
    const h = await tutupDengan(kode, { tiket: tiketManual(20_000), rincian: [{ aliran: "KUNING", diterimaG: 19_999, ditolakG: 0 }] });
    expect(h.status).toBe(400);
    expect(h.json.galat?.pesan).toBe(isi("P1_JUMLAH_TIDAK_SAMA", { berat_tiket: "20" }));
    expect((await satu<{ status: string }>(`SELECT status::text FROM serah WHERE kode = $1`, [kode])).status).toBe("DIANGKUT");
  });

  it("tolak penuh: alasan & Σditolak = tiket → DITOLAK", async () => {
    const kode = await serahSampai("DIANGKUT");
    const kurang = await tutupDengan(kode, { tiket: tiketManual(20_000), rincian: [{ aliran: "KUNING", diterimaG: 0, ditolakG: 15_000, alasan: "BASAH_KOTOR" }] });
    expect(kurang.status).toBe(400);
    const h = await tutupDengan(kode, { tiket: tiketManual(20_000), rincian: [{ aliran: "KUNING", diterimaG: 0, ditolakG: 20_000, alasan: "BASAH_KOTOR" }] });
    expect(data(h)).toMatchObject({ status: "DITOLAK" });
  });

  it("asal tiket jujur: MANUAL dengan jejak AI → 400; penerima yang bukan tujuan → 404", async () => {
    const kode = await serahSampai("DIANGKUT");
    const palsu = await tutupDengan(kode, { tiket: { ...tiketManual(20_000), aiModel: "x" }, rincian: [{ aliran: "KUNING", diterimaG: 20_000, ditolakG: 0 }] });
    expect(palsu.status).toBe(400);
    const lain = await tutupDengan(kode, { tiket: tiketManual(20_000), rincian: [{ aliran: "KUNING", diterimaG: 20_000, ditolakG: 0 }] }, penerimaLain);
    expect(lain.status).toBe(404);
  });

  it("dua penutupan bersamaan → satu sukses, satu ditolak (KONFLIK_VERSI / TRANSISI_TIDAK_SAH)", async () => {
    const kode = await serahSampai("DIANGKUT");
    const body = { tiket: tiketManual(20_000), rincian: [{ aliran: "KUNING", diterimaG: 20_000, ditolakG: 0 }] };
    const hasil = await Promise.all([tutupDengan(kode, body), tutupDengan(kode, body)]);
    expect(hasil.map((h) => h.status).sort()).toEqual([200, 409]);
    expect(Number((await satu<{ n: string }>(`SELECT count(*) AS n FROM tiket_timbang t JOIN serah s ON s.id = t.serah_id WHERE s.kode = $1`, [kode])).n)).toBe(1);
  });
});

describe("T16 — koreksi menyimpan nilai asli; nilai final lewat view", () => {
  it("koreksi tiket + rincian bersama: baris asli tetap, view & detail memberi nilai final, event KOREKSI_BERAT", async () => {
    const kode = await serahSampai("DIANGKUT");
    data(await tutupDengan(kode, { tiket: tiketManual(20_000), rincian: [{ aliran: "KUNING", diterimaG: 20_000, ditolakG: 0 }] }));
    const ids = await satu<{ tiket: string; rincian: string }>(
      `SELECT t.id AS tiket, r.id AS rincian FROM serah s JOIN tiket_timbang t ON t.serah_id = s.id JOIN penutupan_rincian r ON r.serah_id = s.id WHERE s.kode = $1`,
      [kode],
    );

    const tunggal = await panggil(koreksi, { jalur: "/", cookie: penerima, params: { kode }, body: { alasan: "Salah baca tiket", perubahan: [{ target: "TIKET", targetId: ids.tiket, nilaiFinalG: 21_000 }] } });
    expect(tunggal.status).toBe(400);

    const h = await panggil(koreksi, {
      jalur: "/",
      cookie: penerima,
      params: { kode },
      body: {
        alasan: "Salah baca tiket",
        perubahan: [
          { target: "TIKET", targetId: ids.tiket, nilaiFinalG: 21_000 },
          { target: "RINCIAN_DITERIMA", targetId: ids.rincian, nilaiFinalG: 21_000 },
        ],
      },
    });
    const isiH = data<{ status: string; versi: number; nilaiAsliG: number; nilaiFinalG: number; koreksi: { target: string; nilaiAsliG: number; nilaiFinalG: number }[] }>(h);
    expect(isiH).toMatchObject({ status: "DITERIMA", versi: 5, nilaiAsliG: 20_000, nilaiFinalG: 21_000 });
    expect(isiH.koreksi.map((k) => [k.target, k.nilaiAsliG, k.nilaiFinalG])).toEqual([
      ["TIKET", 20_000, 21_000],
      ["RINCIAN_DITERIMA", 20_000, 21_000],
    ]);

    // Nilai asli tidak pernah berubah (🔒); view memberi nilai final.
    expect((await satu<{ berat_g: number }>(`SELECT berat_g FROM tiket_timbang WHERE id = $1`, [ids.tiket])).berat_g).toBe(20_000);
    expect((await satu<{ diterima_g: number }>(`SELECT diterima_g FROM penutupan_rincian WHERE id = $1`, [ids.rincian])).diterima_g).toBe(20_000);
    const v = await semua<{ target_jenis: string; nilai_asli_g: number; nilai_final_g: number; jumlah_koreksi: number }>(
      `SELECT target_jenis::text, nilai_asli_g, nilai_final_g, jumlah_koreksi FROM v_nilai_final WHERE target_id = ANY($1) ORDER BY target_jenis`,
      [[ids.tiket, ids.rincian]],
    );
    expect(v).toEqual([
      { target_jenis: "RINCIAN_DITERIMA", nilai_asli_g: 20_000, nilai_final_g: 21_000, jumlah_koreksi: 1 },
      { target_jenis: "RINCIAN_DITOLAK", nilai_asli_g: 0, nilai_final_g: 0, jumlah_koreksi: 0 },
      { target_jenis: "TIKET", nilai_asli_g: 20_000, nilai_final_g: 21_000, jumlah_koreksi: 1 },
    ]);
    const det = data<{ tiket: { beratG: number; beratFinalG: number }; rincian: { diterimaG: number; diterimaFinalG: number }[]; timeline: { jenis: string }[] }>(
      await panggil(detail, { jalur: "/", cookie: penerima, params: { kode } }),
    );
    expect(det.tiket).toMatchObject({ beratG: 20_000, beratFinalG: 21_000 });
    expect(det.rincian[0]).toMatchObject({ diterimaG: 20_000, diterimaFinalG: 21_000 });
    expect(det.timeline.map((e) => e.jenis)).toEqual(["SERAH_DIBUAT", "SERAH_DIAMBIL", "SERAH_DISETUJUI", "SERAH_DITERIMA", "KOREKSI_BERAT"]);
  });
});
