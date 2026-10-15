import { describe, expect, it } from "vitest";
import { BERAT_G_MAKS } from "@serah/kontrak";
import { formatBp, formatE6, formatGramKeKg, parseBeratKgKeGram, parseBeratTeksKeGram, parseKoordinatKeE6, persenBp } from "./index";

const ok = (nilai: number) => ({ ok: true, nilai });
const galat = (g: string) => ({ ok: false, galat: g });

describe("T23 parser berat (BLUEPRINT §R)", () => {
  it('"42,5" → 42500 g', () => expect(parseBeratKgKeGram("42,5")).toEqual(ok(42_500)));
  it('"1.250,5" → 1250500 g', () => expect(parseBeratKgKeGram("1.250,5")).toEqual(ok(1_250_500)));
  it('"0" → galat', () => expect(parseBeratKgKeGram("0")).toEqual(galat("NOL")));
  it('"abc" → galat', () => expect(parseBeratKgKeGram("abc")).toEqual(galat("BUKAN_ANGKA")));
  it("ton → gram", () => {
    expect(parseBeratTeksKeGram("1,5", "ton")).toEqual(ok(1_500_000));
    expect(parseBeratTeksKeGram("2", "ton")).toEqual(ok(2_000_000));
    expect(parseBeratTeksKeGram("0,000001", "ton")).toEqual(ok(1));
  });
  it("kg lewat parseBeratTeksKeGram sama dengan parseBeratKgKeGram", () => {
    expect(parseBeratTeksKeGram("42,5", "kg")).toEqual(parseBeratKgKeGram("42,5"));
  });
  it("gram tidak boleh berdesimal", () => {
    expect(parseBeratTeksKeGram("1.500", "g")).toEqual(ok(1_500));
    expect(parseBeratTeksKeGram("1,5", "g")).toEqual(galat("TERLALU_BANYAK_DESIMAL"));
  });
});

describe("parseBeratKgKeGram — kasus tepi", () => {
  it.each<[string, ReturnType<typeof ok> | ReturnType<typeof galat>]>([
    [" 42,5 ", ok(42_500)], // 1 spasi luar
    [" 42,5\t", ok(42_500)], // 2 spasi tak putus & tab
    ["4 2,5", galat("BUKAN_ANGKA")], // 3 spasi di dalam
    ["", galat("KOSONG")], // 4
    ["   ", galat("KOSONG")], // 5
    ["1.250", ok(1_250_000)], // 6 titik ribuan tanpa desimal
    ["5.000", ok(5_000_000)], // 7 tepat batas atas
    ["5.000,001", galat("TERLALU_BESAR")], // 8 lewat batas
    ["1.000.000", galat("TERLALU_BESAR")], // 9 ribuan bertingkat
    ["99999999999999999999", galat("TERLALU_BESAR")], // 10 tanpa kehilangan presisi
    ["42.5", galat("FORMAT_RIBUAN")], // 11 titik sebagai desimal → tolak, jangan ditebak
    ["1.25,5", galat("FORMAT_RIBUAN")], // 12 kelompok ribuan cacat
    ["-3", galat("NEGATIF")], // 13
    ["-0,5", galat("NEGATIF")], // 14
    ["1,2345", galat("TERLALU_BANYAK_DESIMAL")], // 15 >3 desimal
    ["0,0004", galat("TERLALU_BANYAK_DESIMAL")], // 16
    ["1,2340", ok(1_234)], // 17 nol berlebih tetap pasti
    ["0,001", ok(1)], // 18 satu gram
    ["0,000", galat("NOL")], // 19
    [",5", galat("BUKAN_ANGKA")], // 20
    ["42,", galat("BUKAN_ANGKA")], // 21
    ["1e3", galat("BUKAN_ANGKA")], // 22
    ["007", ok(7_000)], // 23 nol di depan
    ["４２", galat("BUKAN_ANGKA")], // 24 angka lebar penuh
    ["42,5 kg", galat("BUKAN_ANGKA")], // 25 satuan bukan bagian isian
    ["+42", galat("BUKAN_ANGKA")], // 26
  ])("%j", (masukan, harap) => {
    expect(parseBeratKgKeGram(masukan)).toEqual(harap);
  });

  it("hasil selalu integer aman", () => {
    for (const t of ["42,5", "1.250,5", "0,001", "4.999,999"]) {
      const h = parseBeratKgKeGram(t);
      expect(h.ok && Number.isSafeInteger(h.nilai)).toBe(true);
    }
  });

  it("batas atas sama dengan kontrak BERAT_G_MAKS", () => {
    expect(parseBeratKgKeGram("5.000")).toEqual(ok(BERAT_G_MAKS));
  });
});

describe("formatGramKeKg", () => {
  it.each<[number, string]>([
    [42_500, "42,5"],
    [1_250_500, "1.250,5"],
    [1_000, "1"],
    [1, "0,001"],
    [0, "0"],
    [1_234_567, "1.234,567"],
    [5_000_000, "5.000"],
    [-1_500, "-1,5"],
    [123_456_789_000, "123.456.789"],
  ])("%d → %s", (g, harap) => expect(formatGramKeKg(g)).toBe(harap));

  it("menolak bukan integer", () => {
    expect(() => formatGramKeKg(1.5)).toThrow(RangeError);
    expect(() => formatGramKeKg(Number.NaN)).toThrow(RangeError);
  });

  it("pulang-pergi parse(format(g)) = g", () => {
    for (const g of [1, 9, 10, 99, 100, 999, 1_000, 1_001, 42_500, 999_999, 1_000_000, 4_999_999, 5_000_000]) {
      expect(parseBeratKgKeGram(formatGramKeKg(g))).toEqual(ok(g));
    }
  });
});

describe("koordinat e6", () => {
  it.each<[string, "lat" | "lon", ReturnType<typeof ok> | ReturnType<typeof galat>]>([
    ["-6.164532", "lat", ok(-6_164_532)],
    ["106,845", "lon", ok(106_845_000)],
    ["-6.1645321", "lat", ok(-6_164_532)], // dibulatkan ke 6 desimal
    ["-6.1645325", "lat", ok(-6_164_533)], // setengah menjauhi nol
    ["6.1645325", "lat", ok(6_164_533)],
    ["0", "lat", ok(0)],
    ["90", "lat", ok(90_000_000)],
    ["90.000001", "lat", galat("DI_LUAR_RENTANG")],
    ["-180", "lon", ok(-180_000_000)],
    ["181", "lon", galat("DI_LUAR_RENTANG")],
    ["abc", "lat", galat("BUKAN_ANGKA")],
    ["-6.16.4", "lat", galat("BUKAN_ANGKA")],
    ["", "lon", galat("KOSONG")],
  ])("%j (%s)", (t, sumbu, harap) => expect(parseKoordinatKeE6(t, sumbu)).toEqual(harap));

  it.each<[number, string]>([
    [-6_164_532, "-6.164532"],
    [106_845_000, "106.845000"],
    [0, "0.000000"],
    [-500, "-0.000500"],
  ])("formatE6(%d) → %s", (e6, harap) => expect(formatE6(e6)).toBe(harap));
});

describe("persen basis poin", () => {
  it.each<[number, number, number | null]>([
    [1, 3, 3_333],
    [2, 3, 6_667],
    [1, 8, 1_250],
    [0, 5, 0],
    [5, 0, null],
    [-1, 8, -1_250],
    [1, 32, 313],
    [-1, 32, -313],
    [8_000_000_000_000, 7_000_000_000_000, 11_429], // perkalian melewati 2^53 tetap tepat
  ])("persenBp(%d, %d) = %s", (b, t, harap) => expect(persenBp(b, t)).toBe(harap));

  it.each<[number, string]>([
    [1_250, "12,5"],
    [2_000, "20"],
    [3_333, "33,33"],
    [5, "0,05"],
    [-1_250, "-12,5"],
    [0, "0"],
  ])("formatBp(%d) = %s", (bp, harap) => expect(formatBp(bp)).toBe(harap));
});
