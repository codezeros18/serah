import { describe, expect, it } from "vitest";
import { evaluasiMenggantung, KONFIGURASI_ATURAN, konfigurasiPada, pilihVersi, validasiAmbang, type VersiAturan } from "./index";

// S21-3 — aturan berversi: versi dipilih menurut tanggal KEJADIAN; versi lama tidak berubah.

const v = (kode: VersiAturan["kode"], versi: number, berlakuDari: string, ambang: Record<string, unknown>, yurisdiksi: VersiAturan["yurisdiksi"] = "DKI"): VersiAturan => ({
  kode,
  yurisdiksi,
  versi,
  berlakuDari,
  ambang,
});

const DAFTAR: VersiAturan[] = [
  v("R07", 1, "2026-10-14T00:00:00.000Z", { R07_JAM: KONFIGURASI_ATURAN.R07_JAM }),
  v("R07", 2, "2026-11-01T00:00:00.000Z", { R07_JAM: 36 }),
  v("R07", 3, "2026-12-01T00:00:00.000Z", { R07_JAM: 48 }),
  v("R07", 9, "2026-11-01T00:00:00.000Z", { R07_JAM: 100 }, "NASIONAL"),
];

describe("pilihVersi", () => {
  it("berlaku_dari ≤ kejadian; yang terbaru di antaranya", () => {
    expect(pilihVersi(DAFTAR, "R07", "DKI", "2026-10-13T23:59:59.999Z")).toBeNull();
    expect(pilihVersi(DAFTAR, "R07", "DKI", "2026-10-14T00:00:00.000Z")?.versi).toBe(1);
    expect(pilihVersi(DAFTAR, "R07", "DKI", "2026-10-31T23:59:59.999Z")?.versi).toBe(1);
    expect(pilihVersi(DAFTAR, "R07", "DKI", "2026-11-01T00:00:00.000Z")?.versi).toBe(2);
    expect(pilihVersi(DAFTAR, "R07", "DKI", "2027-01-01T00:00:00.000Z")?.versi).toBe(3);
  });
  it("yurisdiksi dan kode tidak tertukar", () => {
    expect(pilihVersi(DAFTAR, "R07", "NASIONAL", "2027-01-01T00:00:00.000Z")?.versi).toBe(9);
    expect(pilihVersi(DAFTAR, "R08", "DKI", "2027-01-01T00:00:00.000Z")).toBeNull();
  });
  it("tidak bergantung urutan larik; berlaku_dari sama → nomor versi tertinggi", () => {
    const campur = [DAFTAR[2]!, v("R07", 5, "2026-11-01T00:00:00.000Z", { R07_JAM: 40 }), DAFTAR[1]!, DAFTAR[0]!];
    expect(pilihVersi(campur, "R07", "DKI", "2026-11-15T00:00:00.000Z")?.versi).toBe(5);
  });
});

describe("konfigurasiPada & evaluator", () => {
  it("kejadian sebelum versi baru memakai ambang lama; sesudahnya memakai ambang baru", () => {
    const lama = konfigurasiPada(DAFTAR, "DKI", "2026-10-20T00:00:00.000Z");
    const baru = konfigurasiPada(DAFTAR, "DKI", "2026-11-20T00:00:00.000Z");
    expect(lama.R07_JAM).toBe(KONFIGURASI_ATURAN.R07_JAM);
    expect(baru.R07_JAM).toBe(36);
    expect(baru.R05_JAM).toBe(KONFIGURASI_ATURAN.R05_JAM); // aturan tanpa versi: bawaan
  });

  it("ambang yang rusak diabaikan (bawaan dipakai)", () => {
    const rusak = [v("R07", 1, "2026-10-14T00:00:00.000Z", { R07_JAM: "36" })];
    expect(konfigurasiPada(rusak, "DKI", "2026-11-01T00:00:00.000Z").R07_JAM).toBe(KONFIGURASI_ATURAN.R07_JAM);
  });

  it("evaluator R-07 mengikuti konfigurasi: tidak menggantung di ambang baru, menggantung di ambang lama", () => {
    const disetujuiPada = new Date("2026-11-10T00:00:00.000Z");
    const sekarang = new Date(disetujuiPada.getTime() + 30 * 3_600_000);
    const m = { yurisdiksi: "DKI" as const, sekarang, kodeSerah: "SRH-UJI-0001", status: "DIANGKUT" as const, disetujuiPada };
    // Kejadian (persetujuan) 10 Nov: versi 2 berlaku (36 jam) → 30 jam belum lewat.
    const baru = konfigurasiPada(DAFTAR, "DKI", disetujuiPada.toISOString());
    expect(evaluasiMenggantung(m, baru)).toHaveLength(0);
    // Kejadian Okt: versi 1 (bawaan) → 30 jam melewati ambang.
    const lama = konfigurasiPada(DAFTAR, "DKI", "2026-10-20T00:00:00.000Z");
    expect(evaluasiMenggantung(m, lama)).toHaveLength(1);
  });
});

describe("validasiAmbang", () => {
  it("kunci persis milik aturan, bilangan bulat dalam rentang", () => {
    expect(validasiAmbang("R07", { R07_JAM: 30 })).toEqual({ ok: true });
    expect(validasiAmbang("R07", {})).toEqual({ ok: false, kunci: "R07_JAM", sebab: "kunci_kurang" });
    expect(validasiAmbang("R07", { R07_JAM: 30, R05_JAM: 1 })).toEqual({ ok: false, kunci: "R05_JAM", sebab: "kunci_tidak_dikenal" });
    expect(validasiAmbang("R07", { R07_JAM: 0 })).toEqual({ ok: false, kunci: "R07_JAM", sebab: "di_luar_rentang" });
    expect(validasiAmbang("R09", { R09_JAM_WIB: 24 })).toEqual({ ok: false, kunci: "R09_JAM_WIB", sebab: "di_luar_rentang" });
    expect(validasiAmbang("R08", { R08_BP: 1.5 })).toEqual({ ok: false, kunci: "R08_BP", sebab: "bukan_bilangan_bulat" });
  });
  it("aturan tanpa ambang hanya menerima objek kosong", () => {
    expect(validasiAmbang("R01", {})).toEqual({ ok: true });
    expect(validasiAmbang("R11", { R07_JAM: 3 })).toMatchObject({ ok: false, sebab: "kunci_tidak_dikenal" });
  });
});
