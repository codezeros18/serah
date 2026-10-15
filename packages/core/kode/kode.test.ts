import { describe, expect, it } from "vitest";
import { KodeKawasan, KodePermintaanKoreksi, KodeSerah, KodeTagihanAngkut, KodeTps, NomorTagihan } from "@serah/kontrak";
import { kodeKawasan, kodePermintaanKoreksi, kodeSerah, kodeTagihan, kodeTagihanAngkut, kodeTps } from "./index";

const kode = (k: string) => ({ ok: true, kode: k });
const FORMAT = { ok: false, galat: "FORMAT" };
const RENTANG = { ok: false, galat: "NOMOR_DI_LUAR_RENTANG" };

describe("kode terbaca (CLAUDE.md §5)", () => {
  it("kawasan KWS-<3–5 huruf>", () => {
    expect(kodeKawasan("PCS")).toEqual(kode("KWS-PCS"));
    expect(kodeKawasan(" pcs ")).toEqual(kode("KWS-PCS"));
    expect(kodeKawasan("ABCDE")).toEqual(kode("KWS-ABCDE"));
    expect(kodeKawasan("PC")).toEqual(FORMAT);
    expect(kodeKawasan("ABCDEF")).toEqual(FORMAT);
    expect(kodeKawasan("P1S")).toEqual(FORMAT);
  });

  it("TPS TPS-<KWS>-NN", () => {
    expect(kodeTps("KWS-PCS", 1)).toEqual(kode("TPS-PCS-01"));
    expect(kodeTps("KWS-PCS", 99)).toEqual(kode("TPS-PCS-99"));
    expect(kodeTps("KWS-PCS", 0)).toEqual(RENTANG);
    expect(kodeTps("KWS-PCS", 100)).toEqual(RENTANG);
    expect(kodeTps("KWS-X", 1)).toEqual(FORMAT);
  });

  it("serah SRH-YYYYMMDD-NNNN memakai tanggal WIB (lintas tengah malam)", () => {
    expect(kodeSerah(new Date("2026-10-15T16:59:59.999Z"), 1)).toEqual(kode("SRH-20261015-0001"));
    expect(kodeSerah(new Date("2026-10-15T17:00:00.000Z"), 1)).toEqual(kode("SRH-20261016-0001"));
    expect(kodeSerah(new Date("2026-10-14T23:30:00.000Z"), 42)).toEqual(kode("SRH-20261015-0042"));
    expect(kodeSerah(new Date("2026-10-15T03:00:00Z"), 9_999)).toEqual(kode("SRH-20261015-9999"));
    expect(kodeSerah(new Date("2026-10-15T03:00:00Z"), 10_000)).toEqual(RENTANG);
    expect(kodeSerah(new Date("2026-10-15T03:00:00Z"), 0)).toEqual(RENTANG);
    expect(kodeSerah(new Date("2026-10-15T03:00:00Z"), 1.5)).toEqual(RENTANG);
  });

  it("permintaan koreksi PKR-YYYYMMDD-NNN", () => {
    expect(kodePermintaanKoreksi(new Date("2026-10-15T17:00:00Z"), 7)).toEqual(kode("PKR-20261016-007"));
    expect(kodePermintaanKoreksi(new Date("2026-10-15T17:00:00Z"), 1_000)).toEqual(RENTANG);
  });

  it("tagihan TGH-YYYYMM-NNNN & tagihan angkut TGA-YYYYMM-NNNN", () => {
    expect(kodeTagihan("2026-10", 12)).toEqual(kode("TGH-202610-0012"));
    expect(kodeTagihanAngkut("2026-11", 1)).toEqual(kode("TGA-202611-0001"));
    expect(kodeTagihan("2026-13", 1)).toEqual(FORMAT);
    expect(kodeTagihanAngkut("202611", 1)).toEqual(FORMAT);
    expect(kodeTagihan("2026-10", 10_000)).toEqual(RENTANG);
  });

  it("semua keluaran lolos skema kontrak", () => {
    const t = new Date("2026-12-31T17:00:00Z");
    const ambil = (h: { ok: boolean; kode?: string }) => (h.ok ? h.kode : "");
    expect(KodeKawasan.safeParse(ambil(kodeKawasan("ABCDE"))).success).toBe(true);
    expect(KodeTps.safeParse(ambil(kodeTps("KWS-ABCDE", 7))).success).toBe(true);
    expect(KodeSerah.safeParse(ambil(kodeSerah(t, 1))).success).toBe(true);
    expect(ambil(kodeSerah(t, 1))).toBe("SRH-20270101-0001");
    expect(KodePermintaanKoreksi.safeParse(ambil(kodePermintaanKoreksi(t, 1))).success).toBe(true);
    expect(NomorTagihan.safeParse(ambil(kodeTagihan("2027-01", 1))).success).toBe(true);
    expect(KodeTagihanAngkut.safeParse(ambil(kodeTagihanAngkut("2027-01", 1))).success).toBe(true);
  });
});
