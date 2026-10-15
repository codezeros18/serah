import { describe, expect, it } from "vitest";
import { awalHariWib } from "../waktu";
import { hitungNeraca, jumlahkanPerAliran, type BarisNeraca, type RincianNeraca, type WadahNeraca } from "./index";

// Neraca per aliran per TPS/kawasan/periode — angka dihitung dengan tangan.

const t = (iso: string) => new Date(iso);
const wadah: WadahNeraca[] = [
  { id: "w1", tpsId: "tps1", kawasanId: "kws1", aliran: "KUNING", beratG: 12_500, jumlahWadah: null, terjadiPada: t("2026-10-15T01:00:00Z") },
  { id: "w2", tpsId: "tps1", kawasanId: "kws1", aliran: "KUNING", beratG: 7_250, jumlahWadah: 2, terjadiPada: t("2026-10-15T02:00:00Z") },
  { id: "w3", tpsId: "tps1", kawasanId: "kws1", aliran: "ABU", beratG: 30_000, jumlahWadah: null, terjadiPada: t("2026-10-15T03:00:00Z") },
  { id: "w4", tpsId: "tps1", kawasanId: "kws1", aliran: "HIJAU", beratG: null, jumlahWadah: 3, terjadiPada: t("2026-10-15T04:00:00Z") },
  // 17.30 UTC tgl 15 = 00.30 WIB tgl 16 → hari berikutnya
  { id: "w5", tpsId: "tps1", kawasanId: "kws1", aliran: "MERAH", beratG: 1_200, jumlahWadah: null, terjadiPada: t("2026-10-15T17:30:00Z") },
  { id: "w6", tpsId: "tps2", kawasanId: "kws1", aliran: "ABU", beratG: 10_000, jumlahWadah: null, terjadiPada: t("2026-10-15T05:00:00Z") },
  { id: "w7", tpsId: "tps2", kawasanId: "kws1", aliran: "HIJAU", beratG: null, jumlahWadah: 2, terjadiPada: t("2026-10-15T06:00:00Z") },
];
const rincian: RincianNeraca[] = [
  // S1 dari TPS1: diterima sebagian (KUNING 15 kg diterima, 4,75 kg ditolak), ABU diterima penuh
  { serahId: "s1", tpsId: "tps1", kawasanId: "kws1", aliran: "KUNING", diterimaG: 15_000, ditolakG: 4_750, ditutupPada: t("2026-10-15T08:00:00Z") },
  { serahId: "s1", tpsId: "tps1", kawasanId: "kws1", aliran: "ABU", diterimaG: 30_000, ditolakG: 0, ditutupPada: t("2026-10-15T08:00:00Z") },
  // S2 dari TPS2: ditolak penuh
  { serahId: "s2", tpsId: "tps2", kawasanId: "kws1", aliran: "ABU", diterimaG: 0, ditolakG: 10_000, ditutupPada: t("2026-10-15T09:00:00Z") },
];

const nol = { dicatatG: 0, catatanBerBerat: 0, catatanTanpaBerat: 0, wadahTanpaBerat: 0, diterimaG: 0, ditolakG: 0, serahTertutup: 0 };
const cari = (b: BarisNeraca[], kunci: string, periode: string, aliran: string) => b.find((x) => x.kunci === kunci && x.periode === periode && x.aliran === aliran);

describe("neraca per TPS per hari WIB", () => {
  const b = hitungNeraca({ wadah, rincian }, { kelompok: "TPS", periode: "HARI" });

  it("TPS1 15 Okt — KUNING tolak sebagian", () => {
    expect(cari(b, "tps1", "2026-10-15", "KUNING")).toEqual({
      kunci: "tps1", periode: "2026-10-15", aliran: "KUNING",
      dicatatG: 19_750, catatanBerBerat: 2, catatanTanpaBerat: 0, wadahTanpaBerat: 0, diterimaG: 15_000, ditolakG: 4_750, serahTertutup: 1,
    });
  });
  it("TPS1 15 Okt — ABU diterima penuh", () => {
    expect(cari(b, "tps1", "2026-10-15", "ABU")).toMatchObject({ dicatatG: 30_000, catatanBerBerat: 1, diterimaG: 30_000, ditolakG: 0, serahTertutup: 1 });
  });
  it("TPS1 15 Okt — HIJAU tanpa berat tetap terhitung", () => {
    expect(cari(b, "tps1", "2026-10-15", "HIJAU")).toMatchObject({ ...nol, catatanTanpaBerat: 1, wadahTanpaBerat: 3 });
  });
  it("TPS1 15 Okt — MERAH nol (catatan MERAH jatuh di 16 Okt WIB)", () => {
    expect(cari(b, "tps1", "2026-10-15", "MERAH")).toMatchObject(nol);
    expect(cari(b, "tps1", "2026-10-16", "MERAH")).toMatchObject({ dicatatG: 1_200, catatanBerBerat: 1 });
  });
  it("TPS2 15 Okt — ABU ditolak penuh", () => {
    expect(cari(b, "tps2", "2026-10-15", "ABU")).toMatchObject({ dicatatG: 10_000, diterimaG: 0, ditolakG: 10_000, serahTertutup: 1 });
  });
  it("setiap (kunci, periode) berisi keempat aliran berurutan HIJAU, KUNING, MERAH, ABU", () => {
    expect(b.map((x) => `${x.kunci}/${x.periode}/${x.aliran}`)).toEqual([
      "tps1/2026-10-15/HIJAU", "tps1/2026-10-15/KUNING", "tps1/2026-10-15/MERAH", "tps1/2026-10-15/ABU",
      "tps1/2026-10-16/HIJAU", "tps1/2026-10-16/KUNING", "tps1/2026-10-16/MERAH", "tps1/2026-10-16/ABU",
      "tps2/2026-10-15/HIJAU", "tps2/2026-10-15/KUNING", "tps2/2026-10-15/MERAH", "tps2/2026-10-15/ABU",
    ]);
  });
});

describe("neraca per kawasan per bulan WIB", () => {
  const b = hitungNeraca({ wadah, rincian }, { kelompok: "KAWASAN", periode: "BULAN" });
  it("angka tangan", () => {
    expect(cari(b, "kws1", "2026-10", "KUNING")).toMatchObject({ dicatatG: 19_750, diterimaG: 15_000, ditolakG: 4_750, serahTertutup: 1 });
    expect(cari(b, "kws1", "2026-10", "ABU")).toMatchObject({ dicatatG: 40_000, catatanBerBerat: 2, diterimaG: 30_000, ditolakG: 10_000, serahTertutup: 2 });
    expect(cari(b, "kws1", "2026-10", "HIJAU")).toMatchObject({ dicatatG: 0, catatanTanpaBerat: 2, wadahTanpaBerat: 5 });
    expect(cari(b, "kws1", "2026-10", "MERAH")).toMatchObject({ dicatatG: 1_200, catatanBerBerat: 1 });
    expect(b).toHaveLength(4);
  });
  it("jumlahkanPerAliran", () => {
    const j = jumlahkanPerAliran(b);
    expect(j.ABU).toEqual({ dicatatG: 40_000, catatanBerBerat: 2, catatanTanpaBerat: 0, wadahTanpaBerat: 0, diterimaG: 30_000, ditolakG: 10_000, serahTertutup: 2 });
    expect(j.KUNING.diterimaG + j.KUNING.ditolakG).toBe(19_750);
  });
  it("semua angka integer aman", () => {
    for (const x of b) for (const v of Object.values(x)) if (typeof v === "number") expect(Number.isSafeInteger(v)).toBe(true);
  });
});

describe("rentang & periode SEMUA", () => {
  it("rentang setengah terbuka [dari, sampai) dalam WIB", () => {
    const b = hitungNeraca({ wadah, rincian }, { kelompok: "KAWASAN", periode: "SEMUA", rentang: { dari: awalHariWib("2026-10-16"), sampai: awalHariWib("2026-10-17") } });
    expect(b.filter((x) => x.dicatatG > 0 || x.diterimaG > 0 || x.ditolakG > 0)).toEqual([
      { ...nol, kunci: "kws1", periode: "*", aliran: "MERAH", dicatatG: 1_200, catatanBerBerat: 1 },
    ]);
  });
  it("data kosong → tanpa baris", () => {
    expect(hitungNeraca({ wadah: [], rincian: [] }, { kelompok: "TPS", periode: "HARI" })).toEqual([]);
  });
  it("penutupan dihitung pada tanggal ditutup", () => {
    const b = hitungNeraca({ wadah: [], rincian: [{ ...rincian[0]!, ditutupPada: t("2026-10-15T17:00:00Z") }] }, { kelompok: "TPS", periode: "HARI" });
    expect(cari(b, "tps1", "2026-10-16", "KUNING")).toMatchObject({ diterimaG: 15_000, ditolakG: 4_750, dicatatG: 0 });
  });
});
