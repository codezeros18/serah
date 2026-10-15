import { describe, expect, it } from "vitest";
import { adalahDhash, jarakHamming } from "./index";

describe("T04 jarakHamming (versi murni)", () => {
  it("identik = 0", () => {
    expect(jarakHamming("ffff0000ffff0000", "ffff0000ffff0000")).toBe(0);
  });
  it("hitung bit berbeda", () => {
    expect(jarakHamming("0000000000000000", "0000000000000001")).toBe(1);
    expect(jarakHamming("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(jarakHamming("ffff0000ffff0000", "ffff0000ffff003f")).toBe(6);
  });
  it("tidak peka kapitalisasi dan simetris", () => {
    expect(jarakHamming("ABCDEF0123456789", "abcdef0123456789")).toBe(0);
    expect(jarakHamming("0123456789abcdef", "fedcba9876543210")).toBe(jarakHamming("fedcba9876543210", "0123456789abcdef"));
  });
  it("menolak hash bukan 16 heksa", () => {
    expect(adalahDhash("xyz")).toBe(false);
    expect(() => jarakHamming("abc", "0000000000000000")).toThrow();
  });
});
