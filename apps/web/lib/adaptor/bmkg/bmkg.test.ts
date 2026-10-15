import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { evaluasiCuaca } from "@serah/core/aturan";
import { titikDalamPoligon } from "@serah/core/cuaca";
import { PembatasLaju, buatSumberCuaca, buatSumberLive, buatSumberSnapshot, derajatKeE6, GalatBmkg, normalisasiPrakiraan, parseCap, parseDaftarNowcast, poligonCapKeE6 } from "./index";

const DIR = resolve(import.meta.dirname, "../../../../../data/bmkg");
const baca = (n: string) => readFileSync(resolve(DIR, n), "utf8");
const ADM4 = "31.71.03.1001";

describe("S05-3 derajatKeE6 (tanpa float)", () => {
  it.each([
    ["0.882", 882_000],
    ["103.753", 103_753_000],
    ["-6.1647214778", -6_164_721],
    ["106.8453837867", 106_845_383],
    ["-0.5", -500_000],
    ["5", 5_000_000],
    ["+7.000001", 7_000_001],
  ])("%s → %i", (s, e6) => expect(derajatKeE6(s)).toBe(e6));
  it("menolak masukan tak sah", () => {
    for (const s of ["", "abc", "1,5", "1.2.3", "1e3"]) expect(() => derajatKeE6(s)).toThrow(GalatBmkg);
  });
  it("poligon: titik penutup dibuang, pasangan rusak ditolak", () => {
    expect(poligonCapKeE6("-6.170,106.840 -6.170,106.850 -6.160,106.850 -6.170,106.840")).toEqual([
      [-6_170_000, 106_840_000],
      [-6_170_000, 106_850_000],
      [-6_160_000, 106_850_000],
    ]);
    expect(() => poligonCapKeE6("1.0 2.0")).toThrow(GalatBmkg);
  });
});

describe("S05-2 normalisasi prakiraan (snapshot nyata 15 Okt 2026)", () => {
  const p = normalisasiPrakiraan(JSON.parse(baca(`prakiraan-${ADM4}.json`)), ADM4, "SNAPSHOT");
  it("20 slot urut naik, analysis_date dibaca UTC", () => {
    expect(p.slot).toHaveLength(20);
    expect(p.slot[0]!.slotUtc.toISOString()).toBe("2026-10-15T05:00:00.000Z");
    expect(p.analysisDate.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(p.slot.every((s, i) => i === 0 || s.slotUtc > p.slot[i - 1]!.slotUtc)).toBe(true);
    expect(p).toMatchObject({ adm4: ADM4, mode: "SNAPSHOT" });
  });
  it("toleran field tambahan", () => {
    const j = JSON.parse(baca(`prakiraan-${ADM4}.json`));
    j.baru = 1;
    j.data[0].cuaca[0][0].field_baru = "x";
    expect(normalisasiPrakiraan(j, ADM4, "LIVE").slot).toHaveLength(20);
  });
  it("bentuk tak dikenal / slot rusak → GalatBmkg FORMAT, tanpa data karangan", () => {
    expect(() => normalisasiPrakiraan({}, ADM4, "LIVE")).toThrow(GalatBmkg);
    expect(() => normalisasiPrakiraan({ data: [] }, ADM4, "LIVE")).toThrow(GalatBmkg);
    expect(() => normalisasiPrakiraan({ data: [{ cuaca: [[{ datetime: "bukan waktu" }]] }] }, ADM4, "LIVE")).toThrow(GalatBmkg);
  });
});

describe("S05-3 RSS & CAP", () => {
  it("RSS nyata: item, kode, provinsi", () => {
    const d = parseDaftarNowcast(baca("nowcast-rss.xml"));
    expect(d).toHaveLength(7);
    expect(d[1]).toMatchObject({ kode: "CKR20261015003", provinsi: "Kep. Riau" });
  });
  it("CAP nyata: banyak <polygon>, waktu berzona, koordinat integer", () => {
    const c = parseCap(baca("cap-CKR20261015003.xml"));
    expect(c.identifierCap).toBe("2.49.0.1.360.0.2026.10.15.05.21.003");
    expect(c.effective.toISOString()).toBe("2026-10-15T05:06:00.000Z");
    expect(c.expires.toISOString()).toBe("2026-10-15T07:00:00.000Z");
    expect(c.provinsi).toBe("Kep. Riau");
    expect(c.poligonE6.length).toBeGreaterThan(5);
    expect(c.poligonE6[0]![0]).toEqual([882_000, 103_753_000]);
    for (const cincin of c.poligonE6) for (const t of cincin) expect(Number.isInteger(t[0]) && Number.isInteger(t[1])).toBe(true);
  });
  it("XML rusak → GalatBmkg FORMAT", () => {
    expect(() => parseCap("<alert></alert>")).toThrow(GalatBmkg);
    expect(() => parseDaftarNowcast("<x/>")).toThrow(GalatBmkg);
  });
});

describe("sumber snapshot & fixture → evaluator R-10 (bukti tanpa jaringan)", () => {
  const fx = buatSumberSnapshot({ dir: DIR, awalan: "fixture-" });
  it("fixture hujan: weather_desc sampai evaluator, kata dicocokkan trim & case-insensitive", async () => {
    const p = await fx.prakiraan(ADM4);
    const kini = new Date("2026-10-15T05:30:00Z");
    const r = evaluasiCuaca({
      yurisdiksi: "DKI",
      sekarang: kini,
      tps: { kode: "TPS-KWS-01", latE6: -6_165_000, lonE6: 106_845_000, namaKelurahan: "Kemayoran" },
      wadahBelumDiserahkan: [{ aliran: "KUNING", terjadiPada: new Date("2026-10-14T00:00:00Z") }],
      prakiraan: { mode: p.mode, analysisDate: p.analysisDate, slot: p.slot },
      nowcast: [],
    });
    expect(r.prioritas?.sumberCuaca).toBe("PRAKIRAAN");
  });
  it("fixture nowcast: hanya provinsi diminta; poligon memuat Kemayoran, cincin kedua tidak", async () => {
    const n = await fx.nowcast(["dki jakarta"]);
    expect(n).toHaveLength(1);
    expect(n[0]!.poligonE6).toHaveLength(2);
    const ada = (lat: number, lon: number) => n[0]!.poligonE6.some((c) => titikDalamPoligon(lat, lon, c));
    expect(ada(-6_165_000, 106_845_000)).toBe(true);
    expect(ada(-6_300_000, 106_845_000)).toBe(false);
  });
  it("snapshot tidak ada / adm4 tak sah → GalatBmkg", async () => {
    await expect(fx.prakiraan("99.99.99.9999")).rejects.toMatchObject({ kode: "BMKG_TIDAK_TERSEDIA", sebab: "SNAPSHOT_TIDAK_ADA" });
    await expect(fx.prakiraan("abc")).rejects.toMatchObject({ sebab: "FORMAT" });
  });
});

describe("S05-4 perilaku gagal sumber live", () => {
  const respons = (badan: string, status = 200) => async () => new Response(badan, { status });
  const bebas = new PembatasLaju(() => 0, async () => undefined, 1000);

  it("sukses → mode LIVE", async () => {
    const s = buatSumberLive({ fetch: respons(baca(`prakiraan-${ADM4}.json`)), pembatas: bebas });
    expect((await s.prakiraan(ADM4)).mode).toBe("LIVE");
  });
  it("5xx → HTTP", async () => {
    const s = buatSumberLive({ fetch: respons("x", 503), pembatas: bebas });
    await expect(s.prakiraan(ADM4)).rejects.toMatchObject({ kode: "BMKG_TIDAK_TERSEDIA", sebab: "HTTP" });
    await expect(s.daftarNowcast()).rejects.toMatchObject({ sebab: "HTTP" });
  });
  it("jaringan putus → JARINGAN", async () => {
    const s = buatSumberLive({ fetch: async () => Promise.reject(new TypeError("fetch failed")), pembatas: bebas });
    await expect(s.prakiraan(ADM4)).rejects.toMatchObject({ sebab: "JARINGAN" });
  });
  it("timeout → TIMEOUT", async () => {
    const menggantung: typeof fetch = (_u, init) =>
      new Promise((_ok, tolak) => init?.signal?.addEventListener("abort", () => tolak(new DOMException("abort", "AbortError"))));
    const s = buatSumberLive({ fetch: menggantung, pembatas: bebas, timeoutMs: 20 });
    await expect(s.prakiraan(ADM4)).rejects.toMatchObject({ sebab: "TIMEOUT" });
  });
  it("JSON/XML rusak → FORMAT", async () => {
    const s = buatSumberLive({ fetch: respons("<html>"), pembatas: bebas });
    await expect(s.prakiraan(ADM4)).rejects.toMatchObject({ sebab: "FORMAT" });
    await expect(s.daftarNowcast()).rejects.toMatchObject({ sebab: "FORMAT" });
  });
  it("detail nowcast hanya untuk URL bmkg.go.id", async () => {
    const f = vi.fn(respons(baca("cap-CKR20261015003.xml")));
    const s = buatSumberLive({ fetch: f, pembatas: bebas });
    await expect(s.detailNowcast("https://contoh.example/a_alert.xml")).rejects.toMatchObject({ sebab: "FORMAT" });
    expect(f).not.toHaveBeenCalled();
  });
  it("satu detail nowcast gagal → seluruh nowcast gagal (tanpa tebakan sebagian)", async () => {
    let n = 0;
    const f: typeof fetch = async () => {
      n++;
      return n === 1 ? new Response(baca("fixture-nowcast-rss.xml")) : new Response("x", { status: 500 });
    };
    const s = buatSumberLive({ fetch: f, pembatas: bebas });
    await expect(s.nowcast(["DKI Jakarta"])).rejects.toMatchObject({ sebab: "HTTP" });
  });
});

describe("antrean batas laju ≤ 50/menit", () => {
  it("permintaan ke-51 menunggu sampai jendela 60 dtk bergeser", async () => {
    let t = 0;
    const tidur = vi.fn(async (ms: number) => {
      t += ms;
    });
    const p = new PembatasLaju(() => t, tidur, 50);
    for (let i = 0; i < 50; i++) await p.tunggu();
    expect(tidur).not.toHaveBeenCalled();
    await p.tunggu();
    expect(tidur).toHaveBeenCalledTimes(1);
    expect(t).toBe(60_000);
  });
});

describe("S27-2 fallback otomatis snapshot BMKG", () => {
  it("mode live jatuh ke snapshot bila live gagal", async () => {
    const s = buatSumberCuaca("live");
    // Di lingkungan uji tanpa fetch BMKG live, akan fallback otomatis ke snapshot
    const p = await s.prakiraan(ADM4);
    expect(p.mode).toBe("SNAPSHOT");
    expect(p.slot.length).toBeGreaterThan(0);
  });
});
