import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { idBaru } from "@/lib/server/id";
import { kueriPemilik } from "@/lib/server/uji/db";
import { cookieDari, emailBaru, permintaan, tokenTerakhir } from "@/lib/server/uji/http";
import { GET as dataSaya } from "./akun/data-saya/route";
import { POST as hapus } from "./akun/hapus/route";
import { GET as bacaNtf, PUT as ubahNtf } from "./akun/notifikasi/route";
import { GET as anggota } from "./anggota/route";
import { POST as nonaktif } from "./anggota/[id]/nonaktif/route";
import { POST as daftar } from "./auth/daftar/route";
import { POST as demo } from "./auth/demo/route";
import { POST as masuk } from "./auth/masuk/route";
import { POST as verifikasi } from "./auth/verifikasi/route";
import { POST as gantiOrg } from "./sesi/organisasi/route";
import { GET as sesi } from "./sesi/route";
import { POST as undang } from "./undangan/route";
import { POST as terima } from "./undangan/terima/route";

// S07-2, S07-3 — undangan, anggota, akun pribadi, T31. Butuh DB ber-seed demo (DEMO_MODE=true).

const rekam = new PengirimRekam();
const VERSI = "PRIV-2026-10-1";
const SANDI = "sandi-uji-panjang-1";
let org: Record<string, string> = {};
let cookiePengelola = "";

beforeAll(async () => {
  setelPengirimUji(rekam);
  const rows = await kueriPemilik<{ kode: string; id: string }>(`SELECT kode, id FROM organisasi WHERE demo AND kode IN ('ORG-PCS', 'ORG-ACB', 'ORG-DUCM')`);
  org = Object.fromEntries(rows.map((r) => [r.kode, r.id]));
  if (!org["ORG-PCS"]) throw new Error("Data demo belum ada — jalankan pnpm db:reset dengan DEMO_MODE=true");
  cookiePengelola = cookieDari(await demo(permintaan("/api/auth/demo", { body: { peran: "PENGELOLA" } })));
});
afterAll(() => setelPengirimUji(null));

const ambilSesi = async (cookie: string) => (await (await sesi(permintaan("/api/sesi", { metode: "GET", cookie }))).json()).data;

async function akunTerverifikasi(): Promise<{ email: string; cookie: string; id: string }> {
  const email = emailBaru();
  await daftar(permintaan("/api/auth/daftar", { body: { email, sandi: SANDI, persetujuanVersi: VERSI } }));
  await verifikasi(permintaan("/api/auth/verifikasi", { body: { token: tokenTerakhir(rekam, email, "/verifikasi") } }));
  const m = await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }));
  const cookie = cookieDari(m);
  return { email, cookie, id: (await ambilSesi(cookie)).pengguna.id };
}

/** Pengelola demo mengundang `email` sebagai PETUGAS ke Pasar Mekar Sari Kemayoran; kembalikan token undangan. */
async function undangPetugas(email: string): Promise<string> {
  const r = await undang(permintaan("/api/undangan", { cookie: cookiePengelola, body: { email, peran: "PETUGAS" } }));
  expect(r.status).toBe(200);
  return tokenTerakhir(rekam, email, "/undangan");
}

/** Akun baru lewat undangan (tanpa sesi). */
async function petugasBaru(): Promise<{ email: string; cookie: string; id: string }> {
  const email = emailBaru();
  const token = await undangPetugas(email);
  const r = await terima(permintaan("/api/undangan/terima", { body: { token, email, sandi: SANDI, persetujuanVersi: VERSI } }));
  expect(r.status).toBe(200);
  const cookie = cookieDari(r);
  return { email, cookie, id: (await ambilSesi(cookie)).pengguna.id };
}

describe("S07-2 undangan", () => {
  it("pengurus mengundang: berlaku 7 hari, hanya sidik email disimpan, email undangan terkirim", async () => {
    const email = emailBaru();
    const r = await undang(permintaan("/api/undangan", { cookie: cookiePengelola, body: { email, peran: "PETUGAS" } }));
    expect(r.status).toBe(200);
    const { kadaluwarsaPada } = (await r.json()).data;
    const selisihJam = (Date.parse(kadaluwarsaPada) - Date.now()) / 3_600_000;
    expect(selisihJam).toBeGreaterThan(167);
    expect(selisihJam).toBeLessThanOrEqual(168);
    const baris = await kueriPemilik(`SELECT * FROM token_sekali WHERE jenis = 'UNDANGAN' AND organisasi_id = $1 ORDER BY dibuat_pada DESC LIMIT 1`, [org["ORG-PCS"]]);
    expect(baris[0]).toMatchObject({ peran: "PETUGAS", pengguna_id: null });
    expect(JSON.stringify(baris[0])).not.toContain(email);
    expect(rekam.terkirim.at(-1)?.teks).toContain("Pasar Mekar Sari Kemayoran");
  });

  it("menolak: peran tak sesuai jenis organisasi, field organisasi dari klien, anggota bukan pengurus", async () => {
    const salahPeran = await undang(permintaan("/api/undangan", { cookie: cookiePengelola, body: { email: emailBaru(), peran: "PENERIMA" } }));
    expect(salahPeran.status).toBe(400);
    const asing = await undang(permintaan("/api/undangan", { cookie: cookiePengelola, body: { email: emailBaru(), peran: "PETUGAS", organisasiId: org["ORG-ACB"] } }));
    expect((await asing.json()).galat.kode).toBe("FIELD_TIDAK_DIKENAL");
    const cookiePetugas = cookieDari(await demo(permintaan("/api/auth/demo", { body: { peran: "PETUGAS" } })));
    expect((await undang(permintaan("/api/undangan", { cookie: cookiePetugas, body: { email: emailBaru(), peran: "PETUGAS" } }))).status).toBe(403);
  });

  it("pengurus organisasi A tidak bisa mengundang ke organisasi B (hanya anggota biasa di B)", async () => {
    const u = await akunTerverifikasi();
    const A = org["ORG-ACB"] ?? "";
    const B = org["ORG-DUCM"] ?? "";
    await kueriPemilik(
      `INSERT INTO keanggotaan (id, pengguna_id, organisasi_id, peran, pengurus, aktif) VALUES ($1, $2, $3, 'PENGANGKUT', true, true), ($4, $2, $5, 'PENERIMA', false, true)`,
      [idBaru(), u.id, A, idBaru(), B],
    );
    expect((await gantiOrg(permintaan("/api/sesi/organisasi", { cookie: u.cookie, body: { organisasiId: B, peran: "PENERIMA" } }))).status).toBe(200);
    const undanganB = async () => Number((await kueriPemilik<{ n: string }>(`SELECT count(*) AS n FROM token_sekali WHERE jenis = 'UNDANGAN' AND organisasi_id = $1`, [B]))[0]?.n);
    const sebelumB = await undanganB();
    const keB = await undang(permintaan("/api/undangan", { cookie: u.cookie, body: { email: emailBaru(), peran: "PENERIMA" } }));
    expect(keB.status).toBe(403);
    expect(await undanganB()).toBe(sebelumB);

    expect((await gantiOrg(permintaan("/api/sesi/organisasi", { cookie: u.cookie, body: { organisasiId: A, peran: "PENGANGKUT" } }))).status).toBe(200);
    const keA = await undang(permintaan("/api/undangan", { cookie: u.cookie, body: { email: emailBaru(), peran: "PENGANGKUT" } }));
    expect(keA.status).toBe(200);
  });

  it("terima tanpa sesi: email harus cocok; akun baru langsung masuk ke organisasi; token sekali pakai", async () => {
    const email = emailBaru();
    const token = await undangPetugas(email);
    const salah = await terima(permintaan("/api/undangan/terima", { body: { token, email: emailBaru(), sandi: SANDI, persetujuanVersi: VERSI } }));
    expect(salah.status).toBe(400);
    const tanpaPersetujuan = await terima(permintaan("/api/undangan/terima", { body: { token, email, sandi: SANDI } }));
    expect(tanpaPersetujuan.status).toBe(400);

    const ok = await terima(permintaan("/api/undangan/terima", { body: { token, email, sandi: SANDI, persetujuanVersi: VERSI } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).data).toEqual({ organisasiId: org["ORG-PCS"], peran: "PETUGAS" });
    const s = await ambilSesi(cookieDari(ok));
    expect(s).toMatchObject({ organisasiAktif: { kode: "ORG-PCS" }, peran: "PETUGAS" });
    const p = await kueriPemilik<{ verif: Date | null; n: string }>(
      `SELECT p.email_terverifikasi_pada AS verif, (SELECT count(*) FROM persetujuan_pdp s WHERE s.pengguna_id = p.id) AS n FROM pengguna p WHERE p.email = $1`,
      [email],
    );
    expect(p[0]?.verif).toBeInstanceOf(Date);
    expect(Number(p[0]?.n)).toBe(1);
    expect((await terima(permintaan("/api/undangan/terima", { body: { token, email, sandi: SANDI, persetujuanVersi: VERSI } }))).status).toBe(400);
  });

  it("terima dengan sesi: hanya akun yang emailnya diundang", async () => {
    const x = await akunTerverifikasi();
    const y = await akunTerverifikasi();
    const token = await undangPetugas(x.email);
    expect((await terima(permintaan("/api/undangan/terima", { cookie: y.cookie, body: { token } }))).status).toBe(403);
    const r = await terima(permintaan("/api/undangan/terima", { cookie: x.cookie, body: { token } }));
    expect(r.status).toBe(200);
    const g = await gantiOrg(permintaan("/api/sesi/organisasi", { cookie: x.cookie, body: { organisasiId: org["ORG-PCS"], peran: "PETUGAS" } }));
    expect(g.status).toBe(200);
  });
});

describe("S07-2 anggota", () => {
  it("daftar anggota hanya peran, sejak, aktif, pengurus — tanpa email siapa pun", async () => {
    await petugasBaru();
    const r = await anggota(permintaan("/api/anggota", { metode: "GET", cookie: cookiePengelola }));
    expect(r.status).toBe(200);
    const teks = await r.text();
    expect(teks).not.toContain("@");
    const daftarAnggota = JSON.parse(teks).data.anggota as Record<string, unknown>[];
    expect(daftarAnggota.length).toBeGreaterThan(2);
    for (const a of daftarAnggota) expect(Object.keys(a).sort()).toEqual(["aktif", "id", "pengurus", "peran", "sejak"]);
    const cookiePetugas = cookieDari(await demo(permintaan("/api/auth/demo", { body: { peran: "PETUGAS" } })));
    expect((await anggota(permintaan("/api/anggota", { metode: "GET", cookie: cookiePetugas }))).status).toBe(403);
  });

  it("nonaktifkan: keanggotaan di organisasinya saja, bukan diri sendiri; sesi anggota kehilangan konteks", async () => {
    const p = await petugasBaru();
    const [kId] = await kueriPemilik<{ id: string }>(`SELECT id FROM keanggotaan WHERE pengguna_id = $1`, [p.id]);
    const params = (id: string) => ({ params: Promise.resolve({ id }) });
    const r = await nonaktif(permintaan(`/api/anggota/${kId?.id}/nonaktif`, { cookie: cookiePengelola }), params(kId?.id ?? ""));
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual({ id: kId?.id, aktif: false });
    expect(await ambilSesi(p.cookie)).toMatchObject({ organisasiAktif: null, peran: null });

    const diri = (await ambilSesi(cookiePengelola)).pengguna.id;
    // Akun demo bisa punya keanggotaan lain dari test jendela lain; ambil yang di organisasi aktifnya (ORG-PCS) saja.
    const [kDiri] = await kueriPemilik<{ id: string }>(`SELECT id FROM keanggotaan WHERE pengguna_id = $1 AND organisasi_id = $2`, [diri, org["ORG-PCS"]]);
    expect((await nonaktif(permintaan(`/api/anggota/x/nonaktif`, { cookie: cookiePengelola }), params(kDiri?.id ?? ""))).status).toBe(400);
    const [kLain] = await kueriPemilik<{ id: string }>(`SELECT id FROM keanggotaan WHERE organisasi_id = $1 LIMIT 1`, [org["ORG-ACB"]]);
    expect((await nonaktif(permintaan(`/api/anggota/x/nonaktif`, { cookie: cookiePengelola }), params(kLain?.id ?? ""))).status).toBe(404);
  });
});

describe("S07-3 akun pribadi", () => {
  it("unduh data pribadi: email sendiri, keanggotaan, persetujuan — tanpa email orang lain", async () => {
    const p = await petugasBaru();
    const r = await dataSaya(permintaan("/api/akun/data-saya", { metode: "GET", cookie: p.cookie }));
    expect(r.headers.get("content-disposition")).toMatch(/attachment/);
    const d = (await r.json()).data;
    expect(d.pengguna.email).toBe(p.email);
    expect(d.keanggotaan).toEqual([expect.objectContaining({ organisasiNama: "Pasar Mekar Sari Kemayoran", peran: "PETUGAS", aktif: true })]);
    expect(d.persetujuan).toEqual([expect.objectContaining({ versi: VERSI, jenis: "LAYANAN" })]);
    expect(JSON.stringify(d)).not.toContain("demo.serah.id");
  });

  it("preferensi notifikasi: bawaan menyala, dapat diubah, hanya untuk organisasi keanggotaan", async () => {
    const p = await petugasBaru();
    const awal = (await (await bacaNtf(permintaan("/api/akun/notifikasi", { metode: "GET", cookie: p.cookie }))).json()).data;
    expect(awal.preferensi).toEqual([{ organisasiId: org["ORG-PCS"], email: true, push: true }]);
    const ubah = await ubahNtf(permintaan("/api/akun/notifikasi", { metode: "PUT", cookie: p.cookie, body: { organisasiId: org["ORG-PCS"], email: false, push: true } }));
    expect((await ubah.json()).data.preferensi).toEqual([{ organisasiId: org["ORG-PCS"], email: false, push: true }]);
    const lain = await ubahNtf(permintaan("/api/akun/notifikasi", { metode: "PUT", cookie: p.cookie, body: { organisasiId: org["ORG-ACB"], email: false, push: false } }));
    expect(lain.status).toBe(404);
  });

  it("T31: hapus akun → email & sandi dihapus permanen, sesi dicabut, keanggotaan nonaktif; data operasional utuh", async () => {
    const p = await petugasBaru();
    // Data operasional kawasan tempat ia bekerja + catatan persetujuannya sendiri (bukan hitungan global: test lain berjalan paralel).
    const kws = `(SELECT id FROM kawasan WHERE kode = 'KWS-PCS')`;
    const srh = `(SELECT id FROM serah WHERE kawasan_id = ${kws})`;
    const kueri: Record<string, string> = {
      wadah_catat: `SELECT count(*) AS n FROM wadah_catat WHERE kawasan_id = ${kws}`,
      serah: `SELECT count(*) AS n FROM serah WHERE kawasan_id = ${kws}`,
      serah_wadah: `SELECT count(*) AS n FROM serah_wadah WHERE serah_id IN ${srh}`,
      event: `SELECT count(*) AS n FROM event WHERE kawasan_id = ${kws}`,
      foto: `SELECT count(*) AS n FROM foto WHERE serah_id IN ${srh}`,
      tiket_timbang: `SELECT count(*) AS n FROM tiket_timbang WHERE serah_id IN ${srh}`,
      penutupan_rincian: `SELECT count(*) AS n FROM penutupan_rincian WHERE serah_id IN ${srh}`,
      koreksi: `SELECT count(*) AS n FROM koreksi WHERE kawasan_id = ${kws}`,
      permintaan_koreksi: `SELECT count(*) AS n FROM permintaan_koreksi WHERE kawasan_id = ${kws}`,
      persetujuan_pdp: `SELECT count(*) AS n FROM persetujuan_pdp WHERE pengguna_id = '${p.id}'`,
    };
    const hitung = async () =>
      Object.fromEntries(await Promise.all(Object.entries(kueri).map(async ([t, q]) => [t, Number((await kueriPemilik<{ n: string }>(q))[0]?.n)] as const)));
    const sebelum = await hitung();
    expect(sebelum.event).toBeGreaterThan(0);

    expect((await hapus(permintaan("/api/akun/hapus", { cookie: p.cookie, body: { konfirmasi: "hapus" } }))).status).toBe(400);
    const r = await hapus(permintaan("/api/akun/hapus", { cookie: p.cookie, body: { konfirmasi: "HAPUS" } }));
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/);

    const [baris] = await kueriPemilik<{ email: string | null; sandi_hash: string | null; dihapus_pada: Date | null }>(
      `SELECT email, sandi_hash, dihapus_pada FROM pengguna WHERE id = $1`,
      [p.id],
    );
    expect(baris).toMatchObject({ email: null, sandi_hash: null });
    expect(baris?.dihapus_pada).toBeInstanceOf(Date);
    const k = await kueriPemilik<{ aktif: boolean }>(`SELECT aktif FROM keanggotaan WHERE pengguna_id = $1`, [p.id]);
    expect(k.length).toBe(1);
    expect(k.every((x) => !x.aktif)).toBe(true);
    expect(await kueriPemilik(`SELECT 1 FROM sesi WHERE pengguna_id = $1 AND dicabut_pada IS NULL`, [p.id])).toHaveLength(0);
    expect((await sesi(permintaan("/api/sesi", { metode: "GET", cookie: p.cookie }))).status).toBe(401);
    expect((await masuk(permintaan("/api/auth/masuk", { body: { email: p.email, sandi: SANDI } }))).status).toBe(400);
    expect(await kueriPemilik(`SELECT 1 FROM pengguna WHERE email = $1`, [p.email])).toHaveLength(0);

    // Tidak ada baris yang hilang. Test lain boleh menambah data kawasan yang sama secara paralel (S08), jadi
    // tabel operasional dibandingkan "tidak berkurang"; persetujuan milik pengguna ini dibandingkan persis.
    const sesudah = await hitung();
    for (const [t, n] of Object.entries(sebelum)) {
      if (t === "persetujuan_pdp") expect(sesudah[t], t).toBe(n);
      else expect(sesudah[t], t).toBeGreaterThanOrEqual(n);
    }
  });
});
