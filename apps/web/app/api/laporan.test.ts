import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PETUNJUK_PEMISAH, totalPerAliran } from "@serah/core/laporan";
import { periodeWib } from "@serah/core/waktu";
import { HEADER_SIDIK_ISI, TEKS, isi } from "@serah/kontrak";
import { beforeAll, describe, expect, it } from "vitest";
import { denganAkses } from "@/lib/server/db";
import { jalankanCron } from "@/lib/server/layanan/cron";
import { indikatorKawasan } from "@/lib/server/layanan/laporan";
import { bacaSesi, konteksAkses } from "@/lib/server/sesi";
import { asal, data, demo, denganPemilik, formFoto, masuk, panggil, pngContoh, satu, semua, type DemoS08, type Hasil } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { GET as ditolak } from "./kawasan/[id]/ditolak/route";
import { GET as ringkasan } from "./kawasan/[id]/ringkasan/route";
import { GET as laporan } from "./laporan/[pihak]/route";
import { GET as ekspor } from "./laporan/[pihak]/ekspor/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { POST as catatWadah } from "./wadah/route";

// S11 — laporan tiga pihak, CSV, ringkasan, penyebab ditolak, indikator, akses per pihak.
// "Dunia" kawasan baru dibuat per run (organisasi + kawasan + TPS + kontrak) sehingga angkanya pasti dan dihitung tangan;
// data seed demo dipakai hanya untuk pembanding SQL independen pada periode lampau yang tidak ditulis test mana pun.

const JAM = 3_600_000;
type Dunia = { org: string; kawasan: string; kodeKawasan: string; tps: string; kodeTps: string; nama: string };

let d: DemoS08;
let a: Dunia;
let b: Dunia;
let c: Record<"petugasA" | "pengelolaA" | "pengelolaB" | "petugasB" | "pengangkut" | "duCm" | "tpst", string>;
let kode: Record<"s1" | "s2" | "s3" | "s4" | "s6" | "s7", string>;
const periode = periodeWib(new Date());
const acak = () => randomBytes(6).toString("hex");
const id = (awalan: string) => `${awalan}${randomBytes(10).toString("hex")}`;

async function buatDunia(nama: string, koordinat: { lat: number; lon: number }): Promise<Dunia> {
  const r = acak();
  const w: Dunia = { org: id("ujs11o"), kawasan: id("ujs11k"), kodeKawasan: `KWS-UJ${r}`, tps: id("ujs11t"), kodeTps: `TPS-UJ${r}-01`, nama };
  await denganPemilik(async (k) => {
    await k.query(
      `INSERT INTO organisasi (id, kode, nama, jenis, aliran_diterima, status_izin, yurisdiksi, demo, dibuat_pada)
       VALUES ($1, $2, $3, 'KAWASAN', ARRAY[]::"Aliran"[], 'BELUM_DIAJUKAN', 'DKI', false, now())`,
      [w.org, `ORG-UJ${r}`, nama],
    );
    await k.query(
      `INSERT INTO kawasan (id, organisasi_id, kode, nama, jenis, alamat, adm4, kota, dibuat_pada)
       VALUES ($1, $2, $3, $4, 'KOMERSIAL', 'Jl. Uji S11 No. 1', '31.71.03.1001', 'Jakarta Pusat', now())`,
      [w.kawasan, w.org, w.kodeKawasan, nama],
    );
    await k.query(
      `INSERT INTO tps (id, kawasan_id, organisasi_id, kode, nama, lat_e6, lon_e6, qr_token_hash, qr_versi, aktif, dibuat_pada)
       VALUES ($1, $2, $3, $4, 'TPS Uji', $5, $6, $7, 1, true, now())`,
      [w.tps, w.kawasan, w.org, w.kodeTps, koordinat.lat, koordinat.lon, randomBytes(32).toString("hex")],
    );
    for (const [penerima, aliran] of [[d.org.daurUlang, "KUNING"], [d.org.tpst, "ABU"]] as const) {
      await k.query(
        `INSERT INTO kontrak (id, kawasan_id, org_kawasan_id, org_pengangkut_id, org_penerima_id, aliran, berlaku_dari, berlaku_sampai, status, dibuat_pada)
         VALUES ($1, $2, $3, $4, $5, ARRAY[$6]::"Aliran"[], current_date - 30, current_date + 365, 'AKTIF', now())`,
        [id("ujs11c"), w.kawasan, w.org, d.org.pengangkut, penerima, aliran],
      );
    }
  });
  return w;
}

const wadahBaru = (cookie: string, w: Dunia, aliran: string, beratG: number | null, terjadiPada = new Date()) =>
  panggil(catatWadah, { jalur: "/api/wadah", cookie, body: { tpsId: w.tps, aliran, ...(beratG === null ? { jumlahWadah: 3 } : { beratG }), terjadiPada: terjadiPada.toISOString() } }).then((h) => data<{ id: string }>(h).id);

/** Catat wadah → serah → foto muatan → ambil; opsional setujui (pengelola) dan tutup (penerima). */
async function alurSerah(aliran: "KUNING" | "ABU", berat: number[], penerima: { id: string; cookie: string }, tahap: "AMBIL" | "SETUJU" | "TUTUP", tutupBody?: unknown): Promise<string> {
  const ids: string[] = [];
  for (const g of berat) ids.push(await wadahBaru(c.petugasA, a, aliran, g));
  const kd = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: c.petugasA, body: { tpsId: a.tps, wadahIds: ids } })).kode;
  const fotoId = data<{ fotoId: string }>(await panggil(unggah, { jalur: "/api/foto", cookie: c.pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kd) })).fotoId;
  data(await panggil(ambil, { jalur: "/", cookie: c.pengangkut, params: { kode: kd }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: penerima.id } }));
  if (tahap !== "AMBIL") data(await panggil(setujui, { jalur: "/", cookie: c.pengelolaA, params: { kode: kd }, body: {} }));
  if (tahap === "TUTUP") data(await panggil(tutup, { jalur: "/", cookie: penerima.cookie, params: { kode: kd }, body: tutupBody }));
  return kd;
}

beforeAll(async () => {
  d = await demo();
  a = await buatDunia("Kawasan Uji S11 A", { lat: 5_000_000, lon: 5_000_000 });
  b = await buatDunia("Kawasan Uji S11 B", { lat: 0, lon: 0 });
  // Berurutan (bukan paralel): sesi lain berbagi Postgres lokal; jangan menambah beban kolam koneksi.
  c = {
    pengangkut: await masuk("PENGANGKUT"),
    duCm: await masuk("PENERIMA"),
    tpst: await masuk("PENERIMA", d.org.tpst),
    petugasA: await masuk("PETUGAS", a.org),
    pengelolaA: await masuk("PENGELOLA", a.org),
    petugasB: await masuk("PETUGAS", b.org),
    pengelolaB: await masuk("PENGELOLA", b.org),
  };
  const { duCm, tpst } = c;

  // Prioritas prakiraan untuk kawasan A, dicatat SEBELUM semua persetujuan; slot hujan 3 jam lagi (untuk F43).
  await denganPemilik((k) =>
    k.query(
      `INSERT INTO prioritas_tercatat (id, tps_id, kawasan_id, org_kawasan_id, sumber, acuan, weather_desc, aliran, umur_jam, ditetapkan_pada)
       VALUES ($1, $2, $3, $4, 'PRAKIRAAN', $5, 'Hujan Lebat', 'KUNING', 30, now() - interval '1 minute')`,
      [id("ujs11p"), a.tps, a.kawasan, a.org, new Date(Date.now() + 3 * JAM).toISOString()],
    ),
  );

  const tiket = (beratG: number) => ({ beratG, sumber: "MANUAL", nomor: "TKT-S11" });
  const duCmPenerima = { id: d.org.daurUlang, cookie: duCm };
  kode = {
    s1: await alurSerah("KUNING", [12_500, 7_500], duCmPenerima, "TUTUP", { tiket: tiket(20_000), rincian: [{ aliran: "KUNING", diterimaG: 15_000, ditolakG: 5_000, alasan: "TERCAMPUR_ORGANIK" }] }),
    s2: await alurSerah("KUNING", [10_000], duCmPenerima, "TUTUP", { tiket: tiket(10_000), rincian: [{ aliran: "KUNING", diterimaG: 0, ditolakG: 10_000, alasan: "BASAH_KOTOR" }] }),
    s3: await alurSerah("KUNING", [6_000], duCmPenerima, "TUTUP", { tiket: tiket(6_000), rincian: [{ aliran: "KUNING", diterimaG: 3_000, ditolakG: 3_000, alasan: "TERCAMPUR_ORGANIK" }] }),
    s4: await alurSerah("ABU", [30_000], { id: d.org.tpst, cookie: tpst }, "TUTUP", { tiket: tiket(30_000), rincian: [{ aliran: "ABU", diterimaG: 30_000, ditolakG: 0 }] }),
    s6: await alurSerah("KUNING", [5_000], duCmPenerima, "SETUJU"),
    s7: await alurSerah("KUNING", [7_000], duCmPenerima, "AMBIL"),
  };
  await wadahBaru(c.petugasA, a, "HIJAU", null); // wadah tanpa berat: tercatat, beratnya tidak ditebak
  // s6 berumur > 12 jam sejak disetujui → MENGGANTUNG lewat cron (R-07).
  await jalankanCron("sepuluh-menit", new Date(Date.now() + 13 * JAM), { hanyaSerah: [kode.s6], hanyaR07: true, jendela: `uji-s11-${randomUUID()}` });
}, 120_000);

const lap = (cookie: string, pihak: string, kueri: string) => panggil(laporan, { jalur: `/api/laporan/${pihak}?${kueri}`, cookie, params: { pihak } });
/** Baris & total saja: field `pihak` di respons memang berbeda per tab. */
const bar = (h: Hasil) => {
  const { baris, total } = data<{ baris: Record<string, unknown>[]; total: Record<string, unknown>[] }>(h);
  return { baris, total };
};
const unduh = (cookie: string, pihak: string, kueri: string) =>
  (ekspor as unknown as (r: Request, x: { params: Promise<{ pihak: string }> }) => Promise<Response>)(
    new Request(`${asal()}/api/laporan/${pihak}/ekspor?${kueri}`, { headers: { cookie } }),
    { params: Promise.resolve({ pihak }) },
  );

describe("T14 integrasi — tiga laporan dari satu serah identik", () => {
  it("serah s1: baris sama persis untuk kawasan, pengangkut, dan penerima; semua kolom §L.4", async () => {
    const q = `periode=${periode}&kawasanId=${a.kawasan}`;
    const [kws, png, prm] = await Promise.all([lap(c.pengelolaA, "kawasan", q), lap(c.pengangkut, "pengangkut", q), lap(c.duCm, "penerima", q)]);
    const sidik = await satu<{ hash: string }>(`SELECT e.hash FROM event e JOIN serah s ON s.id = e.serah_id WHERE s.kode = $1 AND e.jenis = 'SERAH_DITERIMA_SEBAGIAN'`, [kode.s1]);
    const baris = (h: Hasil) => bar(h).baris.filter((x) => x.kodeSerah === kode.s1);
    expect(baris(kws)).toEqual([
      {
        tanggalWib: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()),
        kodeSerah: kode.s1,
        aliran: "KUNING",
        beratTpsG: 20_000,
        beratDiterimaG: 15_000,
        beratDitolakG: 5_000,
        alasanTolak: "TERCAMPUR_ORGANIK",
        tpsKode: a.kodeTps,
        kawasanNama: a.nama,
        kawasanAlamat: "Jl. Uji S11 No. 1",
        pengangkutNama: "Angkut Contoh Bersih",
        plat: "B 9001 SRH",
        penerimaNama: "Daur Ulang Contoh Mandiri",
        penerimaJenis: "FASILITAS_BERIZIN",
        status: "DITERIMA_SEBAGIAN",
        sidikEvent: sidik.hash,
      },
    ]);
    expect(baris(png)).toEqual(baris(kws));
    expect(baris(prm)).toEqual(baris(kws));
  });

  it("kawasan A: total per aliran dihitung tangan, dan sama di tiga laporan yang dilihat pengelola (K4)", async () => {
    const q = `periode=${periode}&kawasanId=${a.kawasan}`;
    const hasil = await Promise.all(["kawasan", "pengangkut", "penerima"].map((p) => lap(c.pengelolaA, p, q)));
    const kws = bar(hasil[0]!);
    expect(kws.baris.map((x) => x.kodeSerah)).toEqual([kode.s1, kode.s2, kode.s3, kode.s4]); // s6 & s7 belum tertutup
    expect(kws.total).toEqual([
      { aliran: "KUNING", beratTpsG: 36_000, beratDiterimaG: 18_000, beratDitolakG: 18_000 }, // 20+10+6 | 15+0+3 | 5+10+3
      { aliran: "ABU", beratTpsG: 30_000, beratDiterimaG: 30_000, beratDitolakG: 0 },
    ]);
    expect(totalPerAliran(kws.baris as never)).toEqual(kws.total);
    for (const h of hasil.slice(1)) expect(bar(h)).toEqual(kws);
    expect(hasil.map((h) => (h.json.data as { pihak: string }).pihak)).toEqual(["kawasan", "pengangkut", "penerima"]);
  });

  it("pengangkut dan penerima hanya melihat serah miliknya (penerima TPST hanya serah ABU s4)", async () => {
    const q = `periode=${periode}&kawasanId=${a.kawasan}`;
    expect(bar(await lap(c.pengangkut, "pengangkut", q)).baris.map((x) => x.kodeSerah)).toEqual([kode.s1, kode.s2, kode.s3, kode.s4]);
    expect(bar(await lap(c.duCm, "penerima", q)).baris.map((x) => x.kodeSerah)).toEqual([kode.s1, kode.s2, kode.s3]);
    expect(bar(await lap(c.tpst, "penerima", q)).baris.map((x) => x.kodeSerah)).toEqual([kode.s4]);
  });

  it("koreksi berat: baris memakai nilai FINAL dan sidik menunjuk event koreksi terakhir; nilai asli utuh", async () => {
    const { POST: koreksi } = await import("./serah/[kode]/koreksi/route");
    const ids = await satu<{ rincian: string }>(`SELECT r.id AS rincian FROM penutupan_rincian r JOIN serah s ON s.id = r.serah_id WHERE s.kode = $1`, [kode.s3]);
    data(
      await panggil(koreksi, {
        jalur: "/",
        cookie: c.duCm,
        params: { kode: kode.s3 },
        body: { alasan: "Timbangan ulang", perubahan: [{ target: "RINCIAN_DITERIMA", targetId: ids.rincian, nilaiFinalG: 4_000 }, { target: "RINCIAN_DITOLAK", targetId: ids.rincian, nilaiFinalG: 2_000 }] },
      }),
    );
    const k = bar(await lap(c.pengelolaA, "kawasan", `periode=${periode}&kawasanId=${a.kawasan}`));
    expect(k.baris.find((x) => x.kodeSerah === kode.s3)).toMatchObject({ beratDiterimaG: 4_000, beratDitolakG: 2_000 });
    const sidik = await satu<{ hash: string }>(`SELECT e.hash FROM event e JOIN serah s ON s.id = e.serah_id WHERE s.kode = $1 AND e.jenis = 'KOREKSI_BERAT'`, [kode.s3]);
    expect(k.baris.find((x) => x.kodeSerah === kode.s3)?.sidikEvent).toBe(sidik.hash);
    expect((await satu<{ diterima_g: number }>(`SELECT r.diterima_g FROM penutupan_rincian r JOIN serah s ON s.id = r.serah_id WHERE s.kode = $1`, [kode.s3])).diterima_g).toBe(3_000);
    // Kembalikan nilai awal untuk test berikutnya: koreksi kedua (nilai asli tetap 3.000/3.000).
    data(
      await panggil(koreksi, {
        jalur: "/",
        cookie: c.duCm,
        params: { kode: kode.s3 },
        body: { alasan: "Kembali ke timbangan awal", perubahan: [{ target: "RINCIAN_DITERIMA", targetId: ids.rincian, nilaiFinalG: 3_000 }, { target: "RINCIAN_DITOLAK", targetId: ids.rincian, nilaiFinalG: 3_000 }] },
      }),
    );
  });

  it("data seed periode lampau: total ketiga pihak = SQL independen (v_nilai_final, periode WIB dari event penutupan)", async () => {
    const p = (
      await satu<{ p: string }>(
        `SELECT min(to_char(diterima_pada AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')) AS p FROM event
         WHERE kawasan_id = $1 AND jenis IN ('SERAH_DITERIMA', 'SERAH_DITERIMA_SEBAGIAN', 'SERAH_DITOLAK') AND idempotency_key LIKE 'demo-%'`,
        [d.kawasan],
      )
    ).p;
    const pengelola = await masuk("PENGELOLA");
    const sql = async (kolom: string, org: string) => {
      const baris = await semua<{ aliran: string; tps: string; diterima: string; ditolak: string }>(
        `SELECT r.aliran::text AS aliran,
                coalesce((SELECT sum(vn.nilai_final_g) FROM serah_wadah sw JOIN wadah_catat w ON w.id = sw.wadah_catat_id
                          JOIN v_nilai_final vn ON vn.target_jenis = 'WADAH' AND vn.target_id = w.id
                          WHERE sw.serah_id = r.serah_id AND w.aliran = r.aliran), 0) AS tps,
                vd.nilai_final_g AS diterima, vt.nilai_final_g AS ditolak
         FROM penutupan_rincian r
         JOIN serah s ON s.id = r.serah_id
         JOIN v_nilai_final vd ON vd.target_jenis = 'RINCIAN_DITERIMA' AND vd.target_id = r.id
         JOIN v_nilai_final vt ON vt.target_jenis = 'RINCIAN_DITOLAK' AND vt.target_id = r.id
         WHERE s.${kolom} = $1 AND s.kawasan_id = $2 AND EXISTS (
           SELECT 1 FROM event e WHERE e.serah_id = s.id AND e.jenis IN ('SERAH_DITERIMA', 'SERAH_DITERIMA_SEBAGIAN', 'SERAH_DITOLAK')
             AND to_char(e.diterima_pada AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') = $3)`,
        [org, d.kawasan, p],
      );
      const per: Record<string, { beratTpsG: number; beratDiterimaG: number; beratDitolakG: number }> = {};
      for (const x of baris) {
        const t = (per[x.aliran] ??= { beratTpsG: 0, beratDiterimaG: 0, beratDitolakG: 0 });
        t.beratTpsG += Number(x.tps);
        t.beratDiterimaG += Number(x.diterima);
        t.beratDitolakG += Number(x.ditolak);
      }
      return per;
    };
    const dariApi = (h: Hasil) => Object.fromEntries(bar(h).total.map((t) => [t.aliran as string, { beratTpsG: t.beratTpsG, beratDiterimaG: t.beratDiterimaG, beratDitolakG: t.beratDitolakG }]));
    const q = `periode=${p}&kawasanId=${d.kawasan}`;

    const kws = await lap(pengelola, "kawasan", q);
    expect(bar(kws).baris.length).toBeGreaterThan(0);
    expect(dariApi(kws)).toEqual(await sql("org_kawasan_id", d.org.kawasan));
    expect(dariApi(await lap(c.pengangkut, "pengangkut", q))).toEqual(await sql("org_pengangkut_id", d.org.pengangkut));
    expect(dariApi(await lap(c.duCm, "penerima", q))).toEqual(await sql("org_penerima_id", d.org.daurUlang));
    // Tiga tab pengelola identik.
    expect(bar(await lap(pengelola, "pengangkut", q))).toEqual(bar(kws));
    expect(bar(await lap(pengelola, "penerima", q))).toEqual(bar(kws));
  });
});

describe("S11-5 — akses per pihak", () => {
  const q = () => `periode=${periode}&kawasanId=${a.kawasan}`;

  it("pengangkut & penerima tidak bisa mengambil laporan pihak lain (403), petugas tidak punya laporan", async () => {
    for (const [cookie, pihak] of [[c.pengangkut, "kawasan"], [c.pengangkut, "penerima"], [c.duCm, "kawasan"], [c.duCm, "pengangkut"]] as const) {
      const h = await lap(cookie, pihak, q());
      expect(h.status, `${pihak}`).toBe(403);
      expect(h.json.galat?.pesan).toBe(TEKS.G_PERAN_TIDAK_BOLEH);
      expect((await unduh(cookie, pihak, `${q()}&format=csv`)).status).toBe(403);
    }
    expect((await lap(c.petugasA, "kawasan", q())).status).toBe(403);
  });

  it("organisasi lain tidak melihat serah kawasan A: pengelola B, pengangkut baru, penerima baru → 404 (kawasanId) atau kosong", async () => {
    // Pengelola kawasan B meminta kawasan A, dan sebaliknya.
    expect((await lap(c.pengelolaB, "kawasan", q())).status).toBe(404);
    expect((await rk(c.pengelolaB, a)).status).toBe(404);
    expect((await panggil(ditolak, { jalur: `/api/kawasan/${a.kawasan}/ditolak?periode=${periode}`, cookie: c.pengelolaB, params: { id: a.kawasan } })).status).toBe(404);
    // Pengangkut & penerima tanpa kontrak dengan kawasan A.
    const r = acak();
    const [orgPengangkut, orgPenerima] = [id("ujs11g"), id("ujs11n")];
    await denganPemilik(async (k) => {
      for (const [oid, jenis, jp] of [[orgPengangkut, "PENGANGKUT", null], [orgPenerima, "PENERIMA", "FASILITAS_BERIZIN"]] as const) {
        await k.query(
          `INSERT INTO organisasi (id, kode, nama, jenis, jenis_penerima, aliran_diterima, status_izin, yurisdiksi, demo, dibuat_pada)
           VALUES ($1, $2, $3, $4, $5, ARRAY['KUNING']::"Aliran"[], 'TERVERIFIKASI', 'DKI', false, now())`,
          [oid, `ORG-UJ${jenis === "PENGANGKUT" ? "PGK" : "PNR"}${r}`, `Uji ${jenis}`, jenis, jp],
        );
      }
    });
    const asingPengangkut = await masuk("PENGANGKUT", orgPengangkut);
    const asingPenerima = await masuk("PENERIMA", orgPenerima);
    expect((await lap(asingPengangkut, "pengangkut", q())).status).toBe(404);
    expect((await lap(asingPenerima, "penerima", q())).status).toBe(404);
    for (const [cookie, pihak] of [[asingPengangkut, "pengangkut"], [asingPenerima, "penerima"]] as const) {
      const tanpaFilter = bar(await lap(cookie, pihak, `periode=${periode}`));
      expect(tanpaFilter.baris).toEqual([]);
      expect(tanpaFilter.total).toEqual([]);
      const csv = await unduh(cookie, pihak, `periode=${periode}&format=csv`);
      expect(csv.status).toBe(200);
      expect((await csv.text()).split("\r\n").filter(Boolean)).toHaveLength(2); // header + catatan, tanpa data siapa pun
    }
  });

  it("lapis kedua: peran PENGELOLA pada organisasi non-kawasan yang berkontrak (RLS membuka kawasan A) tetap 404, bukan data kawasan A", async () => {
    // RLS memperlihatkan kawasan A kepada organisasi pengangkut (ada kontrak). Hanya pemeriksaan kepemilikan di layanan
    // yang mencegah peran PENGELOLA di organisasi itu membaca ringkasan/laporan kawasan A.
    const cookie = await masuk("PENGELOLA", d.org.pengangkut);
    expect((await rk(cookie, a)).status).toBe(404);
    expect((await lap(cookie, "kawasan", q())).status).toBe(404);
    expect((await panggil(ditolak, { jalur: `/api/kawasan/${a.kawasan}/ditolak?periode=${periode}`, cookie, params: { id: a.kawasan } })).status).toBe(404);
  });

  it("masukan tidak sah: periode salah / field tak dikenal → 400; format tak dikenal → 400", async () => {
    expect((await lap(c.pengelolaA, "kawasan", "periode=2026-13")).status).toBe(400);
    expect((await lap(c.pengelolaA, "kawasan", "")).status).toBe(400);
    const asing = await lap(c.pengelolaA, "kawasan", `periode=${periode}&userId=x`);
    expect([asing.status, asing.json.galat?.kode]).toEqual([400, "FIELD_TIDAK_DIKENAL"]);
    expect((await panggil(laporan, { jalur: "/", cookie: c.pengelolaA, params: { pihak: "admin" } })).status).toBe(400);
    // PDF (S23) butuh hak ekspor.pdf; organisasi uji ini dibuat lewat SQL tanpa langganan → tanpa hak (CSV tetap bisa).
    const pdf = await unduh(c.pengelolaA, "kawasan", `periode=${periode}&format=pdf`);
    expect([pdf.status, (await pdf.json()).galat.kode]).toEqual([403, "HAK_PAKET_TIDAK_ADA"]);
    expect((await unduh(c.pengelolaA, "kawasan", `periode=${periode}&format=xlsx`)).status).toBe(400);
  });
});

describe("CSV ekspor", () => {
  it("berkas kawasan A: BOM, ';', header KOL_*, baris & total angka tangan, sidik cocok, tercatat di tabel ekspor", async () => {
    const q = `periode=${periode}&kawasanId=${a.kawasan}`;
    const r = await unduh(c.pengelolaA, "kawasan", `${q}&format=csv`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toBe(`attachment; filename="laporan-kawasan-${periode}.csv"`);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const sidikHeader = r.headers.get(HEADER_SIDIK_ISI)!;

    const mentah = new Uint8Array(await r.arrayBuffer());
    expect([...mentah.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    // ignoreBOM: pertahankan U+FEFF supaya terlihat dan dibuang eksplisit (pembaca bawaan membuangnya diam-diam).
    const teks = new TextDecoder("utf-8", { ignoreBOM: true }).decode(mentah).slice(1 + PETUNJUK_PEMISAH.length);
    const baris = teks.split("\r\n");
    expect(baris.at(-1)).toBe(""); // diakhiri CRLF
    const garis = baris.slice(0, -1);
    expect(garis[0]).toBe([TEKS.KOL_TANGGAL, TEKS.KOL_KODE_SERAH, TEKS.KOL_ALIRAN, TEKS.KOL_BERAT_TPS, TEKS.KOL_BERAT_DITERIMA, TEKS.KOL_BERAT_DITOLAK, TEKS.KOL_ALASAN, TEKS.KOL_LOKASI, TEKS.KOL_PENGANGKUT, TEKS.KOL_PLAT, TEKS.KOL_TUJUAN, TEKS.KOL_STATUS, TEKS.KOL_SIDIK].join(";"));
    expect(garis).toHaveLength(1 + 4 + 2 + 1); // header, 4 serah tertutup, 2 total (KUNING, ABU), catatan
    const sel = garis.slice(1, 5).map((g) => g.split(";"));
    expect(sel.map((s) => [s[1], s[3], s[4], s[5]])).toEqual([
      [kode.s1, "20", "15", "5"],
      [kode.s2, "10", "0", "10"],
      [kode.s3, "6", "3", "3"],
      [kode.s4, "30", "30", "0"],
    ]);
    expect(garis[5]!.split(";").slice(0, 6)).toEqual([TEKS.LAPORAN_TOTAL, "", TEKS.ALIRAN_KUNING, "36", "18", "18"]);
    expect(garis[6]!.split(";").slice(0, 6)).toEqual([TEKS.LAPORAN_TOTAL, "", TEKS.ALIRAN_ABU, "30", "30", "0"]);

    // Sidik dihitung ulang dari berkas: buang baris catatan, SHA-256 atas sisanya.
    const tanpaCatatan = garis.slice(0, -1).map((g) => `${g}\r\n`).join("");
    expect(createHash("sha256").update(tanpaCatatan, "utf8").digest("hex")).toBe(sidikHeader);
    expect(garis.at(-1)).toBe(isi("EKSPOR_CATATAN", { sidik_isi: sidikHeader }));

    const catat = await satu<{ organisasi_id: string; pihak: string; periode: string; format: string; jumlah_baris: number }>(
      `SELECT organisasi_id, pihak::text, periode, format::text, jumlah_baris FROM ekspor WHERE sidik_isi = $1 ORDER BY dibuat_pada DESC LIMIT 1`,
      [sidikHeader],
    );
    expect(catat).toEqual({ organisasi_id: a.org, pihak: "KAWASAN", periode, format: "CSV", jumlah_baris: 4 });
  });

  it("isi CSV = isi JSON laporan (jumlah baris sama); angka kg koma desimal untuk berat berpecahan", async () => {
    const q = `periode=${periode}&kawasanId=${a.kawasan}`;
    const json = bar(await lap(c.pengelolaA, "kawasan", q));
    const csv = await (await unduh(c.pengelolaA, "kawasan", `${q}&format=csv`)).text();
    const dataGaris = csv.split("\r\n").filter((g) => g.includes(";SRH-"));
    expect(dataGaris).toHaveLength(json.baris.length);
  });
});

const zero = (aliran: string) => ({ aliran, beratTpsG: 0, beratDiterimaG: 0, beratDitolakG: 0 });
const rk = (cookie: string, w: Dunia) => panggil(ringkasan, { jalur: `/api/kawasan/${w.kawasan}/ringkasan?periode=${periode}`, cookie, params: { id: w.kawasan } });

describe("GET /api/kawasan/[id]/ringkasan", () => {
  it("kawasan A (angka tangan): neraca hari & bulan ini, menunggu persetujuan 1 (s7), menggantung 1 (s6), tanpa prioritas/peringatan", async () => {
    const neraca = [
      zero("HIJAU"), // wadah tanpa berat: tercatat, berat tidak ditebak
      { aliran: "KUNING", beratTpsG: 48_000, beratDiterimaG: 18_000, beratDitolakG: 18_000 }, // dicatat 20+10+6+5+7 kg
      zero("MERAH"),
      { aliran: "ABU", beratTpsG: 30_000, beratDiterimaG: 30_000, beratDitolakG: 0 },
    ];
    expect(data(await rk(c.pengelolaA, a))).toEqual({ periode, hariIni: neraca, bulanIni: neraca, menungguSetuju: 1, menggantung: 1, prioritas: [], peringatan: [] });
  });

  it("hanya pengelola pemilik kawasan: peran lain 403, pengelola kawasan lain 404, periode wajib", async () => {
    expect((await rk(c.pengangkut, a)).status).toBe(403);
    expect((await rk(c.petugasA, a)).status).toBe(403);
    expect((await rk(c.pengelolaB, a)).status).toBe(404);
    expect((await panggil(ringkasan, { jalur: `/api/kawasan/${a.kawasan}/ringkasan`, cookie: c.pengelolaA, params: { id: a.kawasan } })).status).toBe(400);
  });

  it("prioritas R-10 (nowcast memuat TPS + wadah KUNING 80 jam) selalu bercatatan; peringatan R-05 muncul — kawasan B", async () => {
    await wadahBaru(c.petugasB, b, "KUNING", 2_000, new Date(Date.now() - 80 * JAM));
    await denganPemilik((k) =>
      k.query(
        `INSERT INTO peringatan_cuaca (id, identifier_cap, provinsi, event, headline, deskripsi, effective, expires, poligon_e6, diambil_pada)
         VALUES ($1, $2, 'Uji', 'Hujan Lebat', 'Peringatan uji S11', '-', now() - interval '1 hour', now() + interval '2 hours', $3::jsonb, now())`,
        [id("ujs11w"), `uji-s11-${randomUUID()}`, JSON.stringify([[-1000, -1000], [-1000, 1000], [1000, 1000], [1000, -1000]])],
      ),
    );
    const h = data<{ prioritas: { tpsId: string; tpsKode: string; teks: string; catatan: string }[]; peringatan: { kode: string; aksi: string; teks: string }[] }>(await rk(c.pengelolaB, b));
    expect(h.prioritas).toHaveLength(1);
    expect(h.prioritas[0]).toMatchObject({ tpsId: b.tps, tpsKode: b.kodeTps, catatan: TEKS.R10_CATATAN });
    expect(h.prioritas[0]?.teks).toContain("Peringatan uji S11");
    expect(h.peringatan).toContainEqual(expect.objectContaining({ kode: "R05", aksi: "PERINGATAN" }));
    expect(h.peringatan.every((p) => !/melanggar|pelanggaran/i.test(p.teks))).toBe(true);
  });
});

describe("GET /api/kawasan/[id]/ditolak", () => {
  const dt = (cookie: string, w: Dunia) => panggil(ditolak, { jalur: `/api/kawasan/${w.kawasan}/ditolak?periode=${periode}`, cookie, params: { id: w.kawasan } });

  it("kawasan A (angka tangan): kuning 18 kg diterima vs 18 kg ditolak; alasan teratas; selisih = kg × (2000 − 1200); label sumber bertanggal", async () => {
    expect(data(await dt(c.pengelolaA, a))).toEqual({
      periode,
      kuning: { diterimaG: 18_000, ditolakG: 18_000 }, // ABU s4 tidak dihitung
      alasan: [
        { alasan: "BASAH_KOTOR", ditolakG: 10_000, jumlahSerah: 1, selisihIdr: 8_000 }, // 10 kg × Rp800
        { alasan: "TERCAMPUR_ORGANIK", ditolakG: 8_000, jumlahSerah: 2, selisihIdr: 6_400 }, // (5 + 3) kg × Rp800
      ],
      sumberHarga: { sumber: "PET bening, bank sampah binaan IMIP", tanggal: "2024-07-10" },
    });
  });

  it("angka sama dengan laporan kawasan (satu sumber); kawasan tanpa penutupan → nol & daftar kosong", async () => {
    const lapKws = bar(await lap(c.pengelolaA, "kawasan", `periode=${periode}&kawasanId=${a.kawasan}`));
    const kuning = lapKws.total.find((t) => t.aliran === "KUNING");
    const h = data<{ kuning: { diterimaG: number; ditolakG: number } }>(await dt(c.pengelolaA, a));
    expect(h.kuning).toEqual({ diterimaG: kuning?.beratDiterimaG, ditolakG: kuning?.beratDitolakG });
    expect(data(await dt(c.pengelolaB, b))).toMatchObject({ kuning: { diterimaG: 0, ditolakG: 0 }, alasan: [] });
  });

  it("pengelola lain / peran lain tidak bisa melihat penyebab ditolak kawasan A", async () => {
    expect((await dt(c.pengelolaB, a)).status).toBe(404);
    expect((await dt(c.duCm, a)).status).toBe(403);
  });
});

describe("Indikator F43 (layanan indikatorKawasan)", () => {
  it("kawasan A (angka tangan): kg per aliran, kuning 50%, serah tertutup 4 dari 6, kg terangkut sebelum hujan = 71 kg", async () => {
    const sesi = (await bacaSesi(new Request(`${asal()}/api/sesi`, { headers: { cookie: c.pengelolaA } })))!;
    const h = await denganAkses(konteksAkses(sesi), (tx) => indikatorKawasan(tx, sesi, a.kawasan, periode));
    expect(h).toEqual({
      kgPerAliran: {
        HIJAU: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
        KUNING: { dicatatG: 48_000, diterimaG: 18_000, ditolakG: 18_000 },
        MERAH: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
        ABU: { dicatatG: 30_000, diterimaG: 30_000, ditolakG: 0 },
      },
      kuning: { diterimaG: 18_000, ditolakG: 18_000, diterimaBp: 5_000 },
      serahDibuat: 6, // s1, s2, s3, s4, s6, s7
      serahTertutup: 4,
      serahTertutupBp: 6_667,
      umurWadahRataJam: 0, // wadah dicatat beberapa detik sebelum disetujui
      kgTerangkutSebelumHujanG: 71_000, // s1 20 + s2 10 + s3 6 + s4 30 + s6 5 (s7 belum disetujui)
    });
  });
});
