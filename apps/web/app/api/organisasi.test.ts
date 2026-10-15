import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { denganAkses } from "@/lib/server/db";
import { GalatApi } from "@/lib/server/galat";
import { ubahKawasan as ubahKawasanLayanan } from "@/lib/server/layanan/organisasi";
import { tokenQrTps } from "@/lib/server/layanan/tps";
import { SANDI_UJI, VERSI_PERSETUJUAN, cookieDemo, orgBaru, type OrgUji } from "@/lib/server/uji/akun";
import { kueriPemilik } from "@/lib/server/uji/db";
import { emailBaru, permintaan } from "@/lib/server/uji/http";
import { GET as direktori } from "./direktori/mitra/route";
import { GET as daftarKawasan, POST as buatKawasan } from "./kawasan/route";
import { PATCH as ubahKawasan } from "./kawasan/[id]/route";
import { GET as daftarKendaraan, POST as buatKendaraan } from "./kendaraan/route";
import { POST as nonaktifKendaraan } from "./kendaraan/[id]/nonaktif/route";
import { PATCH as ubahSaya, GET as bacaSaya } from "./organisasi/saya/route";
import { POST as buatOrganisasi } from "./organisasi/route";
import { GET as sesi } from "./sesi/route";
import { GET as pindai } from "./tps/qr/[token]/route";
import { GET as daftarTps, POST as buatTps } from "./tps/route";
import { PATCH as ubahTps } from "./tps/[id]/route";
import { GET as gambarQr } from "./tps/[id]/qr/route";
import { POST as qrBaru } from "./tps/[id]/qr-baru/route";
import { POST as undang } from "./undangan/route";
import { POST as terima } from "./undangan/terima/route";

// S13-1..3 — integrasi organisasi, kawasan, TPS, QR, kendaraan, direktori. Butuh DB ber-seed demo (DEMO_MODE=true).

// Alur ini membuat banyak organisasi lewat API sungguhan dan berbagi Postgres dengan jendela kerja lain: beri waktu longgar.
vi.setConfig({ testTimeout: 60_000 });

const rekam = new PengirimRekam();
beforeAll(() => setelPengirimUji(rekam));
afterAll(() => setelPengirimUji(null));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const KAWASAN = { jenis: "KOMERSIAL", alamat: "Alamat uji", adm4: "31.71.03.1001", kota: "Jakarta Pusat" };

async function kawasanBaru(o: OrgUji, nama = "Pasar Uji Sentosa") {
  const r = await buatKawasan(permintaan("/api/kawasan", { cookie: o.cookie, body: { nama, ...KAWASAN } }));
  expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
  return (await r.json()).data.kawasan as { id: string; kode: string; adm4: string; kodeKecamatan: string };
}

async function tpsBaru(o: OrgUji, kawasanId: string, nama = "TPS Uji") {
  return buatTps(permintaan("/api/tps", { cookie: o.cookie, body: { kawasanId, nama, latE6: -6_161_234, lonE6: 106_845_678 } }));
}

describe("S13-1 organisasi", () => {
  it("KAWASAN baru: pembuat jadi pengurus PENGELOLA, langganan uji coba 14 hari (tengah malam WIB), sesi pindah ke organisasi baru", async () => {
    const o = await orgBaru(rekam, { jenis: "KAWASAN", nama: "Kawasan Uji Satu" });
    const [lg] = await kueriPemilik<{ paket_kode: string; status: string; mulai: Date; selesai: Date }>(
      `SELECT paket_kode, status, uji_coba_mulai AS mulai, uji_coba_selesai AS selesai FROM langganan WHERE organisasi_id = $1`,
      [o.organisasiId],
    );
    expect(lg).toMatchObject({ paket_kode: "KAWASAN_UJI_COBA", status: "UJI_COBA" });
    expect(lg?.mulai.toISOString().slice(11)).toBe("17:00:00.000Z");
    expect((lg!.selesai.getTime() - lg!.mulai.getTime()) / 86_400_000).toBe(14);
    expect(await kueriPemilik(`SELECT 1 FROM peristiwa_langganan WHERE langganan_id IN (SELECT id FROM langganan WHERE organisasi_id = $1)`, [o.organisasiId])).toHaveLength(1);
    const [a] = await kueriPemilik<{ peran: string; pengurus: boolean; aktif: boolean }>(`SELECT peran, pengurus, aktif FROM keanggotaan WHERE organisasi_id = $1`, [o.organisasiId]);
    expect(a).toEqual({ peran: "PENGELOLA", pengurus: true, aktif: true });

    const s = (await (await sesi(permintaan("/api/sesi", { metode: "GET", cookie: o.cookie }))).json()).data;
    expect(s).toMatchObject({ organisasiAktif: { id: o.organisasiId, nama: "Kawasan Uji Satu", jenis: "KAWASAN" }, peran: "PENGELOLA", paket: "KAWASAN_UJI_COBA" });
    expect(s.hak).toContainEqual({ kunci: "tps.maks", nilai: 10 });
  });

  it("PENGANGKUT & PENERIMA baru: peran sesuai jenis, tanpa langganan; PENERIMA wajib jenis & aliran; hanya PENERIMA yang boleh", async () => {
    const p = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    const r = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "FASILITAS_BERIZIN", aliranDiterima: ["KUNING", "ABU"] });
    expect((await (await sesi(permintaan("/api/sesi", { metode: "GET", cookie: p.cookie }))).json()).data).toMatchObject({ peran: "PENGANGKUT", paket: "MITRA" });
    expect((await (await sesi(permintaan("/api/sesi", { metode: "GET", cookie: r.cookie }))).json()).data).toMatchObject({ peran: "PENERIMA", paket: "MITRA" });
    expect(await kueriPemilik(`SELECT 1 FROM langganan WHERE organisasi_id = ANY($1)`, [[p.organisasiId, r.organisasiId]])).toHaveLength(0);
    const [o] = await kueriPemilik<{ jenis_penerima: string; aliran_diterima: string[]; status_izin: string }>(`SELECT jenis_penerima, aliran_diterima::text[] AS aliran_diterima, status_izin FROM organisasi WHERE id = $1`, [r.organisasiId]);
    expect(o).toEqual({ jenis_penerima: "FASILITAS_BERIZIN", aliran_diterima: ["KUNING", "ABU"], status_izin: "BELUM_DIAJUKAN" });

    const tanpa = await buatOrganisasi(permintaan("/api/organisasi", { cookie: p.cookie, body: { jenis: "PENERIMA", nama: "Tanpa Jenis", yurisdiksi: "DKI" } }));
    expect(tanpa.status).toBe(400);
    const salah = await buatOrganisasi(permintaan("/api/organisasi", { cookie: p.cookie, body: { jenis: "KAWASAN", nama: "Kawasan Salah", yurisdiksi: "DKI", jenisPenerima: "TPS3R" } }));
    expect(salah.status).toBe(400);
  });

  it("GET/PATCH /saya: pengurus saja; aliranDiterima hanya untuk PENERIMA", async () => {
    const o = await orgBaru(rekam, { jenis: "KAWASAN", nama: "Kawasan Ubah" });
    const ubah = await ubahSaya(permintaan("/api/organisasi/saya", { metode: "PATCH", cookie: o.cookie, body: { nama: "Kawasan Ubah Baru" } }));
    expect((await ubah.json()).data.organisasi.nama).toBe("Kawasan Ubah Baru");
    expect((await (await bacaSaya(permintaan("/api/organisasi/saya", { metode: "GET", cookie: o.cookie }))).json()).data.organisasi.nama).toBe("Kawasan Ubah Baru");
    const aliran = await ubahSaya(permintaan("/api/organisasi/saya", { metode: "PATCH", cookie: o.cookie, body: { aliranDiterima: ["KUNING"] } }));
    expect(aliran.status).toBe(400);

    const cookiePetugas = await cookieDemo("PETUGAS");
    expect((await bacaSaya(permintaan("/api/organisasi/saya", { metode: "GET", cookie: cookiePetugas }))).status).toBe(403);
    expect((await ubahSaya(permintaan("/api/organisasi/saya", { metode: "PATCH", cookie: cookiePetugas, body: { nama: "X Orang" } }))).status).toBe(403);
  });
});

describe("S13-2 kawasan, TPS, QR", () => {
  it("kawasan: kode KWS unik walau nama kembar; adm4 tidak valid ditolak; kode kecamatan dari adm4; milik organisasi lain 404", async () => {
    const a = await orgBaru(rekam, { jenis: "KAWASAN" });
    const b = await orgBaru(rekam, { jenis: "KAWASAN" });
    const k1 = await kawasanBaru(a, "Pasar Kembar Raya");
    const k2 = await kawasanBaru(b, "Pasar Kembar Raya");
    expect(k1.kode).toMatch(/^KWS-[A-Z]{3,5}$/);
    expect(k2.kode).toMatch(/^KWS-[A-Z]{3,5}$/);
    expect(k2.kode).not.toBe(k1.kode);
    expect(k1.kodeKecamatan).toBe("31.71.03");

    const buruk = await buatKawasan(permintaan("/api/kawasan", { cookie: a.cookie, body: { nama: "Adm Buruk", ...KAWASAN, adm4: "3171031001" } }));
    expect(buruk.status).toBe(400);

    const ubah = await ubahKawasan(permintaan("/api/kawasan/x", { metode: "PATCH", cookie: a.cookie, body: { adm4: "31.71.04.1002", nama: "Pasar Kembar Raya Dua" } }), ctx(k1.id));
    expect((await ubah.json()).data.kawasan).toMatchObject({ adm4: "31.71.04.1002", kodeKecamatan: "31.71.04", kode: k1.kode });
    // Organisasi lain tidak melihat/mengubah kawasan ini.
    expect((await ubahKawasan(permintaan("/api/kawasan/x", { metode: "PATCH", cookie: b.cookie, body: { nama: "Curian" } }), ctx(k1.id))).status).toBe(404);
    const milikA = (await (await daftarKawasan(permintaan("/api/kawasan", { metode: "GET", cookie: a.cookie }))).json()).data.kawasan;
    expect(milikA.map((k: { id: string }) => k.id)).toEqual([k1.id]);
  });

  it("lapis kedua: walau RLS dilonggarkan (kedua organisasi terlihat), kawasan organisasi lain tetap 404", async () => {
    const a = await orgBaru(rekam, { jenis: "KAWASAN" });
    const b = await orgBaru(rekam, { jenis: "KAWASAN" });
    const k = await kawasanBaru(a);
    const sesiB = { id: "s", penggunaId: b.penggunaId, organisasiAktifId: b.organisasiId, peran: "PENGELOLA" as const };
    const galat = await denganAkses({ penggunaId: b.penggunaId, orgIds: [a.organisasiId, b.organisasiId], peran: "PENGELOLA" }, (tx) =>
      ubahKawasanLayanan(tx, sesiB, k.id, { nama: "Curian" }),
    ).catch((e: unknown) => e);
    expect(galat).toBeInstanceOf(GalatApi);
    expect((galat as GalatApi).kode).toBe("TIDAK_DITEMUKAN");
  });

  it("TPS: kode berurutan TPS-<KWS>-NN, tampilan tanpa data pribadi; kawasan orang lain 404; koordinat di luar rentang 400", async () => {
    const a = await orgBaru(rekam, { jenis: "KAWASAN" });
    const b = await orgBaru(rekam, { jenis: "KAWASAN" });
    const k = await kawasanBaru(a);
    const t1 = (await (await tpsBaru(a, k.id, "TPS Satu")).json()).data.tps;
    const t2 = (await (await tpsBaru(a, k.id, "TPS Dua")).json()).data.tps;
    expect(t1).toMatchObject({ kode: `TPS-${k.kode.slice(4)}-01`, latE6: -6_161_234, lonE6: 106_845_678, aktif: true, qrVersi: 1 });
    expect(t2.kode).toBe(`TPS-${k.kode.slice(4)}-02`);

    expect((await tpsBaru(b, k.id)).status).toBe(404);
    const luar = await buatTps(permintaan("/api/tps", { cookie: a.cookie, body: { kawasanId: k.id, nama: "Luar", latE6: 91_000_000, lonE6: 0 } }));
    expect(luar.status).toBe(400);
    const daftar = (await (await daftarTps(permintaan("/api/tps", { metode: "GET", cookie: a.cookie }))).json()).data.tps;
    expect(daftar.map((t: { kode: string }) => t.kode)).toEqual([t1.kode, t2.kode]);
    expect(Object.keys(daftar[0]).sort()).toEqual(["aktif", "id", "kawasanId", "kode", "latE6", "lonE6", "nama", "qrVersi"]);

    const ubah = await ubahTps(permintaan("/api/tps/x", { metode: "PATCH", cookie: a.cookie, body: { nama: "TPS Satu Baru", latE6: -6_170_000 } }), ctx(t1.id));
    expect((await ubah.json()).data.tps).toMatchObject({ nama: "TPS Satu Baru", latE6: -6_170_000, lonE6: 106_845_678 });
    expect((await ubahTps(permintaan("/api/tps/x", { metode: "PATCH", cookie: b.cookie, body: { nama: "Curian" } }), ctx(t1.id))).status).toBe(404);
  });

  it("batas tps.maks (uji coba = 10): TPS ke-11 → 403 HAK_PAKET_TIDAK_ADA; menonaktifkan membebaskan slot; mengaktifkan kembali tunduk batas", async () => {
    const a = await orgBaru(rekam, { jenis: "KAWASAN" });
    const k = await kawasanBaru(a);
    const id: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const r = await tpsBaru(a, k.id, `TPS ${i}`);
      expect(r.status, `TPS ${i}`).toBe(200);
      id.push((await r.json()).data.tps.id);
    }
    const ke11 = await tpsBaru(a, k.id, "TPS 11");
    expect(ke11.status).toBe(403);
    const g = (await ke11.json()).galat;
    expect(g).toMatchObject({ kode: "HAK_PAKET_TIDAK_ADA", pesan: "Fitur ini tersedia pada paket berbayar. Pencatatan dan ekspor CSV tetap dapat dipakai." });

    expect((await ubahTps(permintaan("/api/tps/x", { metode: "PATCH", cookie: a.cookie, body: { aktif: false } }), ctx(id[0]!))).status).toBe(200);
    const pengganti = await tpsBaru(a, k.id, "TPS Pengganti");
    expect(pengganti.status).toBe(200);
    expect((await pengganti.json()).data.tps.kode.endsWith("-11")).toBe(true);
    expect((await ubahTps(permintaan("/api/tps/x", { metode: "PATCH", cookie: a.cookie, body: { aktif: true } }), ctx(id[0]!))).status).toBe(403);
    // Mengubah nama TPS yang nonaktif tidak terkena batas.
    expect((await ubahTps(permintaan("/api/tps/x", { metode: "PATCH", cookie: a.cookie, body: { nama: "Nama Baru" } }), ctx(id[0]!))).status).toBe(200);
  });

  it("QR: gambar SVG/PNG untuk dicetak; token terpindai dikenal; QR baru mencabut yang lama (G_QR_TIDAK_DIKENAL)", async () => {
    const a = await orgBaru(rekam, { jenis: "KAWASAN" });
    const b = await orgBaru(rekam, { jenis: "KAWASAN" });
    const k = await kawasanBaru(a);
    const tps = (await (await tpsBaru(a, k.id)).json()).data.tps;

    const svg = await gambarQr(permintaan(`/api/tps/${tps.id}/qr?format=svg`, { metode: "GET", cookie: a.cookie }), ctx(tps.id));
    expect(svg.status).toBe(200);
    expect(svg.headers.get("content-type")).toBe("image/svg+xml");
    expect(svg.headers.get("cache-control")).toBe("private, no-store");
    const svgV1 = await svg.text();
    expect(svgV1).toContain("<svg");
    const png = await gambarQr(permintaan(`/api/tps/${tps.id}/qr?format=png`, { metode: "GET", cookie: a.cookie }), ctx(tps.id));
    expect(png.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await png.arrayBuffer()).slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await gambarQr(permintaan(`/api/tps/${tps.id}/qr?format=gif`, { metode: "GET", cookie: a.cookie }), ctx(tps.id))).status).toBe(400);
    // Organisasi lain tidak dapat mengambil QR; hanya sidik token yang tersimpan.
    expect((await gambarQr(permintaan(`/api/tps/${tps.id}/qr`, { metode: "GET", cookie: b.cookie }), ctx(tps.id))).status).toBe(404);
    const [baris] = await kueriPemilik<{ qr_token_hash: string }>(`SELECT qr_token_hash FROM tps WHERE id = $1`, [tps.id]);
    expect(baris?.qr_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(baris)).not.toContain(tokenQrTps(tps.id, 1));

    const lama = tokenQrTps(tps.id, 1);
    const dikenal = await pindai(permintaan(`/api/tps/qr/${lama}`, { metode: "GET", cookie: a.cookie }), { params: Promise.resolve({ token: lama }) });
    expect(dikenal.status).toBe(200);
    expect((await dikenal.json()).data).toMatchObject({ tps: { id: tps.id, kode: tps.kode }, kawasan: { id: k.id } });

    const baru = await qrBaru(permintaan(`/api/tps/${tps.id}/qr-baru`, { cookie: a.cookie }), ctx(tps.id));
    expect(baru.status).toBe(200);
    const { qrVersi, qrToken } = (await baru.json()).data;
    expect(qrVersi).toBe(2);
    expect(qrToken).toBe(tokenQrTps(tps.id, 2));
    expect(Buffer.from(qrToken, "base64url")).toHaveLength(32);

    const tolak = await pindai(permintaan(`/api/tps/qr/${lama}`, { metode: "GET", cookie: a.cookie }), { params: Promise.resolve({ token: lama }) });
    expect(tolak.status).toBe(404);
    expect((await tolak.json()).galat.pesan).toBe("Kode QR tidak dikenal. Pastikan Anda memindai QR dari SERAH.");
    const sah = await pindai(permintaan(`/api/tps/qr/${qrToken}`, { metode: "GET", cookie: a.cookie }), { params: Promise.resolve({ token: qrToken }) });
    expect(sah.status).toBe(200);
    expect(await (await gambarQr(permintaan(`/api/tps/${tps.id}/qr`, { metode: "GET", cookie: a.cookie }), ctx(tps.id))).text()).not.toBe(svgV1);
    // Organisasi lain tidak boleh mencabut QR.
    expect((await qrBaru(permintaan(`/api/tps/${tps.id}/qr-baru`, { cookie: b.cookie }), ctx(tps.id))).status).toBe(404);
  });

  it("TPS demo (seed) tetap bisa dicetak QR-nya dan terpindai", async () => {
    const cookie = await cookieDemo("PENGELOLA");
    const [t] = await kueriPemilik<{ id: string }>(`SELECT id FROM tps WHERE kode = 'TPS-PCS-01'`);
    const r = await gambarQr(permintaan(`/api/tps/${t?.id}/qr`, { metode: "GET", cookie }), ctx(t?.id ?? ""));
    expect(r.status).toBe(200);
    const ok = await pindai(permintaan("/api/tps/qr/demo-qr-TPS-PCS-01", { metode: "GET", cookie }), { params: Promise.resolve({ token: "demo-qr-TPS-PCS-01" }) });
    expect(ok.status).toBe(200);
  });
});

describe("S13-3 kendaraan & direktori", () => {
  it("kendaraan: tambah plat, duplikat ditolak, daftar, nonaktifkan; organisasi lain tak melihat; bukan pengurus ditolak", async () => {
    const p = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    const lain = await orgBaru(rekam, { jenis: "PENGANGKUT" });
    const r = await buatKendaraan(permintaan("/api/kendaraan", { cookie: p.cookie, body: { plat: "B 1234 ABC" } }));
    expect(r.status).toBe(200);
    const kendaraan = (await r.json()).data.kendaraan;
    expect(kendaraan).toMatchObject({ plat: "B 1234 ABC", aktif: true });
    expect(Object.keys(kendaraan).sort()).toEqual(["aktif", "id", "plat"]);

    expect((await buatKendaraan(permintaan("/api/kendaraan", { cookie: p.cookie, body: { plat: "B 1234 ABC" } }))).status).toBe(400);
    expect((await buatKendaraan(permintaan("/api/kendaraan", { cookie: p.cookie, body: { plat: "1234 ABC" } }))).status).toBe(400);
    expect((await buatKendaraan(permintaan("/api/kendaraan", { cookie: lain.cookie, body: { plat: "B 1234 ABC" } }))).status).toBe(200);

    expect((await (await daftarKendaraan(permintaan("/api/kendaraan", { metode: "GET", cookie: p.cookie }))).json()).data.kendaraan).toHaveLength(1);
    expect((await nonaktifKendaraan(permintaan("/api/kendaraan/x/nonaktif", { cookie: lain.cookie }), ctx(kendaraan.id))).status).toBe(404);
    const non = await nonaktifKendaraan(permintaan("/api/kendaraan/x/nonaktif", { cookie: p.cookie }), ctx(kendaraan.id));
    expect((await non.json()).data.kendaraan).toMatchObject({ id: kendaraan.id, aktif: false });

    // Anggota pengangkut yang bukan pengurus tidak boleh mengelola kendaraan.
    const emailAnggota = emailBaru();
    const u = await undang(permintaan("/api/undangan", { cookie: p.cookie, body: { email: emailAnggota, peran: "PENGANGKUT" } }));
    expect(u.status).toBe(200);
    const token = rekam.terkirim.filter((x) => x.ke === emailAnggota).at(-1)?.teks.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    const t = await terima(permintaan("/api/undangan/terima", { body: { token, email: emailAnggota, sandi: SANDI_UJI, persetujuanVersi: VERSI_PERSETUJUAN } }));
    expect(t.status).toBe(200);
    const cookieAnggota = (t.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    expect((await buatKendaraan(permintaan("/api/kendaraan", { cookie: cookieAnggota, body: { plat: "B 9999 ZZZ" } }))).status).toBe(403);
  });

  it("direktori mitra: pengangkut & penerima (nama badan usaha, jenis, status izin, aliran) tanpa data pribadi; hanya PENGELOLA", async () => {
    const cookie = await cookieDemo("PENGELOLA");
    const semua = (await (await direktori(permintaan("/api/direktori/mitra", { metode: "GET", cookie }))).json()).data.mitra as Record<string, unknown>[];
    const nama = semua.map((m) => m.nama);
    expect(nama).toEqual(expect.arrayContaining(["Angkut Contoh Bersih", "Daur Ulang Contoh Mandiri", "Pelapak Contoh Baru", "TPST Contoh"]));
    expect(semua.every((m) => m.jenis === "PENGANGKUT" || m.jenis === "PENERIMA")).toBe(true);
    expect(nama).not.toContain("Pasar Contoh Sejahtera");
    for (const m of semua) expect(Object.keys(m).sort()).toEqual(["aliranDiterima", "id", "jenis", "jenisPenerima", "nama", "statusIzin"]);
    expect(JSON.stringify(semua)).not.toContain("@");

    const hanyaPengangkut = (await (await direktori(permintaan("/api/direktori/mitra?jenis=PENGANGKUT", { metode: "GET", cookie }))).json()).data.mitra as { jenis: string }[];
    expect(hanyaPengangkut.length).toBeGreaterThan(0);
    expect(hanyaPengangkut.every((m) => m.jenis === "PENGANGKUT")).toBe(true);
    const pelapak = semua.find((m) => m.nama === "Pelapak Contoh Baru");
    expect(pelapak).toMatchObject({ jenisPenerima: "PELAPAK_BERIZIN", statusIzin: "MENUNGGU", aliranDiterima: ["KUNING"] });

    expect((await direktori(permintaan("/api/direktori/mitra", { metode: "GET", cookie: await cookieDemo("PETUGAS") }))).status).toBe(403);
    expect((await direktori(permintaan("/api/direktori/mitra", { metode: "GET", cookie: await cookieDemo("PENGANGKUT") }))).status).toBe(403);
  });
});
