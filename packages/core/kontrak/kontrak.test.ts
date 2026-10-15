import { describe, expect, it } from "vitest";
import { akhiriKontrak, bolehUbahKontrak, rentangSah, terapkanKonfirmasi } from "./index";

const t0 = new Date("2026-10-15T03:00:00.000Z");
const t1 = new Date("2026-10-15T05:00:00.000Z");
const dasar = { berlakuDari: "2026-10-01", berlakuSampai: "2027-09-30" };

describe("rentang berlaku", () => {
  it("sampai ≥ dari dan format YYYY-MM-DD", () => {
    expect(rentangSah("2026-10-01", "2026-10-01")).toBe(true);
    expect(rentangSah("2026-10-01", "2026-09-30")).toBe(false);
    expect(rentangSah("2026-10-1", "2026-10-31")).toBe(false);
  });
});

describe("bolehUbahKontrak", () => {
  it("AKTIF: pihak terkunci", () => {
    expect(bolehUbahKontrak({ status: "AKTIF", ...dasar }, { pengangkutId: "x" })).toEqual({ ok: false, sebab: "PIHAK_TERKUNCI" });
    expect(bolehUbahKontrak({ status: "AKTIF", ...dasar }, { penerimaId: "x" })).toEqual({ ok: false, sebab: "PIHAK_TERKUNCI" });
  });
  it("AKTIF: aliran terkunci", () => {
    expect(bolehUbahKontrak({ status: "AKTIF", ...dasar }, { aliran: ["HIJAU"] })).toEqual({ ok: false, sebab: "ALIRAN_TERKUNCI" });
  });
  it("AKTIF: tarif & rentang boleh tetapi teraudit", () => {
    expect(bolehUbahKontrak({ status: "AKTIF", ...dasar }, { tarifPerKgIdr: 500, berlakuSampai: "2028-01-01" })).toEqual({
      ok: true,
      perluKonfirmasiUlang: false,
      teraudit: true,
    });
  });
  it("USULAN: semua boleh; konfirmasi diulang", () => {
    expect(bolehUbahKontrak({ status: "USULAN", ...dasar }, { penerimaId: "y", aliran: ["ABU"] })).toEqual({
      ok: true,
      perluKonfirmasiUlang: true,
      teraudit: false,
    });
  });
  it("BERAKHIR & DIBATALKAN: tidak ada yang boleh", () => {
    expect(bolehUbahKontrak({ status: "BERAKHIR", ...dasar }, { tarifPerRitIdr: 1 })).toEqual({ ok: false, sebab: "STATUS_TERTUTUP" });
    expect(bolehUbahKontrak({ status: "DIBATALKAN", ...dasar }, {})).toEqual({ ok: false, sebab: "STATUS_TERTUTUP" });
  });
  it("menolak rentang terbalik dan tarif negatif/pecahan", () => {
    expect(bolehUbahKontrak({ status: "USULAN", ...dasar }, { berlakuSampai: "2026-09-01" })).toEqual({ ok: false, sebab: "RENTANG_TIDAK_SAH" });
    expect(bolehUbahKontrak({ status: "USULAN", ...dasar }, { tarifPerRitIdr: -1 })).toEqual({ ok: false, sebab: "TARIF_TIDAK_SAH" });
    expect(bolehUbahKontrak({ status: "USULAN", ...dasar }, { tarifPerKgIdr: 1.5 })).toEqual({ ok: false, sebab: "TARIF_TIDAK_SAH" });
  });
});

describe("terapkanKonfirmasi", () => {
  const awal = { status: "USULAN" as const, dikonfirmasiPengangkutPada: null, dikonfirmasiPenerimaPada: null };
  it("satu pihak → tetap USULAN; dua pihak → AKTIF", () => {
    const a = terapkanKonfirmasi(awal, "PENGANGKUT", t0);
    expect(a).toMatchObject({ ok: true, status: "USULAN", dikonfirmasiPengangkutPada: t0, dikonfirmasiPenerimaPada: null, aktifBaru: false });
    if (!a.ok) return;
    const b = terapkanKonfirmasi(a, "PENERIMA", t1);
    expect(b).toMatchObject({ ok: true, status: "AKTIF", dikonfirmasiPengangkutPada: t0, dikonfirmasiPenerimaPada: t1, aktifBaru: true });
  });
  it("konfirmasi ulang pihak yang sama mempertahankan waktu pertama", () => {
    const r = terapkanKonfirmasi({ ...awal, dikonfirmasiPenerimaPada: t0 }, "PENERIMA", t1);
    expect(r).toMatchObject({ ok: true, dikonfirmasiPenerimaPada: t0, aktifBaru: false });
  });
  it("hanya USULAN yang dapat dikonfirmasi", () => {
    for (const status of ["AKTIF", "BERAKHIR", "DIBATALKAN"] as const) {
      expect(terapkanKonfirmasi({ ...awal, status }, "PENGANGKUT", t0)).toEqual({ ok: false, sebab: "BUKAN_USULAN" });
    }
  });
});

describe("akhiriKontrak", () => {
  it("AKTIF → BERAKHIR, USULAN → DIBATALKAN, selebihnya ditolak", () => {
    expect(akhiriKontrak("AKTIF")).toEqual({ ok: true, statusBaru: "BERAKHIR" });
    expect(akhiriKontrak("USULAN")).toEqual({ ok: true, statusBaru: "DIBATALKAN" });
    expect(akhiriKontrak("BERAKHIR")).toEqual({ ok: false, sebab: "SUDAH_SELESAI" });
    expect(akhiriKontrak("DIBATALKAN")).toEqual({ ok: false, sebab: "SUDAH_SELESAI" });
  });
});
