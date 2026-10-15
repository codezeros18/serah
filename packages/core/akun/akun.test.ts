import { describe, expect, it } from "vitest";
import { UMUR_TOKEN_MS, kedaluwarsaToken, normalisasiEmail, peranCocokJenis, persetujuanBerlaku, pilihKonteksAwal, statusToken } from "./index";

const t0 = new Date("2026-10-15T03:00:00.000Z");
const jam = (n: number) => new Date(t0.getTime() + n * 3_600_000);

describe("token sekali pakai", () => {
  it("umur: verifikasi 24 j, reset 1 j, undangan 7 hari", () => {
    expect(kedaluwarsaToken("VERIFIKASI_EMAIL", t0)).toEqual(jam(24));
    expect(kedaluwarsaToken("RESET_SANDI", t0)).toEqual(jam(1));
    expect(kedaluwarsaToken("UNDANGAN", t0)).toEqual(jam(168));
    expect(UMUR_TOKEN_MS.RESET_SANDI).toBe(3_600_000);
  });

  it("status: berlaku sampai tepat sebelum kedaluwarsa; dipakai menang", () => {
    expect(statusToken({ kedaluwarsaPada: jam(1), dipakaiPada: null }, jam(0.99))).toBe("BERLAKU");
    expect(statusToken({ kedaluwarsaPada: jam(1), dipakaiPada: null }, jam(1))).toBe("KEDALUWARSA");
    expect(statusToken({ kedaluwarsaPada: jam(1), dipakaiPada: t0 }, t0)).toBe("DIPAKAI");
  });
});

describe("akun", () => {
  it("email dinormalisasi huruf kecil tanpa spasi tepi", () => {
    expect(normalisasiEmail("  Petugas@Contoh.ID ")).toBe("petugas@contoh.id");
  });

  it("peran sesuai jenis organisasi (§G)", () => {
    expect(peranCocokJenis("KAWASAN", "PETUGAS")).toBe(true);
    expect(peranCocokJenis("KAWASAN", "PENGELOLA")).toBe(true);
    expect(peranCocokJenis("KAWASAN", "PENERIMA")).toBe(false);
    expect(peranCocokJenis("PENGANGKUT", "PENGANGKUT")).toBe(true);
    expect(peranCocokJenis("PENERIMA", "ADMIN")).toBe(false);
    expect(peranCocokJenis("INTERNAL", "ADMIN")).toBe(true);
  });

  it("persetujuan berlaku hanya bila catatan terakhir LAYANAN", () => {
    expect(persetujuanBerlaku([])).toBe(false);
    expect(persetujuanBerlaku([{ jenis: "LAYANAN", pada: t0 }])).toBe(true);
    expect(persetujuanBerlaku([{ jenis: "LAYANAN", pada: t0 }, { jenis: "TARIK", pada: jam(1) }])).toBe(false);
    expect(persetujuanBerlaku([{ jenis: "TARIK", pada: jam(1) }, { jenis: "LAYANAN", pada: jam(2) }])).toBe(true);
  });

  it("konteks awal = keanggotaan aktif tertua", () => {
    const k = [
      { organisasiId: "b", peran: "PETUGAS" as const, aktif: true, dibuatPada: jam(2) },
      { organisasiId: "a", peran: "PENGELOLA" as const, aktif: false, dibuatPada: jam(0) },
      { organisasiId: "c", peran: "PENGELOLA" as const, aktif: true, dibuatPada: jam(1) },
    ];
    expect(pilihKonteksAwal(k)?.organisasiId).toBe("c");
    expect(pilihKonteksAwal([])).toBeNull();
  });
});
