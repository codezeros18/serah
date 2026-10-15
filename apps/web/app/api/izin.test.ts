import { TEKS } from "@serah/kontrak";
import { namaUnik } from "@/lib/server/uji/nama";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { denganAdmin, denganAkses, denganSistem } from "@/lib/server/db";
import { GalatApi } from "@/lib/server/galat";
import { evaluasiUlangKontrakMenunggu, putuskanIzin } from "@/lib/server/layanan/izin";
import type { Sesi } from "@/lib/server/sesi";
import { konteksAkses } from "@/lib/server/sesi";
import { cookieDemo, orgBaru, type OrgUji } from "@/lib/server/uji/akun";
import { kueriPemilik } from "@/lib/server/uji/db";
import { permintaan } from "@/lib/server/uji/http";
import { formFoto, pngContoh } from "@/lib/server/uji/klien";
import { POST as foto } from "./foto/route";
import { POST as buatKawasan } from "./kawasan/route";
import { POST as konfirmasi } from "./kontrak/[id]/konfirmasi/route";
import { POST as usulKontrak } from "./kontrak/route";
import { POST as ajukan } from "./organisasi/izin/route";

// S15 — izin pelaku usaha: ajukan (S15-1), putusan admin + evaluasi ulang kontrak (S15-2), T12 lengkap.
// Butuh DB ber-seed demo (DEMO_MODE=true). Putusan dipanggil lewat layanan di dalam denganAdmin (rute admin = S21).

vi.setConfig({ testTimeout: 60_000 });

const rekam = new PengirimRekam();
beforeAll(() => setelPengirimUji(rekam));
afterAll(() => setelPengirimUji(null));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const ALASAN = "Dokumen izin diperiksa terhadap daftar";
let orgInternal = "";

beforeAll(async () => {
  orgInternal = (await kueriPemilik<{ id: string }>(`SELECT id FROM organisasi WHERE kode = 'ORG-INTERNAL'`))[0]!.id;
});

const sesiAdmin = (): Sesi => ({ id: "uji-admin", penggunaId: "uji-admin", organisasiAktifId: orgInternal, peran: "ADMIN" });

function putus(organisasiId: string, keputusan: "TERVERIFIKASI" | "DITOLAK", alasan = ALASAN, sesi: Sesi = sesiAdmin()) {
  const k = konteksAkses(sesi);
  return denganAdmin(k, alasan, (tx) => putuskanIzin(tx, sesi, { organisasiId, keputusan, alasan }, new Date()));
}

const status = async (id: string) => (await kueriPemilik<{ status_izin: string; nomor_izin: string | null }>(`SELECT status_izin::text, nomor_izin FROM organisasi WHERE id = $1`, [id]))[0]!;
const ajukanIzin = (o: OrgUji, body: unknown) => ajukan(permintaan("/api/organisasi/izin", { cookie: o.cookie, body }));

async function unggahDokumen(o: OrgUji): Promise<string> {
  const f = formFoto("DOKUMEN_IZIN", pngContoh(`izin-${Math.random()}`), "image/png");
  const r = await foto(new Request(`${new URL(process.env.BASE_URL!).origin}/api/foto`, { method: "POST", headers: { origin: new URL(process.env.BASE_URL!).origin, cookie: o.cookie }, body: f }));
  expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
  return (await r.json()).data.fotoId as string;
}

describe("S15-1 ajukan izin", () => {
  it("pengurus PENERIMA mengajukan → MENUNGGU; nomor & jejak (nomor, foto dokumen) tersimpan; tidak bisa mengajukan lagi", async () => {
    const p = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "PELAPAK_BERIZIN", aliranDiterima: ["KUNING"] });
    const fotoId = await unggahDokumen(p);
    const r = await ajukanIzin(p, { nomorIzin: "  IZIN-PELAPAK-001  ", fotoDokumenId: fotoId });
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual({ statusIzin: "MENUNGGU" });
    expect(await status(p.organisasiId)).toEqual({ status_izin: "MENUNGGU", nomor_izin: "IZIN-PELAPAK-001" });
    const audit = await kueriPemilik<{ data: { nomorIzin: string; fotoId: string }; peran: string }>(
      `SELECT data, peran::text FROM audit_log WHERE organisasi_id = $1 AND aksi = 'IZIN_DIAJUKAN'`,
      [p.organisasiId],
    );
    expect(audit).toEqual([{ data: { nomorIzin: "IZIN-PELAPAK-001", fotoId }, peran: "PENERIMA" }]);
    const lagi = await ajukanIzin(p, { nomorIzin: "IZIN-PELAPAK-002" });
    expect(lagi.status).toBe(409);
  });

  it("pengangkut juga boleh; kawasan 403; non-pengurus 403; nomor terlalu pendek & field asing 400", async () => {
    const a = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    expect((await ajukanIzin(a, { nomorIzin: "IZIN-ANGKUT-1" })).status).toBe(200);
    const k = await orgBaru(rekam, { jenis: "KAWASAN" });
    expect((await ajukanIzin(k, { nomorIzin: "IZIN-KAWASAN-1" })).status).toBe(403);
    // Petugas demo bukan pengurus.
    expect((await ajukan(permintaan("/api/organisasi/izin", { cookie: await cookieDemo("PETUGAS"), body: { nomorIzin: "IZIN-X-1" } }))).status).toBe(403);
    const baru = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    expect((await ajukanIzin(baru, { nomorIzin: "ab" })).status).toBe(400);
    const asing = await ajukanIzin(baru, { nomorIzin: "IZIN-ANGKUT-2", statusIzin: "TERVERIFIKASI" });
    expect([asing.status, (await asing.json()).galat.kode]).toEqual([400, "FIELD_TIDAK_DIKENAL"]);
    expect((await status(baru.organisasiId)).status_izin).toBe("BELUM_DIAJUKAN");
  });

  it("foto dokumen harus jenis DOKUMEN_IZIN milik organisasi sendiri", async () => {
    const a = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    const b = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    const fotoB = await unggahDokumen(b);
    const r = await ajukanIzin(a, { nomorIzin: "IZIN-ANGKUT-3", fotoDokumenId: fotoB });
    expect(r.status).toBe(400);
    expect((await status(a.organisasiId)).status_izin).toBe("BELUM_DIAJUKAN");

    // Foto MILIK SENDIRI tetapi bukan dokumen izin (RLS tidak menolongnya): jenis diperiksa di layanan.
    const origin = new URL(process.env.BASE_URL!).origin;
    const bukti = await foto(
      new Request(`${origin}/api/foto`, { method: "POST", headers: { origin, cookie: a.cookie }, body: formFoto("BUKTI_TRANSFER", pngContoh(`bukti-${Math.random()}`), "image/png") }),
    );
    expect(bukti.status).toBe(200);
    const buktiId = (await bukti.json()).data.fotoId as string;
    expect((await ajukanIzin(a, { nomorIzin: "IZIN-ANGKUT-3", fotoDokumenId: buktiId })).status).toBe(400);
    expect((await status(a.organisasiId)).status_izin).toBe("BELUM_DIAJUKAN");
  });
});

describe("S15-2 putusan admin", () => {
  it("TERVERIFIKASI: izin_putusan tercatat dengan foto & nomor, status berubah, IZIN_DIPUTUS ke organisasi dengan teks §M", async () => {
    const p = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "FASILITAS_BERIZIN", aliranDiterima: ["KUNING"] });
    const fotoId = await unggahDokumen(p);
    await ajukanIzin(p, { nomorIzin: "IZIN-FB-9", fotoDokumenId: fotoId });
    expect(await putus(p.organisasiId, "TERVERIFIKASI")).toEqual({ statusIzin: "TERVERIFIKASI", kontrakDiaktifkan: 0 });
    expect((await status(p.organisasiId)).status_izin).toBe("TERVERIFIKASI");
    const pt = await kueriPemilik<{ keputusan: string; nomor_izin: string; alasan: string; foto_id: string }>(
      `SELECT keputusan::text, nomor_izin, alasan, foto_id FROM izin_putusan WHERE organisasi_id = $1`,
      [p.organisasiId],
    );
    expect(pt).toEqual([{ keputusan: "TERVERIFIKASI", nomor_izin: "IZIN-FB-9", alasan: ALASAN, foto_id: fotoId }]);
    const n = await kueriPemilik<{ jenis: string; peran: string[]; data: { status: string } }>(
      `SELECT jenis::text, peran_tujuan::text[] AS peran, data FROM notifikasi WHERE organisasi_id = $1 AND jenis = 'IZIN_DIPUTUS'`,
      [p.organisasiId],
    );
    expect(n).toEqual([{ jenis: "IZIN_DIPUTUS", peran: ["PENERIMA"], data: { status: TEKS.IZIN_TERVERIFIKASI } }]);
  });

  it("DITOLAK → boleh diajukan ulang → MENUNGGU → TERVERIFIKASI; kedua putusan tercatat berurutan", async () => {
    const p = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "PELAPAK_BERIZIN", aliranDiterima: ["KUNING"] });
    await ajukanIzin(p, { nomorIzin: "IZIN-TOLAK-1" });
    await putus(p.organisasiId, "DITOLAK");
    expect((await status(p.organisasiId)).status_izin).toBe("DITOLAK");
    const n = await kueriPemilik<{ data: { status: string } }>(`SELECT data FROM notifikasi WHERE organisasi_id = $1 AND jenis = 'IZIN_DIPUTUS'`, [p.organisasiId]);
    expect(n[0]?.data.status).toBe(TEKS.IZIN_DITOLAK);
    expect((await ajukanIzin(p, { nomorIzin: "IZIN-TOLAK-2" })).status).toBe(200);
    await putus(p.organisasiId, "TERVERIFIKASI");
    const pt = await kueriPemilik<{ keputusan: string; nomor_izin: string }>(`SELECT keputusan::text, nomor_izin FROM izin_putusan WHERE organisasi_id = $1 ORDER BY diputus_pada, id`, [p.organisasiId]);
    expect(pt).toEqual([{ keputusan: "DITOLAK", nomor_izin: "IZIN-TOLAK-1" }, { keputusan: "TERVERIFIKASI", nomor_izin: "IZIN-TOLAK-2" }]);
  });

  it("penjaga: hanya status MENUNGGU (409), hanya ADMIN (403), alasan ≥15 (400), hanya pengangkut/penerima (400), organisasi tak ada (404)", async () => {
    const p = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "TPS3R", aliranDiterima: ["HIJAU"] });
    await expect(putus(p.organisasiId, "TERVERIFIKASI")).rejects.toMatchObject({ kode: "TRANSISI_TIDAK_SAH" }); // BELUM_DIAJUKAN
    await ajukanIzin(p, { nomorIzin: "IZIN-TPS3R-1" });
    // denganAdmin menolak secara sinkron (alasan pendek / peran bukan ADMIN) sebelum membuka transaksi.
    await expect((async () => putus(p.organisasiId, "TERVERIFIKASI", "terlalu pendek"))()).rejects.toBeInstanceOf(GalatApi);
    const bukanAdmin: Sesi = { ...sesiAdmin(), peran: "PENGELOLA" };
    await expect((async () => putus(p.organisasiId, "TERVERIFIKASI", ALASAN, bukanAdmin))()).rejects.toMatchObject({ kode: "PERAN_TIDAK_BOLEH" });
    // Sesi ADMIN tetapi memanggil layanan langsung di luar denganAdmin: peran sesi tetap diperiksa.
    const sesiPalsu: Sesi = { ...sesiAdmin(), peran: "PENGELOLA" };
    await expect(denganAkses(konteksAkses(sesiAdmin()), (tx) => putuskanIzin(tx, sesiPalsu, { organisasiId: p.organisasiId, keputusan: "TERVERIFIKASI", alasan: ALASAN }, new Date()))).rejects.toMatchObject({ kode: "PERAN_TIDAK_BOLEH" });
    const k = await orgBaru(rekam, { jenis: "KAWASAN" });
    await expect(putus(k.organisasiId, "TERVERIFIKASI")).rejects.toMatchObject({ kode: "VALIDASI_GAGAL" });
    await expect(putus("tidakada000000000000000000", "TERVERIFIKASI")).rejects.toMatchObject({ kode: "TIDAK_DITEMUKAN" });
    expect((await status(p.organisasiId)).status_izin).toBe("MENUNGGU");
    await putus(p.organisasiId, "TERVERIFIKASI");
    await expect(putus(p.organisasiId, "DITOLAK")).rejects.toMatchObject({ kode: "TRANSISI_TIDAK_SAH" });
    expect((await status(p.organisasiId)).status_izin).toBe("TERVERIFIKASI");
  });
});

describe("evaluasiUlangKontrakMenunggu — R-11 dinilai ulang oleh evaluator core", () => {
  it("penerima yang belum TERVERIFIKASI tidak mengaktifkan kontrak USULAN lengkap, walau dipanggil langsung", async () => {
    const p = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "BANK_SAMPAH_INDUK", aliranDiterima: ["KUNING"] });
    await ajukanIzin(p, { nomorIzin: "IZIN-BSI-1" }); // MENUNGGU
    const kawasan = await orgBaru(rekam, { jenis: "KAWASAN" });
    const kws = await buatKawasan(permintaan("/api/kawasan", { cookie: kawasan.cookie, body: { nama: namaUnik("Pasar R11 Uji"), jenis: "KOMERSIAL", alamat: "Alamat uji", adm4: "31.71.03.1001", kota: "Jakarta Pusat" } }));
    const kawasanId = (await kws.json()).data.kawasan.id as string;
    const angkut = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    const u = await usulKontrak(
      permintaan("/api/kontrak", {
        cookie: kawasan.cookie,
        body: { kawasanId, pengangkutId: angkut.organisasiId, penerimaId: p.organisasiId, aliran: ["KUNING"], berlakuDari: "2026-10-01", berlakuSampai: "2027-09-30" },
      }),
    );
    const kontrakId = (await u.json()).data.kontrak.id as string;
    await kueriPemilik(`UPDATE kontrak SET dikonfirmasi_pengangkut_pada = now(), dikonfirmasi_penerima_pada = now() WHERE id = $1`, [kontrakId]);

    // Konteks sistem: kontrak antar-organisasi terlihat (bukan vakum karena RLS); evaluator R-11 yang menahannya.
    const n = await denganSistem((tx) => evaluasiUlangKontrakMenunggu(tx, p.organisasiId));
    expect(n).toBe(0);
    expect((await kueriPemilik<{ status: string }>(`SELECT status::text FROM kontrak WHERE id = $1`, [kontrakId]))[0]?.status).toBe("USULAN");
  });
});

describe("T12 lengkap — MENUNGGU → TERVERIFIKASI → kontrak bisa AKTIF", () => {
  async function dunia() {
    const k = await orgBaru(rekam, { jenis: "KAWASAN" });
    const r = await buatKawasan(permintaan("/api/kawasan", { cookie: k.cookie, body: { nama: namaUnik("Pasar Izin Uji"), jenis: "KOMERSIAL", alamat: "Alamat uji", adm4: "31.71.03.1001", kota: "Jakarta Pusat" } }));
    const kawasanId = (await r.json()).data.kawasan.id as string;
    const pengangkut = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    const penerima = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "PELAPAK_BERIZIN", aliranDiterima: ["KUNING"] });
    const u = await usulKontrak(
      permintaan("/api/kontrak", {
        cookie: k.cookie,
        body: { kawasanId, pengangkutId: pengangkut.organisasiId, penerimaId: penerima.organisasiId, aliran: ["KUNING"], berlakuDari: "2026-10-01", berlakuSampai: "2027-09-30" },
      }),
    );
    expect(u.status).toBe(200);
    return { kawasan: k, pengangkut, penerima, kontrakId: (await u.json()).data.kontrak.id as string };
  }
  const konf = (o: OrgUji, id: string) => konfirmasi(permintaan(`/api/kontrak/${id}/konfirmasi`, { cookie: o.cookie }), ctx(id));
  const statusKontrak = async (id: string) =>
    (await kueriPemilik<{ status: string; p: boolean; r: boolean }>(`SELECT status::text, dikonfirmasi_pengangkut_pada IS NOT NULL AS p, dikonfirmasi_penerima_pada IS NOT NULL AS r FROM kontrak WHERE id = $1`, [id]))[0]!;

  it("belum diajukan & MENUNGGU → penerima ditolak R-11; DITOLAK pun; TERVERIFIKASI → konfirmasi penerima mengaktifkan", async () => {
    const d = await dunia();
    expect((await konf(d.pengangkut, d.kontrakId)).status).toBe(200);
    const sebelum = await konf(d.penerima, d.kontrakId);
    expect([sebelum.status, (await sebelum.json()).galat.aturan.kode]).toEqual([422, "R11"]);

    await ajukanIzin(d.penerima, { nomorIzin: "IZIN-T12-1" });
    expect((await konf(d.penerima, d.kontrakId)).status).toBe(422); // MENUNGGU: tetap R-11

    await putus(d.penerima.organisasiId, "DITOLAK");
    const ditolak = await konf(d.penerima, d.kontrakId);
    expect([ditolak.status, (await ditolak.json()).galat.aturan.kode]).toEqual([422, "R11"]);
    expect(await statusKontrak(d.kontrakId)).toEqual({ status: "USULAN", p: true, r: false });

    await ajukanIzin(d.penerima, { nomorIzin: "IZIN-T12-2" });
    const hasil = await putus(d.penerima.organisasiId, "TERVERIFIKASI");
    expect(hasil.kontrakDiaktifkan).toBe(0); // konfirmasi penerima belum ada: harus mengonfirmasi sendiri
    expect(await statusKontrak(d.kontrakId)).toEqual({ status: "USULAN", p: true, r: false });
    const akhir = await konf(d.penerima, d.kontrakId);
    expect(akhir.status).toBe(200);
    expect(await statusKontrak(d.kontrakId)).toEqual({ status: "AKTIF", p: true, r: true });
  });

  it("kontrak yang sudah dikonfirmasi kedua pihak tetapi menunggu izin → AKTIF saat TERVERIFIKASI; yang belum lengkap & milik penerima lain tidak berubah; DITOLAK tidak mengaktifkan", async () => {
    const lengkap = await dunia();
    const parsial = await dunia();
    // Kontrak parsial ke penerima yang SAMA: hanya pengangkut yang sudah mengonfirmasi.
    const k2 = await usulKontrak(
      permintaan("/api/kontrak", {
        cookie: parsial.kawasan.cookie,
        body: { kawasanId: (await kueriPemilik<{ id: string }>(`SELECT id FROM kawasan WHERE organisasi_id = $1`, [parsial.kawasan.organisasiId]))[0]!.id, pengangkutId: lengkap.pengangkut.organisasiId, penerimaId: lengkap.penerima.organisasiId, aliran: ["KUNING"], berlakuDari: "2026-10-01", berlakuSampai: "2027-09-30" },
      }),
    );
    const kontrakParsial = (await k2.json()).data.kontrak.id as string;
    await kueriPemilik(`UPDATE kontrak SET dikonfirmasi_pengangkut_pada = now() WHERE id = $1`, [kontrakParsial]);
    // Kontrak lengkap: kedua konfirmasi ada tetapi status USULAN (mis. izin penerima dicabut sesudah konfirmasi).
    await kueriPemilik(`UPDATE kontrak SET dikonfirmasi_pengangkut_pada = now(), dikonfirmasi_penerima_pada = now() WHERE id = $1`, [lengkap.kontrakId]);
    // Kontrak penerima lain (juga lengkap tapi izin lain) tidak boleh ikut berubah.
    await kueriPemilik(`UPDATE kontrak SET dikonfirmasi_pengangkut_pada = now(), dikonfirmasi_penerima_pada = now() WHERE id = $1`, [parsial.kontrakId]);

    await ajukanIzin(lengkap.penerima, { nomorIzin: "IZIN-T12-3" });
    expect((await putus(lengkap.penerima.organisasiId, "DITOLAK")).kontrakDiaktifkan).toBe(0);
    expect((await statusKontrak(lengkap.kontrakId)).status).toBe("USULAN");

    await ajukanIzin(lengkap.penerima, { nomorIzin: "IZIN-T12-4" });
    expect(await putus(lengkap.penerima.organisasiId, "TERVERIFIKASI")).toEqual({ statusIzin: "TERVERIFIKASI", kontrakDiaktifkan: 1 });
    expect(await statusKontrak(lengkap.kontrakId)).toEqual({ status: "AKTIF", p: true, r: true });
    expect((await statusKontrak(kontrakParsial)).status).toBe("USULAN");
    expect((await statusKontrak(parsial.kontrakId)).status).toBe("USULAN");
  });
});
