import { ALIRAN, TEKS, isi, type Aliran, type BarisLaporan, type PihakLaporan, type StatusSerah } from "@serah/kontrak";
import { formatGramKeKg } from "../angka";
import { HEADER_TABEL, isiCsvTanpaCatatan, selBaris, selTotal } from "../laporan/csv";
import type { TotalAliran } from "../laporan";
import { sha256Hex } from "../rantai";

// Model data PDF (S23). Murni: semua angka, label, urutan, dan sidik disusun di sini; renderer (@react-pdf/renderer
// di server) hanya menggambar. Tidak ada hitungan di renderer, sehingga PDF tidak bisa berbeda dari CSV.

// ── Laporan (tiga pihak) ───────────────────────────────────────────────────

export type ModelPdfLaporan = {
  judul: string;
  pihak: PihakLaporan;
  periode: string;
  kolom: readonly string[];
  baris: string[][];
  total: string[][];
  catatan: string;
  /** SHA-256 isi tabel — SAMA dengan sidik CSV untuk pihak & periode yang sama. */
  sidikIsi: string;
  jumlahBaris: number;
};

const JUDUL_PIHAK: Record<PihakLaporan, string> = {
  kawasan: TEKS.LAPORAN_KAWASAN,
  pengangkut: TEKS.LAPORAN_PENGANGKUT,
  penerima: TEKS.LAPORAN_PENERIMA,
};

/** Kolom, baris, total, dan catatan identik dengan CSV (sel yang sama dari core/laporan). */
export function susunModelLaporanPdf(pihak: PihakLaporan, periode: string, data: readonly BarisLaporan[], total: readonly TotalAliran[]): ModelPdfLaporan {
  const sidikIsi = sha256Hex(isiCsvTanpaCatatan(data, total));
  return {
    judul: JUDUL_PIHAK[pihak],
    pihak,
    periode,
    kolom: HEADER_TABEL,
    baris: data.map(selBaris),
    total: total.map(selTotal),
    catatan: isi("EKSPOR_CATATAN", { sidik_isi: sidikIsi }),
    sidikIsi,
    jumlahBaris: data.length,
  };
}

// ── Lembar Neraca Bulanan (berjejak asal) ──────────────────────────────────

export type AsalAngka = {
  kodeSerah: string;
  status: StatusSerah;
  statusLabel: string;
  tanggalWib: string;
  beratTpsG: number;
  diterimaG: number;
  ditolakG: number;
  sidikEvent: string;
};

export type BarisLembar = {
  aliran: Aliran;
  label: string;
  totalTpsG: number;
  totalDiterimaG: number;
  totalDitolakG: number;
  /** Teks siap tampil (kg, koma desimal). */
  totalTps: string;
  totalDiterima: string;
  totalDitolak: string;
  /** Setiap angka di atas = Σ daftar ini. Urut menurut kode serah. */
  asal: AsalAngka[];
};

export type ModelLembarNeraca = {
  judul: string;
  penjelasan: string;
  periode: string;
  kawasanNama: string;
  aliran: BarisLembar[];
  kolomAsal: readonly string[];
  jumlahSerah: number;
  catatan: string;
  sidikIsi: string;
};

/**
 * Dari baris laporan kawasan (susunBaris) — angkanya selalu sama dengan laporan & CSV. Hanya aliran yang punya
 * serah tertutup pada periode; setiap total menyertakan daftar serah asalnya beserta statusnya.
 */
export function susunModelLembarNeraca(periode: string, kawasanNama: string, data: readonly BarisLaporan[]): ModelLembarNeraca {
  const aliran: BarisLembar[] = [];
  for (const a of ALIRAN) {
    const asal = data
      .filter((b) => b.aliran === a)
      .map<AsalAngka>((b) => ({
        kodeSerah: b.kodeSerah,
        status: b.status,
        statusLabel: TEKS[`STATUS_${b.status}`],
        tanggalWib: b.tanggalWib,
        beratTpsG: b.beratTpsG,
        diterimaG: b.beratDiterimaG,
        ditolakG: b.beratDitolakG,
        sidikEvent: b.sidikEvent,
      }))
      .sort((x, y) => (x.kodeSerah < y.kodeSerah ? -1 : x.kodeSerah > y.kodeSerah ? 1 : 0));
    if (asal.length === 0) continue;
    const totalTpsG = asal.reduce((s, x) => s + x.beratTpsG, 0);
    const totalDiterimaG = asal.reduce((s, x) => s + x.diterimaG, 0);
    const totalDitolakG = asal.reduce((s, x) => s + x.ditolakG, 0);
    aliran.push({
      aliran: a,
      label: TEKS[`ALIRAN_${a}`],
      totalTpsG,
      totalDiterimaG,
      totalDitolakG,
      totalTps: formatGramKeKg(totalTpsG),
      totalDiterima: formatGramKeKg(totalDiterimaG),
      totalDitolak: formatGramKeKg(totalDitolakG),
      asal,
    });
  }

  // Sidik atas jejak lengkap (aliran, serah, angka, status, sidik event) — berubah bila satu angka berubah.
  const jejak = aliran
    .flatMap((b) => b.asal.map((x) => [b.aliran, x.kodeSerah, x.beratTpsG, x.diterimaG, x.ditolakG, x.status, x.sidikEvent].join("|")))
    .join("\n");
  const sidikIsi = sha256Hex(`${periode}|${kawasanNama}\n${jejak}`);
  return {
    judul: TEKS.LEMBAR_NERACA,
    penjelasan: TEKS.LEMBAR_NERACA_PENJELASAN,
    periode,
    kawasanNama,
    aliran,
    kolomAsal: [TEKS.KOL_KODE_SERAH, TEKS.KOL_TANGGAL, TEKS.KOL_BERAT_TPS, TEKS.KOL_BERAT_DITERIMA, TEKS.KOL_BERAT_DITOLAK, TEKS.KOL_STATUS, TEKS.KOL_SIDIK],
    jumlahSerah: new Set(data.map((b) => b.kodeSerah)).size,
    catatan: isi("EKSPOR_CATATAN", { sidik_isi: sidikIsi }),
    sidikIsi,
  };
}

/** Sel tabel asal angka (teks siap tampil). */
export function selAsal(x: AsalAngka): string[] {
  return [x.kodeSerah, x.tanggalWib, formatGramKeKg(x.beratTpsG), formatGramKeKg(x.diterimaG), formatGramKeKg(x.ditolakG), x.statusLabel, x.sidikEvent];
}
