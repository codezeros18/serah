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

/** Kolom tabel laporan (Ps. 23(3)); dipakai CSV dan PDF agar keduanya identik. */
export const HEADER_TABEL = [
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

/** Sel mentah (tanpa kutip/penangkal rumus) satu baris laporan. */
export function selBaris(b: BarisLaporan): string[] {
  return [
    b.tanggalWib,
    b.kodeSerah,
    TEKS[`ALIRAN_${b.aliran}`],
    kg(b.beratTpsG),
    kg(b.beratDiterimaG),
    kg(b.beratDitolakG),
    b.alasanTolak ? TEKS[`ALASAN_${b.alasanTolak}`] : "",
    `${b.tpsKode}, ${b.kawasanNama}, ${b.kawasanAlamat}`,
    b.pengangkutNama ?? "",
    b.plat ?? "",
    b.penerimaNama ? `${b.penerimaNama}${b.penerimaJenis ? ` (${TEKS[`JENIS_PENERIMA_${b.penerimaJenis}`]})` : ""}` : "",
    TEKS[`STATUS_${b.status}`],
    b.sidikEvent,
  ];
}

/** Sel mentah satu baris total per aliran (Ps. 23(3) huruf d). */
export function selTotal(t: TotalAliran): string[] {
  return [TEKS.LAPORAN_TOTAL, "", TEKS[`ALIRAN_${t.aliran}`], kg(t.beratTpsG), kg(t.beratDiterimaG), kg(t.beratDitolakG), ...Array<string>(HEADER_TABEL.length - 6).fill("")];
}

/**
 * Isi CSV tanpa BOM dan tanpa baris catatan (CRLF per baris) — satu-satunya dasar sidik. PDF memakai sidik yang sama
 * untuk periode & pihak yang sama, sehingga totalnya terbukti sama dengan CSV.
 */
export function isiCsvTanpaCatatan(data: readonly BarisLaporan[], total: readonly TotalAliran[]): string {
  let isiCsv = baris(HEADER_TABEL.map(sel));
  for (const b of data) isiCsv += baris(selBaris(b).map(sel));
  for (const t of total) isiCsv += baris(selTotal(t).map(sel));
  return isiCsv;
}

export function susunCsv(data: readonly BarisLaporan[], total: readonly TotalAliran[]): HasilCsv {
  const isiCsv = isiCsvTanpaCatatan(data, total);
  const sidikIsi = sha256Hex(isiCsv);
  const catatan = sel(isi("EKSPOR_CATATAN", { sidik_isi: sidikIsi })) + AKHIR_BARIS_CSV;
  return { teks: BOM_UTF8 + isiCsv + catatan, sidikIsi, jumlahBaris: data.length };
}
