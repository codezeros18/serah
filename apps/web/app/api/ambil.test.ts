import { randomUUID } from "node:crypto";
import { TEKS, isi } from "@serah/kontrak";
import { beforeAll, describe, expect, it } from "vitest";
import { bacaObjekLokal } from "@/lib/server/integrasi";
import { data, demo, denganPemilik, formFoto, jpegContoh, masuk, panggil, pngContoh, satu, type DemoS08 } from "@/lib/server/uji/klien";
import { GET as daftarAmbil } from "./ambil/route";
import { GET as berkasFoto } from "./foto/berkas/route";
import { POST as unggah } from "./foto/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { GET as detail } from "./serah/[kode]/route";
import { POST as buatSerah } from "./serah/route";
import { POST as catatWadah } from "./wadah/route";

// S08-3 — integrasi T01–T04: foto MUATAN (metadata dibuang, R-04), daftar ambil, AMBIL dengan aturan berpasal.

let d: DemoS08;
let petugas: string;
let pengangkut: string;
let penerima: string;

beforeAll(async () => {
  d = await demo();
  petugas = await masuk("PETUGAS");
  pengangkut = await masuk("PENGANGKUT");
  penerima = await masuk("PENERIMA");
  // Kontrak uji (tabel bukan catat-saja): ABU → Daur Ulang (penerima tidak menerima ABU → R-03 saja),
  // KUNING → Pelapak Contoh Baru AKTIF (izin MENUNGGU → R-11 saja).
  await denganPemilik(async (k) => {
    for (const [penerimaId, aliran] of [
      [d.org.daurUlang, "ABU"],
      [d.org.pelapakBaru, "KUNING"],
    ] as const) {
      const ada = await k.query(`SELECT 1 FROM kontrak WHERE org_penerima_id = $1 AND status = 'AKTIF' AND $2 = ANY(aliran::text[])`, [penerimaId, aliran]);
      if (ada.rowCount) continue;
      await k.query(
        `INSERT INTO kontrak (id, kawasan_id, org_kawasan_id, org_pengangkut_id, org_penerima_id, aliran, berlaku_dari, berlaku_sampai, status, dibuat_pada)
         VALUES ($1, $2, $3, $4, $5, ARRAY[$6]::"Aliran"[], current_date - 30, current_date + 365, 'AKTIF', now())`,
        [`ujis08ktr${randomUUID().replaceAll("-", "").slice(0, 15)}`, d.kawasan, d.org.kawasan, d.org.pengangkut, penerimaId, aliran],
      );
    }
  });
});

async function serahBaru(aliran: string[]): Promise<string> {
  const ids: string[] = [];
  for (const a of aliran) {
    const w = await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps1, aliran: a, beratG: 10_000, terjadiPada: new Date().toISOString() } });
    ids.push(data<{ id: string }>(w).id);
  }
  return data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: ids } })).kode;
}

const fotoMuatan = async (kode: string, benih: string = randomUUID()) =>
  panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(benih), "image/png", kode) });

async function ambilKe(kode: string, penerimaId: string) {
  const fotoId = data<{ fotoId: string }>(await fotoMuatan(kode)).fotoId;
  return panggil(ambil, { jalur: `/api/serah/${kode}/ambil`, cookie: pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId } });
}

describe("POST /api/foto", () => {
  it("PNG: metadata (tEXt, eXIf) dibuang sebelum disimpan; dHash 16 hex; foto terkait serah", async () => {
    const kode = await serahBaru(["KUNING"]);
    const h = await fotoMuatan(kode, `png-bersih-${randomUUID()}`);
    expect(h.status).toBe(200);
    const { fotoId, dhash } = data<{ fotoId: string; dhash: string }>(h);
    expect(dhash).toMatch(/^[0-9a-f]{16}$/);
    const f = await satu<{ object_key: string; lebar: number; tinggi: number; serah_kode: string }>(
      `SELECT f.object_key, f.lebar, f.tinggi, s.kode AS serah_kode FROM foto f JOIN serah s ON s.id = f.serah_id WHERE f.id = $1`,
      [fotoId],
    );
    expect(f).toMatchObject({ lebar: 4, tinggi: 3, serah_kode: kode });
    const tersimpan = new TextDecoder("latin1").decode((await bacaObjekLokal(f.object_key)) ?? new Uint8Array());
    expect(tersimpan).toContain("IDAT");
    expect(tersimpan).not.toContain("Nama Orang Rahasia");
    expect(tersimpan).not.toContain("GPSLatitude");
  });

  it("JPEG: APP1 (EXIF/GPS) & komentar dibuang, ukuran dari SOF", async () => {
    const kode = await serahBaru(["KUNING"]);
    const h = await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", jpegContoh(randomUUID()), "image/jpeg", kode) });
    const f = await satu<{ object_key: string; lebar: number; tinggi: number }>(`SELECT object_key, lebar, tinggi FROM foto WHERE id = $1`, [data<{ fotoId: string }>(h).fotoId]);
    expect(f).toMatchObject({ lebar: 8, tinggi: 6 });
    const tersimpan = new TextDecoder("latin1").decode((await bacaObjekLokal(f.object_key)) ?? new Uint8Array());
    expect(tersimpan).not.toContain("GPSLatitude");
    expect(tersimpan).not.toContain("komentar kamera");
  });

  it("T04 integrasi: foto MUATAN identik → R-04 ditolak dengan teks berkode serah; foto berbeda lolos", async () => {
    const a = await serahBaru(["KUNING"]);
    const b = await serahBaru(["KUNING"]);
    const benih = `identik-${randomUUID()}`;
    expect((await fotoMuatan(a, benih)).status).toBe(200);
    const ulang = await fotoMuatan(b, benih);
    expect(ulang.status).toBe(422);
    expect(ulang.json.galat?.aturan).toEqual({ kode: "R04", aksi: "TOLAK", teks: isi("ATURAN_R04", { kode_serah: a }) });
    expect((await fotoMuatan(b, `berbeda-${randomUUID()}`)).status).toBe(200);
  });

  it("MUATAN tanpa serahKode → 400; MUATAN oleh petugas → 403; berkas bukan gambar → 400", async () => {
    expect((await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh("x"), "image/png") })).status).toBe(400);
    const kode = await serahBaru(["KUNING"]);
    expect((await panggil(unggah, { jalur: "/api/foto", cookie: petugas, kunci: null, form: formFoto("MUATAN", pngContoh("y"), "image/png", kode) })).status).toBe(403);
    const palsu = new TextEncoder().encode("bukan gambar sama sekali");
    expect((await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", palsu, "image/png", kode) })).status).toBe(400);
  });
});

describe("GET /api/ambil", () => {
  it("pengangkut melihat serah DRAF baru beserta aliran & umur; penerima → 403", async () => {
    const kode = await serahBaru(["KUNING", "ABU"]);
    const h = data<{ serah: { kode: string; aliran: string[]; umurJamTertua: number; tps: { kode: string } }[] }>(await panggil(daftarAmbil, { jalur: "/api/ambil", cookie: pengangkut }));
    expect(h.serah.find((s) => s.kode === kode)).toMatchObject({ aliran: ["KUNING", "ABU"], umurJamTertua: 0, tps: { kode: "TPS-PCS-01" } });
    expect((await panggil(daftarAmbil, { jalur: "/api/ambil", cookie: penerima })).status).toBe(403);
  });
});

describe("POST /api/serah/[kode]/ambil — T01–T03 & R-11 integrasi", () => {
  it("sukses: DRAF → MENUNGGU_SETUJU; kontrak berlaku tercatat; notifikasi ke pengelola; replay sama", async () => {
    const kode = await serahBaru(["KUNING"]);
    const fotoId = data<{ fotoId: string }>(await fotoMuatan(kode)).fotoId;
    const kunci = randomUUID();
    const body = { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang };
    const h = await panggil(ambil, { jalur: `/api/serah/${kode}/ambil`, cookie: pengangkut, kunci, params: { kode }, body });
    expect(h.status).toBe(200);
    expect(data(h)).toEqual({ kode, status: "MENUNGGU_SETUJU", versi: 2 });
    const ulang = await panggil(ambil, { jalur: `/api/serah/${kode}/ambil`, cookie: pengangkut, kunci, params: { kode }, body });
    expect(ulang.json).toEqual(h.json);
    expect(ulang.header.get("idempotent-replay")).toBe("true");
    const s = await satu<{ org_pengangkut_id: string; org_penerima_id: string; kendaraan_id: string; kontrak_id: string | null }>(
      `SELECT org_pengangkut_id, org_penerima_id, kendaraan_id, kontrak_id FROM serah WHERE kode = $1`,
      [kode],
    );
    expect(s).toMatchObject({ org_pengangkut_id: d.org.pengangkut, org_penerima_id: d.org.daurUlang, kendaraan_id: d.kendaraan });
    expect(s.kontrak_id).not.toBeNull();
    const n = await satu<{ n: string }>(`SELECT count(*) AS n FROM notifikasi WHERE objek_kode = $1 AND jenis = 'SERAH_MENUNGGU_SETUJU'`, [kode]);
    expect(Number(n.n)).toBe(1);
    // Pengangkut tidak bisa mengambil dua kali (sinkron tak berurutan → TRANSISI_TIDAK_SAH).
    const lagi = await panggil(ambil, { jalur: `/api/serah/${kode}/ambil`, cookie: pengangkut, params: { kode }, body });
    expect(lagi.status).toBe(409);
    expect(lagi.json.galat?.kode).toBe("TRANSISI_TIDAK_SAH");
  });

  it("T01: KUNING ke TPA/TPST → R-01 dengan teks Pergub", async () => {
    const kode = await serahBaru(["KUNING"]);
    const h = await ambilKe(kode, d.org.tpst);
    expect(h.status).toBe(422);
    expect(h.json.galat).toMatchObject({ kode: "ATURAN_DITOLAK", pesan: TEKS.ATURAN_JUDUL_TOLAK });
    expect(h.json.galat?.aturan).toEqual({ kode: "R01", aksi: "TOLAK", teks: isi("ATURAN_R01", { aliran: TEKS.ALIRAN_KUNING }) });
    expect((await satu<{ status: string }>(`SELECT status::text FROM serah WHERE kode = $1`, [kode])).status).toBe("DRAF");
  });

  it("T02: kontrak tidak mencakup aliran → R-02", async () => {
    const kode = await serahBaru(["KUNING", "HIJAU"]);
    const h = await ambilKe(kode, d.org.daurUlang);
    expect(h.json.galat?.aturan).toEqual({ kode: "R02", aksi: "TOLAK", teks: isi("ATURAN_R02", { aliran: TEKS.ALIRAN_HIJAU }) });
  });

  it("T03: penerima tidak menerima aliran (walau berkontrak) → R-03", async () => {
    const kode = await serahBaru(["ABU"]);
    const h = await ambilKe(kode, d.org.daurUlang);
    expect(h.json.galat?.aturan).toEqual({ kode: "R03", aksi: "TOLAK", teks: isi("ATURAN_R03", { aliran: TEKS.ALIRAN_ABU }) });
  });

  it("R-11: penerima berizin MENUNGGU (kontrak AKTIF) → R-11", async () => {
    const kode = await serahBaru(["KUNING"]);
    const h = await ambilKe(kode, d.org.pelapakBaru);
    expect(h.json.galat?.aturan).toEqual({ kode: "R11", aksi: "TOLAK", teks: isi("ATURAN_R11") });
  });

  it("foto bukan milik serah ini → VALIDASI_GAGAL; kendaraan orang lain tidak terlihat → VALIDASI_GAGAL", async () => {
    const a = await serahBaru(["KUNING"]);
    const b = await serahBaru(["KUNING"]);
    const fotoA = data<{ fotoId: string }>(await fotoMuatan(a)).fotoId;
    const h = await panggil(ambil, { jalur: `/api/serah/${b}/ambil`, cookie: pengangkut, params: { kode: b }, body: { fotoId: fotoA, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } });
    expect(h.status).toBe(400);
    const fotoB = data<{ fotoId: string }>(await fotoMuatan(b)).fotoId;
    const k = await panggil(ambil, { jalur: `/api/serah/${b}/ambil`, cookie: pengangkut, params: { kode: b }, body: { fotoId: fotoB, kendaraanId: "tz4a98xxat96iws9zmbrgj3a", penerimaId: d.org.daurUlang } });
    expect(k.status).toBe(400);
  });
});

describe("URL foto bertanda tangan (5 menit)", () => {
  it("URL dari detail serah menyajikan foto bersih; tanda diubah → 404", async () => {
    const kode = await serahBaru(["KUNING"]);
    await fotoMuatan(kode, `untuk-url-${randomUUID()}`);
    const det = data<{ foto: { url: string; kedaluwarsaPada: string }[] }>(await panggil(detail, { jalur: `/api/serah/${kode}`, cookie: pengangkut, params: { kode } }));
    expect(det.foto).toHaveLength(1);
    const u = new URL(det.foto[0]!.url);
    const sisaMs = new Date(det.foto[0]!.kedaluwarsaPada).getTime() - Date.now();
    expect(sisaMs).toBeGreaterThan(4 * 60_000);
    expect(sisaMs).toBeLessThanOrEqual(5 * 60_000);
    const r = await berkasFoto(new Request(u));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    u.searchParams.set("t", "tanda-palsu");
    expect((await berkasFoto(new Request(u))).status).toBe(404);
    u.searchParams.set("e", "1");
    expect((await berkasFoto(new Request(u))).status).toBe(404);
  });
});
