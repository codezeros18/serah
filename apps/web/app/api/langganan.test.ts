import { randomUUID } from "node:crypto";
import { namaUnik } from "@/lib/server/uji/nama";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { periodeWib } from "@serah/core/waktu";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setelPenyediaUji } from "@/lib/adaptor/bayar";
import { SandboxTiruan } from "@/lib/adaptor/bayar/uji";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { denganSistem } from "@/lib/server/db";
import { muatEnv } from "@/lib/server/env";
import { aturIntegrasi, penyimpananLokal } from "@/lib/server/integrasi-stub";
import { PAKET_BERBAYAR } from "@/lib/server/hak";
import { kerjaLanggananHarian } from "@/lib/server/layanan/langganan";
import { JENIS_PERLU_TINJAUAN } from "@/lib/server/layanan/tagihan";
import { orgBaru, type OrgUji } from "@/lib/server/uji/akun";
import { asal, data, demo, formFoto, masuk, panggil, pngContoh, satu, semua, type DemoS08 } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { POST as buatKawasan } from "./kawasan/route";
import { GET as ekspor } from "./laporan/[pihak]/ekspor/route";
import { GET as bacaLangganan } from "./langganan/route";
import { GET as daftarPaket } from "./paket/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { POST as bayar } from "./tagihan/[nomor]/bayar/route";
import { GET as tarikStatus } from "./tagihan/[nomor]/status/route";
import { POST as transfer } from "./tagihan/[nomor]/transfer/route";
import { GET as daftarTagihan } from "./tagihan/route";
import { POST as buatTps } from "./tps/route";
import { POST as catatWadah } from "./wadah/route";
import { POST as webhook } from "./webhook/midtrans/route";

// S19 — langganan & pembayaran. Penyedia = sandbox TIRUAN (fetch palsu di adaptor); pembayaran sandbox sungguhan
// menunggu kunci P-02. T25: webhook (tanda tangan, idempoten, tarik status, kejanggalan → antrean admin).
// T24: pencatatan, serah, penutupan, dan CSV tidak pernah dikunci paket walau KAWASAN_DASAR.

vi.setConfig({ testTimeout: 60_000 });

const HARI = 86_400_000;
const HARGA = 350_000;
const rekam = new PengirimRekam();
const sandbox = new SandboxTiruan();
let d: DemoS08;

beforeAll(async () => {
  setelPengirimUji(rekam);
  setelPenyediaUji(sandbox.penyedia);
  // Foto uji selalu ke penyimpanan lokal (tidak bergantung PENYIMPANAN_MODE di .env).
  aturIntegrasi({ penyimpanan: penyimpananLokal });
  d = await demo();
});
afterAll(() => {
  setelPengirimUji(null);
  setelPenyediaUji(undefined);
});

type Kawasan = OrgUji & { kawasanId: string; tps: string[] };

/** Organisasi KAWASAN baru (uji coba) dengan `jumlahTps` TPS aktif. */
async function kawasanBaru(jumlahTps: number): Promise<Kawasan> {
  const o = await orgBaru(rekam, { jenis: "KAWASAN" });
  const k = data<{ kawasan: { id: string } }>(
    await panggil(buatKawasan, { jalur: "/api/kawasan", cookie: o.cookie, body: { nama: namaUnik("Kawasan Langganan Uji"), jenis: "KOMERSIAL", alamat: "Alamat uji", adm4: "31.71.03.1001", kota: "Jakarta Pusat" } }),
  ).kawasan;
  const tps: string[] = [];
  for (let i = 0; i < jumlahTps; i++) {
    tps.push(data<{ tps: { id: string } }>(await panggil(buatTps, { jalur: "/api/tps", cookie: o.cookie, body: { kawasanId: k.id, nama: `TPS ${i + 1}`, latE6: -6_161_234, lonE6: 106_845_678 } })).tps.id);
  }
  return { ...o, kawasanId: k.id, tps };
}

/** Uji coba dimundurkan ke kemarin lalu cron harian (hanya organisasi ini) → BERAKHIR + tagihan pertama. */
async function ujiCobaBerakhir(o: Kawasan): Promise<{ nomor: string; totalIdr: number }> {
  await satu(`UPDATE langganan SET uji_coba_selesai = now() - interval '1 hour' WHERE organisasi_id = $1 RETURNING id`, [o.organisasiId]);
  await denganSistem((tx) => kerjaLanggananHarian(tx, new Date(), [o.organisasiId]));
  return satu(`SELECT nomor, total_idr AS "totalIdr" FROM tagihan WHERE organisasi_id = $1 ORDER BY dibuat_pada DESC LIMIT 1`, [o.organisasiId]);
}

const lg = async (o: OrgUji) => data<{ paketKode: string; status: string; hargaDibekukanPerTpsIdr: number | null; periodeBerjalan: string | null; tpsDitagih: number }>(await panggil(bacaLangganan, { jalur: "/api/langganan", cookie: o.cookie }));
const statusTagihan = async (nomor: string) => (await satu<{ status: string }>(`SELECT status::text FROM tagihan WHERE nomor = $1`, [nomor])).status;
const kirim = (isi: Record<string, unknown>) => webhook(new Request(`${asal()}/api/webhook/midtrans`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(isi) }));
const peristiwa = (nomor: string) =>
  semua<{ jenis: string; kunci_peristiwa: string; payload: Record<string, unknown> }>(
    `SELECT pb.jenis, pb.kunci_peristiwa, pb.payload FROM peristiwa_bayar pb JOIN tagihan t ON t.id = pb.tagihan_id WHERE t.nomor = $1 ORDER BY pb.diterima_pada, pb.kunci_peristiwa`,
    [nomor],
  );

describe("paket & langganan", () => {
  it("GET /api/paket publik: paket berbayar Rp350.000/TPS beserta hak dari tabel", async () => {
    const p = data<{ paket: { kode: string; hargaPerTpsIdr: number; hak: { kunci: string }[] }[] }>(await panggil(daftarPaket, { jalur: "/api/paket" })).paket;
    const berbayar = p.find((x) => x.kode === PAKET_BERBAYAR);
    expect(berbayar?.hargaPerTpsIdr).toBe(HARGA);
    expect(berbayar?.hak.map((h) => h.kunci)).toContain("tps.maks");
  });

  it("S19-2/3: uji coba lewat → BERAKHIR (paket dasar) + tagihan pertama TPS aktif × harga; diulang tidak menggandakan", async () => {
    const o = await kawasanBaru(2);
    expect(await lg(o)).toMatchObject({ status: "UJI_COBA", tpsDitagih: 2 });
    const t = await ujiCobaBerakhir(o);
    expect(t.totalIdr).toBe(2 * HARGA);
    expect(await lg(o)).toMatchObject({ paketKode: "KAWASAN_DASAR", status: "BERAKHIR", hargaDibekukanPerTpsIdr: null });
    await denganSistem((tx) => kerjaLanggananHarian(tx, new Date(), [o.organisasiId]));
    expect(await semua(`SELECT 1 FROM tagihan WHERE organisasi_id = $1`, [o.organisasiId])).toHaveLength(1);
    expect(await semua(`SELECT sebab FROM peristiwa_langganan pl JOIN langganan l ON l.id = pl.langganan_id WHERE l.organisasi_id = $1 ORDER BY pl.dibuat_pada`, [o.organisasiId])).toEqual([
      { sebab: expect.any(String) },
      { sebab: "UJI_COBA_BERAKHIR" },
    ]);
    const n = await semua<{ jenis: string }>(`SELECT jenis FROM notifikasi WHERE organisasi_id = $1 AND jenis IN ('TAGIHAN_TERBIT', 'UJI_COBA_BERAKHIR') ORDER BY jenis`, [o.organisasiId]);
    expect(n.map((x) => x.jenis)).toEqual(["TAGIHAN_TERBIT", "UJI_COBA_BERAKHIR"]);
    const daftar = data<{ tagihan: { nomor: string; status: string; periode: string; jumlahTps: number }[] }>(await panggil(daftarTagihan, { jalur: "/api/tagihan", cookie: o.cookie })).tagihan;
    expect(daftar).toEqual([expect.objectContaining({ nomor: t.nomor, status: "TERBIT", periode: periodeWib(new Date()), jumlahTps: 2 })]);
  });

  it("AKTIF lewat jatuh tempo → MENUNGGAK; tenggang 14 hari habis → BERAKHIR", async () => {
    const o = await kawasanBaru(1);
    const t = await ujiCobaBerakhir(o);
    await satu(`UPDATE langganan SET status = 'AKTIF', paket_kode = $2 WHERE organisasi_id = $1 RETURNING id`, [o.organisasiId, PAKET_BERBAYAR]);
    const jatuhTempo = new Date((await satu<{ j: Date }>(`SELECT jatuh_tempo AS j FROM tagihan WHERE nomor = $1`, [t.nomor])).j);
    await denganSistem((tx) => kerjaLanggananHarian(tx, new Date(jatuhTempo.getTime() + 2 * HARI), [o.organisasiId]));
    expect((await lg(o)).status).toBe("MENUNGGAK");
    await denganSistem((tx) => kerjaLanggananHarian(tx, new Date(jatuhTempo.getTime() + 16 * HARI), [o.organisasiId]));
    expect((await lg(o)).status).toBe("BERAKHIR");
  });
});

describe("T25 — webhook pembayaran", () => {
  it("tanda tangan salah → 401 tanpa menyimpan apa pun; tidak menarik status", async () => {
    const o = await kawasanBaru(1);
    const t = await ujiCobaBerakhir(o);
    const sebelum = sandbox.panggilan.length;
    const r = await kirim(sandbox.notifikasi(t.nomor, { status: "settlement", jumlahIdr: t.totalIdr, idTransaksi: `trx-${randomUUID()}` }, { tandaSalah: true }));
    expect(r.status).toBe(401);
    expect(await peristiwa(t.nomor)).toEqual([]);
    expect(sandbox.panggilan.length).toBe(sebelum);
    expect(await statusTagihan(t.nomor)).toBe("TERBIT");
  });

  it("bayar online (idempoten) → notifikasi sah → status DITARIK → LUNAS, langganan AKTIF berbayar, harga dibekukan; duplikat → 200 tanpa efek ganda", async () => {
    const o = await kawasanBaru(2);
    const t = await ujiCobaBerakhir(o);
    const postSebelum = sandbox.panggilan.filter((p) => p.startsWith("POST ")).length;
    const b1 = data<{ redirectUrl: string }>(await panggil(bayar, { jalur: "/", cookie: o.cookie, params: { nomor: t.nomor }, body: {} }));
    const b2 = data(await panggil(bayar, { jalur: "/", cookie: o.cookie, params: { nomor: t.nomor }, body: {} }));
    expect(b2).toEqual(b1);
    expect(b1.redirectUrl).toMatch(/^https:\/\/app\.sandbox\./);
    // Panggilan kedua memakai pembayaran yang sudah dibuat: penyedia hanya dipanggil sekali.
    expect(sandbox.panggilan.filter((p) => p.startsWith("POST ")).length - postSebelum).toBe(1);

    const trx = { status: "settlement", jumlahIdr: t.totalIdr, idTransaksi: `trx-${randomUUID()}` } as const;
    // Isi notifikasi tidak dipercaya: status penyedia masih pending saat ditarik → tagihan tetap TERBIT.
    sandbox.atur(t.nomor, { ...trx, status: "pending" });
    expect((await kirim(sandbox.notifikasi(t.nomor, { ...trx, status: "pending" }))).status).toBe(200);
    expect(await statusTagihan(t.nomor)).toBe("TERBIT");

    sandbox.atur(t.nomor, trx);
    const r = await kirim(sandbox.notifikasi(t.nomor, trx));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, data: { diterima: true } });
    expect(await statusTagihan(t.nomor)).toBe("LUNAS");
    expect(await lg(o)).toMatchObject({ paketKode: PAKET_BERBAYAR, status: "AKTIF", hargaDibekukanPerTpsIdr: HARGA, periodeBerjalan: periodeWib(new Date()) });

    const ulang = await kirim(sandbox.notifikasi(t.nomor, trx));
    expect(ulang.status).toBe(200);
    const p = await peristiwa(t.nomor);
    expect(p.filter((x) => x.kunci_peristiwa === `${trx.idTransaksi}:settlement`)).toHaveLength(1);
    expect(p.filter((x) => x.jenis === "TAGIHAN_LUNAS")).toHaveLength(1);
    expect(p.filter((x) => x.jenis === JENIS_PERLU_TINJAUAN)).toHaveLength(0);
    expect(await semua(`SELECT 1 FROM peristiwa_langganan pl JOIN langganan l ON l.id = pl.langganan_id WHERE l.organisasi_id = $1 AND pl.ke = 'AKTIF'`, [o.organisasiId])).toHaveLength(1);
  });

  it("kejanggalan tidak ditolak diam-diam: nominal beda, uang ganda, bayar terlambat → antrean admin, status tetap", async () => {
    // Nominal beda.
    const a = await kawasanBaru(1);
    const ta = await ujiCobaBerakhir(a);
    const kurang = { status: "settlement", jumlahIdr: ta.totalIdr - 1_000, idTransaksi: `trx-${randomUUID()}` } as const;
    sandbox.atur(ta.nomor, kurang);
    expect((await kirim(sandbox.notifikasi(ta.nomor, kurang))).status).toBe(200);
    expect(await statusTagihan(ta.nomor)).toBe("TERBIT");
    expect((await peristiwa(ta.nomor)).filter((x) => x.jenis === JENIS_PERLU_TINJAUAN).map((x) => x.payload.sebab)).toEqual(["BAYAR_BERBEDA"]);
    expect((await lg(a)).status).toBe("BERAKHIR");

    // Uang ganda: transaksi kedua untuk tagihan yang sudah LUNAS.
    const b = await kawasanBaru(1);
    const tb = await ujiCobaBerakhir(b);
    const satuKali = { status: "settlement", jumlahIdr: tb.totalIdr, idTransaksi: `trx-${randomUUID()}` } as const;
    sandbox.atur(tb.nomor, satuKali);
    await kirim(sandbox.notifikasi(tb.nomor, satuKali));
    const keduaKali = { ...satuKali, idTransaksi: `trx-${randomUUID()}` };
    sandbox.atur(tb.nomor, keduaKali);
    expect((await kirim(sandbox.notifikasi(tb.nomor, keduaKali))).status).toBe(200);
    expect(await statusTagihan(tb.nomor)).toBe("LUNAS");
    expect((await peristiwa(tb.nomor)).filter((x) => x.jenis === JENIS_PERLU_TINJAUAN).map((x) => x.payload.sebab)).toEqual(["BAYAR_GANDA"]);

    // Terlambat: tagihan sudah KEDALUWARSA lalu uang masuk.
    const c = await kawasanBaru(1);
    const tc = await ujiCobaBerakhir(c);
    const kedaluwarsa = { status: "expire", jumlahIdr: tc.totalIdr, idTransaksi: `trx-${randomUUID()}` } as const;
    sandbox.atur(tc.nomor, kedaluwarsa);
    await kirim(sandbox.notifikasi(tc.nomor, kedaluwarsa));
    expect(await statusTagihan(tc.nomor)).toBe("KEDALUWARSA");
    const telat = { status: "settlement", jumlahIdr: tc.totalIdr, idTransaksi: `trx-${randomUUID()}` } as const;
    sandbox.atur(tc.nomor, telat);
    expect((await kirim(sandbox.notifikasi(tc.nomor, telat))).status).toBe(200);
    expect(await statusTagihan(tc.nomor)).toBe("KEDALUWARSA");
    expect((await peristiwa(tc.nomor)).filter((x) => x.jenis === JENIS_PERLU_TINJAUAN).map((x) => x.payload.sebab)).toEqual(["BAYAR_TERLAMBAT"]);
  });

  it("tarik status gagal (jaringan) → peristiwa tetap tercatat & 200; GET …/status menarik ulang → LUNAS", async () => {
    const o = await kawasanBaru(1);
    const t = await ujiCobaBerakhir(o);
    const trx = { status: "settlement", jumlahIdr: t.totalIdr, idTransaksi: `trx-${randomUUID()}` } as const;
    sandbox.atur(t.nomor, trx);
    sandbox.gagalJaringan = true;
    try {
      expect((await kirim(sandbox.notifikasi(t.nomor, trx))).status).toBe(200);
    } finally {
      sandbox.gagalJaringan = false;
    }
    expect(await statusTagihan(t.nomor)).toBe("TERBIT");
    expect(await peristiwa(t.nomor)).toHaveLength(1);
    const h = data<{ tagihan: { status: string } }>(await panggil(tarikStatus, { jalur: "/", cookie: o.cookie, params: { nomor: t.nomor } }));
    expect(h.tagihan.status).toBe("LUNAS");
  });

  it("tagihan organisasi lain tidak terlihat (404)", async () => {
    const a = await kawasanBaru(1);
    const b = await kawasanBaru(1);
    const t = await ujiCobaBerakhir(a);
    expect((await panggil(bayar, { jalur: "/", cookie: b.cookie, params: { nomor: t.nomor }, body: {} })).status).toBe(404);
    expect((await panggil(tarikStatus, { jalur: "/", cookie: b.cookie, params: { nomor: t.nomor } })).status).toBe(404);
  });
});

describe("transfer manual", () => {
  it("tanpa TRANSFER_REKENING_TEKS → 404; dengan → bukti BUKTI_TRANSFER milik organisasi → MENUNGGU_KONFIRMASI (status langganan tetap)", async () => {
    const o = await kawasanBaru(1);
    const t = await ujiCobaBerakhir(o);
    const foto = data<{ fotoId: string }>(await panggil(unggah, { jalur: "/api/foto", cookie: o.cookie, kunci: null, form: formFoto("BUKTI_TRANSFER", pngContoh(randomUUID()), "image/png") })).fotoId;
    const env = muatEnv() as { TRANSFER_REKENING_TEKS?: string | undefined };
    const lama = env.TRANSFER_REKENING_TEKS;
    env.TRANSFER_REKENING_TEKS = undefined;
    try {
      expect((await panggil(transfer, { jalur: "/", cookie: o.cookie, params: { nomor: t.nomor }, body: { fotoBuktiId: foto } })).status).toBe(404);
      env.TRANSFER_REKENING_TEKS = "Bank Uji 000 a.n. Uji";
      const lain = await kawasanBaru(1);
      const fotoLain = data<{ fotoId: string }>(await panggil(unggah, { jalur: "/api/foto", cookie: lain.cookie, kunci: null, form: formFoto("BUKTI_TRANSFER", pngContoh(randomUUID()), "image/png") })).fotoId;
      expect((await panggil(transfer, { jalur: "/", cookie: o.cookie, params: { nomor: t.nomor }, body: { fotoBuktiId: fotoLain } })).status).toBe(400);
      const h = data<{ tagihan: { status: string } }>(await panggil(transfer, { jalur: "/", cookie: o.cookie, params: { nomor: t.nomor }, body: { fotoBuktiId: foto } }));
      expect(h.tagihan.status).toBe("MENUNGGU_KONFIRMASI");
      expect((await peristiwa(t.nomor)).map((x) => x.jenis)).toEqual(["BUKTI_TRANSFER"]);
      expect((await lg(o)).status).toBe("BERAKHIR");
      // Sudah menunggu konfirmasi: kirim ulang ditolak (konfirmasi hanya oleh admin, S21).
      expect((await panggil(transfer, { jalur: "/", cookie: o.cookie, params: { nomor: t.nomor }, body: { fotoBuktiId: foto } })).status).toBe(409);
    } finally {
      env.TRANSFER_REKENING_TEKS = lama;
    }
  });
});

describe("T24 — tidak pernah dikunci paket (CLAUDE.md §2.7)", () => {
  it("KAWASAN_DASAR: catat wadah, serah, ambil, setujui, tutup, dan ekspor CSV tetap berjalan", async () => {
    const o = await kawasanBaru(1);
    await ujiCobaBerakhir(o);
    expect((await lg(o)).paketKode).toBe("KAWASAN_DASAR");
    await satu(
      `INSERT INTO kontrak (id, kawasan_id, org_kawasan_id, org_pengangkut_id, org_penerima_id, aliran, berlaku_dari, berlaku_sampai, status, dibuat_pada)
       VALUES ($1, $2, $3, $4, $5, ARRAY['KUNING']::"Aliran"[], current_date - 30, current_date + 365, 'AKTIF', now()) RETURNING id`,
      [`ujis19ktr${randomUUID().replaceAll("-", "").slice(0, 15)}`, o.kawasanId, o.organisasiId, d.org.pengangkut, d.org.daurUlang],
    );
    const [pengangkut, penerima] = await Promise.all([masuk("PENGANGKUT"), masuk("PENERIMA")]);
    const tps = o.tps[0]!;
    const w = data<{ id: string }>(await panggil(catatWadah, { jalur: "/api/wadah", cookie: o.cookie, body: { tpsId: tps, aliran: "KUNING", beratG: 10_000, terjadiPada: new Date().toISOString() } }));
    const kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: o.cookie, body: { tpsId: tps, wadahIds: [w.id] } })).kode;
    const fotoId = data<{ fotoId: string }>(await panggil(unggah, { jalur: "/api/foto", cookie: pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) })).fotoId;
    data(await panggil(ambil, { jalur: "/", cookie: pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.daurUlang } }));
    data(await panggil(setujui, { jalur: "/", cookie: o.cookie, params: { kode }, body: {} }));
    const ditutup = data<{ status: string }>(
      await panggil(tutup, { jalur: "/", cookie: penerima, params: { kode }, body: { tiket: { beratG: 10_000, sumber: "MANUAL", nomor: "TKT-UJI" }, rincian: [{ aliran: "KUNING", diterimaG: 10_000, ditolakG: 0 }] } }),
    );
    expect(ditutup.status).toBe("DITERIMA");
    const r = await (ekspor as unknown as (r: Request, x: { params: Promise<{ pihak: string }> }) => Promise<Response>)(
      new Request(`${asal()}/api/laporan/kawasan/ekspor?periode=${periodeWib(new Date())}&kawasanId=${o.kawasanId}&format=csv`, { headers: { cookie: o.cookie } }),
      { params: Promise.resolve({ pihak: "kawasan" }) },
    );
    expect(r.status).toBe(200);
    expect(await r.text()).toContain(kode);
  });

  it("statis: layanan pencatatan/serah/penutupan/ekspor tidak memanggil boleh()/batas()", () => {
    const akar = join(__dirname, "..", "..");
    for (const berkas of ["lib/server/layanan/wadah.ts", "lib/server/layanan/serah.ts", "lib/server/layanan/transisi.ts", "lib/server/layanan/sinkron.ts", "app/api/laporan/[pihak]/ekspor/route.ts"]) {
      const isi = readFileSync(join(akar, berkas), "utf8");
      expect(isi, berkas).not.toMatch(/\b(boleh|batas)\s*\(/);
      expect(isi, berkas).not.toMatch(/from\s+["'][^"']*\/hak["']/);
    }
  });
});
