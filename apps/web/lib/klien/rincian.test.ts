import { describe, expect, it } from "vitest";
import { beratAtauNol, ringkasRincian, type IsianRincian } from "./rincian";

const r = (aliran: IsianRincian["aliran"], diterima: string, ditolak: string, alasan: IsianRincian["alasan"] = "", keterangan = ""): IsianRincian => ({
  aliran,
  diterima,
  ditolak,
  alasan,
  keterangan,
});

describe("beratAtauNol", () => {
  it("kosong dan nol = 0; koma desimal; tidak sah = null", () => {
    expect(beratAtauNol("")).toBe(0);
    expect(beratAtauNol("0")).toBe(0);
    expect(beratAtauNol("0,0")).toBe(0);
    expect(beratAtauNol("12,5")).toBe(12_500);
    expect(beratAtauNol("abc")).toBeNull();
    expect(beratAtauNol("1,2345")).toBeNull();
  });
});

describe("ringkasRincian", () => {
  it("terima semua: Σ = tiket, tanpa penolakan", () => {
    const h = ringkasRincian([r("KUNING", "30", "")], 30_000);
    expect(h).toMatchObject({ sah: true, sama: true, aksi: "TERIMA", alasanLengkap: true, diterimaG: 30_000, ditolakG: 0 });
  });
  it("sebagian: butuh alasan untuk aliran yang ditolak", () => {
    const tanpa = ringkasRincian([r("KUNING", "20", "10")], 30_000);
    expect(tanpa).toMatchObject({ sama: true, aksi: "SEBAGIAN", alasanLengkap: false });
    expect(ringkasRincian([r("KUNING", "20", "10", "BASAH_KOTOR")], 30_000).alasanLengkap).toBe(true);
  });
  it("LAINNYA wajib keterangan", () => {
    expect(ringkasRincian([r("KUNING", "0", "30", "LAINNYA")], 30_000).alasanLengkap).toBe(false);
    expect(ringkasRincian([r("KUNING", "0", "30", "LAINNYA", "kotor")], 30_000)).toMatchObject({ alasanLengkap: true, aksi: "TOLAK" });
  });
  it("jumlah tidak sama dengan tiket → sama=false", () => {
    expect(ringkasRincian([r("KUNING", "20", "5", "BASAH_KOTOR")], 30_000).sama).toBe(false);
    expect(ringkasRincian([r("KUNING", "20", "10", "BASAH_KOTOR")], null).sama).toBe(false);
  });
  it("angka tidak sah → sah=false dan tanpa aksi", () => {
    expect(ringkasRincian([r("KUNING", "x", "")], 30_000)).toMatchObject({ sah: false, aksi: null, sama: false });
  });
  it("beberapa aliran dijumlahkan sebagai integer (tanpa pembulatan float)", () => {
    const h = ringkasRincian([r("KUNING", "0,1", ""), r("HIJAU", "0,2", "")], 300);
    expect(h).toMatchObject({ jumlahG: 300, sama: true });
  });
});
