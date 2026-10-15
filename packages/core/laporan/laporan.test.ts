import { describe, expect, it } from "vitest";
import { susunBaris, totalPerAliran, type SerahTertutup } from "./index";

// T14 versi murni — tiga laporan dari satu fungsi: total & kode manifes identik untuk ketiga pihak (BLUEPRINT §L.4).

const K = "org-kawasan";
const A = "org-angkut";
const P = "org-penerima";
const P2 = "org-penerima-lain";
const HASH = (c: string) => c.repeat(64);

function serah(ubah: Partial<SerahTertutup> & Pick<SerahTertutup, "kode">): SerahTertutup {
  return {
    status: "DITERIMA_SEBAGIAN",
    ditutupPada: new Date("2026-10-15T08:00:00.000Z"),
    sidikEvent: HASH("a"),
    kawasanId: "kws1",
    orgKawasanId: K,
    orgPengangkutId: A,
    orgPenerimaId: P,
    tpsKode: "TPS-PCS-01",
    kawasanNama: "Pasar Contoh Sejahtera",
    kawasanAlamat: "Jl. Contoh No. 1",
    pengangkutNama: "Angkut Contoh Bersih",
    plat: "B 9001 SRH",
    penerimaNama: "Daur Ulang Contoh Mandiri",
    penerimaJenis: "FASILITAS_BERIZIN",
    aliran: [
      { aliran: "ABU", beratTpsG: 30_000, diterimaG: 30_000, ditolakG: 0, alasan: null },
      { aliran: "KUNING", beratTpsG: 20_000, diterimaG: 15_000, ditolakG: 5_000, alasan: "TERCAMPUR_ORGANIK" },
    ],
    ...ubah,
  };
}

const s1 = serah({ kode: "SRH-20261015-0001", sidikEvent: HASH("1") });
const s2 = serah({
  kode: "SRH-20261031-0002",
  status: "DITERIMA",
  ditutupPada: new Date("2026-10-31T16:59:59.999Z"), // 23.59 WIB 31 Okt
  orgPenerimaId: P2,
  aliran: [{ aliran: "HIJAU", beratTpsG: 4_000, diterimaG: 4_000, ditolakG: 0, alasan: null }],
  sidikEvent: HASH("2"),
});
const s3 = serah({
  kode: "SRH-20261101-0001",
  status: "DITOLAK",
  ditutupPada: new Date("2026-10-31T17:00:00.000Z"), // 00.00 WIB 1 Nov
  aliran: [{ aliran: "KUNING", beratTpsG: 10_000, diterimaG: 0, ditolakG: 10_000, alasan: "BASAH_KOTOR" }],
  sidikEvent: HASH("3"),
});
const s4 = serah({ kode: "SRH-20261016-0003", status: "MENGGANTUNG" });
const s5 = serah({ kode: "SRH-20261016-0004", kawasanId: "kws2", orgKawasanId: "org-kawasan-lain", sidikEvent: HASH("5") });
const SEMUA = [s5, s3, s4, s2, s1];

const pihakKawasan = { jenis: "kawasan", organisasiId: K } as const;
const pihakAngkut = { jenis: "pengangkut", organisasiId: A } as const;
const pihakTerima = { jenis: "penerima", organisasiId: P } as const;

describe("T14 — tiga laporan dari satu serah identik", () => {
  const satu = [s1];
  const kawasan = susunBaris(satu, pihakKawasan);
  const pengangkut = susunBaris(satu, pihakAngkut);
  const penerima = susunBaris(satu, pihakTerima);

  it("baris, kode manifes, dan total sama untuk kawasan, pengangkut, penerima", () => {
    expect(pengangkut).toEqual(kawasan);
    expect(penerima).toEqual(kawasan);
    expect(totalPerAliran(pengangkut)).toEqual(totalPerAliran(kawasan));
    expect(totalPerAliran(penerima)).toEqual(totalPerAliran(kawasan));
    expect(kawasan.map((b) => b.kodeSerah)).toEqual(["SRH-20261015-0001", "SRH-20261015-0001"]);
  });

  it("satu baris per aliran (HIJAU, KUNING, MERAH, ABU) dengan semua kolom §L.4", () => {
    expect(kawasan).toEqual([
      {
        tanggalWib: "2026-10-15",
        kodeSerah: "SRH-20261015-0001",
        aliran: "KUNING",
        beratTpsG: 20_000,
        beratDiterimaG: 15_000,
        beratDitolakG: 5_000,
        alasanTolak: "TERCAMPUR_ORGANIK",
        tpsKode: "TPS-PCS-01",
        kawasanNama: "Pasar Contoh Sejahtera",
        kawasanAlamat: "Jl. Contoh No. 1",
        pengangkutNama: "Angkut Contoh Bersih",
        plat: "B 9001 SRH",
        penerimaNama: "Daur Ulang Contoh Mandiri",
        penerimaJenis: "FASILITAS_BERIZIN",
        status: "DITERIMA_SEBAGIAN",
        sidikEvent: HASH("1"),
      },
      expect.objectContaining({ aliran: "ABU", beratTpsG: 30_000, beratDiterimaG: 30_000, beratDitolakG: 0, alasanTolak: null }),
    ]);
  });

  it("total (huruf d) dari baris yang sama, hanya aliran yang ada", () => {
    expect(totalPerAliran(kawasan)).toEqual([
      { aliran: "KUNING", beratTpsG: 20_000, beratDiterimaG: 15_000, beratDitolakG: 5_000 },
      { aliran: "ABU", beratTpsG: 30_000, beratDiterimaG: 30_000, beratDitolakG: 0 },
    ]);
    expect(totalPerAliran([])).toEqual([]);
  });
});

describe("filter pihak, periode, dan status", () => {
  it("pihak hanya melihat serah miliknya; kawasanId membatasi ke satu kawasan", () => {
    const kode = (b: ReturnType<typeof susunBaris>) => [...new Set(b.map((x) => x.kodeSerah))];
    expect(kode(susunBaris(SEMUA, pihakKawasan))).toEqual(["SRH-20261015-0001", "SRH-20261031-0002", "SRH-20261101-0001"]);
    // Penerima P juga menerima serah dari kawasan lain (s5): pihak = organisasi, bukan kawasan.
    expect(kode(susunBaris(SEMUA, pihakTerima))).toEqual(["SRH-20261015-0001", "SRH-20261016-0004", "SRH-20261101-0001"]);
    expect(kode(susunBaris(SEMUA, { ...pihakTerima, kawasanId: "kws1" }))).toEqual(["SRH-20261015-0001", "SRH-20261101-0001"]);
    expect(kode(susunBaris(SEMUA, { jenis: "penerima", organisasiId: P2 }))).toEqual(["SRH-20261031-0002"]);
    expect(kode(susunBaris(SEMUA, pihakAngkut)).sort()).toEqual(["SRH-20261015-0001", "SRH-20261016-0004", "SRH-20261031-0002", "SRH-20261101-0001"]);
    expect(kode(susunBaris(SEMUA, { ...pihakAngkut, kawasanId: "kws2" }))).toEqual(["SRH-20261016-0004"]);
    expect(susunBaris(SEMUA, { jenis: "kawasan", organisasiId: "org-asing" })).toEqual([]);
  });

  it("organisasi tidak bisa memakai kolom pihak lain (pengangkut ≠ penerima)", () => {
    expect(susunBaris(SEMUA, { jenis: "penerima", organisasiId: A })).toEqual([]);
    expect(susunBaris(SEMUA, { jenis: "pengangkut", organisasiId: P })).toEqual([]);
  });

  it("periode WIB: 23.59.59 WIB 31 Okt masuk Oktober, 00.00 WIB 1 Nov masuk November", () => {
    const kode = (p: string) => [...new Set(susunBaris(SEMUA, pihakKawasan, p).map((b) => b.kodeSerah))];
    expect(kode("2026-10")).toEqual(["SRH-20261015-0001", "SRH-20261031-0002"]);
    expect(kode("2026-11")).toEqual(["SRH-20261101-0001"]);
    expect(kode("2026-09")).toEqual([]);
    expect(susunBaris(SEMUA, pihakKawasan, "2026-11")[0]?.tanggalWib).toBe("2026-11-01");
  });

  it("serah yang belum tertutup (DRAF, MENUNGGU_SETUJU, DIANGKUT, MENGGANTUNG) tidak masuk", () => {
    for (const status of ["DRAF", "MENUNGGU_SETUJU", "DIANGKUT", "MENGGANTUNG"] as const) {
      expect(susunBaris([serah({ kode: "SRH-20261015-0009", status })], pihakKawasan)).toEqual([]);
    }
    for (const status of ["DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"] as const) {
      expect(susunBaris([serah({ kode: "SRH-20261015-0009", status })], pihakKawasan)).toHaveLength(2);
    }
  });

  it("urut menurut waktu tutup lalu kode; masukan tidak diubah", () => {
    const masukan = Object.freeze([...SEMUA]);
    const b = susunBaris(masukan, pihakKawasan);
    expect(b.map((x) => x.kodeSerah)).toEqual(["SRH-20261015-0001", "SRH-20261015-0001", "SRH-20261031-0002", "SRH-20261101-0001"]);
  });

  it("berat bukan integer ≥ 0 ditolak", () => {
    const rusak = serah({ kode: "SRH-20261015-0008", aliran: [{ aliran: "KUNING", beratTpsG: 1.5, diterimaG: 0, ditolakG: 0, alasan: null }] });
    expect(() => susunBaris([rusak], pihakKawasan)).toThrow(RangeError);
    const negatif = serah({ kode: "SRH-20261015-0008", aliran: [{ aliran: "KUNING", beratTpsG: 1, diterimaG: -1, ditolakG: 0, alasan: null }] });
    expect(() => susunBaris([negatif], pihakKawasan)).toThrow(RangeError);
  });

  it("nama & plat kosong (tanpa pengangkut/penerima) diteruskan sebagai null", () => {
    const b = susunBaris([serah({ kode: "SRH-20261015-0007", pengangkutNama: null, plat: null, penerimaNama: null, penerimaJenis: null })], pihakKawasan);
    expect(b[0]).toMatchObject({ pengangkutNama: null, plat: null, penerimaNama: null, penerimaJenis: null });
  });
});
