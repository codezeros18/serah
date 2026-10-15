import type { BarisLaporan } from "@serah/kontrak";
import { describe, expect, it } from "vitest";
import { pilihHargaAcuan, ringkasDitolak, type HargaMaterialMasukan } from "./index";

// Penyebab ditolak (K3) — angka dihitung dengan tangan. Selisih rupiah hanya untuk harga bersih DAN kotor (R-HM-02).

const PET: HargaMaterialMasukan = { sumberKode: "R-HM-02", bersihIdrPerKg: 2_000, kotorIdrPerKg: 1_200, tanggalSumber: "2024-07-10" };

function b(kodeSerah: string, aliran: BarisLaporan["aliran"], diterimaG: number, ditolakG: number, alasan: BarisLaporan["alasanTolak"]): BarisLaporan {
  return {
    tanggalWib: "2026-10-15", kodeSerah, aliran, beratTpsG: diterimaG + ditolakG, beratDiterimaG: diterimaG, beratDitolakG: ditolakG, alasanTolak: alasan,
    tpsKode: "TPS-PCS-01", kawasanNama: "K", kawasanAlamat: "A", pengangkutNama: null, plat: null, penerimaNama: null, penerimaJenis: null,
    status: "DITERIMA_SEBAGIAN", sidikEvent: "0".repeat(64),
  };
}

const DATA = [
  b("SRH-1", "KUNING", 15_000, 5_000, "TERCAMPUR_ORGANIK"),
  b("SRH-2", "KUNING", 0, 10_000, "BASAH_KOTOR"),
  b("SRH-3", "KUNING", 7_000, 3_000, "TERCAMPUR_ORGANIK"),
  b("SRH-3", "ABU", 30_000, 4_000, "RESIDU_BERLEBIH"), // bukan KUNING: diabaikan
  b("SRH-4", "KUNING", 9_000, 0, null), // tidak ada yang ditolak: tidak masuk daftar alasan
];

describe("ringkasDitolak", () => {
  it("kuning diterima vs ditolak, alasan terurut menurut kg ditolak, selisih = kg × (2000 − 1200) = 800 Rp/kg", () => {
    expect(ringkasDitolak(DATA, PET)).toEqual({
      kuning: { diterimaG: 31_000, ditolakG: 18_000 },
      alasan: [
        { alasan: "BASAH_KOTOR", ditolakG: 10_000, jumlahSerah: 1, selisihIdr: 8_000 }, // 10 kg × 800
        { alasan: "TERCAMPUR_ORGANIK", ditolakG: 8_000, jumlahSerah: 2, selisihIdr: 6_400 }, // 8 kg × 800
      ],
      sumberHarga: { sumber: "PET bening, bank sampah binaan IMIP", tanggal: "2024-07-10" },
    });
  });

  it("dibulatkan setengah-naik tanpa float: 1 g × 800/kg = 0,8 → 1; 624 g → 499; 625 g → 500", () => {
    const rp = (g: number) => ringkasDitolak([b("S", "KUNING", 0, g, "BASAH_KOTOR")], PET).alasan[0]?.selisihIdr;
    expect([rp(1), rp(624), rp(625)]).toEqual([1, 499, 500]);
    const lain: HargaMaterialMasukan = { ...PET, bersihIdrPerKg: 1_700, kotorIdrPerKg: 1_000 }; // selisih 700/kg
    expect(ringkasDitolak([b("S", "KUNING", 0, 5, "BASAH_KOTOR")], lain).alasan[0]?.selisihIdr).toBe(4); // 3,5 → 4
  });

  it("tanpa harga acuan: berat ditolak tetap tampil, rupiah & sumber null", () => {
    const h = ringkasDitolak(DATA, null);
    expect(h.kuning).toEqual({ diterimaG: 31_000, ditolakG: 18_000 });
    expect(h.alasan.map((a) => a.selisihIdr)).toEqual([null, null]);
    expect(h.sumberHarga).toBeNull();
  });

  it("harga tanpa harga kotor (mis. kardus R-HM-01) tidak menghasilkan rupiah", () => {
    const kardus: HargaMaterialMasukan = { sumberKode: "R-HM-01", bersihIdrPerKg: 1_300, kotorIdrPerKg: null, tanggalSumber: null };
    expect(ringkasDitolak(DATA, kardus).alasan.every((a) => a.selisihIdr === null)).toBe(true);
    expect(ringkasDitolak(DATA, kardus).sumberHarga).toBeNull();
  });

  it("tanpa tanggal sumber yang sah, harga dianggap tidak tersedia (label sumber wajib bertanggal)", () => {
    for (const tanggalSumber of [null, "2025-04/2026-04", "2024-13-01", "10 Juli 2024"]) {
      const h = ringkasDitolak(DATA, { ...PET, tanggalSumber });
      expect(h.sumberHarga).toBeNull();
      expect(h.alasan.every((a) => a.selisihIdr === null)).toBe(true);
    }
  });

  it("harga bersih ≤ kotor tidak dipakai (selisih tidak bermakna)", () => {
    expect(ringkasDitolak(DATA, { ...PET, kotorIdrPerKg: 2_000 }).sumberHarga).toBeNull();
    expect(ringkasDitolak(DATA, { ...PET, kotorIdrPerKg: 2_500 }).sumberHarga).toBeNull();
  });

  it("sumber tak terdaftar tampil sebagai kodenya", () => {
    expect(ringkasDitolak(DATA, { ...PET, sumberKode: "R-HM-99" }).sumberHarga?.sumber).toBe("R-HM-99");
  });

  it("tanpa baris KUNING: nol & daftar kosong", () => {
    expect(ringkasDitolak([b("S", "ABU", 1_000, 0, null)], PET)).toEqual({
      kuning: { diterimaG: 0, ditolakG: 0 },
      alasan: [],
      sumberHarga: { sumber: "PET bening, bank sampah binaan IMIP", tanggal: "2024-07-10" },
    });
  });
});

describe("pilihHargaAcuan", () => {
  const SEED: HargaMaterialMasukan[] = [
    { sumberKode: "R-HM-01", bersihIdrPerKg: 1_300, kotorIdrPerKg: null, tanggalSumber: null },
    PET,
    { sumberKode: "R-HM-03", bersihIdrPerKg: 10_500, kotorIdrPerKg: null, tanggalSumber: "2025-04/2026-04" },
    { sumberKode: "R-HM-04", bersihIdrPerKg: 1_500, kotorIdrPerKg: null, tanggalSumber: null },
  ];

  it("dari data seed hanya R-HM-02 (satu-satunya punya harga bersih & kotor)", () => {
    expect(pilihHargaAcuan(SEED)).toBe(PET);
  });

  it("beberapa kandidat: tanggal terbaru menang; tanggal sama → kode terkecil", () => {
    const baru: HargaMaterialMasukan = { sumberKode: "R-HM-10", bersihIdrPerKg: 3_000, kotorIdrPerKg: 2_000, tanggalSumber: "2025-01-01" };
    expect(pilihHargaAcuan([PET, baru])).toBe(baru);
    const kembar: HargaMaterialMasukan = { ...baru, sumberKode: "R-HM-09" };
    expect(pilihHargaAcuan([baru, kembar])).toBe(kembar);
  });

  it("bertanggal sah tetap ditolak bila tanpa harga kotor atau harga bersih ≤ kotor", () => {
    const tanpaKotor: HargaMaterialMasukan = { sumberKode: "R-HM-11", bersihIdrPerKg: 9_000, kotorIdrPerKg: null, tanggalSumber: "2026-01-01" };
    const terbalik: HargaMaterialMasukan = { sumberKode: "R-HM-12", bersihIdrPerKg: 1_000, kotorIdrPerKg: 1_500, tanggalSumber: "2026-01-01" };
    const sama: HargaMaterialMasukan = { sumberKode: "R-HM-13", bersihIdrPerKg: 1_000, kotorIdrPerKg: 1_000, tanggalSumber: "2026-01-01" };
    expect(pilihHargaAcuan([tanpaKotor, terbalik, sama])).toBeNull();
    expect(pilihHargaAcuan([tanpaKotor, terbalik, sama, PET])).toBe(PET);
  });

  it("tidak ada kandidat → null", () => {
    expect(pilihHargaAcuan([])).toBeNull();
    expect(pilihHargaAcuan(SEED.filter((h) => h !== PET))).toBeNull();
  });
});
