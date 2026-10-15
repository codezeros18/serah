import { describe, expect, it } from "vitest";
import { KodeKawasan } from "@serah/kontrak";
import { hurufKodeKawasan, kodeKawasan } from "./index";

describe("hurufKodeKawasan", () => {
  it("huruf awal tiap kata", () => {
    expect(hurufKodeKawasan("Pasar Contoh Sejahtera")).toBe("PCS");
    expect(hurufKodeKawasan("Food Court Mal Kelapa Gading Indah Raya")).toBe("FCMKG");
  });

  it("nama pendek dilengkapi dari huruf berikutnya; selalu 3–5 huruf kapital", () => {
    expect(hurufKodeKawasan("Kemayoran")).toBe("KEM");
    expect(hurufKodeKawasan("Al")).toBe("ALX");
    expect(hurufKodeKawasan("12 34")).toBe("XXX");
    for (const n of ["Pasar Ikan", "Apartemen Éclair Residence", "  Gedung   X  ", "A", "88"]) {
      expect(hurufKodeKawasan(n), n).toMatch(/^[A-Z]{3,5}$/);
    }
  });

  it("diakritik dibuang", () => {
    expect(hurufKodeKawasan("Éclair Résidence Plaza")).toBe("ERP");
  });

  it("percobaan berikutnya selalu berbeda, tetap sah, dan deterministik", () => {
    const dilihat = new Set<string>();
    for (let p = 0; p < 80; p++) {
      const h = hurufKodeKawasan("Pasar Contoh Sejahtera", p);
      expect(h).toMatch(/^[A-Z]{3,5}$/);
      expect(hurufKodeKawasan("Pasar Contoh Sejahtera", p)).toBe(h);
      expect(dilihat.has(h), `${p}:${h}`).toBe(false);
      dilihat.add(h);
    }
  });

  it("hasilnya selalu lolos kodeKawasan & skema kontrak", () => {
    for (const n of ["Pasar Contoh Sejahtera", "Mal 1", "Apartemen Mediterania Palace Kemayoran"]) {
      for (const p of [0, 1, 27, 60]) {
        const k = kodeKawasan(hurufKodeKawasan(n, p));
        expect(k.ok).toBe(true);
        if (k.ok) expect(KodeKawasan.safeParse(k.kode).success).toBe(true);
      }
    }
  });
});
