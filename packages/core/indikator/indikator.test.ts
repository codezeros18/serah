import { describe, expect, it } from "vitest";
import type { RincianNeraca, WadahNeraca } from "../neraca";
import { hitungIndikator, kgTerangkutSebelumHujanG, type PrioritasPrakiraan, type SerahDisetujui } from "./index";

// Indikator dampak F43 — angka dihitung dengan tangan.

const t = (jam: number, menit = 0, detik = 0, ms = 0) => new Date(Date.UTC(2026, 9, 15, jam, menit, detik, ms));

describe("kgTerangkutSebelumHujanG — disetujui SETELAH prioritas dan SEBELUM slot acuan (batas ketat)", () => {
  const prioritas: PrioritasPrakiraan[] = [
    { tpsId: "tps1", ditetapkanPada: t(6), slotUtc: t(12) },
    { tpsId: "tps1", ditetapkanPada: t(7), slotUtc: t(18) },
  ];
  const serah: SerahDisetujui[] = [
    { id: "a", tpsId: "tps1", disetujuiPada: t(9), beratG: 20_000 }, // di dalam kedua jendela → dihitung sekali
    { id: "b", tpsId: "tps1", disetujuiPada: t(5, 59, 59, 999), beratG: 1_111 }, // sebelum prioritas pertama (dan sebelum kedua)
    { id: "c", tpsId: "tps1", disetujuiPada: t(12), beratG: 2_222 }, // tepat di slot pertama; masih < 18.00 → jendela kedua
    { id: "d", tpsId: "tps2", disetujuiPada: t(9), beratG: 3_333 }, // TPS lain
    { id: "e", tpsId: "tps1", disetujuiPada: t(11, 59, 59, 999), beratG: 5_000 }, // 1 ms sebelum slot
    { id: "f", tpsId: "tps1", disetujuiPada: t(18), beratG: 4_444 }, // tepat di slot kedua → tidak
    { id: "g", tpsId: "tps1", disetujuiPada: t(6), beratG: 6_666 }, // tepat saat prioritas pertama; setelah?? tidak; < kedua? sebelum 07.00 → tidak
  ];

  it("a(20.000) + c(2.222, hanya jendela kedua) + e(5.000) = 27.222 g; serah ganda dihitung sekali", () => {
    expect(kgTerangkutSebelumHujanG(prioritas, serah)).toBe(27_222);
  });

  it("tepat di batas tidak dihitung: setelah = >, sebelum = <", () => {
    const p = [{ tpsId: "x", ditetapkanPada: t(6), slotUtc: t(12) }];
    const s = (jam: number, menit = 0, detik = 0, ms = 0): SerahDisetujui => ({ id: "s", tpsId: "x", disetujuiPada: t(jam, menit, detik, ms), beratG: 100 });
    expect(kgTerangkutSebelumHujanG(p, [s(6)])).toBe(0);
    expect(kgTerangkutSebelumHujanG(p, [s(6, 0, 0, 1)])).toBe(100);
    expect(kgTerangkutSebelumHujanG(p, [s(11, 59, 59, 999)])).toBe(100);
    expect(kgTerangkutSebelumHujanG(p, [s(12)])).toBe(0);
  });

  it("tanpa prioritas atau tanpa serah → 0; berat tak sah ditolak", () => {
    expect(kgTerangkutSebelumHujanG([], serah)).toBe(0);
    expect(kgTerangkutSebelumHujanG(prioritas, [])).toBe(0);
    expect(() => kgTerangkutSebelumHujanG(prioritas, [{ id: "x", tpsId: "tps1", disetujuiPada: t(9), beratG: 1.5 }])).toThrow(RangeError);
  });
});

describe("hitungIndikator", () => {
  const wadah = (id: string, aliran: WadahNeraca["aliran"], beratG: number | null): WadahNeraca => ({
    id, tpsId: "tps1", kawasanId: "kws1", aliran, beratG, jumlahWadah: beratG === null ? 2 : null, terjadiPada: t(1),
  });
  const rincian = (aliran: RincianNeraca["aliran"], diterimaG: number, ditolakG: number): RincianNeraca => ({
    serahId: "s", tpsId: "tps1", kawasanId: "kws1", aliran, diterimaG, ditolakG, ditutupPada: t(8),
  });

  it("angka tangan: kg per aliran, kuning 75% diterima, 50% serah tertutup, umur rata-rata 3 jam", () => {
    const h = hitungIndikator({
      wadah: [wadah("w1", "KUNING", 12_500), wadah("w2", "KUNING", 7_500), wadah("w3", "ABU", 30_000), wadah("w4", "HIJAU", null)],
      rincian: [rincian("KUNING", 15_000, 5_000), rincian("ABU", 30_000, 0)],
      statusSerahDibuat: ["DITERIMA_SEBAGIAN", "DITERIMA", "DRAF", "DIANGKUT"],
      wadahDiangkut: [
        { terjadiPada: t(1), disetujuiPada: t(3) }, // 120 menit
        { terjadiPada: t(1), disetujuiPada: t(6) }, // 300 menit → rata-rata 210 menit = 3 jam 30 menit → 3
      ],
      prioritas: [{ tpsId: "tps1", ditetapkanPada: t(6), slotUtc: t(12) }],
      serahDisetujui: [{ id: "x", tpsId: "tps1", disetujuiPada: t(9), beratG: 20_000 }],
    });
    expect(h).toEqual({
      kgPerAliran: {
        HIJAU: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
        KUNING: { dicatatG: 20_000, diterimaG: 15_000, ditolakG: 5_000 },
        MERAH: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
        ABU: { dicatatG: 30_000, diterimaG: 30_000, ditolakG: 0 },
      },
      kuning: { diterimaG: 15_000, ditolakG: 5_000, diterimaBp: 7_500 },
      serahDibuat: 4,
      serahTertutup: 2,
      serahTertutupBp: 5_000,
      umurWadahRataJam: 3,
      kgTerangkutSebelumHujanG: 20_000,
    });
  });

  it("serah DITOLAK dihitung tertutup; MENGGANTUNG belum", () => {
    const h = hitungIndikator({
      wadah: [], rincian: [], statusSerahDibuat: ["DITOLAK", "MENGGANTUNG", "MENUNGGU_SETUJU"], wadahDiangkut: [], prioritas: [], serahDisetujui: [],
    });
    expect([h.serahTertutup, h.serahTertutupBp]).toEqual([1, 3_333]);
  });

  it("belum ada data: nol dan null (tidak ada pembagian dengan nol)", () => {
    expect(hitungIndikator({ wadah: [], rincian: [], statusSerahDibuat: [], wadahDiangkut: [], prioritas: [], serahDisetujui: [] })).toEqual({
      kgPerAliran: {
        HIJAU: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
        KUNING: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
        MERAH: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
        ABU: { dicatatG: 0, diterimaG: 0, ditolakG: 0 },
      },
      kuning: { diterimaG: 0, ditolakG: 0, diterimaBp: null },
      serahDibuat: 0,
      serahTertutup: 0,
      serahTertutupBp: null,
      umurWadahRataJam: null,
      kgTerangkutSebelumHujanG: 0,
    });
  });

  it("umur rata-rata dibulatkan ke bawah per jam penuh: 59 menit → 0 jam; 119 menit → 1 jam", () => {
    const umur = (menit: number) =>
      hitungIndikator({ wadah: [], rincian: [], statusSerahDibuat: [], wadahDiangkut: [{ terjadiPada: t(1), disetujuiPada: t(1, menit) }], prioritas: [], serahDisetujui: [] }).umurWadahRataJam;
    expect([umur(59), umur(60), umur(119)]).toEqual([0, 1, 1]);
  });
});
