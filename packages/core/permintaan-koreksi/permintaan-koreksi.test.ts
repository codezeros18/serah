import { describe, expect, it } from "vitest";
import {
  bolehAjukan,
  bolehPutus,
  pemutusUntuk,
  periksaPenerapan,
  statusPermintaan,
  TARGET_DARI_SERAH,
  type RelasiPermintaan,
} from "./index";

const rel: RelasiPermintaan = { orgKawasanId: "kws", orgPenerimaId: "pen" };

describe("S16-1 siapa memutus apa", () => {
  it("WADAH diputus PENGELOLA; TIKET dan RINCIAN diputus PENERIMA", () => {
    expect(pemutusUntuk("WADAH")).toBe("PENGELOLA");
    expect(pemutusUntuk("TIKET")).toBe("PENERIMA");
    expect(pemutusUntuk("RINCIAN_DITERIMA")).toBe("PENERIMA");
    expect(pemutusUntuk("RINCIAN_DITOLAK")).toBe("PENERIMA");
  });
});

describe("S16-1 matriks mengajukan", () => {
  const sah = (peran: Parameters<typeof bolehAjukan>[0], target: Parameters<typeof bolehAjukan>[1], org: string) =>
    bolehAjukan(peran, target, { orgAktifId: org, ...rel });

  it("PETUGAS & PENGELOLA kawasan: semua target di kawasannya", () => {
    for (const p of ["PETUGAS", "PENGELOLA"] as const) {
      for (const t of ["WADAH", "TIKET", "RINCIAN_DITERIMA", "RINCIAN_DITOLAK"] as const) expect(sah(p, t, "kws")).toEqual({ ok: true });
    }
  });
  it("PENERIMA pemilik serah: hanya TIKET/RINCIAN, bukan WADAH", () => {
    expect(sah("PENERIMA", "TIKET", "pen")).toEqual({ ok: true });
    expect(sah("PENERIMA", "RINCIAN_DITOLAK", "pen")).toEqual({ ok: true });
    expect(sah("PENERIMA", "WADAH", "pen")).toEqual({ ok: false, sebab: "PERAN_TIDAK_BOLEH" });
  });
  it("PENGANGKUT dan ADMIN tidak boleh", () => {
    expect(sah("PENGANGKUT", "TIKET", "peng")).toEqual({ ok: false, sebab: "PERAN_TIDAK_BOLEH" });
    expect(sah("ADMIN", "WADAH", "int")).toEqual({ ok: false, sebab: "PERAN_TIDAK_BOLEH" });
  });
  it("organisasi lain (bukan pihak) ditolak", () => {
    expect(sah("PENGELOLA", "WADAH", "kawasan-lain")).toEqual({ ok: false, sebab: "BUKAN_PIHAK" });
    expect(sah("PENERIMA", "TIKET", "penerima-lain")).toEqual({ ok: false, sebab: "BUKAN_PIHAK" });
    // Penerima tidak boleh mengajukan atas nama kawasan (org kawasan ≠ org penerima).
    expect(sah("PENERIMA", "TIKET", "kws")).toEqual({ ok: false, sebab: "BUKAN_PIHAK" });
  });
});

describe("S16-1 matriks memutus", () => {
  const putus = (peran: Parameters<typeof bolehPutus>[0], target: Parameters<typeof bolehPutus>[1], org: string) =>
    bolehPutus(peran, target, { orgAktifId: org, ...rel });

  it("WADAH hanya PENGELOLA kawasannya", () => {
    expect(putus("PENGELOLA", "WADAH", "kws")).toEqual({ ok: true });
    expect(putus("PENERIMA", "WADAH", "pen")).toEqual({ ok: false, sebab: "PERAN_TIDAK_BOLEH" });
    expect(putus("PETUGAS", "WADAH", "kws")).toEqual({ ok: false, sebab: "PERAN_TIDAK_BOLEH" });
    expect(putus("PENGELOLA", "WADAH", "kawasan-lain")).toEqual({ ok: false, sebab: "BUKAN_PIHAK" });
  });
  it("TIKET/RINCIAN hanya PENERIMA pemilik serah, bukan PENGELOLA", () => {
    for (const t of ["TIKET", "RINCIAN_DITERIMA", "RINCIAN_DITOLAK"] as const) {
      expect(putus("PENERIMA", t, "pen")).toEqual({ ok: true });
      expect(putus("PENGELOLA", t, "kws")).toEqual({ ok: false, sebab: "PERAN_TIDAK_BOLEH" });
      expect(putus("PENERIMA", t, "penerima-lain")).toEqual({ ok: false, sebab: "BUKAN_PIHAK" });
    }
  });
  it("permintaan tanpa penerima tidak dapat diputus oleh penerima", () => {
    expect(bolehPutus("PENERIMA", "TIKET", { orgAktifId: "pen", orgKawasanId: "kws", orgPenerimaId: null })).toEqual({
      ok: false,
      sebab: "BUKAN_PIHAK",
    });
  });
});

describe("S16-1 status turunan & target serah", () => {
  it("tanpa putusan = DIAJUKAN; ada putusan = keputusannya", () => {
    expect(statusPermintaan(null)).toBe("DIAJUKAN");
    expect(statusPermintaan("DISETUJUI")).toBe("DISETUJUI");
    expect(statusPermintaan("DITOLAK")).toBe("DITOLAK");
  });
  it("target yang berada di serah tertutup", () => {
    expect(TARGET_DARI_SERAH).toEqual(["TIKET", "RINCIAN_DITERIMA", "RINCIAN_DITOLAK"]);
  });
});

describe("S16-1 periksaPenerapan (nilai usulan)", () => {
  const rincianSebagian = [
    { id: "r1", aliran: "KUNING" as const, diterimaG: 20_000, ditolakG: 10_000, alasan: "BASAH_KOTOR" as const },
  ];
  it("WADAH: nilai berbeda dari nilai final berlaku; sama ditolak; negatif/non-integer ditolak", () => {
    expect(periksaPenerapan({ jenis: "WADAH", nilaiFinalG: 5_000, nilaiUsulanG: 4_000 })).toEqual({ ok: true, sigmaKonsisten: null });
    expect(periksaPenerapan({ jenis: "WADAH", nilaiFinalG: 5_000, nilaiUsulanG: 5_000 })).toEqual({ ok: false, sebab: "NILAI_SAMA" });
    expect(periksaPenerapan({ jenis: "WADAH", nilaiFinalG: 5_000, nilaiUsulanG: -1 })).toEqual({ ok: false, sebab: "NILAI_TIDAK_SAH" });
    expect(periksaPenerapan({ jenis: "WADAH", nilaiFinalG: 5_000, nilaiUsulanG: 1.5 })).toEqual({ ok: false, sebab: "NILAI_TIDAK_SAH" });
  });
  it("TIKET/RINCIAN: Σ tidak memblokir tetapi ditandai; mode ketat menolak", () => {
    const tutup = { status: "DITERIMA_SEBAGIAN" as const, tiketG: 30_000, rincian: rincianSebagian };
    expect(periksaPenerapan({ jenis: "TIKET", nilaiFinalG: 30_000, nilaiUsulanG: 35_000, tutup })).toEqual({ ok: true, sigmaKonsisten: false });
    expect(periksaPenerapan({ jenis: "RINCIAN_DITERIMA", targetId: "r1", nilaiFinalG: 20_000, nilaiUsulanG: 25_000, tutup })).toEqual({ ok: true, sigmaKonsisten: false });
    expect(periksaPenerapan({ jenis: "TIKET", nilaiFinalG: 30_000, nilaiUsulanG: 35_000, tutup, ketat: true })).toEqual({ ok: false, sebab: "SIGMA_TIDAK_KONSISTEN" });
  });
  it("alasan tolak wajib: rincian ditolak > 0 tanpa alasan baku ditolak di semua mode", () => {
    const tutup = { status: "DITERIMA" as const, tiketG: 20_000, rincian: [{ id: "r1", aliran: "KUNING" as const, diterimaG: 20_000, ditolakG: 0, alasan: null }] };
    expect(periksaPenerapan({ jenis: "RINCIAN_DITOLAK", targetId: "r1", nilaiFinalG: 0, nilaiUsulanG: 5_000, tutup })).toEqual({ ok: false, sebab: "ALASAN_TOLAK_KURANG" });
  });
  it("TIKET/RINCIAN tanpa data penutupan → TARGET_TIDAK_DIKENAL", () => {
    expect(periksaPenerapan({ jenis: "TIKET", nilaiFinalG: 1, nilaiUsulanG: 2 })).toEqual({ ok: false, sebab: "TARGET_TIDAK_DIKENAL" });
  });
});
