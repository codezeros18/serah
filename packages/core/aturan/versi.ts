import type { KodeAturan, Yurisdiksi } from "@serah/kontrak";
import { KONFIGURASI_ATURAN, type KonfigurasiAturan } from "./konfigurasi";

// Aturan berversi (CLAUDE.md §2.3, BLUEPRINT §J, FITUR F39). Murni: tanpa DB, tanpa jam sistem.
// Versi yang berlaku untuk suatu KEJADIAN = versi dengan berlaku_dari ≤ waktu kejadian (yang terbaru di antaranya).
// Versi lama tidak pernah diubah; menambah versi = baris baru (tabel catat-saja di DB).
// Waktu dibandingkan sebagai teks ISO-8601 UTC berformat sama (YYYY-MM-DDTHH:mm:ss.sssZ) — urutan teks = urutan waktu.

type KunciAmbang = keyof KonfigurasiAturan;

/** Kunci ambang yang boleh dimiliki tiap aturan; aturan tanpa ambang berisi larik kosong. */
export const KUNCI_AMBANG_ATURAN: Readonly<Record<KodeAturan, readonly KunciAmbang[]>> = {
  R01: [],
  R02: [],
  R03: [],
  R04: ["R04_AMBANG_BIT", "R04_JENDELA_HARI"],
  R05: ["R05_JAM"],
  R06: ["R06_JAM"],
  R07: ["R07_JAM"],
  R08: ["R08_BP"],
  R09: ["R09_JAM_WIB"],
  R10: ["R10_HORIZON_JAM", "R10_UMUR_JAM", "R10_BASI_JAM", "R10_KATA_HUJAN"],
  R11: [],
};

/** Rentang bilangan bulat yang sah per kunci (inklusif). */
const RENTANG: Readonly<Record<Exclude<KunciAmbang, "R10_KATA_HUJAN">, readonly [number, number]>> = {
  R04_AMBANG_BIT: [0, 64],
  R04_JENDELA_HARI: [1, 3650],
  R05_JAM: [1, 8760],
  R06_JAM: [1, 8760],
  R07_JAM: [1, 8760],
  R08_BP: [1, 10_000],
  R09_JAM_WIB: [0, 23],
  R10_HORIZON_JAM: [1, 168],
  R10_UMUR_JAM: [1, 8760],
  R10_BASI_JAM: [1, 8760],
};

export interface VersiAturan {
  readonly kode: KodeAturan;
  readonly yurisdiksi: Yurisdiksi;
  readonly versi: number;
  /** ISO-8601 UTC. */
  readonly berlakuDari: string;
  readonly ambang: Readonly<Record<string, unknown>>;
}

/**
 * Versi yang berlaku untuk (kode, yurisdiksi) pada waktu kejadian `pada` (ISO UTC): berlaku_dari ≤ pada; bila
 * beberapa, yang berlaku_dari terbaru, lalu nomor versi tertinggi. null bila belum ada versi yang berlaku.
 */
export function pilihVersi(daftar: readonly VersiAturan[], kode: KodeAturan, yurisdiksi: Yurisdiksi, pada: string): VersiAturan | null {
  let terpilih: VersiAturan | null = null;
  for (const v of daftar) {
    if (v.kode !== kode || v.yurisdiksi !== yurisdiksi || v.berlakuDari > pada) continue;
    if (!terpilih || v.berlakuDari > terpilih.berlakuDari || (v.berlakuDari === terpilih.berlakuDari && v.versi > terpilih.versi)) terpilih = v;
  }
  return terpilih;
}

export type HasilAmbang = { ok: true } | { ok: false; kunci: string; sebab: "kunci_tidak_dikenal" | "di_luar_rentang" | "bukan_bilangan_bulat" | "bukan_larik_teks" | "kunci_kurang" };

/**
 * Validasi ambang sebuah versi baru: persis kunci milik aturannya (R-10 boleh tanpa kata hujan — kontrak API hanya
 * membawa bilangan bulat), bilangan bulat dalam rentang.
 */
export function validasiAmbang(kode: KodeAturan, ambang: Readonly<Record<string, unknown>>): HasilAmbang {
  const boleh = KUNCI_AMBANG_ATURAN[kode] as readonly string[];
  for (const [kunci, nilai] of Object.entries(ambang)) {
    if (!boleh.includes(kunci)) return { ok: false, kunci, sebab: "kunci_tidak_dikenal" };
    if (kunci === "R10_KATA_HUJAN") {
      if (!Array.isArray(nilai) || nilai.length === 0 || nilai.some((x) => typeof x !== "string" || x.trim() === "")) return { ok: false, kunci, sebab: "bukan_larik_teks" };
      continue;
    }
    if (typeof nilai !== "number" || !Number.isInteger(nilai)) return { ok: false, kunci, sebab: "bukan_bilangan_bulat" };
    const [bawah, atas] = RENTANG[kunci as keyof typeof RENTANG];
    if (nilai < bawah || nilai > atas) return { ok: false, kunci, sebab: "di_luar_rentang" };
  }
  for (const kunci of boleh) {
    if (kunci !== "R10_KATA_HUJAN" && !(kunci in ambang)) return { ok: false, kunci, sebab: "kunci_kurang" };
  }
  return { ok: true };
}

/**
 * Konfigurasi evaluator untuk kejadian pada `pada`: bawaan (konfigurasi.ts) ditimpa ambang dari versi yang berlaku
 * per aturan. Nilai yang tidak sah (data rusak) diabaikan — bawaan tetap dipakai, tidak pernah menebak.
 */
export function konfigurasiPada(daftar: readonly VersiAturan[], yurisdiksi: Yurisdiksi, pada: string): KonfigurasiAturan {
  const hasil: { -readonly [K in KunciAmbang]: KonfigurasiAturan[K] } = {
    R04_AMBANG_BIT: KONFIGURASI_ATURAN.R04_AMBANG_BIT,
    R04_JENDELA_HARI: KONFIGURASI_ATURAN.R04_JENDELA_HARI,
    R05_JAM: KONFIGURASI_ATURAN.R05_JAM,
    R06_JAM: KONFIGURASI_ATURAN.R06_JAM,
    R07_JAM: KONFIGURASI_ATURAN.R07_JAM,
    R08_BP: KONFIGURASI_ATURAN.R08_BP,
    R09_JAM_WIB: KONFIGURASI_ATURAN.R09_JAM_WIB,
    R10_HORIZON_JAM: KONFIGURASI_ATURAN.R10_HORIZON_JAM,
    R10_UMUR_JAM: KONFIGURASI_ATURAN.R10_UMUR_JAM,
    R10_BASI_JAM: KONFIGURASI_ATURAN.R10_BASI_JAM,
    R10_KATA_HUJAN: [...KONFIGURASI_ATURAN.R10_KATA_HUJAN],
  };
  for (const kode of Object.keys(KUNCI_AMBANG_ATURAN) as KodeAturan[]) {
    const v = pilihVersi(daftar, kode, yurisdiksi, pada);
    if (!v) continue;
    for (const kunci of KUNCI_AMBANG_ATURAN[kode]) {
      const nilai = v.ambang[kunci];
      if (nilai === undefined) continue;
      if (kunci === "R10_KATA_HUJAN") {
        if (Array.isArray(nilai) && nilai.length > 0 && nilai.every((x) => typeof x === "string")) hasil.R10_KATA_HUJAN = [...(nilai as string[])];
        continue;
      }
      const [bawah, atas] = RENTANG[kunci];
      if (typeof nilai === "number" && Number.isInteger(nilai) && nilai >= bawah && nilai <= atas) hasil[kunci] = nilai;
    }
  }
  return hasil;
}
