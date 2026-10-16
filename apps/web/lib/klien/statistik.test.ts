import { describe, expect, it } from "vitest";
import { deretHarian, hariDalamBulan, jumlahTotal, mutuPemilahan, perubahanPersen, periodeSebelum, persen } from "./statistik";

const t = (tps: number, diterima: number, ditolak: number) => ({ beratTpsG: tps, beratDiterimaG: diterima, beratDitolakG: ditolak });

describe("statistik dasbor", () => {
  it("menjumlahkan total", () => {
    expect(jumlahTotal([t(100, 60, 10), t(50, 30, 20)])).toEqual({ tps: 150, diterima: 90, ditolak: 30 });
  });

  it("persen aman untuk total 0", () => {
    expect(persen(5, 0)).toBe(0);
    expect(persen(1, 3)).toBe(33.3);
  });

  it("mutu pemilahan = diterima / (diterima + ditolak)", () => {
    expect(mutuPemilahan([t(100, 80, 20)])).toBe(80);
    expect(mutuPemilahan([t(0, 0, 0)])).toBeNull();
  });

  it("perubahan persen null bila pembanding 0", () => {
    expect(perubahanPersen(120, 100)).toBe(20);
    expect(perubahanPersen(80, 100)).toBe(-20);
    expect(perubahanPersen(10, 0)).toBeNull();
  });

  it("periode sebelum melewati pergantian tahun", () => {
    expect(periodeSebelum("2026-01")).toBe("2025-12");
    expect(periodeSebelum("2026-10")).toBe("2026-09");
  });

  it("hari dalam bulan", () => {
    expect(hariDalamBulan("2026-02")).toBe(28);
    expect(hariDalamBulan("2024-02")).toBe(29);
    expect(hariDalamBulan("2026-10")).toBe(31);
  });

  it("deret harian mengisi hari kosong dengan nol dan menjumlah per hari", () => {
    const d = deretHarian(
      [
        { tanggalWib: "2026-10-03", ...t(10, 6, 4) },
        { tanggalWib: "2026-10-03", ...t(5, 5, 0) },
        { tanggalWib: "2026-10-05", ...t(7, 7, 0) },
      ],
      "2026-10",
      5,
    );
    expect(d).toHaveLength(5);
    expect(d[2]).toMatchObject({ hari: 3, tpsG: 15, diterimaG: 11, ditolakG: 4 });
    expect(d[3]).toMatchObject({ hari: 4, tpsG: 0 });
    expect(d[4]).toMatchObject({ hari: 5, tpsG: 7 });
  });
});
