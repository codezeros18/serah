import { DAFTAR_ATURAN, KONFIGURASI_ATURAN, KUNCI_AMBANG_ATURAN } from "@serah/core/aturan";
import { TEKS } from "@serah/kontrak";
import { describe, expect, it } from "vitest";
import { kueriPemilik } from "./uji/db";

// S28-5 — seed aturan (BLUEPRINT §J, tabel aturan_versi versi 1) harus SAMA dengan core/aturan/daftar.ts +
// konfigurasi.ts: kode, yurisdiksi, sumber, aksi, kunci teks, dan ambang. Satu sumber kebenaran, dua salinan dijaga sama.
// Dibandingkan hanya versi 1 (versi berikutnya adalah penambahan admin, S21).

type Baris = { kode: string; yurisdiksi: string; versi: number; sumber: string; aksi: string; kunci_teks: string; ambang: Record<string, unknown> };

function harapan(): Map<string, Omit<Baris, "versi">> {
  const peta = new Map<string, Omit<Baris, "versi">>();
  for (const d of DAFTAR_ATURAN) {
    for (const y of d.yurisdiksi) {
      const ambang: Record<string, unknown> = {};
      for (const kunci of KUNCI_AMBANG_ATURAN[d.kode]) ambang[kunci] = KONFIGURASI_ATURAN[kunci];
      peta.set(`${d.kode}|${y}`, {
        kode: d.kode,
        yurisdiksi: y,
        sumber: y === "NASIONAL" ? (d.sumberNasional ?? d.sumber) : d.sumber,
        aksi: d.aksi,
        kunci_teks: d.kunciTeks,
        ambang,
      });
    }
  }
  return peta;
}

describe("seed aturan = core/aturan/daftar.ts", () => {
  it("setiap aturan versi 1 di DB cocok dengan daftar core (kode × yurisdiksi, sumber, aksi, kunci teks, ambang); tidak ada yang kurang atau lebih", async () => {
    const db = await kueriPemilik<Baris>(`SELECT kode::text, yurisdiksi::text, versi, sumber, aksi::text, kunci_teks, ambang FROM aturan_versi WHERE versi = 1`);
    const dari = new Map(db.map((b) => [`${b.kode}|${b.yurisdiksi}`, b]));
    const mau = harapan();
    expect([...dari.keys()].sort()).toEqual([...mau.keys()].sort());
    for (const [kunci, e] of mau) {
      const b = dari.get(kunci)!;
      expect({ sumber: b.sumber, aksi: b.aksi, kunci_teks: b.kunci_teks }, kunci).toEqual({ sumber: e.sumber, aksi: e.aksi, kunci_teks: e.kunci_teks });
      expect(b.ambang, `${kunci} ambang`).toEqual(e.ambang);
    }
  });

  it("kunci teks setiap aturan ada di teks.ts; R-01…R-11 semuanya terdaftar sekali", () => {
    expect(DAFTAR_ATURAN.map((d) => d.kode)).toEqual(["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11"]);
    for (const d of DAFTAR_ATURAN) expect(Object.prototype.hasOwnProperty.call(TEKS, d.kunciTeks), d.kode).toBe(true);
  });

  it("yurisdiksi NASIONAL hanya aturan tanpa pasal Pergub DKI (R-04, R-07, R-08, R-10)", () => {
    const nasional = DAFTAR_ATURAN.filter((d) => d.yurisdiksi.includes("NASIONAL")).map((d) => d.kode);
    expect(nasional).toEqual(["R04", "R07", "R08", "R10"]);
    for (const d of DAFTAR_ATURAN.filter((x) => x.yurisdiksi.includes("NASIONAL"))) {
      expect(d.sumberNasional ?? d.sumber, d.kode).not.toMatch(/Pergub/);
    }
  });
});
