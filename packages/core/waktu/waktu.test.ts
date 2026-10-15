import { describe, expect, it } from "vitest";
import {
  akhirPeriodeWib,
  awalHariWib,
  awalPeriodeWib,
  jamMenitWib,
  jamWib,
  periodeSebelumnya,
  periodeWib,
  selisihJam,
  selisihMenit,
  tambahJam,
  tanggalWib,
  tanggalWibKompak,
} from "./index";

const t = (iso: string) => new Date(iso);

describe("waktu WIB — lintas tengah malam UTC & WIB", () => {
  it("tanggal WIB berganti pukul 17.00 UTC", () => {
    expect(tanggalWib(t("2026-10-15T16:59:59.999Z"))).toBe("2026-10-15");
    expect(tanggalWib(t("2026-10-15T17:00:00.000Z"))).toBe("2026-10-16");
  });

  it("tengah malam UTC tidak mengganti tanggal WIB", () => {
    expect(tanggalWib(t("2026-10-15T23:59:59.999Z"))).toBe("2026-10-16");
    expect(tanggalWib(t("2026-10-16T00:00:00.000Z"))).toBe("2026-10-16");
    expect(tanggalWib(t("2026-10-14T23:30:00.000Z"))).toBe("2026-10-15"); // tanggal UTC 14, WIB 15
  });

  it("jam WIB", () => {
    expect(jamWib(t("2026-10-15T13:00:00Z"))).toBe(20);
    expect(jamWib(t("2026-10-15T23:30:00Z"))).toBe(6);
    expect(jamWib(t("2026-10-15T16:59:00Z"))).toBe(23);
    expect(jamWib(t("2026-10-15T17:00:00Z"))).toBe(0);
    expect(jamMenitWib(t("2026-10-15T13:05:00Z"))).toBe("20.05");
    expect(jamMenitWib(t("2026-10-15T17:00:00Z"))).toBe("00.00");
  });

  it("periode WIB lintas bulan & tahun", () => {
    expect(periodeWib(t("2026-10-31T16:59:59.999Z"))).toBe("2026-10");
    expect(periodeWib(t("2026-10-31T17:00:00Z"))).toBe("2026-11");
    expect(periodeWib(t("2026-12-31T17:00:00Z"))).toBe("2027-01");
    expect(tanggalWibKompak(t("2026-12-31T17:00:00Z"))).toBe("20270101");
    expect(tanggalWib(t("2028-02-28T17:00:00Z"))).toBe("2028-02-29");
  });

  it("awal hari & periode WIB dalam UTC", () => {
    expect(awalHariWib("2026-10-16").toISOString()).toBe("2026-10-15T17:00:00.000Z");
    expect(awalPeriodeWib("2026-11").toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(akhirPeriodeWib("2026-12").toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(akhirPeriodeWib("2026-11").getTime()).toBe(awalPeriodeWib("2026-12").getTime());
    expect(periodeSebelumnya("2027-01")).toBe("2026-12");
    expect(periodeSebelumnya("2026-10")).toBe("2026-09");
  });

  it("format salah ditolak", () => {
    expect(() => awalHariWib("2026-13-01")).toThrow(RangeError);
    expect(() => awalPeriodeWib("2026-1")).toThrow(RangeError);
    expect(() => tanggalWib(new Date(Number.NaN))).toThrow(RangeError);
  });

  it("selisih jam & menit integer (jam penuh)", () => {
    const a = t("2026-10-15T03:00:00Z");
    expect(selisihJam(a, t("2026-10-18T02:59:00Z"))).toBe(71); // 71 j 59 m
    expect(selisihJam(a, t("2026-10-18T03:01:00Z"))).toBe(72); // 72 j 1 m
    expect(selisihJam(a, t("2026-10-15T03:30:00Z"))).toBe(0);
    expect(selisihJam(t("2026-10-15T04:30:00Z"), a)).toBe(-1);
    expect(selisihMenit(a, t("2026-10-15T04:30:59Z"))).toBe(90);
    expect(tambahJam(a, 12).toISOString()).toBe("2026-10-15T15:00:00.000Z");
    expect(Number.isInteger(selisihJam(a, t("2026-10-15T05:17:23.456Z")))).toBe(true);
  });
});
