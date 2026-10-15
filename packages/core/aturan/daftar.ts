import type { AksiAturan, KodeAturan, KunciTeks, Yurisdiksi } from "@serah/kontrak";

// Aturan adalah data (CLAUDE.md §2.3). Yurisdiksi NASIONAL hanya mengaktifkan aturan
// tanpa pasal Pergub (BLUEPRINT §J): R-04, R-07, R-08, R-10.

export interface DefinisiAturan {
  readonly kode: KodeAturan;
  /** Rujukan yang ditampilkan lewat ATURAN_RUJUKAN. */
  readonly sumber: string;
  /** Rujukan di yurisdiksi NASIONAL bila berbeda (tanpa kutipan pasal Pergub). */
  readonly sumberNasional?: string;
  readonly aksi: AksiAturan;
  readonly yurisdiksi: readonly Yurisdiksi[];
  /** Kunci teks utama (R-10 punya dua varian di evaluator). */
  readonly kunciTeks: KunciTeks;
}

const PERGUB = "Pergub DKI Jakarta Nomor 102 Tahun 2021";
const DKI: readonly Yurisdiksi[] = ["DKI"];
const SEMUA: readonly Yurisdiksi[] = ["DKI", "NASIONAL"];

export const DAFTAR_ATURAN: readonly DefinisiAturan[] = [
  { kode: "R01", sumber: `${PERGUB} Pasal 20 ayat (2) huruf d`, aksi: "TOLAK", yurisdiksi: DKI, kunciTeks: "ATURAN_R01" },
  { kode: "R02", sumber: `${PERGUB} Pasal 20 ayat (2) huruf b`, aksi: "TOLAK", yurisdiksi: DKI, kunciTeks: "ATURAN_R02" },
  { kode: "R03", sumber: `${PERGUB} Pasal 19 ayat (2) huruf c`, aksi: "TOLAK", yurisdiksi: DKI, kunciTeks: "ATURAN_R03" },
  { kode: "R04", sumber: "Integritas bukti", aksi: "TOLAK", yurisdiksi: SEMUA, kunciTeks: "ATURAN_R04" },
  { kode: "R05", sumber: `${PERGUB} Pasal 8 ayat (1) huruf g`, aksi: "PERINGATAN", yurisdiksi: DKI, kunciTeks: "ATURAN_R05" },
  { kode: "R06", sumber: `${PERGUB} Pasal 8 ayat (1) huruf h`, aksi: "PERINGATAN", yurisdiksi: DKI, kunciTeks: "ATURAN_R06" },
  { kode: "R07", sumber: "Integritas serah", aksi: "STATUS", yurisdiksi: SEMUA, kunciTeks: "ATURAN_R07" },
  { kode: "R08", sumber: "Integritas berat", aksi: "PERINGATAN", yurisdiksi: SEMUA, kunciTeks: "ATURAN_R08" },
  { kode: "R09", sumber: `${PERGUB} Pasal 13 ayat (4) huruf a`, aksi: "PERINGATAN", yurisdiksi: DKI, kunciTeks: "ATURAN_R09" },
  {
    kode: "R10",
    sumber: `Data BMKG; ${PERGUB} Pasal 8`,
    sumberNasional: "Data BMKG",
    aksi: "PRIORITAS",
    yurisdiksi: SEMUA,
    kunciTeks: "ATURAN_R10_PRAKIRAAN",
  },
  { kode: "R11", sumber: `${PERGUB} Pasal 1 angka 21`, aksi: "TOLAK", yurisdiksi: DKI, kunciTeks: "ATURAN_R11" },
];

const PETA = new Map(DAFTAR_ATURAN.map((a) => [a.kode, a] as const));

export function definisiAturan(kode: KodeAturan): DefinisiAturan {
  const d = PETA.get(kode);
  if (!d) throw new Error(`Aturan ${kode} tidak ada di daftar`);
  return d;
}

export function aturanAktif(kode: KodeAturan, yurisdiksi: Yurisdiksi): boolean {
  return definisiAturan(kode).yurisdiksi.includes(yurisdiksi);
}

export function sumberAturan(kode: KodeAturan, yurisdiksi: Yurisdiksi): string {
  const d = definisiAturan(kode);
  return yurisdiksi === "NASIONAL" && d.sumberNasional ? d.sumberNasional : d.sumber;
}
