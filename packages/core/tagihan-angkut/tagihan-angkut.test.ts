import { describe, expect, it } from "vitest";
import { gramKeRupiah, hitungTagihanAngkut } from "./index";

// T27 — tagihan angkut hanya dari DITERIMA/DITERIMA_SEBAGIAN; angka dihitung tangan.

describe("gramKeRupiah", () => {
  it("dibulatkan ke bawah, sekali, tanpa float", () => {
    expect(gramKeRupiah(1_000, 700)).toBe(700);
    expect(gramKeRupiah(1_001, 700)).toBe(700); // 700,7 → 700
    expect(gramKeRupiah(1_999, 700)).toBe(1_399); // 1399,3 → 1399
    expect(gramKeRupiah(0, 700)).toBe(0);
    expect(gramKeRupiah(999, 1)).toBe(0);
  });
  it("menolak bukan integer / negatif", () => {
    expect(() => gramKeRupiah(1.5, 10)).toThrow(RangeError);
    expect(() => gramKeRupiah(-1, 10)).toThrow(RangeError);
    expect(() => gramKeRupiah(10, 0.5)).toThrow(RangeError);
  });
});

describe("hitungTagihanAngkut (T27)", () => {
  const serah = [
    { kode: "SRH-3", status: "DITERIMA_SEBAGIAN", diterimaG: 12_345 },
    { kode: "SRH-1", status: "DITERIMA", diterimaG: 20_000 },
    { kode: "SRH-2", status: "DITOLAK", diterimaG: 0 },
    { kode: "SRH-4", status: "DIANGKUT", diterimaG: 0 },
    { kode: "SRH-5", status: "MENGGANTUNG", diterimaG: 0 },
  ] as const;

  it("hanya DITERIMA & DITERIMA_SEBAGIAN: rit 2, 32.345 g; lainnya dilaporkan tidak termasuk", () => {
    const h = hitungTagihanAngkut(serah, { tarifPerRitIdr: 150_000, tarifPerKgIdr: 500 });
    // 2 × 150.000 + ⌊32.345 × 500 / 1000⌋ = 300.000 + 16.172 = 316.172
    expect(h.ritTertutup).toBe(2);
    expect(h.kgDiterimaG).toBe(32_345);
    expect(h.totalIdr).toBe(316_172);
    expect(h.tidakTermasuk).toEqual([
      { kode: "SRH-2", status: "DITOLAK" },
      { kode: "SRH-4", status: "DIANGKUT" },
      { kode: "SRH-5", status: "MENGGANTUNG" },
    ]);
  });

  it("pembulatan SEKALI atas total gram; Σ subtotal = total (kumulatif)", () => {
    const h = hitungTagihanAngkut(serah, { tarifPerRitIdr: 150_000, tarifPerKgIdr: 500 });
    // Kumulatif: 20.000 g → 10.000; 32.345 g → 16.172; bagian kg SRH-3 = 6.172.
    expect(h.rincian).toEqual([
      { kodeSerah: "SRH-1", kgDiterimaG: 20_000, subtotalIdr: 160_000 },
      { kodeSerah: "SRH-3", kgDiterimaG: 12_345, subtotalIdr: 156_172 },
    ]);
    expect(h.rincian.reduce((a, b) => a + b.subtotalIdr, 0)).toBe(h.totalIdr);
    // Dua serah 1.001 g × 700/kg: dibulatkan per serah = 700 + 700 = 1.400; sekali = ⌊1.401,4⌋ = 1.401.
    const g = hitungTagihanAngkut(
      [
        { kode: "A", status: "DITERIMA", diterimaG: 1_001 },
        { kode: "B", status: "DITERIMA", diterimaG: 1_001 },
      ],
      { tarifPerRitIdr: 0, tarifPerKgIdr: 700 },
    );
    expect(g.totalIdr).toBe(1_401);
    expect(g.rincian.map((r) => r.subtotalIdr)).toEqual([700, 701]);
  });

  it("tarif kosong dihitung 0; hanya tarif rit / hanya tarif kg", () => {
    expect(hitungTagihanAngkut(serah, { tarifPerRitIdr: null, tarifPerKgIdr: null }).totalIdr).toBe(0);
    expect(hitungTagihanAngkut(serah, { tarifPerRitIdr: 100_000, tarifPerKgIdr: null }).totalIdr).toBe(200_000);
    expect(hitungTagihanAngkut(serah, { tarifPerRitIdr: null, tarifPerKgIdr: 1_000 }).totalIdr).toBe(32_345);
  });

  it("tanpa serah tertutup: nol rit, nol total", () => {
    const h = hitungTagihanAngkut([{ kode: "X", status: "DITOLAK", diterimaG: 0 }], { tarifPerRitIdr: 5, tarifPerKgIdr: 5 });
    expect(h).toMatchObject({ ritTertutup: 0, kgDiterimaG: 0, totalIdr: 0, rincian: [] });
    expect(h.tidakTermasuk).toHaveLength(1);
  });

  it("tidak bergantung urutan masukan; serah ganda & angka tak sah ditolak", () => {
    const a = hitungTagihanAngkut([...serah].reverse(), { tarifPerRitIdr: 150_000, tarifPerKgIdr: 500 });
    expect(a.totalIdr).toBe(316_172);
    expect(() => hitungTagihanAngkut([serah[0], serah[0]], { tarifPerRitIdr: 1, tarifPerKgIdr: 1 })).toThrow(RangeError);
    expect(() => hitungTagihanAngkut([{ kode: "Z", status: "DITERIMA", diterimaG: -1 }], { tarifPerRitIdr: 1, tarifPerKgIdr: 1 })).toThrow(RangeError);
    expect(() => hitungTagihanAngkut(serah, { tarifPerRitIdr: 1.5, tarifPerKgIdr: 1 })).toThrow(RangeError);
  });
});
