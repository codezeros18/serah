import { describe, expect, it } from "vitest";
import { evaluasiBatas, evaluasiBoleh, masihDalamBatas } from "./index";

describe("evaluator hak (FITUR §3.2)", () => {
  it("boleh: hanya true yang membuka", () => {
    expect(evaluasiBoleh(true)).toBe(true);
    for (const n of [false, null, undefined, 1, "true", {}]) expect(evaluasiBoleh(n)).toBe(false);
  });
  it("batas: integer ≥0, null = tak terbatas, selain itu 0", () => {
    expect(evaluasiBatas(10)).toBe(10);
    expect(evaluasiBatas(0)).toBe(0);
    expect(evaluasiBatas(null)).toBeNull();
    for (const n of [undefined, -1, 1.5, "10", true]) expect(evaluasiBatas(n)).toBe(0);
  });
  it("masih dalam batas", () => {
    expect(masihDalamBatas(10, 9)).toBe(true);
    expect(masihDalamBatas(10, 10)).toBe(false);
    expect(masihDalamBatas(0, 0)).toBe(false);
    expect(masihDalamBatas(null, 1_000_000)).toBe(true);
  });
});
