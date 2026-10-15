import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { konfigurasiPada } from "@serah/core/aturan";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { denganSistem } from "@/lib/server/db";
import { muatEnv } from "@/lib/server/env";
import { versiAturan } from "@/lib/server/aturan";
import { jalankanResetDemo } from "@/lib/server/layanan/demo-reset";
import { terapkanStatus } from "@/lib/server/layanan/tagihan";
import { cookieDemo, orgBaru, type OrgUji } from "@/lib/server/uji/akun";
import { kueriPemilik } from "@/lib/server/uji/db";
import { asal, ipBaru } from "@/lib/server/uji/http";
import { GET as aturanGet, POST as aturanPost } from "./admin/aturan/route";
import { GET as auditGet } from "./admin/audit/route";
import { POST as izinPutus } from "./admin/izin/[organisasiId]/putus/route";
import { GET as metrikGet } from "./admin/metrik/route";
import { POST as demoReset } from "./admin/demo/reset/route";
import { GET as organisasiDetail } from "./admin/organisasi/[id]/route";
import { GET as organisasiDaftar } from "./admin/organisasi/route";
import { PUT as entitlementPut } from "./admin/paket/[kode]/entitlement/route";
import { GET as paketGet, POST as paketPost } from "./admin/paket/route";
import { POST as konfirmasi } from "./admin/pembayaran/[tagihanId]/konfirmasi/route";
import { GET as pembayaranGet } from "./admin/pembayaran/route";

// S21 — API admin: alasan wajib & audit (S21-1), organisasi/izin/pembayaran/paket (S21-2), aturan berversi (S21-3),
// audit/metrik/reset demo (S21-4). Butuh DB ber-seed demo (DEMO_MODE=true).

vi.setConfig({ testTimeout: 90_000 });

const ALASAN = "Pemeriksaan rutin uji otomatis";
const rekam = new PengirimRekam();
let admin: string;
let pengelola: string;

beforeAll(async () => {
  setelPengirimUji(rekam);
  [admin, pengelola] = await Promise.all([cookieDemo("ADMIN"), cookieDemo("PENGELOLA")]);
});
afterAll(() => setelPengirimUji(null));

type Opsi = { cookie?: string | undefined; alasan?: string | null; body?: unknown; kueri?: string; params?: Record<string, string> };
type Handler = (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function panggilAdmin(handler: unknown, jalur: string, metode: "GET" | "POST" | "PUT", o: Opsi = {}) {
  const header: Record<string, string> = { origin: asal(), "x-forwarded-for": ipBaru() };
  if (o.cookie ?? admin) header.cookie = (o.cookie ?? admin)!;
  const alasan = o.alasan === undefined ? ALASAN : o.alasan;
  if (alasan !== null) header["x-alasan"] = alasan;
  if (o.body !== undefined) header["content-type"] = "application/json";
  const r = await (handler as Handler)(
    new Request(`${asal()}${jalur}${o.kueri ? `?${o.kueri}` : ""}`, { method: metode, headers: header, ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}) }),
    { params: Promise.resolve(o.params ?? {}) },
  );
  const teks = await r.text();
  // Isi respons diperiksa dengan toMatchObject/toEqual per kasus; bentuknya divalidasi kontrak di rute.test.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: r.status, json: (teks ? JSON.parse(teks) : {}) as { ok: boolean; data?: any; galat?: { kode: string } } };
}

const sqlSatu = async <T extends pg.QueryResultRow>(sql: string, nilai: unknown[] = []) => (await kueriPemilik<T>(sql, nilai))[0];
const idUji = (awal: string) => `${awal}${randomBytes(10).toString("hex")}`;

async function kawasanBaru(): Promise<OrgUji> {
  return orgBaru(rekam, { jenis: "KAWASAN" });
}

/** Tagihan langsung lewat SQL pemilik (alur transfer manual sudah diuji di S19). */
async function tagihanUji(organisasiId: string, status: string, total = 700_000): Promise<{ id: string; nomor: string }> {
  const id = idUji("ujis21tgh");
  const nomor = `TGH-209901-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  await kueriPemilik(
    `INSERT INTO tagihan (id, nomor, organisasi_id, periode, jumlah_tps, harga_per_tps_idr, total_idr, status, jatuh_tempo, dibuat_pada)
     VALUES ($1, $2, $3, '2099-01', 2, $4, $5, $6::"StatusTagihan", current_date + 14, now())`,
    [id, nomor, organisasiId, total / 2, total, status],
  );
  return { id, nomor };
}

describe("S21-1 — X-Alasan wajib & audit_log", () => {
  const rute: [string, unknown, string, "GET" | "POST", Record<string, string>?][] = [
    ["organisasi daftar", organisasiDaftar, "/api/admin/organisasi", "GET"],
    ["organisasi detail", organisasiDetail, "/api/admin/organisasi/x", "GET", { id: "x" }],
    ["pembayaran", pembayaranGet, "/api/admin/pembayaran", "GET"],
    ["paket", paketGet, "/api/admin/paket", "GET"],
    ["aturan", aturanGet, "/api/admin/aturan", "GET"],
    ["audit", auditGet, "/api/admin/audit", "GET"],
    ["metrik", metrikGet, "/api/admin/metrik", "GET"],
    ["demo reset", demoReset, "/api/admin/demo/reset", "POST"],
  ];

  it("tanpa header, kurang dari 15 karakter, atau hanya spasi → 400 sebelum data dibaca", async () => {
    for (const [nama, h, jalur, metode, params] of rute) {
      for (const alasan of [null, "", "terlalu pendek", "               "]) {
        const r = await panggilAdmin(h, jalur, metode, { alasan, ...(params ? { params } : {}) });
        expect(r.status, `${nama} alasan=${JSON.stringify(alasan)}`).toBe(400);
        expect(r.json.galat?.kode).toBe("VALIDASI_GAGAL");
      }
    }
  });

  it("statis: setiap rute di app/api/admin lewat dalamAdmin (tidak ada akses DB langsung di rute)", () => {
    const akar = join(__dirname, "admin");
    const berkas: string[] = [];
    const telusuri = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) telusuri(p);
        else if (n === "route.ts") berkas.push(p);
      }
    };
    telusuri(akar);
    expect(berkas.length).toBe(11);
    for (const f of berkas) {
      const isi = readFileSync(f, "utf8");
      expect(isi, f).toMatch(/dalamAdmin\(/);
      expect(isi, f).not.toMatch(/denganAkses|denganSistem|denganPublik|prisma\(\)/);
    }
  });

  it("bukan ADMIN → 403, tanpa sesi → 401, mutasi tanpa Origin → 400", async () => {
    expect((await panggilAdmin(organisasiDaftar, "/api/admin/organisasi", "GET", { cookie: pengelola })).status).toBe(403);
    expect((await panggilAdmin(metrikGet, "/api/admin/metrik", "GET", { cookie: "" })).status).toBe(401);
    const r = await (paketPost as unknown as (r: Request) => Promise<Response>)(
      new Request(`${asal()}/api/admin/paket`, { method: "POST", headers: { cookie: admin, "x-alasan": ALASAN, "content-type": "application/json" }, body: "{}" }),
    );
    expect(r.status).toBe(400);
  });

  it("setiap pembukaan detail organisasi tercatat: alasan, organisasi sasaran, peran ADMIN", async () => {
    const o = await kawasanBaru();
    const alasan = `Verifikasi pengaduan ${randomUUID().slice(0, 8)}`;
    const sebelum = (await kueriPemilik(`SELECT 1 FROM audit_log WHERE aksi = 'ORGANISASI_DIBUKA' AND objek_id = $1`, [o.organisasiId])).length;
    const r = await panggilAdmin(organisasiDetail, `/api/admin/organisasi/${o.organisasiId}`, "GET", { alasan, params: { id: o.organisasiId } });
    expect(r.status).toBe(200);
    const baris = await kueriPemilik<{ alasan: string; organisasi_id: string; peran: string }>(
      `SELECT alasan, organisasi_id, peran::text FROM audit_log WHERE aksi = 'ORGANISASI_DIBUKA' AND objek_id = $1`,
      [o.organisasiId],
    );
    expect(baris).toHaveLength(sebelum + 1);
    expect(baris.at(-1)).toEqual({ alasan, organisasi_id: o.organisasiId, peran: "ADMIN" });
  });
});

describe("S21-2 — organisasi, izin, pembayaran, paket", () => {
  it("daftar & detail organisasi: jumlah anggota, kawasan, TPS aktif, paket", async () => {
    const o = await kawasanBaru();
    const daftar = (await panggilAdmin(organisasiDaftar, "/api/admin/organisasi", "GET")).json.data.organisasi as { id: string; jenis: string }[];
    expect(daftar.find((x) => x.id === o.organisasiId)?.jenis).toBe("KAWASAN");
    const d = (await panggilAdmin(organisasiDetail, `/api/admin/organisasi/${o.organisasiId}`, "GET", { params: { id: o.organisasiId } })).json.data;
    expect(d).toMatchObject({ jumlahAnggota: 1, jumlahKawasan: 0, jumlahTpsAktif: 0, paketKode: expect.any(String) });
    const tidakAda = `a${"0".repeat(23)}`;
    expect((await panggilAdmin(organisasiDetail, `/api/admin/organisasi/${tidakAda}`, "GET", { params: { id: tidakAda } })).status).toBe(404);
    expect((await panggilAdmin(organisasiDetail, "/api/admin/organisasi/bukan-id", "GET", { params: { id: "bukan-id" } })).status).toBe(400);
  });

  it("putus izin: MENUNGGU → TERVERIFIKASI (izin_putusan + audit); tidak MENUNGGU → 409; bukan pengangkut/penerima → 400", async () => {
    const p = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "FASILITAS_BERIZIN", aliranDiterima: ["KUNING"] });
    await kueriPemilik(`UPDATE organisasi SET status_izin = 'MENUNGGU', nomor_izin = 'IZIN-UJI-S21' WHERE id = $1`, [p.organisasiId]);
    const putus = (id: string, keputusan: string, alasan = "Dokumen izin sudah diperiksa petugas") =>
      panggilAdmin(izinPutus, `/api/admin/izin/${id}/putus`, "POST", { body: { keputusan, alasan }, params: { organisasiId: id } });

    const r = await putus(p.organisasiId, "TERVERIFIKASI");
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.data.organisasi.statusIzin).toBe("TERVERIFIKASI");
    expect(await kueriPemilik(`SELECT keputusan::text FROM izin_putusan WHERE organisasi_id = $1`, [p.organisasiId])).toEqual([{ keputusan: "TERVERIFIKASI" }]);
    expect((await kueriPemilik(`SELECT 1 FROM audit_log WHERE aksi = 'IZIN_DIPUTUS' AND organisasi_id = $1`, [p.organisasiId])).length).toBeGreaterThanOrEqual(1);

    expect((await putus(p.organisasiId, "DITOLAK")).status).toBe(409);
    const k = await kawasanBaru();
    expect((await putus(k.organisasiId, "TERVERIFIKASI")).status).toBe(400);
    // Alasan putusan di body juga ≥15 karakter.
    await kueriPemilik(`UPDATE organisasi SET status_izin = 'MENUNGGU' WHERE id = $1`, [p.organisasiId]);
    expect((await putus(p.organisasiId, "DITOLAK", "pendek")).status).toBe(400);
  });

  it("pembayaran: konfirmasi SETUJUI → LUNAS + langganan AKTIF berharga beku; ulang → 409; TOLAK → kembali TERBIT; uang ganda sesudahnya masuk antrean tinjauan", async () => {
    const o = await kawasanBaru();
    const t = await tagihanUji(o.organisasiId, "MENUNGGU_KONFIRMASI");
    const foto = idUji("ujis21fto");
    await kueriPemilik(
      `INSERT INTO foto (id, jenis, organisasi_id, object_key, dhash, ukuran_byte, lebar, tinggi, diterima_pada) VALUES ($1, 'BUKTI_TRANSFER', $2, $3, 'aaaaaaaaaaaaaaaa', 10, 1, 1, now())`,
      [foto, o.organisasiId, `uji/${foto}`],
    );
    await kueriPemilik(
      `INSERT INTO peristiwa_bayar (id, penyedia, kunci_peristiwa, tagihan_id, jenis, payload, terverifikasi, diterima_pada) VALUES ($1, 'MANUAL', $2, $3, 'BUKTI_TRANSFER', $4::jsonb, true, now())`,
      [idUji("ujis21pby"), `transfer:${t.nomor}:${foto}`, t.id, JSON.stringify({ fotoBuktiId: foto })],
    );

    const daftar = (await panggilAdmin(pembayaranGet, "/api/admin/pembayaran", "GET", { kueri: "status=MENUNGGU_KONFIRMASI" })).json.data;
    expect(daftar.tagihan.find((x: { nomor: string }) => x.nomor === t.nomor)).toMatchObject({ organisasiId: o.organisasiId, status: "MENUNGGU_KONFIRMASI", fotoBuktiId: foto });

    const url = `/api/admin/pembayaran/${t.id}/konfirmasi`;
    const ok = await panggilAdmin(konfirmasi, url, "POST", { body: { keputusan: "SETUJUI", alasan: "Mutasi rekening cocok dengan nominal" }, params: { tagihanId: t.id } });
    expect(ok.status, JSON.stringify(ok.json)).toBe(200);
    expect(ok.json.data.tagihan.status).toBe("LUNAS");
    expect(await sqlSatu(`SELECT status::text, harga_dibekukan_per_tps_idr AS harga FROM langganan WHERE organisasi_id = $1`, [o.organisasiId])).toEqual({ status: "AKTIF", harga: 350_000 });
    expect(await kueriPemilik(`SELECT keputusan::text, foto_bukti_id FROM konfirmasi_manual WHERE tagihan_id = $1`, [t.id])).toEqual([{ keputusan: "SETUJUI", foto_bukti_id: foto }]);
    expect((await panggilAdmin(konfirmasi, url, "POST", { body: { keputusan: "SETUJUI", alasan: "Mutasi rekening cocok dengan nominal" }, params: { tagihanId: t.id } })).status).toBe(409);

    // Pembayaran online datang SESUDAH pelunasan manual: tidak diabaikan diam-diam → antrean tinjauan, status tetap.
    await denganSistem((tx) => terapkanStatus(tx, t.id, { status: "LUNAS", jumlahIdr: 700_000, idTransaksi: `trx-${randomUUID()}`, mentah: {} }, new Date()));
    const lagi = (await panggilAdmin(pembayaranGet, "/api/admin/pembayaran", "GET")).json.data;
    expect(lagi.perluTinjauan.filter((x: { tagihanId: string }) => x.tagihanId === t.id).map((x: { sebab: string }) => x.sebab)).toEqual(["BAYAR_GANDA"]);
    expect(await sqlSatu(`SELECT status::text FROM tagihan WHERE id = $1`, [t.id])).toEqual({ status: "LUNAS" });

    // TOLAK: kembali TERBIT; langganan tidak berubah.
    const o2 = await kawasanBaru();
    const t2 = await tagihanUji(o2.organisasiId, "MENUNGGU_KONFIRMASI");
    const tolak = await panggilAdmin(konfirmasi, `/api/admin/pembayaran/${t2.id}/konfirmasi`, "POST", {
      body: { keputusan: "TOLAK", alasan: "Bukti transfer tidak terbaca jelas" },
      params: { tagihanId: t2.id },
    });
    expect(tolak.json.data.tagihan.status).toBe("TERBIT");
    expect(await sqlSatu(`SELECT status::text FROM langganan WHERE organisasi_id = $1`, [o2.organisasiId])).toEqual({ status: "UJI_COBA" });
    // Tagihan yang tidak menunggu konfirmasi tidak bisa dikonfirmasi.
    const t3 = await tagihanUji(o2.organisasiId, "TERBIT");
    expect((await panggilAdmin(konfirmasi, `/api/admin/pembayaran/${t3.id}/konfirmasi`, "POST", { body: { keputusan: "SETUJUI", alasan: "Percobaan konfirmasi salah" }, params: { tagihanId: t3.id } })).status).toBe(409);
  });

  it("paket: buat (409 bila kode ada), ubah entitlement → perubahan_paket lama & baru; nilai salah tipe → 400; hak nyata dipakai boleh()/batas()", async () => {
    const kode = `UJI_${randomBytes(4).toString("hex").toUpperCase()}`;
    const buat = await panggilAdmin(paketPost, "/api/admin/paket", "POST", {
      body: { kode, urutan: 99, hargaPerTpsIdr: 123_000, berlakuUntuk: "KAWASAN", aktif: false, hak: [{ kunci: "tps.maks", nilai: 3 }, { kunci: "ekspor.pdf", nilai: false }] },
    });
    expect(buat.status, JSON.stringify(buat.json)).toBe(200);
    expect(buat.json.data.paket).toMatchObject({ kode, hargaPerTpsIdr: 123_000, aktif: false });
    expect((await panggilAdmin(paketPost, "/api/admin/paket", "POST", { body: { kode, urutan: 99, hargaPerTpsIdr: 1, berlakuUntuk: "KAWASAN", aktif: false, hak: [] } })).status).toBe(409);
    expect((await panggilAdmin(paketPost, "/api/admin/paket", "POST", { body: { kode: `${kode}X`, urutan: 99, hargaPerTpsIdr: 1, berlakuUntuk: "KAWASAN", aktif: false, hak: [{ kunci: "tps.maks", nilai: true }] } })).status).toBe(400);

    const ubah = await panggilAdmin(entitlementPut, `/api/admin/paket/${kode}/entitlement`, "PUT", { body: { kunci: "tps.maks", nilai: 7 }, params: { kode }, alasan: "Penyesuaian batas TPS uji" });
    expect(ubah.status, JSON.stringify(ubah.json)).toBe(200);
    expect(ubah.json.data.paket.hak).toContainEqual({ kunci: "tps.maks", nilai: 7 });
    expect(await kueriPemilik(`SELECT kunci, nilai_lama, nilai_baru, alasan FROM perubahan_paket WHERE paket_kode = $1 AND kunci = 'tps.maks'`, [kode])).toEqual([
      { kunci: "tps.maks", nilai_lama: 3, nilai_baru: 7, alasan: "Penyesuaian batas TPS uji" },
    ]);
    // tps.maks tak terbatas (null) sah; boolean untuk kunci batas tidak.
    expect((await panggilAdmin(entitlementPut, `/api/admin/paket/${kode}/entitlement`, "PUT", { body: { kunci: "tps.maks", nilai: null }, params: { kode } })).status).toBe(200);
    expect((await panggilAdmin(entitlementPut, `/api/admin/paket/${kode}/entitlement`, "PUT", { body: { kunci: "tps.maks", nilai: true }, params: { kode } })).status).toBe(400);
    expect((await panggilAdmin(entitlementPut, `/api/admin/paket/${kode}/entitlement`, "PUT", { body: { kunci: "ekspor.pdf", nilai: 5 }, params: { kode } })).status).toBe(400);
    expect((await panggilAdmin(entitlementPut, "/api/admin/paket/TIDAK_ADA/entitlement", "PUT", { body: { kunci: "tps.maks", nilai: 1 }, params: { kode: "TIDAK_ADA" } })).status).toBe(404);

    const semua = (await panggilAdmin(paketGet, "/api/admin/paket", "GET")).json.data.paket as { kode: string }[];
    expect(semua.map((p) => p.kode)).toContain(kode);
  });
});

describe("S21-3 — aturan berversi", () => {
  /** Waktu di masa depan jauh yang naik monoton antar-run (versi baru harus sesudah versi terakhir). */
  const waktuBerlaku = () => new Date(Date.UTC(2100, 0, 1) + (Date.now() - Date.UTC(2026, 0, 1)));
  const baru = (o: Record<string, unknown> = {}) => ({
    kode: "R07",
    yurisdiksi: "NASIONAL",
    sumber: "Integritas serah (uji)",
    aksi: "STATUS",
    ambang: { R07_JAM: 36 },
    kunciTeks: "ATURAN_R07",
    berlakuDari: waktuBerlaku().toISOString(),
    ...o,
  });

  it("versi baru: nomor naik, versi lama tak berubah, evaluator memakai ambang baru HANYA untuk kejadian pada/sesudah berlaku_dari", async () => {
    const lamaSebelum = await kueriPemilik(`SELECT id, versi, ambang, berlaku_dari FROM aturan_versi WHERE kode = 'R07' AND yurisdiksi = 'NASIONAL' ORDER BY versi`);
    const versiSebelum = await denganSistem((tx) => versiAturan(tx, "NASIONAL"));
    const berlaku = waktuBerlaku();
    const jam = 100 + Math.floor(Math.random() * 800);
    const r = await panggilAdmin(aturanPost, "/api/admin/aturan", "POST", { body: baru({ berlakuDari: berlaku.toISOString(), ambang: { R07_JAM: jam } }) });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.data.aturan).toMatchObject({ kode: "R07", yurisdiksi: "NASIONAL", versi: lamaSebelum.length + 1, ambang: { R07_JAM: jam } });

    const lamaSesudah = await kueriPemilik(`SELECT id, versi, ambang, berlaku_dari FROM aturan_versi WHERE kode = 'R07' AND yurisdiksi = 'NASIONAL' ORDER BY versi`);
    expect(lamaSesudah.slice(0, lamaSebelum.length)).toEqual(lamaSebelum);

    const versi = await denganSistem((tx) => versiAturan(tx, "NASIONAL"));
    const hariBerlaku = berlaku.toISOString();
    const tepatSebelum = new Date(berlaku.getTime() - 1).toISOString();
    expect(konfigurasiPada(versi, "NASIONAL", hariBerlaku).R07_JAM).toBe(jam);
    // Sedetik sebelum berlaku_dari: hasil sama persis seperti sebelum versi baru ada.
    expect(konfigurasiPada(versi, "NASIONAL", tepatSebelum).R07_JAM).toBe(konfigurasiPada(versiSebelum, "NASIONAL", tepatSebelum).R07_JAM);
    // Kejadian sekarang (jauh sebelum berlaku_dari) tidak terpengaruh.
    expect(konfigurasiPada(versi, "NASIONAL", new Date().toISOString()).R07_JAM).toBe(konfigurasiPada(versiSebelum, "NASIONAL", new Date().toISOString()).R07_JAM);

    // GET menampilkan versi baru dan lama.
    const daftar = (await panggilAdmin(aturanGet, "/api/admin/aturan", "GET")).json.data.aturan as { kode: string; yurisdiksi: string; versi: number }[];
    expect(daftar.filter((a) => a.kode === "R07" && a.yurisdiksi === "NASIONAL").map((a) => a.versi)).toEqual(lamaSesudah.map((a) => a.versi));
  });

  it("ditolak: di masa lalu, tidak setelah versi terakhir, ambang tak sah, aksi/yurisdiksi/kunci teks salah, kunci ambang aturan lain", async () => {
    const kode = async (o: Record<string, unknown>) => (await panggilAdmin(aturanPost, "/api/admin/aturan", "POST", { body: baru(o) })).status;
    expect(await kode({ berlakuDari: new Date(Date.now() - 86_400_000).toISOString() })).toBe(400);
    expect(await kode({ berlakuDari: new Date(Date.now() + 86_400_000).toISOString() })).toBe(400); // sebelum versi terakhir (2100)
    expect(await kode({ ambang: { R07_JAM: 0 } })).toBe(400);
    expect(await kode({ ambang: { R07_JAM: 36, R05_JAM: 10 } })).toBe(400);
    expect(await kode({ ambang: {} })).toBe(400);
    expect(await kode({ aksi: "TOLAK" })).toBe(400);
    expect(await kode({ kunciTeks: "TIDAK_ADA_DI_TEKS" })).toBe(400);
    expect(await kode({ kode: "R01", yurisdiksi: "NASIONAL", aksi: "TOLAK", ambang: {}, kunciTeks: "ATURAN_R01" })).toBe(400); // R-01 hanya DKI
    expect(await kode({ kode: "R01", yurisdiksi: "DKI", aksi: "TOLAK", ambang: { R01_X: 1 }, kunciTeks: "ATURAN_R01" })).toBe(400);
  });

  it("aturan tanpa ambang boleh punya versi baru dengan ambang kosong", async () => {
    const r = await panggilAdmin(aturanPost, "/api/admin/aturan", "POST", {
      body: baru({ kode: "R01", yurisdiksi: "DKI", sumber: "Pergub DKI (uji)", aksi: "TOLAK", ambang: {}, kunciTeks: "ATURAN_R01" }),
    });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json.data.aturan.ambang).toEqual({});
  });
});

describe("S21-4 — audit, metrik, reset demo", () => {
  it("audit: filter aksi & organisasi; baris tanpa nama/email dan tanpa kolom data internal; filter tanggal WIB", async () => {
    const o = await kawasanBaru();
    await panggilAdmin(organisasiDetail, `/api/admin/organisasi/${o.organisasiId}`, "GET", { params: { id: o.organisasiId }, alasan: "Audit uji filter organisasi" });
    const r = await panggilAdmin(auditGet, "/api/admin/audit", "GET", { kueri: `organisasiId=${o.organisasiId}&aksi=ORGANISASI_DIBUKA` });
    expect(r.status).toBe(200);
    const baris = r.json.data.audit as Record<string, unknown>[];
    expect(baris).toHaveLength(1);
    expect(Object.keys(baris[0]!).sort()).toEqual(["aksi", "alasan", "dibuatPada", "id", "objekId", "objekJenis", "organisasiId", "peran"]);
    expect(JSON.stringify(baris)).not.toMatch(/@/); // tidak ada alamat email
    expect(baris[0]).toMatchObject({ alasan: "Audit uji filter organisasi", peran: "ADMIN" });

    const hariIni = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const hariIniFilter = await panggilAdmin(auditGet, "/api/admin/audit", "GET", { kueri: `dari=${hariIni}&sampai=${hariIni}&organisasiId=${o.organisasiId}` });
    expect(hariIniFilter.json.data.audit.length).toBeGreaterThanOrEqual(1);
    const kemarin = new Date(Date.now() + 7 * 3_600_000 - 2 * 86_400_000).toISOString().slice(0, 10);
    const lampau = await panggilAdmin(auditGet, "/api/admin/audit", "GET", { kueri: `sampai=${kemarin}&organisasiId=${o.organisasiId}` });
    expect(lampau.json.data.audit).toEqual([]);
    expect((await panggilAdmin(auditGet, "/api/admin/audit", "GET", { kueri: "nama=budi" })).status).toBe(400);
  });

  it("metrik: tiga angka agregat sesuai hitungan SQL independen; tidak ada metrik per orang", async () => {
    for (let percobaan = 0; percobaan < 3; percobaan++) {
      const r = await panggilAdmin(metrikGet, "/api/admin/metrik", "GET");
      expect(r.status).toBe(200);
      expect(Object.keys(r.json.data).sort()).toEqual(["hariTpsTercatatBp", "kawasanAktif7Hari", "serahTertutupBp"]);
      const m = r.json.data as { serahTertutupBp: number; hariTpsTercatatBp: number; kawasanAktif7Hari: number };
      const s = (await sqlSatu<{ diangkut: string; tutup: string; tps: string; tercatat: string; aktif: string }>(
        `SELECT
           (SELECT count(*) FROM serah WHERE status IN ('DIANGKUT','MENGGANTUNG','DITERIMA','DITERIMA_SEBAGIAN','DITOLAK'))::text AS diangkut,
           (SELECT count(*) FROM serah WHERE status IN ('DITERIMA','DITERIMA_SEBAGIAN','DITOLAK'))::text AS tutup,
           (SELECT count(*) FROM tps WHERE aktif)::text AS tps,
           (SELECT count(*) FROM (SELECT DISTINCT w.tps_id, (w.terjadi_pada AT TIME ZONE 'Asia/Jakarta')::date FROM wadah_catat w JOIN tps t ON t.id = w.tps_id
              WHERE t.aktif AND w.terjadi_pada >= now() - interval '30 days' AND w.terjadi_pada < now()) x)::text AS tercatat,
           (SELECT count(*) FROM (SELECT kawasan_id FROM wadah_catat WHERE diterima_pada >= now() - interval '7 days'
              UNION SELECT kawasan_id FROM event WHERE diterima_pada >= now() - interval '7 days') x)::text AS aktif`,
      ))!;
      const bp = (a: number, b: number) => (b <= 0 ? 0 : Math.min(10_000, Math.floor((a * 10_000) / b)));
      const harap = { serahTertutupBp: bp(Number(s.tutup), Number(s.diangkut)), hariTpsTercatatBp: bp(Number(s.tercatat), Number(s.tps) * 30), kawasanAktif7Hari: Number(s.aktif) };
      // Berkas test lain menulis data bersamaan: beri 3 kesempatan sampai kedua pembacaan sama.
      if (JSON.stringify(m) === JSON.stringify(harap) || percobaan === 2) {
        expect(m).toEqual(harap);
        for (const v of [m.serahTertutupBp, m.hariTpsTercatatBp]) expect(v).toBeLessThanOrEqual(10_000);
        break;
      }
    }
  });

  it("reset demo via rute: DEMO_MODE=false → 404 dan tidak menyentuh data", async () => {
    const env = muatEnv() as { DEMO_MODE: boolean };
    const lama = env.DEMO_MODE;
    env.DEMO_MODE = false;
    try {
      // Data demo & jejak reset tidak tersentuh (jumlah baris global tidak dibandingkan: test lain menulis paralel).
      const reset = async () => (await sqlSatu<{ n: string }>(`SELECT count(*)::text AS n FROM audit_log WHERE aksi = 'DEMO_RESET'`))!.n;
      const sebelum = await reset();
      expect((await panggilAdmin(demoReset, "/api/admin/demo/reset", "POST")).status).toBe(404);
      expect(await reset()).toBe(sebelum);
      expect(await sqlSatu(`SELECT 1 AS ada FROM organisasi WHERE kode = 'ORG-PCS'`)).toEqual({ ada: 1 });
    } finally {
      env.DEMO_MODE = lama;
    }
  });

  it("reset demo: skrip menolak tanpa DEMO_MODE; dijalankan 2× pada skema terpisah menghasilkan data yang sama", async () => {
    const url = process.env.DATABASE_URL_MIGRASI;
    if (!url) throw new Error("DATABASE_URL_MIGRASI kosong");
    // URL tanpa parameter ?schema= (dipakai pg), lalu skema sementara diatur lewat search_path.
    const tanpaSkema = new URL(url);
    expect(tanpaSkema.searchParams.get("schema")).toBeTruthy();
    tanpaSkema.searchParams.delete("schema");
    const connectionString = tanpaSkema.toString();
    const skema = `uji_reset_${randomBytes(4).toString("hex")}`;
    const klien = () => new pg.Client({ connectionString, options: `-c search_path=${skema}` });
    const akar = join(__dirname, "..", "..", "..", "..", "packages", "db", "prisma", "migrations");

    const pembuat = new pg.Client({ connectionString });
    await pembuat.connect();
    await pembuat.query(`CREATE SCHEMA "${skema}"`);
    await pembuat.end();
    const dasar = klien();
    await dasar.connect();
    try {
      const folder = readdirSync(akar).filter((n) => /^\d+_/.test(n)).sort();
      for (const f of folder) {
        const sql = readFileSync(join(akar, f, "migration.sql"), "utf8").replace(/CREATE SCHEMA IF NOT EXISTS "[^"]+";/, "");
        await dasar.query(sql);
      }
    } finally {
      await dasar.end();
    }

    const lamaMigrasi = process.env.DATABASE_URL_MIGRASI;
    const baseUrl = new URL(url);
    baseUrl.searchParams.set("schema", skema);
    process.env.DATABASE_URL_MIGRASI = baseUrl.toString();
    try {
      const ringkas = async () => {
        const k = klien();
        await k.connect();
        try {
          const tabel = (await k.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename <> '_prisma_migrations' ORDER BY 1`, [skema])).rows.map((r) => r.tablename);
          const hitung: Record<string, number> = {};
          for (const t of tabel) hitung[t] = Number((await k.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n);
          const org = (await k.query(`SELECT kode FROM organisasi ORDER BY kode`)).rows.map((r) => r.kode as string);
          const serah = (await k.query(`SELECT kode, status::text FROM serah ORDER BY kode`)).rows.map((r) => `${r.kode}:${r.status}`);
          const reset = (await k.query(`SELECT alasan FROM audit_log WHERE aksi = 'DEMO_RESET'`)).rows.map((r) => r.alasan as string);
          return { hitung, org, serah, reset };
        } finally {
          await k.end();
        }
      };

      await jalankanResetDemo("Reset demo uji pertama");
      const pertama = await ringkas();
      expect(pertama.org).toContain("ORG-PCS");
      expect(pertama.hitung.event).toBeGreaterThan(0);
      expect(pertama.reset).toEqual(["Reset demo uji pertama"]);

      // Data tambahan di antara dua reset (organisasi non-demo) hilang pada reset kedua.
      const k = klien();
      await k.connect();
      await k.query(`INSERT INTO organisasi (id, kode, nama, jenis, status_izin, yurisdiksi, demo, dibuat_pada) VALUES ('ujis21reset01', 'ORG-UJI-RESET', 'Org Uji Reset', 'KAWASAN', 'BELUM_DIAJUKAN', 'DKI', false, now())`);
      await k.end();

      await jalankanResetDemo("Reset demo uji kedua");
      const kedua = await ringkas();
      expect(kedua.org).not.toContain("ORG-UJI-RESET");
      expect(kedua.hitung).toEqual(pertama.hitung);
      expect(kedua.org).toEqual(pertama.org);
      expect(kedua.serah).toEqual(pertama.serah);
      expect(kedua.reset).toEqual(["Reset demo uji kedua"]);
    } finally {
      process.env.DATABASE_URL_MIGRASI = lamaMigrasi;
      const bersih = new pg.Client({ connectionString });
      await bersih.connect();
      await bersih.query(`DROP SCHEMA "${skema}" CASCADE`);
      await bersih.end();
    }
  });
});
