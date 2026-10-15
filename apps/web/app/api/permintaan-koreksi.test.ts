import { randomUUID } from "node:crypto";
import { TEKS, isi } from "@serah/kontrak";
import { beforeAll, describe, expect, it } from "vitest";
import { data, demo, masuk, panggil, satu, semua, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as ajukan, GET as daftar } from "./permintaan-koreksi/route";
import { POST as putus } from "./permintaan-koreksi/[id]/putus/route";
import { GET as rantai } from "./rantai/verifikasi/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { POST as catatWadah } from "./wadah/route";

// S16 — permintaan koreksi: T26 (disetujui → baris koreksi + event, nilai asli tetap), matriks pengaju/pemutus, notifikasi.

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

async function wadahBaru(beratG = 12_000): Promise<string> {
  const w = await panggil(catatWadah, {
    jalur: "/api/wadah",
    cookie: petugas,
    body: { tpsId: d.tps1, aliran: "KUNING", beratG, terjadiPada: new Date().toISOString() },
  });
  return data<{ id: string }>(w).id;
}

const ajukanBody = (targetJenis: string, targetId: string, nilaiUsulanG: number, alasan = "Salah timbang di TPS") => ({ targetJenis, targetId, nilaiUsulanG, alasan });
const ajukanOleh = (cookie: string, body: unknown, kunci?: string) => panggil(ajukan, { jalur: "/api/permintaan-koreksi", cookie, body, kunci });
const putusOleh = (cookie: string, id: string, body: unknown, kunci?: string) => panggil(putus, { jalur: "/", cookie, params: { id }, body, kunci });

describe("T26 — permintaan koreksi WADAH disetujui pengelola", () => {
  it("diajukan petugas → notifikasi ke pengelola → disetujui: baris koreksi (nilai asli tetap) + event berantai, serah tak berubah", async () => {
    const wadahId = await wadahBaru(12_000);
    const sebelum = await satu<{ n: string }>(`SELECT count(*) AS n FROM event WHERE kawasan_id = (SELECT kawasan_id FROM wadah_catat WHERE id = $1)`, [wadahId]);

    const kunci = randomUUID();
    const h = await ajukanOleh(petugas, ajukanBody("WADAH", wadahId, 9_500), kunci);
    const { id, kode } = data<{ id: string; kode: string }>(h);
    expect(kode).toMatch(/^PKR-\d{8}-\d{3}$/);
    // Kiriman ganda dengan kunci sama → respons sama, satu permintaan.
    expect((await ajukanOleh(petugas, ajukanBody("WADAH", wadahId, 9_500), kunci)).json).toEqual(h.json);
    const jumlah = await satu<{ n: string }>(`SELECT count(*) AS n FROM permintaan_koreksi WHERE target_id = $1`, [wadahId]);
    expect(Number(jumlah.n)).toBe(1);

    // Notifikasi PERMINTAAN_KOREKSI ke organisasi pemutus (kawasan → peran pengelola).
    const n = await semua<{ organisasi_id: string; peran_tujuan: string[]; data: { kode: string } }>(
      `SELECT organisasi_id, peran_tujuan::text[] AS peran_tujuan, data FROM notifikasi WHERE objek_kode = $1 AND jenis = 'PERMINTAAN_KOREKSI'`,
      [kode],
    );
    expect(n.map((x) => x.organisasi_id)).toEqual([d.org.kawasan]);
    expect(n[0]?.peran_tujuan).toEqual(["PENGELOLA"]);
    expect(isi("NTF_PERMINTAAN_KOREKSI", n[0]!.data as { kode: string })).toBe(`Permintaan koreksi ${kode} menunggu keputusan.`);

    // Daftar: terlihat oleh kawasan, status DIAJUKAN, nilai asli = catatan awal.
    const lst = data<{ permintaan: { kode: string; status: string; nilaiAsliG: number; nilaiUsulanG: number }[] }>(
      await panggil(daftar, { jalur: "/api/permintaan-koreksi?status=DIAJUKAN", cookie: pengelola }),
    );
    expect(lst.permintaan.find((p) => p.kode === kode)).toMatchObject({ status: "DIAJUKAN", nilaiAsliG: 12_000, nilaiUsulanG: 9_500 });

    // Disetujui oleh pengelola.
    const p = await putusOleh(pengelola, id, { keputusan: "DISETUJUI", alasan: "Sudah ditimbang ulang" });
    expect(data<{ permintaan: { status: string; putusan: { keputusan: string; peran: string } } }>(p).permintaan).toMatchObject({
      status: "DISETUJUI",
      putusan: { keputusan: "DISETUJUI", peran: "PENGELOLA" },
    });

    // Baris koreksi baru: nilai asli = nilai final saat itu; catatan awal wadah TIDAK berubah.
    const k = await satu<{ nilai_asli_g: number; nilai_final_g: number; permintaan_id: string; peran: string }>(
      `SELECT nilai_asli_g, nilai_final_g, permintaan_id, peran::text FROM koreksi WHERE target_id = $1`,
      [wadahId],
    );
    expect(k).toEqual({ nilai_asli_g: 12_000, nilai_final_g: 9_500, permintaan_id: id, peran: "PENGELOLA" });
    const w = await satu<{ berat_g: number }>(`SELECT berat_g FROM wadah_catat WHERE id = $1`, [wadahId]);
    expect(w.berat_g).toBe(12_000);
    const v = await satu<{ nilai_asli_g: number; nilai_final_g: number }>(`SELECT nilai_asli_g, nilai_final_g FROM v_nilai_final WHERE target_id = $1`, [wadahId]);
    expect(v).toEqual({ nilai_asli_g: 12_000, nilai_final_g: 9_500 });

    // Dua event baru (diajukan + disetujui) di rantai kawasan yang sama, berantai.
    const ev = await semua<{ jenis: string; urutan_rantai: string }>(
      `SELECT jenis::text, urutan_rantai::text FROM event WHERE kawasan_id = (SELECT kawasan_id FROM wadah_catat WHERE id = $1) AND jenis::text LIKE 'PERMINTAAN_KOREKSI_%' ORDER BY urutan_rantai DESC LIMIT 2`,
      [wadahId],
    );
    expect(ev.map((e) => e.jenis).sort()).toEqual(["PERMINTAAN_KOREKSI_DIAJUKAN", "PERMINTAAN_KOREKSI_DISETUJUI"]);
    const sesudah = await satu<{ n: string }>(`SELECT count(*) AS n FROM event WHERE kawasan_id = (SELECT kawasan_id FROM wadah_catat WHERE id = $1)`, [wadahId]);
    expect(Number(sesudah.n) - Number(sebelum.n)).toBe(2);
    const kws = await satu<{ kawasan_id: string }>(`SELECT kawasan_id FROM wadah_catat WHERE id = $1`, [wadahId]);
    const utuh = await panggil(rantai, { jalur: `/api/rantai/verifikasi?kawasanId=${kws.kawasan_id}`, cookie: pengelola });
    expect(data<{ utuh: boolean }>(utuh).utuh).toBe(true);
  });

  it("ditolak: tanpa baris koreksi, event DITOLAK; putusan hanya sekali (409)", async () => {
    const wadahId = await wadahBaru(8_000);
    const { id } = data<{ id: string }>(await ajukanOleh(pengelola, ajukanBody("WADAH", wadahId, 7_000)));
    const h = await putusOleh(pengelola, id, { keputusan: "DITOLAK", alasan: "Nilai awal sudah benar" });
    expect(data<{ permintaan: { status: string } }>(h).permintaan.status).toBe("DITOLAK");
    const n = await satu<{ n: string }>(`SELECT count(*) AS n FROM koreksi WHERE target_id = $1`, [wadahId]);
    expect(Number(n.n)).toBe(0);
    const e = await satu<{ n: string }>(`SELECT count(*) AS n FROM event WHERE jenis = 'PERMINTAAN_KOREKSI_DITOLAK' AND payload->>'targetId' = $1`, [wadahId]);
    expect(Number(e.n)).toBe(1);
    const lagi = await putusOleh(pengelola, id, { keputusan: "DISETUJUI", alasan: "Berubah pikiran" });
    expect(lagi.status).toBe(409);
  });
});

describe("matriks pengaju dan pemutus (API)", () => {
  it("pengangkut tidak boleh mengajukan; petugas tidak boleh memutus; penerima tidak memutus WADAH", async () => {
    const wadahId = await wadahBaru();
    expect((await ajukanOleh(pengangkut, ajukanBody("WADAH", wadahId, 1_000))).status).toBe(403);
    const { id } = data<{ id: string }>(await ajukanOleh(petugas, ajukanBody("WADAH", wadahId, 1_000)));
    expect((await putusOleh(petugas, id, { keputusan: "DISETUJUI", alasan: "Setuju saja" })).status).toBe(403);
    expect((await putusOleh(penerima, id, { keputusan: "DISETUJUI", alasan: "Setuju saja" })).status).toBe(404);
  });

  it("penerima tidak dapat mengajukan koreksi WADAH (bukan targetnya)", async () => {
    const wadahId = await wadahBaru();
    const h = await ajukanOleh(penerima, ajukanBody("WADAH", wadahId, 2_000));
    expect([403, 404]).toContain(h.status);
  });

  it("validasi: nilai sama dengan nilai final ditolak; alasan kosong ditolak; field hasil hitung tak dikenal", async () => {
    const wadahId = await wadahBaru(5_000);
    expect((await ajukanOleh(petugas, ajukanBody("WADAH", wadahId, 5_000))).status).toBe(400);
    expect((await ajukanOleh(petugas, ajukanBody("WADAH", wadahId, 4_000, "   "))).status).toBe(400);
    const asing = await ajukanOleh(petugas, { ...ajukanBody("WADAH", wadahId, 4_000), nilaiAsliG: 5_000 });
    expect(asing.status).toBe(400);
    expect(asing.json.galat?.kode).toBe("FIELD_TIDAK_DIKENAL");
  });

  it("organisasi lain tidak melihat dan tidak dapat memutus", async () => {
    const wadahId = await wadahBaru();
    const { id, kode } = data<{ id: string; kode: string }>(await ajukanOleh(petugas, ajukanBody("WADAH", wadahId, 3_000)));
    const lst = data<{ permintaan: { kode: string }[] }>(await panggil(daftar, { jalur: "/api/permintaan-koreksi", cookie: penerimaLain }));
    expect(lst.permintaan.map((p) => p.kode)).not.toContain(kode);
    expect((await putusOleh(penerimaLain, id, { keputusan: "DISETUJUI", alasan: "Mencoba memutus" })).status).toBe(404);
  });
});

describe("TIKET/RINCIAN diputus penerima pemilik serah", () => {
  async function serahTertutup(): Promise<{ kode: string; tiketId: string; rincianId: string }> {
    const ids = [await wadahBaru(10_000), await wadahBaru(10_000)];
    const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: ids } })).kode;
    // Sampai DIANGKUT lewat jalur nyata dikerjakan test S08; di sini cukup mengatur status lewat pemilik DB.
    await satu(`UPDATE serah SET status = 'DIANGKUT', org_pengangkut_id = $2, org_penerima_id = $3, versi = versi + 1 WHERE kode = $1 RETURNING id`, [kode, d.org.pengangkut, d.org.daurUlang]);
    data(await panggil(tutup, { jalur: "/", cookie: penerima, params: { kode }, body: { tiket: { beratG: 20_000, sumber: "MANUAL", nomor: "TKT-PKR" }, rincian: [{ aliran: "KUNING", diterimaG: 20_000, ditolakG: 0 }] } }));
    const r = await satu<{ tiket: string; rincian: string }>(
      `SELECT t.id AS tiket, r.id AS rincian FROM serah s JOIN tiket_timbang t ON t.serah_id = s.id JOIN penutupan_rincian r ON r.serah_id = s.id WHERE s.kode = $1`,
      [kode],
    );
    return { kode, tiketId: r.tiket, rincianId: r.rincian };
  }

  it("pengelola mengajukan TIKET; yang memutus penerima (pengelola → 403); disetujui menambah koreksi + event, status serah tetap", async () => {
    const s = await serahTertutup();
    const { id, kode } = data<{ id: string; kode: string }>(await ajukanOleh(pengelola, ajukanBody("TIKET", s.tiketId, 21_000, "Tiket terbaca salah")));
    const n = await semua<{ organisasi_id: string }>(`SELECT organisasi_id FROM notifikasi WHERE objek_kode = $1 AND jenis = 'PERMINTAAN_KOREKSI'`, [kode]);
    expect(n.map((x) => x.organisasi_id)).toEqual([d.org.daurUlang]);

    expect((await putusOleh(pengelola, id, { keputusan: "DISETUJUI", alasan: "Saya setujui sendiri" })).status).toBe(403);
    expect((await putusOleh(penerimaLain, id, { keputusan: "DISETUJUI", alasan: "Penerima lain mencoba" })).status).toBe(404);

    const h = await putusOleh(penerima, id, { keputusan: "DISETUJUI", alasan: "Sesuai nota timbang" });
    expect(data<{ permintaan: { status: string } }>(h).permintaan.status).toBe("DISETUJUI");
    const k = await satu<{ nilai_asli_g: number; nilai_final_g: number; serah_id: string | null }>(
      `SELECT nilai_asli_g, nilai_final_g, serah_id FROM koreksi WHERE target_id = $1`,
      [s.tiketId],
    );
    expect(k).toMatchObject({ nilai_asli_g: 20_000, nilai_final_g: 21_000 });
    expect(k.serah_id).not.toBeNull();
    const st = await satu<{ status: string }>(`SELECT status::text FROM serah WHERE kode = $1`, [s.kode]);
    expect(st.status).toBe("DITERIMA");
    // Σ tidak konsisten (tiket 21 ≠ diterima 20) dicatat di event untuk jejak audit.
    const e = await satu<{ payload: { sigmaKonsisten: boolean; nilaiAsliG: number; nilaiFinalG: number } }>(
      `SELECT payload FROM event WHERE jenis = 'PERMINTAAN_KOREKSI_DISETUJUI' AND payload->>'targetId' = $1`,
      [s.tiketId],
    );
    expect(e.payload).toMatchObject({ sigmaKonsisten: false, nilaiAsliG: 20_000, nilaiFinalG: 21_000 });
  });

  it("alasan tolak wajib: rincian ditolak > 0 tanpa alasan baku tidak dapat diajukan", async () => {
    const s = await serahTertutup();
    const h = await ajukanOleh(penerima, ajukanBody("RINCIAN_DITOLAK", s.rincianId, 3_000));
    expect(h.status).toBe(400);
    expect(h.json.galat?.pesan).toBe(TEKS.G_VALIDASI);
  });

  it("serah yang belum tertutup tidak dapat dikoreksi lewat tiket/rincian", async () => {
    const wadahId = await wadahBaru();
    const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: petugas, body: { tpsId: d.tps1, wadahIds: [wadahId] } })).kode;
    expect(kode).toMatch(/^SRH-/);
    const h = await ajukanOleh(penerima, ajukanBody("TIKET", "z0000000000000000000000x", 1_000));
    expect(h.status).toBe(404);
  });
});
