import { TEKS } from "@serah/kontrak";
import { namaUnik } from "@/lib/server/uji/nama";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { denganAkses } from "@/lib/server/db";
import { GalatApi } from "@/lib/server/galat";
import { ubahKontrak } from "@/lib/server/layanan/kontrak";
import { konteksAkses } from "@/lib/server/sesi";
import { cookieDemo, orgBaru, type OrgUji } from "@/lib/server/uji/akun";
import { kueriPemilik } from "@/lib/server/uji/db";
import { permintaan } from "@/lib/server/uji/http";
import { POST as buatKawasan } from "./kawasan/route";
import { GET as daftarKontrak, POST as usulKontrak } from "./kontrak/route";
import { POST as akhiri } from "./kontrak/[id]/akhiri/route";
import { POST as konfirmasi } from "./kontrak/[id]/konfirmasi/route";
import { GET as sesi } from "./sesi/route";

// S13-4 — T12 integrasi: usul → konfirmasi dua pihak → AKTIF (R-11) → akhiri; pihak terkunci setelah AKTIF.
// Butuh DB ber-seed demo (DEMO_MODE=true).

// Alur ini membuat banyak organisasi lewat API sungguhan dan berbagi Postgres dengan jendela kerja lain: beri waktu longgar.
vi.setConfig({ testTimeout: 60_000 });

const rekam = new PengirimRekam();
beforeAll(() => setelPengirimUji(rekam));
afterAll(() => setelPengirimUji(null));

// Nama kawasan unik per run: generator kode kawasan hanya mencoba 200 kandidat per nama di skema yang dipakai berulang.
const NAMA_KAWASAN = namaUnik("Pasar Kontrak Uji");

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const TANGGAL = { berlakuDari: "2026-10-01", berlakuSampai: "2027-09-30" };

type Dunia = { kawasan: OrgUji & { kawasanId: string }; pengangkut: OrgUji; penerima: OrgUji };

/** Satu kawasan (dengan kawasan terdaftar), satu pengangkut, satu penerima FASILITAS_BERIZIN (izin BELUM_DIAJUKAN). */
async function dunia(): Promise<Dunia> {
  const k = await orgBaru(rekam, { jenis: "KAWASAN" });
  const r = await buatKawasan(permintaan("/api/kawasan", { cookie: k.cookie, body: { nama: NAMA_KAWASAN, jenis: "KOMERSIAL", alamat: "Alamat uji", adm4: "31.71.03.1001", kota: "Jakarta Pusat" } }));
  expect(r.status).toBe(200);
  const kawasanId = (await r.json()).data.kawasan.id as string;
  return {
    kawasan: { ...k, kawasanId },
    pengangkut: await orgBaru(rekam, { jenis: "PENGANGKUT" }),
    penerima: await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "FASILITAS_BERIZIN", aliranDiterima: ["KUNING"] }),
  };
}

const verifikasiIzin = (organisasiId: string) => kueriPemilik(`UPDATE organisasi SET status_izin = 'TERVERIFIKASI', nomor_izin = 'IZIN-UJI-1' WHERE id = $1`, [organisasiId]);

function usul(d: Dunia, ubah: Record<string, unknown> = {}) {
  return usulKontrak(
    permintaan("/api/kontrak", {
      cookie: d.kawasan.cookie,
      body: { kawasanId: d.kawasan.kawasanId, pengangkutId: d.pengangkut.organisasiId, penerimaId: d.penerima.organisasiId, aliran: ["KUNING"], ...TANGGAL, ...ubah },
    }),
  );
}

describe("S13-4 kontrak: usul", () => {
  it("pengelola mengusulkan → USULAN; pengangkut & penerima menerima notifikasi KONTRAK_PERLU_KONFIRMASI; tarif integer", async () => {
    const d = await dunia();
    const r = await usul(d, { tarifPerRitIdr: 150_000, tarifPerKgIdr: 500 });
    expect(r.status).toBe(200);
    const k = (await r.json()).data.kontrak;
    expect(k).toMatchObject({
      status: "USULAN",
      aliran: ["KUNING"],
      berlakuDari: "2026-10-01",
      berlakuSampai: "2027-09-30",
      tarifPerRitIdr: 150_000,
      tarifPerKgIdr: 500,
      dikonfirmasiPengangkutPada: null,
      dikonfirmasiPenerimaPada: null,
      kawasan: { id: d.kawasan.kawasanId, nama: NAMA_KAWASAN },
      pengangkut: { id: d.pengangkut.organisasiId },
      penerima: { id: d.penerima.organisasiId },
    });
    const n = await kueriPemilik<{ organisasi_id: string; peran_tujuan: string; data: { nama_kawasan: string } }>(
      `SELECT organisasi_id, peran_tujuan::text AS peran_tujuan, data FROM notifikasi WHERE jenis = 'KONTRAK_PERLU_KONFIRMASI' AND objek_kode = $1 ORDER BY peran_tujuan`,
      [k.id],
    );
    expect(n).toHaveLength(2);
    expect(n.map((x) => [x.organisasi_id, x.peran_tujuan]).sort()).toEqual(
      [[d.pengangkut.organisasiId, "{PENGANGKUT}"], [d.penerima.organisasiId, "{PENERIMA}"]].sort(),
    );
    expect(n.every((x) => x.data.nama_kawasan === NAMA_KAWASAN)).toBe(true);
  });

  it("menolak: tarif pecahan, rentang terbalik, pengangkut/penerima bukan jenisnya, kawasan organisasi lain, bukan PENGELOLA", async () => {
    const d = await dunia();
    expect((await usul(d, { tarifPerKgIdr: 1.5 })).status).toBe(400);
    expect((await usul(d, { berlakuSampai: "2026-09-30" })).status).toBe(400);
    expect((await usul(d, { pengangkutId: d.penerima.organisasiId })).status).toBe(400);
    expect((await usul(d, { penerimaId: d.pengangkut.organisasiId })).status).toBe(400);
    expect((await usul(d, { aliranTambahan: true })).status).toBe(400);
    const lain = await dunia();
    const curian = await usulKontrak(
      permintaan("/api/kontrak", {
        cookie: lain.kawasan.cookie,
        body: { kawasanId: d.kawasan.kawasanId, pengangkutId: d.pengangkut.organisasiId, penerimaId: d.penerima.organisasiId, aliran: ["KUNING"], ...TANGGAL },
      }),
    );
    expect(curian.status).toBe(404);
    const cookiePengangkut = await cookieDemo("PENGANGKUT");
    expect((await usulKontrak(permintaan("/api/kontrak", { cookie: cookiePengangkut, body: { kawasanId: d.kawasan.kawasanId, pengangkutId: d.pengangkut.organisasiId, penerimaId: d.penerima.organisasiId, aliran: ["KUNING"], ...TANGGAL } }))).status).toBe(403);
  });
});

describe("S13-4 T12: konfirmasi dua pihak, R-11, AKTIF", () => {
  it("penerima belum berizin → ATURAN_DITOLAK R11 dengan teks §M; setelah izin terverifikasi → AKTIF", async () => {
    const d = await dunia();
    const k = (await (await usul(d)).json()).data.kontrak;

    const p = await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.pengangkut.cookie }), ctx(k.id));
    expect(p.status).toBe(200);
    expect((await p.json()).data.kontrak).toMatchObject({ status: "USULAN", dikonfirmasiPenerimaPada: null });

    const tolak = await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.penerima.cookie }), ctx(k.id));
    expect(tolak.status).toBe(422);
    const g = (await tolak.json()).galat;
    expect(g.kode).toBe("ATURAN_DITOLAK");
    expect(g.aturan).toMatchObject({ kode: "R11", aksi: "TOLAK", teks: TEKS.ATURAN_R11 });
    expect(g.pesan).toBe("Tidak dapat dilanjutkan");
    const [belum] = await kueriPemilik<{ status: string; penerima: Date | null }>(`SELECT status, dikonfirmasi_penerima_pada AS penerima FROM kontrak WHERE id = $1`, [k.id]);
    expect(belum).toEqual({ status: "USULAN", penerima: null });

    await verifikasiIzin(d.penerima.organisasiId);
    const ok = await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.penerima.cookie }), ctx(k.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.kontrak).toMatchObject({ status: "AKTIF", dikonfirmasiPengangkutPada: expect.any(String), dikonfirmasiPenerimaPada: expect.any(String) });
  });

  it("izin dicabut/belum terverifikasi menolak juga konfirmasi PENGANGKUT yang terakhir (R-11 dinilai pada setiap konfirmasi)", async () => {
    const d = await dunia();
    await verifikasiIzin(d.penerima.organisasiId);
    const k = (await (await usul(d)).json()).data.kontrak;
    expect((await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.penerima.cookie }), ctx(k.id))).status).toBe(200);
    await kueriPemilik(`UPDATE organisasi SET status_izin = 'DITOLAK' WHERE id = $1`, [d.penerima.organisasiId]);
    const tolak = await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.pengangkut.cookie }), ctx(k.id));
    expect(tolak.status).toBe(422);
    expect((await tolak.json()).galat.aturan.kode).toBe("R11");
  });

  it("yang boleh mengonfirmasi hanya pengangkut/penerima pihak kontrak; pihak luar tidak melihatnya; sudah AKTIF → 409", async () => {
    const d = await dunia();
    await verifikasiIzin(d.penerima.organisasiId);
    const k = (await (await usul(d)).json()).data.kontrak;

    expect((await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.kawasan.cookie }), ctx(k.id))).status).toBe(403);
    const asing = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    expect((await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: asing.cookie }), ctx(k.id))).status).toBe(404);
    expect((await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: await cookieDemo("PENERIMA") }), ctx(k.id))).status).toBe(404);

    expect((await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.pengangkut.cookie }), ctx(k.id))).status).toBe(200);
    expect((await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.penerima.cookie }), ctx(k.id))).status).toBe(200);
    const lagi = await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.penerima.cookie }), ctx(k.id));
    expect(lagi.status).toBe(409);
    expect((await lagi.json()).galat.kode).toBe("TRANSISI_TIDAK_SAH");
  });
});

describe("S13-4 ubah pihak, akhiri, daftar", () => {
  async function kontrakAktif(d: Dunia) {
    await verifikasiIzin(d.penerima.organisasiId);
    const k = (await (await usul(d)).json()).data.kontrak;
    await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.pengangkut.cookie }), ctx(k.id));
    const r = await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.penerima.cookie }), ctx(k.id));
    expect((await r.json()).data.kontrak.status).toBe("AKTIF");
    return k.id as string;
  }

  async function sesiKawasan(d: Dunia) {
    const s = (await (await sesi(permintaan("/api/sesi", { metode: "GET", cookie: d.kawasan.cookie }))).json()).data;
    return { id: "s", penggunaId: s.pengguna.id as string, organisasiAktifId: d.kawasan.organisasiId, peran: "PENGELOLA" as const };
  }

  it("ubah pihak atau aliran setelah AKTIF ditolak; tarif boleh dan tercatat di audit_log; pihak tidak berubah", async () => {
    const d = await dunia();
    const id = await kontrakAktif(d);
    const s = await sesiKawasan(d);
    const jalan = (p: Parameters<typeof ubahKontrak>[3]) => denganAkses(konteksAkses(s), (tx) => ubahKontrak(tx, s, id, p, new Date()));

    const pihak = await jalan({ penerimaId: d.pengangkut.organisasiId }).catch((e: unknown) => e);
    expect(pihak).toBeInstanceOf(GalatApi);
    expect((pihak as GalatApi).kode).toBe("TRANSISI_TIDAK_SAH");
    expect((pihak as GalatApi).rincian).toEqual([{ jalur: ["kontrak"], kode: "PIHAK_TERKUNCI" }]);
    const aliran = await jalan({ aliran: ["HIJAU"] }).catch((e: unknown) => e);
    expect((aliran as GalatApi).rincian).toEqual([{ jalur: ["kontrak"], kode: "ALIRAN_TERKUNCI" }]);
    const [utuh] = await kueriPemilik<{ org_penerima_id: string; org_pengangkut_id: string; aliran: string }>(
      `SELECT org_penerima_id, org_pengangkut_id, aliran::text AS aliran FROM kontrak WHERE id = $1`,
      [id],
    );
    expect(utuh).toEqual({ org_penerima_id: d.penerima.organisasiId, org_pengangkut_id: d.pengangkut.organisasiId, aliran: "{KUNING}" });

    const sebelum = await kueriPemilik(`SELECT 1 FROM audit_log WHERE objek_id = $1 AND aksi = 'KONTRAK_DIUBAH'`, [id]);
    const ok = await jalan({ tarifPerKgIdr: 750 });
    expect(ok).toMatchObject({ status: "AKTIF", tarifPerKgIdr: 750 });
    const audit = await kueriPemilik<{ peran: string; data: { bidang: string[] } }>(`SELECT peran, data FROM audit_log WHERE objek_id = $1 AND aksi = 'KONTRAK_DIUBAH'`, [id]);
    expect(audit).toHaveLength(sebelum.length + 1);
    expect(audit.at(-1)).toEqual({ peran: "PENGELOLA", data: { bidang: ["tarifPerKgIdr"] } });
  });

  it("ubah pada USULAN mengosongkan konfirmasi yang sudah masuk; pada kontrak lain milik organisasi lain ditolak", async () => {
    const d = await dunia();
    const k = (await (await usul(d)).json()).data.kontrak;
    await konfirmasi(permintaan(`/api/kontrak/${k.id}/konfirmasi`, { cookie: d.pengangkut.cookie }), ctx(k.id));
    const s = await sesiKawasan(d);
    const baru = await denganAkses(konteksAkses(s), (tx) => ubahKontrak(tx, s, k.id, { aliran: ["KUNING", "ABU"], tarifPerRitIdr: 200_000 }, new Date()));
    expect(baru).toMatchObject({ status: "USULAN", aliran: ["KUNING", "ABU"], tarifPerRitIdr: 200_000, dikonfirmasiPengangkutPada: null });

    const lain = await dunia();
    const sl = await sesiKawasan(lain);
    const asing = await denganAkses(konteksAkses(sl), (tx) => ubahKontrak(tx, sl, k.id, { tarifPerRitIdr: 1 }, new Date())).catch((e: unknown) => e);
    expect((asing as GalatApi).kode).toBe("TIDAK_DITEMUKAN");
  });

  it("akhiri: AKTIF → BERAKHIR, USULAN → DIBATALKAN, ulang → 409; hanya PENGELOLA pemilik kontrak", async () => {
    const d = await dunia();
    const id = await kontrakAktif(d);
    expect((await akhiri(permintaan(`/api/kontrak/${id}/akhiri`, { cookie: d.pengangkut.cookie }), ctx(id))).status).toBe(403);
    const lain = await dunia();
    expect((await akhiri(permintaan(`/api/kontrak/${id}/akhiri`, { cookie: lain.kawasan.cookie }), ctx(id))).status).toBe(404);
    const selesai = await akhiri(permintaan(`/api/kontrak/${id}/akhiri`, { cookie: d.kawasan.cookie }), ctx(id));
    expect((await selesai.json()).data.kontrak.status).toBe("BERAKHIR");
    expect((await akhiri(permintaan(`/api/kontrak/${id}/akhiri`, { cookie: d.kawasan.cookie }), ctx(id))).status).toBe(409);
    expect((await konfirmasi(permintaan(`/api/kontrak/${id}/konfirmasi`, { cookie: d.pengangkut.cookie }), ctx(id))).status).toBe(409);

    const k2 = (await (await usul(d)).json()).data.kontrak;
    const batal = await akhiri(permintaan(`/api/kontrak/${k2.id}/akhiri`, { cookie: d.kawasan.cookie }), ctx(k2.id));
    expect((await batal.json()).data.kontrak.status).toBe("DIBATALKAN");
  });

  it("daftar kontrak: tiap pihak hanya melihat kontraknya; filter status; organisasi lain tidak melihat", async () => {
    const d = await dunia();
    const id = await kontrakAktif(d);
    const usulan = (await (await usul(d)).json()).data.kontrak.id as string;
    const ambil = async (cookie: string, q = "") => ((await (await daftarKontrak(permintaan(`/api/kontrak${q}`, { metode: "GET", cookie }))).json()).data.kontrak as { id: string; status: string }[]);

    for (const c of [d.kawasan.cookie, d.pengangkut.cookie, d.penerima.cookie]) {
      expect((await ambil(c)).map((x) => x.id).sort()).toEqual([id, usulan].sort());
      expect((await ambil(c, "?status=AKTIF")).map((x) => x.id)).toEqual([id]);
    }
    const lain = await dunia();
    expect(await ambil(lain.kawasan.cookie)).toEqual([]);
    expect(await ambil(lain.pengangkut.cookie)).toEqual([]);
    expect((await daftarKontrak(permintaan("/api/kontrak", { metode: "GET", cookie: await cookieDemo("PETUGAS") }))).status).toBe(403);
  });
});
