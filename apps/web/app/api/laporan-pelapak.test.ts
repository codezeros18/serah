import { randomUUID } from "node:crypto";
import { TEKS } from "@serah/kontrak";
import { beforeAll, describe, expect, it } from "vitest";
import { asal, data, demo, formFoto, masuk, panggil, pngContoh, satu, type DemoS08, type Hasil } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { GET as ekspor } from "./laporan/[pihak]/ekspor/route";
import { GET as laporan } from "./laporan/[pihak]/route";
import { POST as ambil } from "./serah/[kode]/ambil/route";
import { POST as setujui } from "./serah/[kode]/setujui/route";
import { POST as tutup } from "./serah/[kode]/tutup/route";
import { POST as buatSerah } from "./serah/route";
import { POST as catatWadah } from "./wadah/route";

// S15-3 — pelapak berizin sebagai penerima: nota pelapak = tiket dengan enum sumber yang sama; T14 tetap hijau
// (tiga laporan identik) dan laporan menandai jenis PELAPAK_BERIZIN.

let d: DemoS08;
let c: Record<"petugas" | "pengelola" | "pengangkut" | "pelapak", string>;
let kode = "";
const periode = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

beforeAll(async () => {
  d = await demo();
  c = {
    petugas: await masuk("PETUGAS"),
    pengelola: await masuk("PENGELOLA"),
    pengangkut: await masuk("PENGANGKUT"),
    pelapak: await masuk("PENERIMA", d.org.pelapakBerkah),
  };
  const ids: string[] = [];
  for (const g of [8_000, 4_500]) {
    const w = await panggil(catatWadah, { jalur: "/api/wadah", cookie: c.petugas, body: { tpsId: d.tps1, aliran: "KUNING", beratG: g, terjadiPada: new Date().toISOString() } });
    ids.push(data<{ id: string }>(w).id);
  }
  kode = data<{ kode: string }>(await panggil(buatSerah, { jalur: "/api/serah", cookie: c.petugas, body: { tpsId: d.tps1, wadahIds: ids } })).kode;
  const fotoId = data<{ fotoId: string }>(
    await panggil(unggah, { jalur: "/api/foto", cookie: c.pengangkut, kunci: null, form: formFoto("MUATAN", pngContoh(randomUUID()), "image/png", kode) }),
  ).fotoId;
  data(await panggil(ambil, { jalur: "/", cookie: c.pengangkut, params: { kode }, body: { fotoId, kendaraanId: d.kendaraan, penerimaId: d.org.pelapakBerkah } }));
  data(await panggil(setujui, { jalur: "/", cookie: c.pengelola, params: { kode }, body: {} }));
  // Nota pelapak memakai enum sumber tiket yang sama dengan tiket timbang (di sini: dibaca AI lalu dikonfirmasi).
  data(
    await panggil(tutup, {
      jalur: "/",
      cookie: c.pelapak,
      params: { kode },
      body: {
        tiket: { beratG: 12_000, sumber: "AI_DIKONFIRMASI", nomor: "NOTA-PLP-01", aiModel: "claude-haiku-5-5", aiKeyakinan: "TINGGI" },
        rincian: [{ aliran: "KUNING", diterimaG: 9_000, ditolakG: 3_000, alasan: "BASAH_KOTOR" }],
      },
    }),
  );
}, 60_000);

const lap = (cookie: string, pihak: string) => panggil(laporan, { jalur: `/api/laporan/${pihak}?periode=${periode}&kawasanId=${d.kawasan}`, cookie, params: { pihak } });
const barisSerah = (h: Hasil) => data<{ baris: Record<string, unknown>[] }>(h).baris.filter((b) => b.kodeSerah === kode);

describe("S15-3 pelapak berizin", () => {
  it("nota pelapak tercatat sebagai tiket dengan sumber yang sama (AI_DIKONFIRMASI + model + keyakinan)", async () => {
    const t = await satu<{ sumber: string; ai_model: string; ai_keyakinan: string; nomor: string; berat_g: number }>(
      `SELECT t.sumber::text, t.ai_model, t.ai_keyakinan::text, t.nomor, t.berat_g FROM tiket_timbang t JOIN serah s ON s.id = t.serah_id WHERE s.kode = $1`,
      [kode],
    );
    expect(t).toEqual({ sumber: "AI_DIKONFIRMASI", ai_model: "claude-haiku-5-5", ai_keyakinan: "TINGGI", nomor: "NOTA-PLP-01", berat_g: 12_000 });
  });

  it("T14: tiga laporan identik untuk serah ke pelapak; kolom jenis penerima = PELAPAK_BERIZIN", async () => {
    const [kws, png, plp] = [await lap(c.pengelola, "kawasan"), await lap(c.pengangkut, "pengangkut"), await lap(c.pelapak, "penerima")];
    expect(barisSerah(kws)).toEqual([
      expect.objectContaining({
        kodeSerah: kode,
        aliran: "KUNING",
        beratTpsG: 12_500,
        beratDiterimaG: 9_000,
        beratDitolakG: 3_000,
        alasanTolak: "BASAH_KOTOR",
        penerimaNama: "Pelapak Contoh Berkah",
        penerimaJenis: "PELAPAK_BERIZIN",
        status: "DITERIMA_SEBAGIAN",
      }),
    ]);
    expect(barisSerah(png)).toEqual(barisSerah(kws));
    expect(barisSerah(plp)).toEqual(barisSerah(kws));
  });

  it("laporan penerima pelapak hanya memuat serah miliknya; CSV menandai jenis dengan label §M", async () => {
    const { baris } = data<{ baris: { penerimaJenis: string }[] }>(await lap(c.pelapak, "penerima"));
    expect(baris.length).toBeGreaterThan(0);
    expect(baris.every((b) => b.penerimaJenis === "PELAPAK_BERIZIN")).toBe(true);
    const r = await (ekspor as unknown as (q: Request, x: { params: Promise<{ pihak: string }> }) => Promise<Response>)(
      new Request(`${asal()}/api/laporan/penerima/ekspor?periode=${periode}&format=csv&kawasanId=${d.kawasan}`, { headers: { cookie: c.pelapak } }),
      { params: Promise.resolve({ pihak: "penerima" }) },
    );
    expect(r.status).toBe(200);
    const baris2 = (await r.text()).split("\r\n").filter((g) => g.includes(kode));
    expect(baris2).toHaveLength(1);
    expect(baris2[0]).toContain(`Pelapak Contoh Berkah (${TEKS.JENIS_PENERIMA_PELAPAK_BERIZIN})`);
  });
});
