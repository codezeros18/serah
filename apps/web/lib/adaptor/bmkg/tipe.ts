import type { ModeData } from "@serah/kontrak";

// Tipe & konstanta adaptor BMKG (BLUEPRINT §O.1, §O.2). Kosakata mentah BMKG berhenti di folder ini.

export type TitikE6 = readonly [latE6: number, lonE6: number];

export interface SlotMentah {
  slotUtc: Date;
  weatherDesc: string;
  weatherDescEn: string | null;
}

export interface PrakiraanMentah {
  adm4: string;
  analysisDate: Date;
  mode: ModeData;
  slot: SlotMentah[];
}

export interface ItemDaftarNowcast {
  /** URL detail CAP. */
  url: string;
  /** Kode berkas, mis. "CKR20261015003". */
  kode: string;
  judul: string;
  /** Nama provinsi dari judul ("… di Kep. Riau" → "Kep. Riau"); null bila tak terbaca. */
  provinsi: string | null;
}

export interface NowcastMentah {
  identifierCap: string;
  provinsi: string;
  event: string;
  headline: string;
  deskripsi: string;
  effective: Date;
  expires: Date;
  /** Satu cincin per elemen `<polygon>` CAP; titik dalam salah satu cincin = tercakup. */
  poligonE6: TitikE6[][];
}

export interface SumberCuaca {
  /** Melempar GalatBmkg bila gagal (tanpa data karangan). */
  prakiraan(adm4: string): Promise<PrakiraanMentah>;
  daftarNowcast(): Promise<ItemDaftarNowcast[]>;
  detailNowcast(url: string): Promise<NowcastMentah>;
  /** Detail semua peringatan provinsi yang diminta (huruf besar-kecil diabaikan). Gagal → melempar. */
  nowcast(provinsi: readonly string[]): Promise<NowcastMentah[]>;
}

export type SebabGalatBmkg = "TIMEOUT" | "HTTP" | "JARINGAN" | "FORMAT" | "SNAPSHOT_TIDAK_ADA" | "BATAS_ANTREAN";

/** Dipetakan ke kode galat kontrak BMKG_TIDAK_TERSEDIA oleh pemanggil. */
export class GalatBmkg extends Error {
  readonly kode = "BMKG_TIDAK_TERSEDIA" as const;
  constructor(
    readonly sebab: SebabGalatBmkg,
    pesan: string,
  ) {
    super(pesan);
    this.name = "GalatBmkg";
  }
}

/** Kunci teks atribusi yang wajib tampil di layar bersama data BMKG (teks ada di `teks.ts`). */
export const KUNCI_ATRIBUSI_BMKG = "BMKG_ATRIBUSI" as const;

export const SUMBER_BMKG = {
  prakiraan: "https://api.bmkg.go.id/publik/prakiraan-cuaca",
  daftarNowcast: "https://www.bmkg.go.id/alerts/nowcast/id",
  halamanData: "https://data.bmkg.go.id/",
} as const;

export const POLA_ADM4 = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;
