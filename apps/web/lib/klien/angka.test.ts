import { describe, expect, it } from "vitest";
import { formatGramKeKg, parseBeratKgKeGram } from "./angka";

describe("angka klien (menyerahkan ke core/angka)", () => {
  it("parse koma → gram bulat", () => {
    expect(parseBeratKgKeGram("42,5")).toBe(42_500);
    expect(parseBeratKgKeGram("0,001")).toBe(1);
    expect(parseBeratKgKeGram(" 7 ")).toBe(7_000);
    expect(parseBeratKgKeGram("1.250,5")).toBe(1_250_500);
  });
  it("menolak masukan tidak sah", () => {
    for (const s of ["", "abc", "1,2345", "-3", "0", "1,2,3", "4 kg", "42.5"]) expect(parseBeratKgKeGram(s)).toBeNull();
  });
  it("format gram → kg dengan koma", () => {
    expect(formatGramKeKg(42_500)).toBe("42,5");
    expect(formatGramKeKg(1_000)).toBe("1");
    expect(formatGramKeKg(1)).toBe("0,001");
  });
});
