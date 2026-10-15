import { describe, expect, it } from "vitest";
import { ditagihBulanan, jatuhTempo, paketEfektif, setelahLunas, tanggalSatuWib, tinjauWaktu, totalTagihan } from "./index";

// S19-2 — mesin langganan: setiap transisi & tanggal (WIB).
const t = (iso: string) => new Date(iso);
const ujiCoba = { status: "UJI_COBA" as const, ujiCobaSelesai: t("2026-10-28T17:00:00.000Z"), hargaDibekukanPerTpsIdr: null };

describe("jatuh tempo", () => {
  it("terbit + 14 hari, tanggal WIB", () => {
    expect(jatuhTempo(t("2026-10-31T17:05:00.000Z"))).toBe("2026-11-15"); // 00.05 WIB 1 Nov → 15 Nov
    expect(jatuhTempo(t("2026-11-01T12:00:00.000Z"))).toBe("2026-11-15");
  });
});

describe("tinjauWaktu", () => {
  it("UJI_COBA: tetap sampai tepat tengah malam WIB hari ke-14, lalu BERAKHIR", () => {
    expect(tinjauWaktu(ujiCoba, [], t("2026-10-28T16:59:59.999Z"))).toBeNull();
    expect(tinjauWaktu(ujiCoba, [], t("2026-10-28T17:00:00.000Z"))).toEqual({ dari: "UJI_COBA", ke: "BERAKHIR", sebab: "UJI_COBA_BERAKHIR" });
  });

  it("AKTIF: tagihan TERBIT lewat jatuh tempo (setelah akhir hari WIB) → MENUNGGAK", () => {
    const l = { status: "AKTIF" as const, ujiCobaSelesai: null, hargaDibekukanPerTpsIdr: 350_000 };
    const tagihan = [{ status: "TERBIT" as const, jatuhTempo: "2026-11-15" }];
    expect(tinjauWaktu(l, tagihan, t("2026-11-15T16:59:59.000Z"))).toBeNull(); // 23.59 WIB 15 Nov
    expect(tinjauWaktu(l, tagihan, t("2026-11-15T17:00:00.000Z"))).toEqual({ dari: "AKTIF", ke: "MENUNGGAK", sebab: "LEWAT_JATUH_TEMPO" });
  });

  it("AKTIF: tagihan LUNAS atau MENUNGGU_KONFIRMASI tidak menyebabkan tunggakan", () => {
    const l = { status: "AKTIF" as const, ujiCobaSelesai: null, hargaDibekukanPerTpsIdr: 1 };
    for (const status of ["LUNAS", "MENUNGGU_KONFIRMASI", "DIBATALKAN"] as const) {
      expect(tinjauWaktu(l, [{ status, jatuhTempo: "2026-01-01" }], t("2026-11-30T00:00:00Z"))).toBeNull();
    }
  });

  it("MENUNGGAK: + 14 hari setelah jatuh tempo tagihan tertua → BERAKHIR", () => {
    const l = { status: "MENUNGGAK" as const, ujiCobaSelesai: null, hargaDibekukanPerTpsIdr: 1 };
    const tagihan = [
      { status: "TERBIT" as const, jatuhTempo: "2026-12-15" },
      { status: "KEDALUWARSA" as const, jatuhTempo: "2026-11-15" },
    ];
    expect(tinjauWaktu(l, tagihan, t("2026-11-29T16:59:59.000Z"))).toBeNull();
    expect(tinjauWaktu(l, tagihan, t("2026-11-29T17:00:00.000Z"))).toEqual({ dari: "MENUNGGAK", ke: "BERAKHIR", sebab: "TENGGANG_HABIS" });
  });

  it("BERAKHIR tidak beralih karena waktu", () => {
    expect(tinjauWaktu({ status: "BERAKHIR", ujiCobaSelesai: null, hargaDibekukanPerTpsIdr: null }, [{ status: "TERBIT", jatuhTempo: "2020-01-01" }], t("2026-11-30T00:00:00Z"))).toBeNull();
  });
});

describe("setelahLunas", () => {
  it("dari UJI_COBA/MENUNGGAK/BERAKHIR → AKTIF; periode berjalan = bulan WIB tanggal lunas", () => {
    for (const status of ["UJI_COBA", "MENUNGGAK", "BERAKHIR"] as const) {
      expect(setelahLunas({ status, ujiCobaSelesai: null, hargaDibekukanPerTpsIdr: null }, 350_000, t("2026-10-31T17:30:00.000Z"))).toEqual({
        status: "AKTIF",
        hargaDibekukanPerTpsIdr: 350_000,
        periodeBerjalan: "2026-11",
        dari: status,
      });
    }
  });

  it("harga dibekukan saat pertama AKTIF; pembayaran berikut dengan harga paket baru tidak mengubahnya", () => {
    const r = setelahLunas({ status: "MENUNGGAK", ujiCobaSelesai: null, hargaDibekukanPerTpsIdr: 350_000 }, 500_000, t("2027-02-03T03:00:00Z"));
    expect(r.hargaDibekukanPerTpsIdr).toBe(350_000);
  });
});

describe("paket efektif", () => {
  it("uji coba berjalan → paket langganan; lewat → dasar walau cron belum jalan", () => {
    expect(paketEfektif(ujiCoba, t("2026-10-20T00:00:00Z"))).toBe("LANGGANAN");
    expect(paketEfektif(ujiCoba, t("2026-10-28T17:00:00.000Z"))).toBe("DASAR");
  });
  it("AKTIF & MENUNGGAK → paket langganan; BERAKHIR → dasar", () => {
    expect(paketEfektif({ status: "AKTIF", ujiCobaSelesai: null }, t("2026-10-20T00:00:00Z"))).toBe("LANGGANAN");
    expect(paketEfektif({ status: "MENUNGGAK", ujiCobaSelesai: null }, t("2026-10-20T00:00:00Z"))).toBe("LANGGANAN");
    expect(paketEfektif({ status: "BERAKHIR", ujiCobaSelesai: null }, t("2026-10-20T00:00:00Z"))).toBe("DASAR");
  });
});

describe("tagihan bulanan", () => {
  it("terbit tanggal 1 WIB (bukan tanggal 1 UTC)", () => {
    expect(tanggalSatuWib(t("2026-10-31T17:05:00.000Z"))).toBe(true); // 00.05 WIB 1 Nov
    expect(tanggalSatuWib(t("2026-11-01T17:05:00.000Z"))).toBe(false); // 00.05 WIB 2 Nov
  });
  it("UJI_COBA tidak ditagih; AKTIF, MENUNGGAK, BERAKHIR ditagih", () => {
    expect(ditagihBulanan("UJI_COBA")).toBe(false);
    expect(["AKTIF", "MENUNGGAK", "BERAKHIR"].every((s) => ditagihBulanan(s as "AKTIF"))).toBe(true);
  });
  it("total = jumlah TPS × harga, bilangan bulat; tanpa prorata", () => {
    expect(totalTagihan(3, 350_000)).toBe(1_050_000);
    expect(totalTagihan(0, 350_000)).toBe(0);
    expect(() => totalTagihan(1.5, 350_000)).toThrow(RangeError);
    expect(() => totalTagihan(-1, 350_000)).toThrow(RangeError);
  });
});
