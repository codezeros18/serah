import { TEKS, type BarisLaporan } from "@serah/kontrak";
import { describe, expect, it } from "vitest";
import { PETUNJUK_PEMISAH, susunCsv, totalPerAliran } from "../laporan";
import { selAsal, susunModelLaporanPdf, susunModelLembarNeraca } from "./index";

const H = (c: string) => c.repeat(64);
const b = (kode: string, aliran: BarisLaporan["aliran"], tps: number, diterima: number, ditolak: number, status: BarisLaporan["status"] = "DITERIMA_SEBAGIAN"): BarisLaporan => ({
  tanggalWib: "2026-10-15",
  kodeSerah: kode,
  aliran,
  beratTpsG: tps,
  beratDiterimaG: diterima,
  beratDitolakG: ditolak,
  alasanTolak: ditolak > 0 ? "BASAH_KOTOR" : null,
  tpsKode: "TPS-PCS-01",
  kawasanNama: "Pasar Contoh Sejahtera",
  kawasanAlamat: "Jl. Contoh No. 1",
  pengangkutNama: "Angkut Contoh Bersih",
  plat: "B 9001 SRH",
  penerimaNama: "Daur Ulang Contoh Mandiri",
  penerimaJenis: "FASILITAS_BERIZIN",
  status,
  sidikEvent: H(kode.slice(-1)),
});

const DATA = [
  b("SRH-20261015-0002", "KUNING", 10_000, 0, 10_000, "DITOLAK"),
  b("SRH-20261015-0001", "KUNING", 20_000, 15_000, 5_000),
  b("SRH-20261015-0001", "ABU", 30_000, 30_000, 0),
  b("SRH-20261016-0003", "ABU", 1_250_500, 1_250_500, 0, "DITERIMA"),
];

describe("susunModelLaporanPdf — total & isi = CSV (S23-1)", () => {
  const total = totalPerAliran(DATA);
  const csv = susunCsv(DATA, total);
  const m = susunModelLaporanPdf("kawasan", "2026-10", DATA, total);

  it("sidik dan jumlah baris sama dengan CSV untuk pihak & periode yang sama", () => {
    expect(m.sidikIsi).toBe(csv.sidikIsi);
    expect(m.jumlahBaris).toBe(csv.jumlahBaris);
    expect(m.catatan).toBe(csv.teks.split("\r\n").filter(Boolean).at(-1)!.replace(/^"|"$/g, "").replaceAll('""', '"'));
  });

  it("baris & total identik dengan sel CSV (angka kg berkoma desimal), kolom = header CSV", () => {
    const sel = csv.teks.slice(1 + PETUNJUK_PEMISAH.length).split("\r\n").filter(Boolean).slice(0, -1).map((g) => g.split(";"));
    expect(sel[0]).toEqual([...m.kolom]);
    // Baris data tanpa sel yang berisi pemisah/kutip: perbandingan langsung.
    expect(sel.slice(1, 1 + DATA.length).map((r) => r.slice(0, 6))).toEqual(m.baris.map((r) => r.slice(0, 6)));
    expect(m.total).toEqual(sel.slice(1 + DATA.length));
    expect(m.total.map((r) => r.slice(2, 6))).toEqual([
      [TEKS.ALIRAN_KUNING, "30", "15", "15"],
      [TEKS.ALIRAN_ABU, "1.280,5", "1.280,5", "0"],
    ]);
  });

  it("judul per pihak dari teks §M; tanpa data: kolom + catatan, sidik atas header", () => {
    expect(susunModelLaporanPdf("pengangkut", "2026-10", [], []).judul).toBe(TEKS.LAPORAN_PENGANGKUT);
    expect(susunModelLaporanPdf("penerima", "2026-10", [], []).judul).toBe(TEKS.LAPORAN_PENERIMA);
    const kosong = susunModelLaporanPdf("kawasan", "2026-10", [], []);
    expect([kosong.baris, kosong.total, kosong.jumlahBaris]).toEqual([[], [], 0]);
    expect(kosong.sidikIsi).toBe(susunCsv([], []).sidikIsi);
  });

  it("satu angka berubah → sidik berubah", () => {
    const lain = susunModelLaporanPdf("kawasan", "2026-10", [{ ...DATA[0]!, beratDitolakG: 10_001 }, ...DATA.slice(1)], total);
    expect(lain.sidikIsi).not.toBe(m.sidikIsi);
  });
});

describe("susunModelLembarNeraca — setiap angka berjejak ke kode serah & status (S23-2)", () => {
  const m = susunModelLembarNeraca("2026-10", "Pasar Contoh Sejahtera", DATA);

  it("urutan HIJAU, KUNING, MERAH, ABU hanya yang ada; total = Σ asal; penjelasan & judul dari §M", () => {
    expect(m.judul).toBe(TEKS.LEMBAR_NERACA);
    expect(m.penjelasan).toBe(TEKS.LEMBAR_NERACA_PENJELASAN);
    expect(m.aliran.map((a) => a.aliran)).toEqual(["KUNING", "ABU"]);
    for (const a of m.aliran) {
      expect(a.totalTpsG).toBe(a.asal.reduce((s, x) => s + x.beratTpsG, 0));
      expect(a.totalDiterimaG).toBe(a.asal.reduce((s, x) => s + x.diterimaG, 0));
      expect(a.totalDitolakG).toBe(a.asal.reduce((s, x) => s + x.ditolakG, 0));
    }
  });

  it("angka tangan: KUNING 30/15/15 dari dua serah; ABU 1.280,5 dari dua serah; asal urut kode, dengan status", () => {
    const [kuning, abu] = m.aliran;
    expect([kuning?.totalTps, kuning?.totalDiterima, kuning?.totalDitolak]).toEqual(["30", "15", "15"]);
    expect(kuning?.asal.map((x) => [x.kodeSerah, x.statusLabel])).toEqual([
      ["SRH-20261015-0001", TEKS.STATUS_DITERIMA_SEBAGIAN],
      ["SRH-20261015-0002", TEKS.STATUS_DITOLAK],
    ]);
    expect([abu?.totalTps, abu?.totalDiterima, abu?.totalDitolak]).toEqual(["1.280,5", "1.280,5", "0"]);
    expect(abu?.asal.map((x) => x.kodeSerah)).toEqual(["SRH-20261015-0001", "SRH-20261016-0003"]);
    expect(selAsal(abu!.asal[1]!)).toEqual(["SRH-20261016-0003", "2026-10-16".replace("16", "15"), "1.250,5", "1.250,5", "0", TEKS.STATUS_DITERIMA, H("3")]);
    expect(m.jumlahSerah).toBe(3);
  });

  it("angka total lembar = total laporan (satu sumber)", () => {
    const lap = totalPerAliran(DATA);
    expect(m.aliran.map((a) => [a.aliran, a.totalTpsG, a.totalDiterimaG, a.totalDitolakG])).toEqual(
      lap.map((t) => [t.aliran, t.beratTpsG, t.beratDiterimaG, t.beratDitolakG]),
    );
  });

  it("sidik berubah bila satu angka atau satu sidik event berubah; deterministik; catatan memuat sidik", () => {
    const sama = susunModelLembarNeraca("2026-10", "Pasar Contoh Sejahtera", [...DATA].reverse());
    expect(sama.sidikIsi).toBe(m.sidikIsi);
    expect(susunModelLembarNeraca("2026-10", "Pasar Contoh Sejahtera", [{ ...DATA[1]!, beratDiterimaG: 15_001 }, ...DATA.filter((_, i) => i !== 1)]).sidikIsi).not.toBe(m.sidikIsi);
    expect(susunModelLembarNeraca("2026-10", "Pasar Contoh Sejahtera", [{ ...DATA[1]!, sidikEvent: H("e") }, ...DATA.filter((_, i) => i !== 1)]).sidikIsi).not.toBe(m.sidikIsi);
    expect(m.catatan).toContain(m.sidikIsi);
  });

  it("tanpa serah tertutup: tanpa aliran, jumlah 0", () => {
    const k = susunModelLembarNeraca("2026-09", "Pasar", []);
    expect([k.aliran, k.jumlahSerah]).toEqual([[], 0]);
  });
});
