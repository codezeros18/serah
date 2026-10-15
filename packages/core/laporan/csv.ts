import { TEKS, isi, type BarisLaporan } from "@serah/kontrak";
import { formatGramKeKg } from "../angka";
import { sha256Hex } from "../rantai";
import type { TotalAliran } from "./index";

// CSV laporan (BLUEPRINT §K.2): UTF-8 BOM, pemisah ";", angka kg berkoma desimal (formatGramKeKg), header KOL_*,
// baris catatan EKSPOR_CATATAN di akhir berisi sidik SHA-256 atas isi TANPA baris catatan.
//
// Cara memeriksa sidik dari berkas: buang BOM, buang baris terakhir (catatan), hitung SHA-256 atas sisanya
// (UTF-8, setiap baris diakhiri CRLF) → hex huruf kecil = nilai "Sidik berkas" pada catatan & header X-Sidik-Isi.

export const BOM_UTF8 = "﻿";
export const PEMISAH_CSV = ";";
export const AKHIR_BARIS_CSV = "\r\n";

export type HasilCsv = {
  /** Isi berkas lengkap (dengan BOM dan baris catatan). */
  teks: string;
  /** SHA-256 hex atas isi tanpa BOM dan tanpa baris catatan. */
  sidikIsi: string;
  /** Jumlah baris data (tanpa header, total, dan catatan). */
  jumlahBaris: number;
};

/**
 * Sel teks: awalan = + - @ tab CR diberi apostrof agar tidak dijalankan sebagai rumus oleh Excel/LibreOffice
 * (nama kawasan & alamat diisi pengguna); lalu dikutip bila memuat pemisah, kutip, atau baris baru.
 */
function sel(nilai: string): string {
  const aman = /^[=+\-@\t\r]/.test(nilai) ? `'${nilai}` : nilai;
  return /[;"\r\n]/.test(aman) ? `"${aman.replaceAll('"', '""')}"` : aman;
}

const kg = (g: number) => formatGramKeKg(g);
const baris = (sel_: readonly string[]) => sel_.join(PEMISAH_CSV) + AKHIR_BARIS_CSV;

const HEADER = [
  TEKS.KOL_TANGGAL,
  TEKS.KOL_KODE_SERAH,
  TEKS.KOL_ALIRAN,
  TEKS.KOL_BERAT_TPS,
  TEKS.KOL_BERAT_DITERIMA,
  TEKS.KOL_BERAT_DITOLAK,
  TEKS.KOL_ALASAN,
  TEKS.KOL_LOKASI,
  TEKS.KOL_PENGANGKUT,
  TEKS.KOL_PLAT,
  TEKS.KOL_TUJUAN,
  TEKS.KOL_STATUS,
  TEKS.KOL_SIDIK,
] as const;

export function susunCsv(data: readonly BarisLaporan[], total: readonly TotalAliran[]): HasilCsv {
  let isiCsv = baris(HEADER.map(sel));

  for (const b of data) {
    isiCsv += baris([
      sel(b.tanggalWib),
      sel(b.kodeSerah),
      sel(TEKS[`ALIRAN_${b.aliran}`]),
      kg(b.beratTpsG),
      kg(b.beratDiterimaG),
      kg(b.beratDitolakG),
      sel(b.alasanTolak ? TEKS[`ALASAN_${b.alasanTolak}`] : ""),
      sel(`${b.tpsKode}, ${b.kawasanNama}, ${b.kawasanAlamat}`),
      sel(b.pengangkutNama ?? ""),
      sel(b.plat ?? ""),
      sel(b.penerimaNama ? `${b.penerimaNama}${b.penerimaJenis ? ` (${TEKS[`JENIS_PENERIMA_${b.penerimaJenis}`]})` : ""}` : ""),
      sel(TEKS[`STATUS_${b.status}`]),
      sel(b.sidikEvent),
    ]);
  }

  // Total (Ps. 23(3) huruf d) dari baris yang sama.
  for (const t of total) {
    isiCsv += baris([
      sel(TEKS.LAPORAN_TOTAL),
      "",
      sel(TEKS[`ALIRAN_${t.aliran}`]),
      kg(t.beratTpsG),
      kg(t.beratDiterimaG),
      kg(t.beratDitolakG),
      ...Array<string>(HEADER.length - 6).fill(""),
    ]);
  }

  const sidikIsi = sha256Hex(isiCsv);
  const catatan = sel(isi("EKSPOR_CATATAN", { sidik_isi: sidikIsi })) + AKHIR_BARIS_CSV;
  return { teks: BOM_UTF8 + isiCsv + catatan, sidikIsi, jumlahBaris: data.length };
}
