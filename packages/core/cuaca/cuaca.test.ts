import { describe, expect, it } from "vitest";
import { basi, jamWib, slotRelevan, tanggalWib, titikDalamPoligon, type TitikE6 } from "./index";

const JAM = 3_600_000;
const SEKARANG = new Date("2026-10-15T05:00:00Z");

// Persegi: lintang −6,170000…−6,160000 ; bujur 106,840000…106,850000 (e6)
const PERSEGI: TitikE6[] = [
  [-6_170_000, 106_840_000],
  [-6_170_000, 106_850_000],
  [-6_160_000, 106_850_000],
  [-6_160_000, 106_840_000],
];

describe("titikDalamPoligon (BigInt)", () => {
  it("di dalam", () => {
    expect(titikDalamPoligon(-6_165_000, 106_845_000, PERSEGI)).toBe(true);
  });
  it("di luar", () => {
    expect(titikDalamPoligon(-6_150_000, 106_845_000, PERSEGI)).toBe(false);
    expect(titikDalamPoligon(-6_165_000, 106_860_000, PERSEGI)).toBe(false);
  });
  it("tepat di sisi dan di sudut = di dalam", () => {
    expect(titikDalamPoligon(-6_170_000, 106_845_000, PERSEGI)).toBe(true);
    expect(titikDalamPoligon(-6_165_000, 106_850_000, PERSEGI)).toBe(true);
    expect(titikDalamPoligon(-6_160_000, 106_840_000, PERSEGI)).toBe(true);
  });
  it("selisih 1 e6 di luar sisi = di luar", () => {
    expect(titikDalamPoligon(-6_159_999, 106_845_000, PERSEGI)).toBe(false);
  });
  it("poligon cekung (bentuk U): lekukan di luar, lengan di dalam", () => {
    // U menghadap ke atas: lekukan di tengah (lon 106,843–106,847, lat > -6,166)
    const U: TitikE6[] = [
      [-6_170_000, 106_840_000],
      [-6_170_000, 106_850_000],
      [-6_160_000, 106_850_000],
      [-6_160_000, 106_847_000],
      [-6_166_000, 106_847_000],
      [-6_166_000, 106_843_000],
      [-6_160_000, 106_843_000],
      [-6_160_000, 106_840_000],
    ];
    expect(titikDalamPoligon(-6_163_000, 106_845_000, U)).toBe(false); // di dalam lekukan
    expect(titikDalamPoligon(-6_163_000, 106_841_000, U)).toBe(true); // lengan kiri
    expect(titikDalamPoligon(-6_163_000, 106_849_000, U)).toBe(true); // lengan kanan
    expect(titikDalamPoligon(-6_168_000, 106_845_000, U)).toBe(true); // dasar U
    expect(titikDalamPoligon(-6_166_000, 106_845_000, U)).toBe(true); // tepat di sisi lekukan
  });
  it("poligon tertutup (titik awal diulang) dan terlalu sedikit titik", () => {
    expect(titikDalamPoligon(-6_165_000, 106_845_000, [...PERSEGI, PERSEGI[0]!])).toBe(true);
    expect(titikDalamPoligon(0, 0, [[0, 0], [1, 1]])).toBe(false);
  });
  it("koordinat e6 besar tidak kehilangan presisi", () => {
    const besar: TitikE6[] = [
      [-90_000_000, -180_000_000],
      [-90_000_000, 180_000_000],
      [90_000_000, 180_000_000],
      [90_000_000, -180_000_000],
    ];
    expect(titikDalamPoligon(89_999_999, 179_999_999, besar)).toBe(true);
  });
});

describe("slotRelevan & basi", () => {
  const slot = [-1, 0, 3, 6, 6.01, 9].map((j) => ({ slotUtc: new Date(SEKARANG.getTime() + j * JAM), weatherDesc: "x" }));
  it("hanya slot dalam [sekarang, sekarang+horizon], batas ikut, urut naik", () => {
    const r = slotRelevan([...slot].reverse(), SEKARANG, 6);
    expect(r.map((s) => (s.slotUtc.getTime() - SEKARANG.getTime()) / JAM)).toEqual([0, 3, 6]);
  });
  it("basi hanya bila lebih tua dari batas", () => {
    expect(basi(new Date(SEKARANG.getTime() - 12 * JAM), SEKARANG, 12)).toBe(false);
    expect(basi(new Date(SEKARANG.getTime() - 12 * JAM - 1000), SEKARANG, 12)).toBe(true);
  });
});

describe("WIB", () => {
  it("tanggal & jam WIB melewati tengah malam UTC", () => {
    const d = new Date("2026-10-14T18:30:00Z");
    expect(tanggalWib(d)).toBe("2026-10-15");
    expect(jamWib(d)).toBe(1);
  });
});
