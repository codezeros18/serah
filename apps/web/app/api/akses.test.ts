import { randomUUID } from "node:crypto";
import { TEKS } from "@serah/kontrak";
import { beforeAll, describe, expect, it } from "vitest";
import { data, demo, denganPemilik, formFoto, masuk, panggil, pngContoh, type DemoS08 } from "@/lib/server/uji/klien";
import { GET as cuaca } from "./cuaca/[adm4]/route";
import { POST as unggah } from "./foto/route";
import { GET as verifikasiRantai } from "./rantai/verifikasi/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { GET as detail } from "./serah/[kode]/route";
import { GET as daftarSerah, POST as buatSerah } from "./serah/route";
import { GET as prioritas } from "./tps/[id]/prioritas/route";
import { POST as catatWadah } from "./wadah/route";

// S08-6 — baca: detail/daftar serah, verifikasi rantai, cuaca, prioritas. Pihak tidak terkait → 404 (bukan 403).

let d: DemoS08;
let petugas: string;
let pengangkut: string;
let penerima: string;
let penerimaLain: string;
let penerimaAsing: string;
let kode: string;

const JAM = 3_600_000;

beforeAll(async () => {
  d = await demo();
  [petugas, pengangkut, penerima] = await Promise.all([masuk("PETUGAS"), masuk("PENGANGKUT"), masuk("PENERIMA")]);
  penerimaLain = await masuk("PENERIMA", d.org.tpst);
  // Organisasi penerima tanpa kontrak apa pun dengan kawasan demo.
  const asing = await denganPemilik(async (k) => {
    const r = await k.query<{ id: string }>(`SELECT id FROM organisasi WHERE kode = 'ORG-UJI-ASING'`);
    if (r.rows[0]) return r.rows[0].id;
    const id = `ujis08org${randomUUID().replaceAll("-", "").slice(0, 15)}`;
    await k.query(
      `INSERT INTO organisasi (id, kode, nama, jenis, jenis_penerima, aliran_diterima, status_izin, yurisdiksi, demo, dibuat_pada)
       VALUES ($1, 'ORG-UJI-ASING', 'Penerima Uji Tanpa Kontrak', 'PENERIMA', 'FASILITAS_BERIZIN', ARRAY['KUNING']::"Aliran"[], 'TERVERIFIKASI', 'DKI', false, now())`,
      [id],
    );
    return id;
  });
  penerimaAsing = await masuk("PENERIMA", asing);

  const w = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: 8_000, terjadiPada: new Date().toISOString() } }));
  kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: [w.id] } })).kode;
  const fotoId = data<{ fotoId: string }>(
    await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) }),
  ).fotoId;
  data(await panggil(ambil, { jalur: "/", cookie: pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }));
});

describe("GET /api/serah/[kode] & /api/serah", () => {
  it("pihak serah (petugas, pengangkut, penerima tujuan) melihat detail lengkap", async () => {
    for (const c of [petugas, pengangkut, penerima]) {
      const h = await panggil(detail, { jalur: "/", cookie: c, params: { kode } });
      expect(h.status).toBe(200);
      expect(data(h)).toMatchObject({
        kode,
        status: "MENUNGGU_SETUJU",
        tps: { kode: "TPS-PCS-01" },
        pengangkut: { nama: "Angkut Contoh Bersih" },
        penerima: { nama: "Daur Ulang Contoh Mandiri" },
        kendaraan: { plat: "B 9001 SRH" },
        aliran: ["KUNING"],
      });
    }
    const det = data<{ timeline: { jenis: string; hash: string }[]; foto: unknown[]; tiket: null; rincian: [] }>(await panggil(detail, { jalur: "/", cookie: penerima, params: { kode } }));
    expect(det.timeline.map((e) => e.jenis)).toEqual(["SERAH_DIBUAT", "SERAH_DIAMBIL"]);
    expect(det.timeline.every((e) => /^[0-9a-f]{64}$/.test(e.hash))).toBe(true);
    expect(det.foto).toHaveLength(1);
    expect(det.tiket).toBeNull();
  });

  it("penerima lain (berkontrak dengan kawasan, bukan tujuan) & penerima asing → 404, tidak muncul di daftar", async () => {
    for (const c of [penerimaLain, penerimaAsing]) {
      const h = await panggil(detail, { jalur: "/", cookie: c, params: { kode } });
      expect(h.status).toBe(404);
      expect(h.json.galat?.pesan).toBe(TEKS.G_TIDAK_DITEMUKAN);
      const daftar = data<{ serah: { kode: string }[] }>(await panggil(daftarSerah, { jalur: "/api/serah", cookie: c }));
      expect(daftar.serah.map((s) => s.kode)).not.toContain(kode);
    }
  });

  it("kode tidak ada → 404; kode salah format → 400", async () => {
    expect((await panggil(detail, { jalur: "/", cookie: petugas, params: { kode: "SRH-20991231-9999" } })).status).toBe(404);
    expect((await panggil(detail, { jalur: "/", cookie: petugas, params: { kode: "bukan-kode" } })).status).toBe(400);
  });
});

describe("GET /api/rantai/verifikasi", () => {
  it("pihak terkait kawasan: utuh, jumlah > 0, tanpa isi event", async () => {
    for (const c of [petugas, pengangkut, penerima]) {
      const h = data<Record<string, unknown>>(await panggil(verifikasiRantai, { jalur: `/api/rantai/verifikasi?kawasanId=${d.kawasan}`, cookie: c }));
      expect(Object.keys(h).sort()).toEqual(["jumlah", "patahDiUrutan", "utuh"]);
      expect(h).toMatchObject({ utuh: true, patahDiUrutan: null });
      expect(h.jumlah).toBeGreaterThan(0);
    }
  });
  it("organisasi tanpa hubungan dengan kawasan → 404", async () => {
    expect((await panggil(verifikasiRantai, { jalur: `/api/rantai/verifikasi?kawasanId=${d.kawasan}`, cookie: penerimaAsing })).status).toBe(404);
  });
});

describe("GET /api/cuaca/[adm4] & /api/tps/[id]/prioritas (R-10 dari data tersimpan)", () => {
  beforeAll(async () => {
    // Snapshot prakiraan uji (tabel 🔒 global: hanya INSERT): analisis 1 jam lalu, slot hujan lebat 2 jam lagi.
    await denganPemilik(async (k) => {
      const analisis = new Date(Math.floor((Date.now() - JAM) / 1000) * 1000);
      for (const [jam, desc] of [[2, "Hujan Lebat"], [5, "Berawan"]] as const) {
        await k.query(
          `INSERT INTO prakiraan_cuaca (id, adm4, analysis_date, slot_utc, weather_desc, weather_desc_en, mode, diambil_pada)
           VALUES ($1, '31.71.03.1001', $2, $3, $4, NULL, 'SNAPSHOT', now()) ON CONFLICT DO NOTHING`,
          [`ujis08cuaca${randomUUID().replaceAll("-", "").slice(0, 13)}`, analisis, new Date(analisis.getTime() + (jam + 1) * JAM), desc],
        );
      }
    });
    // Wadah ABU berumur 30 jam belum diserahkan (waktu perangkat boleh lampau).
    data(await panggil(catatWadah, { jalur: "/api/wadah", cookie: petugas, body: { tpsId: d.tps2, aliran: "ABU", beratG: 9_000, terjadiPada: new Date(Date.now() - 30 * JAM).toISOString() } }));
  });

  it("cuaca: mode SNAPSHOT, tidak basi; adm4 tanpa data → 503 BMKG_TIDAK_TERSEDIA", async () => {
    const h = data<{ mode: string; basi: boolean; slot: { weatherDesc: string }[] }>(await panggil(cuaca, { jalur: "/", cookie: petugas, params: { adm4: "31.71.03.1001" } }));
    expect(h).toMatchObject({ mode: "SNAPSHOT", basi: false });
    expect(h.slot.map((s) => s.weatherDesc)).toContain("Hujan Lebat");
    const kosong = await panggil(cuaca, { jalur: "/", cookie: petugas, params: { adm4: "99.99.99.9999" } });
    expect(kosong.status).toBe(503);
    expect(kosong.json.galat).toMatchObject({ kode: "BMKG_TIDAK_TERSEDIA", pesan: TEKS.G_BMKG_MATI });
  });

  it("prioritas: hujan lebat ≤6 j + wadah ABU ≥24 j → PRAKIRAAN dengan R10_CATATAN; penerima → 403", async () => {
    const h = data<{ prioritas: { sumber: string; teks: string; catatan: string; umurJam: number } | null }>(
      await panggil(prioritas, { jalur: "/", cookie: pengangkut, params: { id: d.tps2 } }),
    );
    expect(h.prioritas).toMatchObject({ sumber: "PRAKIRAAN", catatan: TEKS.R10_CATATAN });
    expect(h.prioritas?.teks).toContain("Hujan Lebat");
    expect(h.prioritas?.umurJam).toBeGreaterThanOrEqual(30);
    expect((await panggil(prioritas, { jalur: "/", cookie: penerima, params: { id: d.tps2 } })).status).toBe(403);
  });
});
