import { randomBytes } from "node:crypto";
import { inflateSync } from "node:zlib";
import { HEADER_SIDIK_ISI, TEKS } from "@serah/kontrak";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { asal, data, demo, denganPemilik, masuk, panggil, satu, semua, type DemoS08 } from "@/lib/server/uji/klien";
import { GET as laporan } from "./laporan/[pihak]/route";
import { GET as ekspor } from "./laporan/[pihak]/ekspor/route";
import { GET as lembar } from "./kawasan/[id]/lembar-neraca/route";

// S23 — PDF tiga laporan (total = CSV), Lembar Neraca (setiap angka → kode serah + status), hak paket.

vi.setConfig({ testTimeout: 60_000 });

let d: DemoS08;
let periode = "";
let c: Record<"pengelola" | "pengangkut" | "penerima", string>;

beforeAll(async () => {
  d = await demo();
  c = { pengelola: await masuk("PENGELOLA"), pengangkut: await masuk("PENGANGKUT"), penerima: await masuk("PENERIMA") };
  // Periode seed lampau tertua yang punya penutupan (tidak ditulis test lain).
  periode = (
    await satu<{ p: string }>(
      `SELECT min(to_char(diterima_pada AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')) AS p FROM event
       WHERE kawasan_id = $1 AND jenis IN ('SERAH_DITERIMA', 'SERAH_DITERIMA_SEBAGIAN', 'SERAH_DITOLAK') AND idempotency_key LIKE 'demo-%'`,
      [d.kawasan],
    )
  ).p;
});

type Berkas = { status: number; header: Headers; mentah: Uint8Array };

async function ambil(handler: unknown, jalur: string, cookie: string, params: Record<string, string>): Promise<Berkas> {
  const r = await (handler as (q: Request, x: { params: Promise<Record<string, string>> }) => Promise<Response>)(
    new Request(`${asal()}${jalur}`, { headers: { cookie } }),
    { params: Promise.resolve(params) },
  );
  return { status: r.status, header: r.headers, mentah: new Uint8Array(await r.arrayBuffer()) };
}

const ekspPdf = (cookie: string, pihak: string, kueri = `periode=${periode}&kawasanId=${d.kawasan}`) =>
  ambil(ekspor, `/api/laporan/${pihak}/ekspor?${kueri}&format=pdf`, cookie, { pihak });
const ekspCsv = (cookie: string, pihak: string, kueri = `periode=${periode}&kawasanId=${d.kawasan}`) =>
  ambil(ekspor, `/api/laporan/${pihak}/ekspor?${kueri}&format=csv`, cookie, { pihak });
const teksBerkas = (b: Berkas) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(b.mentah);

/** Teks dari PDF: inflate semua aliran FlateDecode, lalu gabung string hex dalam tiap operator TJ (font standar). */
function teksPdf(b: Berkas): string {
  const biner = Buffer.from(b.mentah);
  const keluar: string[] = [];
  let i = 0;
  for (;;) {
    const a = biner.indexOf("stream", i, "latin1");
    if (a < 0) break;
    const mulai = biner[a + 6] === 0x0d ? a + 8 : a + 7;
    const e = biner.indexOf("endstream", mulai, "latin1");
    if (e < 0) break;
    i = e + 9;
    let isi: string;
    try {
      isi = inflateSync(biner.subarray(mulai, e)).toString("latin1");
    } catch {
      continue;
    }
    for (const tj of isi.matchAll(/\[((?:<[0-9a-fA-F]*>|\s|-?\d+(?:\.\d+)?)+)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g)) {
      const hex = [...(tj[1] ?? tj[2] ?? "").matchAll(/<([0-9a-fA-F]*)>/g)].map((m) => m[1]).join("") || (tj[2] ?? "");
      keluar.push(Buffer.from(hex, "hex").toString("latin1"));
    }
  }
  return keluar.join("\n");
}

const hitungEkspor = async (pihak: string, format: string) =>
  Number((await satu<{ n: string }>(`SELECT count(*) AS n FROM ekspor WHERE organisasi_id = $1 AND pihak = $2::"PihakEkspor" AND format = $3::"FormatEkspor" AND periode = $4`, [d.org.kawasan, pihak, format, periode])).n);

describe("S23-1 PDF tiga laporan = CSV", () => {
  it("PDF sah; sidik di header = sidik CSV; semua kode serah & total CSV muncul di PDF; tercatat di tabel ekspor", async () => {
    const pdf = await ekspPdf(c.pengelola, "kawasan");
    expect(pdf.status).toBe(200);
    expect(pdf.header.get("content-type")).toBe("application/pdf");
    expect(pdf.header.get("content-disposition")).toBe(`attachment; filename="laporan-kawasan-${periode}.pdf"`);
    expect(Buffer.from(pdf.mentah.subarray(0, 5)).toString()).toBe("%PDF-");

    const csv = await ekspCsv(c.pengelola, "kawasan");
    expect(csv.status).toBe(200);
    expect(pdf.header.get(HEADER_SIDIK_ISI)).toBe(csv.header.get(HEADER_SIDIK_ISI));

    const garis = teksBerkas(csv).slice(1).split("\r\n").filter((g) => g && !g.startsWith("sep="));
    const sel = garis.slice(1, -1).map((g) => g.split(";"));
    const kodeSerah = [...new Set(sel.filter((s) => s[1]).map((s) => s[1]!))];
    expect(kodeSerah.length).toBeGreaterThan(5);
    const teks = teksPdf(pdf);
    expect(teks).toContain(TEKS.LAPORAN_KAWASAN);
    for (const k of kodeSerah) expect(teks, k).toContain(k);
    // Baris total: setiap angka kg total CSV ada di PDF pada baris total yang sama (label aliran + tiga angka berurutan).
    const total = sel.filter((s) => s[0] === TEKS.LAPORAN_TOTAL);
    expect(total.length).toBeGreaterThan(0);
    // Teks PDF dipecah per sel (satu per baris); sel baris total berurutan: label aliran lalu tiga angka CSV.
    // Label aliran bisa terbungkus ke beberapa baris; ketiga angka total selalu tiga baris berturut-turut, didahului "Total".
    const potongan = teks.split("\n");
    for (const t of total) {
      const i = potongan.findIndex((x, n) => x === t[3] && potongan[n + 1] === t[4] && potongan[n + 2] === t[5]);
      expect(i, `total ${t[2]} ${t[3]}/${t[4]}/${t[5]}`).toBeGreaterThan(0);
      expect(potongan.slice(Math.max(0, i - 5), i), `label total ${t[2]}`).toContain(TEKS.LAPORAN_TOTAL);
    }

    // Satu baris ekspor PDF ditambahkan per unduhan (dihitung sebelum & sesudah: data demo identik antar-run).
    const sebelum = await hitungEkspor("KAWASAN", "PDF");
    expect((await ekspPdf(c.pengelola, "kawasan")).status).toBe(200);
    const sesudah = await semua<{ sidik_isi: string; jumlah_baris: number }>(
      `SELECT sidik_isi, jumlah_baris FROM ekspor WHERE organisasi_id = $1 AND pihak = 'KAWASAN' AND format = 'PDF' AND periode = $2 ORDER BY dibuat_pada DESC, id DESC LIMIT 1`,
      [d.org.kawasan, periode],
    );
    expect(await hitungEkspor("KAWASAN", "PDF")).toBe(sebelum + 1);
    expect(sesudah[0]).toEqual({ sidik_isi: pdf.header.get(HEADER_SIDIK_ISI), jumlah_baris: sel.filter((s) => s[1] && s[0] !== TEKS.LAPORAN_TOTAL).length });
  });

  it("tiga pihak: sidik PDF = sidik CSV untuk masing-masing (pengangkut & penerima demo)", async () => {
    for (const [cookie, pihak] of [[c.pengangkut, "pengangkut"], [c.penerima, "penerima"]] as const) {
      const pdf = await ekspPdf(cookie, pihak);
      const csv = await ekspCsv(cookie, pihak);
      expect([pdf.status, csv.status]).toEqual([200, 200]);
      expect(pdf.header.get(HEADER_SIDIK_ISI)).toBe(csv.header.get(HEADER_SIDIK_ISI));
      expect(teksPdf(pdf)).toContain(pihak === "pengangkut" ? TEKS.LAPORAN_PENGANGKUT : TEKS.LAPORAN_PENERIMA);
    }
  });
});

describe("S23-2 Lembar Neraca berjejak asal", () => {
  it("setiap kode serah & statusnya dari laporan ada di lembar; judul & penjelasan §M; sidik di header; tercatat", async () => {
    const r = await ambil(lembar, `/api/kawasan/${d.kawasan}/lembar-neraca?periode=${periode}`, c.pengelola, { id: d.kawasan });
    expect(r.status).toBe(200);
    expect(r.header.get("content-type")).toBe("application/pdf");
    expect(r.header.get("content-disposition")).toBe(`attachment; filename="lembar-neraca-${periode}.pdf"`);
    expect(Buffer.from(r.mentah.subarray(0, 5)).toString()).toBe("%PDF-");

    const lap = data<{ baris: { kodeSerah: string; status: string }[] }>(
      await panggil(laporan, { jalur: `/api/laporan/kawasan?periode=${periode}&kawasanId=${d.kawasan}`, cookie: c.pengelola, params: { pihak: "kawasan" } }),
    );
    const teks = teksPdf(r);
    expect(teks).toContain(TEKS.LEMBAR_NERACA);
    expect(teks).toContain(TEKS.LEMBAR_NERACA_PENJELASAN);
    const kode = [...new Set(lap.baris.map((b) => b.kodeSerah))];
    expect(kode.length).toBeGreaterThan(5);
    for (const k of kode) expect(teks, k).toContain(k);
    for (const s of new Set(lap.baris.map((b) => b.status))) expect(teks).toContain(TEKS[`STATUS_${s}` as keyof typeof TEKS] as string);

    const sebelum = await hitungEkspor("LEMBAR_NERACA", "PDF");
    const ulang = await ambil(lembar, `/api/kawasan/${d.kawasan}/lembar-neraca?periode=${periode}`, c.pengelola, { id: d.kawasan });
    expect(ulang.status).toBe(200);
    expect(ulang.header.get(HEADER_SIDIK_ISI)).toBe(r.header.get(HEADER_SIDIK_ISI)); // deterministik untuk data yang sama
    expect(await hitungEkspor("LEMBAR_NERACA", "PDF")).toBe(sebelum + 1);
    const catat = await satu<{ sidik_isi: string; jumlah_baris: number }>(
      `SELECT sidik_isi, jumlah_baris FROM ekspor WHERE organisasi_id = $1 AND pihak = 'LEMBAR_NERACA' AND periode = $2 ORDER BY dibuat_pada DESC, id DESC LIMIT 1`,
      [d.org.kawasan, periode],
    );
    expect(catat).toEqual({ sidik_isi: r.header.get(HEADER_SIDIK_ISI), jumlah_baris: kode.length });
  });

  it("hanya pengelola pemilik kawasan: peran lain 403, pengelola kawasan lain 404, periode wajib 400", async () => {
    expect((await ambil(lembar, `/api/kawasan/${d.kawasan}/lembar-neraca?periode=${periode}`, c.pengangkut, { id: d.kawasan })).status).toBe(403);
    const lain = await dunia("KAWASAN_STANDAR");
    expect((await ambil(lembar, `/api/kawasan/${d.kawasan}/lembar-neraca?periode=${periode}`, lain, { id: d.kawasan })).status).toBe(404);
    expect((await ambil(lembar, `/api/kawasan/${d.kawasan}/lembar-neraca`, c.pengelola, { id: d.kawasan })).status).toBe(400);
  });
});

/** Organisasi KAWASAN baru dengan paket tertentu + sesi PENGELOLA (keanggotaan ditambahkan di organisasi itu). */
async function dunia(paket: string, hasil?: { org?: string }): Promise<string> {
  const org = `ujs23o${randomBytes(9).toString("hex")}`;
  await denganPemilik(async (k) => {
    await k.query(
      `INSERT INTO organisasi (id, kode, nama, jenis, aliran_diterima, status_izin, yurisdiksi, demo, dibuat_pada)
       VALUES ($1, $2, 'Kawasan Uji S23', 'KAWASAN', ARRAY[]::"Aliran"[], 'BELUM_DIAJUKAN', 'DKI', false, now())`,
      [org, `ORG-UJ23${randomBytes(3).toString("hex")}`],
    );
    await k.query(`INSERT INTO langganan (id, organisasi_id, paket_kode, status, diperbarui_pada) VALUES ($1, $2, $3, 'AKTIF', now())`, [
      `ujs23g${randomBytes(9).toString("hex")}`,
      org,
      paket,
    ]);
  });
  if (hasil) hasil.org = org;
  return masuk("PENGELOLA", org);
}

describe("S23-3 hak paket", () => {
  it("paket DASAR (tanpa ekspor.pdf & lembar_neraca): PDF & lembar → 403 HAK_PAKET_TIDAK_ADA; CSV tetap 200", async () => {
    const dasar = await dunia("KAWASAN_DASAR");
    const pdf = await ekspPdf(dasar, "kawasan", `periode=${periode}`);
    expect(pdf.status).toBe(403);
    const galat = JSON.parse(teksBerkas(pdf)).galat;
    expect(galat).toEqual({ kode: "HAK_PAKET_TIDAK_ADA", pesan: TEKS.G_HAK_PAKET });
    const lem = await ambil(lembar, `/api/kawasan/${d.kawasan}/lembar-neraca?periode=${periode}`, dasar, { id: d.kawasan });
    expect([lem.status, JSON.parse(teksBerkas(lem)).galat.kode]).toEqual([403, "HAK_PAKET_TIDAK_ADA"]);
    // Ekspor CSV tidak pernah dikunci paket (kewajiban hukum pengguna).
    const csv = await ekspCsv(dasar, "kawasan", `periode=${periode}`);
    expect(csv.status).toBe(200);
    expect(teksBerkas(csv)).toContain(TEKS.KOL_KODE_SERAH);
  });

  it("STANDAR punya hak; permintaan yang ditolak hak tidak menulis baris ekspor", async () => {
    const standar = await dunia("KAWASAN_STANDAR");
    expect((await ekspPdf(standar, "kawasan", `periode=${periode}`)).status).toBe(200);
    const o: { org?: string } = {};
    const dasar = await dunia("KAWASAN_DASAR", o);
    expect((await ekspPdf(dasar, "kawasan", `periode=${periode}`)).status).toBe(403);
    expect((await ambil(lembar, `/api/kawasan/${d.kawasan}/lembar-neraca?periode=${periode}`, dasar, { id: d.kawasan })).status).toBe(403);
    expect(await semua(`SELECT 1 FROM ekspor WHERE organisasi_id = $1`, [o.org])).toEqual([]);
  });
});
