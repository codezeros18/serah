import { createHash } from "node:crypto";
import { TEKS, isi, type BarisLaporan } from "@serah/kontrak";
import { describe, expect, it } from "vitest";
import { susunCsv, totalPerAliran } from "./index";

const HASH = "f".repeat(64);
const dasar: BarisLaporan = {
  tanggalWib: "2026-10-15",
  kodeSerah: "SRH-20261015-0001",
  aliran: "KUNING",
  beratTpsG: 1_250_500,
  beratDiterimaG: 1_000_000,
  beratDitolakG: 250_500,
  alasanTolak: "TERCAMPUR_ORGANIK",
  tpsKode: "TPS-PCS-01",
  kawasanNama: "Pasar Contoh Sejahtera",
  kawasanAlamat: "Jl. Contoh No. 1",
  pengangkutNama: "Angkut Contoh Bersih",
  plat: "B 9001 SRH",
  penerimaNama: "Daur Ulang Contoh Mandiri",
  penerimaJenis: "FASILITAS_BERIZIN",
  status: "DITERIMA_SEBAGIAN",
  sidikEvent: HASH,
};
const baris2: BarisLaporan = { ...dasar, kodeSerah: "SRH-20261015-0002", aliran: "ABU", beratTpsG: 42_500, beratDiterimaG: 42_500, beratDitolakG: 0, alasanTolak: null, status: "DITERIMA" };

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Urai CSV sederhana (pemisah ';', kutip ganda, CRLF) — tanpa pustaka, independen dari penyusun. */
function urai(teks: string): string[][] {
  const hasil: string[][] = [];
  let baris: string[] = [];
  let sel = "";
  let dalamKutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]!;
    if (dalamKutip) {
      if (c === '"' && teks[i + 1] === '"') {
        sel += '"';
        i++;
      } else if (c === '"') dalamKutip = false;
      else sel += c;
    } else if (c === '"') dalamKutip = true;
    else if (c === ";") {
      baris.push(sel);
      sel = "";
    } else if (c === "\r" && teks[i + 1] === "\n") {
      baris.push(sel);
      hasil.push(baris);
      baris = [];
      sel = "";
      i++;
    } else sel += c;
  }
  return hasil;
}

const buat = (data: BarisLaporan[]) => susunCsv(data, totalPerAliran(data));

describe("susunCsv — bentuk berkas", () => {
  const h = buat([dasar, baris2]);

  it("diawali BOM UTF-8; setiap baris diakhiri CRLF", () => {
    expect(h.teks.charCodeAt(0)).toBe(0xfeff);
    expect(h.teks.endsWith("\r\n")).toBe(true);
    expect(h.teks.replaceAll("\r\n", "").includes("\n")).toBe(false);
  });

  it("header = kolom KOL_* berurutan; 13 sel pada setiap baris", () => {
    const b = urai(h.teks.slice(1));
    expect(b[0]).toEqual([
      TEKS.KOL_TANGGAL, TEKS.KOL_KODE_SERAH, TEKS.KOL_ALIRAN, TEKS.KOL_BERAT_TPS, TEKS.KOL_BERAT_DITERIMA, TEKS.KOL_BERAT_DITOLAK,
      TEKS.KOL_ALASAN, TEKS.KOL_LOKASI, TEKS.KOL_PENGANGKUT, TEKS.KOL_PLAT, TEKS.KOL_TUJUAN, TEKS.KOL_STATUS, TEKS.KOL_SIDIK,
    ]);
    for (const baris of b.slice(0, -1)) expect(baris).toHaveLength(13);
  });

  it("baris data: kg berkoma desimal dengan titik ribuan, label dari teks.ts", () => {
    const b = urai(h.teks.slice(1));
    expect(b[1]).toEqual([
      "2026-10-15",
      "SRH-20261015-0001",
      TEKS.ALIRAN_KUNING,
      "1.250,5",
      "1.000",
      "250,5",
      TEKS.ALASAN_TERCAMPUR_ORGANIK,
      "TPS-PCS-01, Pasar Contoh Sejahtera, Jl. Contoh No. 1",
      "Angkut Contoh Bersih",
      "B 9001 SRH",
      `Daur Ulang Contoh Mandiri (${TEKS.JENIS_PENERIMA_FASILITAS_BERIZIN})`,
      TEKS.STATUS_DITERIMA_SEBAGIAN,
      HASH,
    ]);
    expect(b[2]?.slice(3, 7)).toEqual(["42,5", "42,5", "0", ""]);
  });

  it("total per aliran (huruf d) menyusul setelah baris data, dari baris yang sama", () => {
    const b = urai(h.teks.slice(1));
    expect(b[3]).toEqual([TEKS.LAPORAN_TOTAL, "", TEKS.ALIRAN_KUNING, "1.250,5", "1.000", "250,5", "", "", "", "", "", "", ""]);
    expect(b[4]).toEqual([TEKS.LAPORAN_TOTAL, "", TEKS.ALIRAN_ABU, "42,5", "42,5", "0", "", "", "", "", "", "", ""]);
  });

  it("jumlahBaris = baris data saja (tanpa header, total, catatan)", () => {
    expect(h.jumlahBaris).toBe(2);
  });
});

describe("susunCsv — sidik isi & catatan", () => {
  it("baris terakhir = EKSPOR_CATATAN berisi sidik; sidik = SHA-256 atas isi tanpa BOM & tanpa baris catatan", () => {
    const h = buat([dasar, baris2]);
    const tanpaBom = h.teks.slice(1);
    const akhir = tanpaBom.slice(0, -2).lastIndexOf("\r\n") + 2; // awal baris catatan
    const isiTanpaCatatan = tanpaBom.slice(0, akhir);
    const catatan = tanpaBom.slice(akhir, -2);
    expect(h.sidikIsi).toBe(sha(isiTanpaCatatan));
    expect(h.sidikIsi).toMatch(/^[0-9a-f]{64}$/);
    expect(catatan).toBe(isi("EKSPOR_CATATAN", { sidik_isi: h.sidikIsi }));
  });

  it("mengubah satu angka mengubah sidik; masukan sama → sidik sama (deterministik)", () => {
    const a = buat([dasar]);
    expect(buat([dasar]).sidikIsi).toBe(a.sidikIsi);
    expect(buat([{ ...dasar, beratDitolakG: 250_501 }]).sidikIsi).not.toBe(a.sidikIsi);
  });

  it("tanpa data: header + catatan saja; sidik atas header", () => {
    const h = susunCsv([], []);
    const b = urai(h.teks.slice(1));
    expect(b).toHaveLength(2);
    expect(h.jumlahBaris).toBe(0);
    const header = h.teks.slice(1, h.teks.indexOf("\r\n") + 2);
    expect(h.sidikIsi).toBe(sha(header));
  });
});

describe("susunCsv — keamanan sel", () => {
  it("sel berawalan = + - @ diberi apostrof agar tidak dijalankan sebagai rumus", () => {
    for (const awal of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
      const h = buat([{ ...dasar, kawasanNama: awal, pengangkutNama: awal, penerimaNama: awal }]);
      const b = urai(h.teks.slice(1));
      expect(b[1]?.[8]?.startsWith("'")).toBe(true);
      expect(b[1]?.[8]?.slice(1)).toBe(awal);
      expect(b[1]?.[7]?.includes(`, '${awal}`) ?? false).toBe(false); // awalan di tengah sel tidak berbahaya
    }
  });

  it("nama berisi pemisah, kutip, dan baris baru dikutip benar dan terbaca utuh", () => {
    const nama = 'Pasar "Contoh"; Sejahtera\nBlok A';
    const h = buat([{ ...dasar, kawasanNama: nama, pengangkutNama: nama }]);
    const b = urai(h.teks.slice(1));
    expect(b[1]).toHaveLength(13);
    expect(b[1]?.[8]).toBe(nama);
    expect(b[1]?.[7]).toBe(`TPS-PCS-01, ${nama}, Jl. Contoh No. 1`);
  });

  it("nilai kosong (tanpa alasan/pengangkut/plat/penerima) menjadi sel kosong", () => {
    const h = buat([{ ...dasar, alasanTolak: null, pengangkutNama: null, plat: null, penerimaNama: null, penerimaJenis: null }]);
    const b = urai(h.teks.slice(1));
    expect([b[1]?.[6], b[1]?.[8], b[1]?.[9], b[1]?.[10]]).toEqual(["", "", "", ""]);
  });
});
