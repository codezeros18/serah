import { describe, expect, it } from "vitest";
import { TEKS, isi } from "@serah/kontrak";
import { KONFIGURASI_ATURAN } from "./konfigurasi";
import { DAFTAR_ATURAN, aturanAktif } from "./daftar";
import {
  evaluasiAmbil,
  evaluasiCuaca,
  evaluasiFoto,
  evaluasiKontrak,
  evaluasiMenggantung,
  evaluasiTPS,
  evaluasiTutup,
  type KontrakAturan,
  type PenerimaAturan,
} from "./evaluator";

const JAM = 3_600_000;
const SEKARANG = new Date("2026-10-15T05:00:00Z"); // 12.00 WIB
const lalu = (jam: number, menit = 0) => new Date(SEKARANG.getTime() - jam * JAM - menit * 60_000);
const nanti = (jam: number) => new Date(SEKARANG.getTime() + jam * JAM);

const penerimaOk: PenerimaAturan = {
  id: "pn1",
  jenis: "FASILITAS_BERIZIN",
  aliranDiterima: ["HIJAU", "KUNING", "MERAH", "ABU"],
  statusIzin: "TERVERIFIKASI",
};
const kontrakAktif: KontrakAturan = {
  status: "AKTIF",
  kawasanId: "kw1",
  pengangkutId: "pg1",
  penerimaId: "pn1",
  aliran: ["HIJAU", "KUNING", "MERAH", "ABU"],
  berlakuDari: "2026-01-01",
  berlakuSampai: "2026-12-31",
};
const dasarAmbil = {
  yurisdiksi: "DKI" as const,
  sekarang: SEKARANG,
  kawasanId: "kw1",
  pengangkutId: "pg1",
  penerima: penerimaOk,
  kontrak: [kontrakAktif],
};

describe("konfigurasi & daftar (S03-1)", () => {
  it("nilai ambang persis BLUEPRINT §J", () => {
    expect(KONFIGURASI_ATURAN).toEqual({
      R04_AMBANG_BIT: 6,
      R04_JENDELA_HARI: 30,
      R05_JAM: 72,
      R06_JAM: 24,
      R07_JAM: 12,
      R08_BP: 2000,
      R09_JAM_WIB: 20,
      R10_HORIZON_JAM: 6,
      R10_UMUR_JAM: 24,
      R10_BASI_JAM: 12,
      R10_KATA_HUJAN: ["Hujan Lebat", "Hujan Petir"],
    });
  });

  it("daftar memuat R01–R11; NASIONAL hanya R04, R07, R08, R10", () => {
    expect(DAFTAR_ATURAN.map((a) => a.kode)).toEqual(["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11"]);
    const nasional = DAFTAR_ATURAN.filter((a) => aturanAktif(a.kode, "NASIONAL")).map((a) => a.kode);
    expect(nasional).toEqual(["R04", "R07", "R08", "R10"]);
  });
});

describe("T01 R-01 aliran ≠ ABU ke TPA_TPST", () => {
  const tpa: PenerimaAturan = { ...penerimaOk, jenis: "TPA_TPST", aliranDiterima: ["ABU", "KUNING"] };
  it("KUNING ke TPA_TPST → TOLAK R01 dengan teks §M.3", () => {
    const h = evaluasiAmbil({ ...dasarAmbil, penerima: tpa, aliranSerah: ["KUNING"], kontrak: [{ ...kontrakAktif, aliran: ["KUNING"] }] });
    const r01 = h.filter((x) => x.kode === "R01");
    expect(r01).toHaveLength(1);
    expect(r01[0]).toMatchObject({ aksi: "TOLAK", teks: isi("ATURAN_R01", { aliran: TEKS.ALIRAN_KUNING }) });
  });
  it("ABU ke TPA_TPST lolos", () => {
    const h = evaluasiAmbil({ ...dasarAmbil, penerima: tpa, aliranSerah: ["ABU"], kontrak: [{ ...kontrakAktif, aliran: ["ABU"] }] });
    expect(h).toEqual([]);
  });
});

describe("T02 R-02 kontrak", () => {
  it("tanpa kontrak → TOLAK per aliran", () => {
    const h = evaluasiAmbil({ ...dasarAmbil, aliranSerah: ["KUNING"], kontrak: [] });
    expect(h.map((x) => x.kode)).toEqual(["R02"]);
  });
  it("kontrak kedaluwarsa (berlakuSampai kemarin WIB) → TOLAK", () => {
    const k = { ...kontrakAktif, berlakuSampai: "2026-10-14" };
    expect(evaluasiAmbil({ ...dasarAmbil, aliranSerah: ["KUNING"], kontrak: [k] }).map((x) => x.kode)).toEqual(["R02"]);
  });
  it("kontrak berakhir hari ini WIB masih berlaku", () => {
    const k = { ...kontrakAktif, berlakuSampai: "2026-10-15" };
    expect(evaluasiAmbil({ ...dasarAmbil, aliranSerah: ["KUNING"], kontrak: [k] })).toEqual([]);
  });
  it("kontrak tidak mencakup salah satu aliran → TOLAK untuk aliran itu saja", () => {
    const k = { ...kontrakAktif, aliran: ["KUNING"] as const };
    const h = evaluasiAmbil({ ...dasarAmbil, aliranSerah: ["KUNING", "HIJAU"], kontrak: [k] });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ kode: "R02", teks: isi("ATURAN_R02", { aliran: TEKS.ALIRAN_HIJAU }) });
  });
  it("kontrak USULAN atau milik pihak lain tidak dihitung", () => {
    const usulan = { ...kontrakAktif, status: "USULAN" as const };
    const lain = { ...kontrakAktif, pengangkutId: "pgX" };
    expect(evaluasiAmbil({ ...dasarAmbil, aliranSerah: ["KUNING"], kontrak: [usulan, lain] }).map((x) => x.kode)).toEqual(["R02"]);
  });
});

describe("T03 R-03 penerima tidak menerima aliran", () => {
  it("→ TOLAK R03", () => {
    const p = { ...penerimaOk, aliranDiterima: ["HIJAU"] as const };
    const h = evaluasiAmbil({ ...dasarAmbil, penerima: p, aliranSerah: ["KUNING"] });
    expect(h.map((x) => x.kode)).toEqual(["R03"]);
    expect(h[0]!.teks).toBe(isi("ATURAN_R03", { aliran: TEKS.ALIRAN_KUNING }));
  });
});

describe("yurisdiksi NASIONAL", () => {
  it("aturan bersumber pasal Pergub tidak aktif", () => {
    const tpa: PenerimaAturan = { ...penerimaOk, jenis: "TPA_TPST", aliranDiterima: ["ABU"], statusIzin: "MENUNGGU" };
    const h = evaluasiAmbil({ ...dasarAmbil, yurisdiksi: "NASIONAL", penerima: tpa, aliranSerah: ["KUNING"], kontrak: [] });
    expect(h).toEqual([]);
  });
});

describe("T04 R-04 foto (versi murni)", () => {
  const A = "ffff0000ffff0000";
  const dasar = { yurisdiksi: "DKI" as const, sekarang: SEKARANG };
  it("identik → TOLAK R04 menyebut kode serah", () => {
    const h = evaluasiFoto({ ...dasar, dhash: A, pembanding: [{ dhash: A, kodeSerah: "SRH-20261001-0001", diambilPada: lalu(48) }] });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ kode: "R04", aksi: "TOLAK", teks: isi("ATURAN_R04", { kode_serah: "SRH-20261001-0001" }) });
  });
  it("tepat 6 bit beda → TOLAK; 7 bit → lolos", () => {
    const enam = "ffff0000ffff003f"; // 6 bit berbeda
    const tujuh = "ffff0000ffff007f"; // 7 bit berbeda
    const p = (d: string) => [{ dhash: d, kodeSerah: "SRH-20261001-0001", diambilPada: lalu(1) }];
    expect(evaluasiFoto({ ...dasar, dhash: A, pembanding: p(enam) })).toHaveLength(1);
    expect(evaluasiFoto({ ...dasar, dhash: A, pembanding: p(tujuh) })).toEqual([]);
  });
  it("pembanding lebih tua dari 30 hari diabaikan", () => {
    const h = evaluasiFoto({ ...dasar, dhash: A, pembanding: [{ dhash: A, kodeSerah: "SRH-20260801-0001", diambilPada: lalu(31 * 24) }] });
    expect(h).toEqual([]);
  });
});

describe("T05 R-05/R-06 batas jam", () => {
  const dasar = { yurisdiksi: "DKI" as const, sekarang: SEKARANG, kodeTps: "TPS-KWS-01", aktif: true, waktuCatatan: [lalu(1)] };
  it("KUNING 71j59m lolos, 72j01m peringatan R05", () => {
    const lolos = evaluasiTPS({ ...dasar, wadahBelumDiserahkan: [{ aliran: "KUNING", terjadiPada: lalu(71, 59) }] });
    const kena = evaluasiTPS({ ...dasar, wadahBelumDiserahkan: [{ aliran: "KUNING", terjadiPada: lalu(72, 1) }] });
    expect(lolos).toEqual([]);
    expect(kena).toHaveLength(1);
    expect(kena[0]).toMatchObject({ kode: "R05", aksi: "PERINGATAN", teks: isi("ATURAN_R05", { aliran: TEKS.ALIRAN_KUNING, kode_tps: "TPS-KWS-01", jam: 72 }) });
  });
  it("HIJAU 23j59m lolos, 24j01m peringatan R06", () => {
    expect(evaluasiTPS({ ...dasar, wadahBelumDiserahkan: [{ aliran: "HIJAU", terjadiPada: lalu(23, 59) }] })).toEqual([]);
    const kena = evaluasiTPS({ ...dasar, wadahBelumDiserahkan: [{ aliran: "HIJAU", terjadiPada: lalu(24, 1) }] });
    expect(kena.map((x) => x.kode)).toEqual(["R06"]);
    expect(kena[0]!.teks).toBe(isi("ATURAN_R06", { kode_tps: "TPS-KWS-01", jam: 24 }));
  });
  it("memakai wadah tertua per aliran", () => {
    const h = evaluasiTPS({
      ...dasar,
      wadahBelumDiserahkan: [
        { aliran: "ABU", terjadiPada: lalu(10) },
        { aliran: "ABU", terjadiPada: lalu(80) },
      ],
    });
    expect(h).toHaveLength(1);
    expect(h[0]!.teks).toBe(isi("ATURAN_R05", { aliran: TEKS.ALIRAN_ABU, kode_tps: "TPS-KWS-01", jam: 80 }));
  });
});

describe("T06 R-07 MENGGANTUNG", () => {
  const dasar = { yurisdiksi: "DKI" as const, sekarang: SEKARANG, kodeSerah: "SRH-20261015-0001" };
  it("DIANGKUT > 12 jam sejak disetujui → STATUS R07", () => {
    const h = evaluasiMenggantung({ ...dasar, status: "DIANGKUT", disetujuiPada: lalu(12, 1) });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ kode: "R07", aksi: "STATUS", teks: isi("ATURAN_R07", { kode_serah: "SRH-20261015-0001", jam: 12 }) });
  });
  it("tepat 12 jam belum", () => {
    expect(evaluasiMenggantung({ ...dasar, status: "DIANGKUT", disetujuiPada: lalu(12) })).toEqual([]);
  });
  it("idempoten: sudah MENGGANTUNG atau sudah tertutup → tidak ada hasil", () => {
    expect(evaluasiMenggantung({ ...dasar, status: "MENGGANTUNG", disetujuiPada: lalu(40) })).toEqual([]);
    expect(evaluasiMenggantung({ ...dasar, status: "DITERIMA", disetujuiPada: lalu(40) })).toEqual([]);
  });
  it("NASIONAL tetap aktif", () => {
    expect(evaluasiMenggantung({ ...dasar, yurisdiksi: "NASIONAL", status: "DIANGKUT", disetujuiPada: lalu(13) })).toHaveLength(1);
  });
});

describe("T07 R-08 peringatan, tidak menolak", () => {
  const dasar = { yurisdiksi: "DKI" as const };
  it("selisih 25% → PERINGATAN R08 dengan angka kg & persen", () => {
    const h = evaluasiTutup({ ...dasar, beratTiketG: 125_000, beratWadahG: [60_000, 40_000] });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ kode: "R08", aksi: "PERINGATAN", teks: isi("ATURAN_R08", { berat_tiket: "125", persen: "25", berat_tps: "100" }) });
  });
  it("tepat 20% belum peringatan; 20,01% peringatan", () => {
    expect(evaluasiTutup({ ...dasar, beratTiketG: 120_000, beratWadahG: [100_000] })).toEqual([]);
    expect(evaluasiTutup({ ...dasar, beratTiketG: 120_011, beratWadahG: [100_000] })).toHaveLength(1);
  });
  it("selisih ke bawah juga dihitung; tidak pernah aksi TOLAK", () => {
    const h = evaluasiTutup({ ...dasar, beratTiketG: 50_000, beratWadahG: [100_000] });
    expect(h.map((x) => x.aksi)).toEqual(["PERINGATAN"]);
  });
  it("hanya bila semua wadah punya berat", () => {
    expect(evaluasiTutup({ ...dasar, beratTiketG: 500_000, beratWadahG: [100_000, null] })).toEqual([]);
    expect(evaluasiTutup({ ...dasar, beratTiketG: 500_000, beratWadahG: [] })).toEqual([]);
  });
});

describe("T08 R-09 jam WIB lintas tengah malam UTC", () => {
  const dasar = { yurisdiksi: "DKI" as const, kodeTps: "TPS-KWS-01", aktif: true, wadahBelumDiserahkan: [] };
  it("20.00 WIB tanpa catatan hari ini → R09", () => {
    const s = new Date("2026-10-15T13:00:00Z"); // 20.00 WIB
    const h = evaluasiTPS({ ...dasar, sekarang: s, waktuCatatan: [] });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ kode: "R09", teks: isi("ATURAN_R09", { kode_tps: "TPS-KWS-01" }) });
  });
  it("19.59 WIB belum", () => {
    expect(evaluasiTPS({ ...dasar, sekarang: new Date("2026-10-15T12:59:00Z"), waktuCatatan: [] })).toEqual([]);
  });
  it("catatan 01.00 WIB (18.00Z hari sebelumnya) dihitung hari WIB ini", () => {
    const s = new Date("2026-10-15T14:00:00Z");
    expect(evaluasiTPS({ ...dasar, sekarang: s, waktuCatatan: [new Date("2026-10-14T18:00:00Z")] })).toEqual([]);
  });
  it("catatan 23.00 WIB kemarin (16.00Z) tidak dihitung hari ini", () => {
    const s = new Date("2026-10-15T14:00:00Z");
    expect(evaluasiTPS({ ...dasar, sekarang: s, waktuCatatan: [new Date("2026-10-14T16:00:00Z")] })).toHaveLength(1);
  });
  it("TPS tidak aktif tidak dievaluasi", () => {
    expect(evaluasiTPS({ ...dasar, aktif: false, sekarang: new Date("2026-10-15T14:00:00Z"), waktuCatatan: [] })).toEqual([]);
  });
});

describe("R-10 prioritas angkut", () => {
  const tps = { kode: "TPS-KWS-01", latE6: -6_165_000, lonE6: 106_845_000, namaKelurahan: "Kemayoran" };
  const wadah30 = [{ aliran: "KUNING" as const, terjadiPada: lalu(30) }];
  const prakiraan = (desc: string, jamKeSlot: number, analisisLalu = 1, mode: "LIVE" | "SNAPSHOT" = "LIVE") => ({
    mode,
    analysisDate: lalu(analisisLalu),
    slot: [{ slotUtc: nanti(jamKeSlot), weatherDesc: desc }],
  });
  const dasar = { yurisdiksi: "DKI" as const, sekarang: SEKARANG, tps, wadahBelumDiserahkan: wadah30, nowcast: [] };

  it("T09 Hujan Lebat ≤6j + wadah 30j → PRIORITAS dengan teks & catatan", () => {
    const r = evaluasiCuaca({ ...dasar, prakiraan: prakiraan("Hujan Lebat", 3) });
    expect(r.prioritas).not.toBeNull();
    expect(r.prioritas).toMatchObject({
      kode: "R10",
      aksi: "PRIORITAS",
      sumberCuaca: "PRAKIRAAN",
      aliran: "KUNING",
      umurJam: 30,
      catatan: TEKS.R10_CATATAN,
      teks: isi("ATURAN_R10_PRAKIRAAN", { weather_desc: "Hujan Lebat", nama_kelurahan: "Kemayoran", jam_slot: "15.00", kode_tps: "TPS-KWS-01", aliran: TEKS.ALIRAN_KUNING, jam: 30 }),
    });
    expect(r.galat).toBeNull();
  });
  it("perbandingan weather_desc case-insensitive dan trim", () => {
    expect(evaluasiCuaca({ ...dasar, prakiraan: prakiraan("  hujan PETIR ", 1) }).prioritas).not.toBeNull();
  });
  it("Hujan Ringan, slot di luar horizon, wadah < 24 jam → tidak ada prioritas", () => {
    expect(evaluasiCuaca({ ...dasar, prakiraan: prakiraan("Hujan Ringan", 3) }).prioritas).toBeNull();
    expect(evaluasiCuaca({ ...dasar, prakiraan: prakiraan("Hujan Lebat", 7) }).prioritas).toBeNull();
    const muda = [{ aliran: "KUNING" as const, terjadiPada: lalu(23, 59) }];
    expect(evaluasiCuaca({ ...dasar, wadahBelumDiserahkan: muda, prakiraan: prakiraan("Hujan Lebat", 3) }).prioritas).toBeNull();
  });
  it("hanya wadah KUNING/ABU yang memicu; HIJAU/MERAH tidak", () => {
    const w = [{ aliran: "HIJAU" as const, terjadiPada: lalu(60) }, { aliran: "MERAH" as const, terjadiPada: lalu(60) }];
    expect(evaluasiCuaca({ ...dasar, wadahBelumDiserahkan: w, prakiraan: prakiraan("Hujan Lebat", 3) }).prioritas).toBeNull();
  });
  it("T10 prakiraan basi > 12j → bagian (a) tidak jalan, G_BMKG_MATI", () => {
    const r = evaluasiCuaca({ ...dasar, prakiraan: prakiraan("Hujan Lebat", 3, 13) });
    expect(r.prioritas).toBeNull();
    expect(r.galat).toBe("G_BMKG_MATI");
  });
  it("prakiraan gagal diambil (null) → G_BMKG_MATI", () => {
    const r = evaluasiCuaca({ ...dasar, prakiraan: null });
    expect(r).toMatchObject({ prioritas: null, galat: "G_BMKG_MATI" });
  });
  it("snapshot ≤12j dipakai dan ditandai G_BMKG_SNAPSHOT", () => {
    const r = evaluasiCuaca({ ...dasar, prakiraan: prakiraan("Hujan Lebat", 3, 2, "SNAPSHOT") });
    expect(r.prioritas).not.toBeNull();
    expect(r.galat).toBe("G_BMKG_SNAPSHOT");
  });

  const kotak = (lat: number, lon: number, r: number): [number, number][] => [
    [lat - r, lon - r], [lat - r, lon + r], [lat + r, lon + r], [lat + r, lon - r],
  ];
  const cap = (poligonE6: [number, number][], efektif = lalu(1), berakhir = nanti(2)) => ({
    identifier: "CAP-1", headline: "Hujan Lebat disertai Petir", effective: efektif, expires: berakhir, poligonE6,
  });
  it("T11 nowcast aktif, poligon memuat TPS → PRIORITAS NOWCAST", () => {
    const r = evaluasiCuaca({ ...dasar, prakiraan: null, nowcast: [cap(kotak(tps.latE6, tps.lonE6, 10_000))] });
    expect(r.prioritas).toMatchObject({
      sumberCuaca: "NOWCAST",
      acuan: "CAP-1",
      teks: isi("ATURAN_R10_NOWCAST", { headline: "Hujan Lebat disertai Petir", kode_tps: "TPS-KWS-01", jam_berakhir: "14.00", aliran: TEKS.ALIRAN_KUNING, jam: 30 }),
    });
  });
  it("T11 poligon di luar TPS, kedaluwarsa, atau belum berlaku → tidak", () => {
    const jauh = kotak(tps.latE6 + 500_000, tps.lonE6, 10_000);
    expect(evaluasiCuaca({ ...dasar, prakiraan: null, nowcast: [cap(jauh)] }).prioritas).toBeNull();
    const poli = kotak(tps.latE6, tps.lonE6, 10_000);
    expect(evaluasiCuaca({ ...dasar, prakiraan: null, nowcast: [cap(poli, lalu(5), lalu(1))] }).prioritas).toBeNull();
    expect(evaluasiCuaca({ ...dasar, prakiraan: null, nowcast: [cap(poli, nanti(1), nanti(3))] }).prioritas).toBeNull();
  });
  it("nowcast gagal (null) tidak menebak; prakiraan tetap jalan", () => {
    const r = evaluasiCuaca({ ...dasar, prakiraan: prakiraan("Hujan Lebat", 3), nowcast: null });
    expect(r.prioritas?.sumberCuaca).toBe("PRAKIRAAN");
    expect(r.nowcastTersedia).toBe(false);
  });
  it("NASIONAL: R-10 aktif, sumber tanpa kutipan Pergub", () => {
    const r = evaluasiCuaca({ ...dasar, yurisdiksi: "NASIONAL", prakiraan: prakiraan("Hujan Lebat", 3) });
    expect(r.prioritas?.sumber).toBe("Data BMKG");
  });
});

describe("T12 R-11 izin penerima", () => {
  const menunggu: PenerimaAturan = { ...penerimaOk, statusIzin: "MENUNGGU" };
  it.each(["FASILITAS_BERIZIN", "PELAPAK_BERIZIN", "BANK_SAMPAH_INDUK", "TPS3R"] as const)("%s dengan izin MENUNGGU → TOLAK R11", (jenis) => {
    const h = evaluasiKontrak({ yurisdiksi: "DKI", penerima: { ...menunggu, jenis } });
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ kode: "R11", aksi: "TOLAK", teks: TEKS.ATURAN_R11 });
  });
  it("TERVERIFIKASI lolos; TPA_TPST tidak terkena R-11", () => {
    expect(evaluasiKontrak({ yurisdiksi: "DKI", penerima: penerimaOk })).toEqual([]);
    expect(evaluasiKontrak({ yurisdiksi: "DKI", penerima: { ...menunggu, jenis: "TPA_TPST" } })).toEqual([]);
  });
  it("juga terjadi saat AMBIL", () => {
    const h = evaluasiAmbil({ ...dasarAmbil, penerima: menunggu, aliranSerah: ["KUNING"] });
    expect(h.map((x) => x.kode)).toContain("R11");
  });
});
