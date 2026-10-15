import type { Aliran, AlasanTolak } from "@serah/kontrak/enum";
import { parseBeratKgKeGram } from "./angka";

// Logika murni layar P1 (tutup serah). Hanya string → gram integer & penjumlahan integer untuk
// pratinjau pada layar; server tetap menghitung ulang & memutuskan (CLAUDE.md §2.1).

export type IsianRincian = {
  aliran: Aliran;
  /** Teks mentah kg dari pengguna. Kosong = 0. */
  diterima: string;
  ditolak: string;
  alasan: AlasanTolak | "";
  keterangan: string;
};

/** Teks kg → gram; kosong atau "0" = 0; tidak sah = null. */
export function beratAtauNol(teks: string): number | null {
  const t = teks.trim();
  if (t === "" || /^0+([.,]0+)?$/.test(t)) return 0;
  return parseBeratKgKeGram(t);
}

export type AksiTutup = "TERIMA" | "SEBAGIAN" | "TOLAK";

export type RingkasanRincian = {
  /** Semua angka sah. */
  sah: boolean;
  diterimaG: number;
  ditolakG: number;
  jumlahG: number;
  /** jumlah == berat tiket */
  sama: boolean;
  /** Setiap aliran yang ditolak punya alasan (dan keterangan untuk LAINNYA). */
  alasanLengkap: boolean;
  aksi: AksiTutup | null;
};

export function ringkasRincian(isian: readonly IsianRincian[], beratTiketG: number | null): RingkasanRincian {
  let sah = true;
  let diterimaG = 0;
  let ditolakG = 0;
  let alasanLengkap = true;
  for (const r of isian) {
    const d = beratAtauNol(r.diterima);
    const t = beratAtauNol(r.ditolak);
    if (d === null || t === null) {
      sah = false;
      continue;
    }
    diterimaG += d;
    ditolakG += t;
    if (t > 0 && (r.alasan === "" || (r.alasan === "LAINNYA" && r.keterangan.trim() === ""))) alasanLengkap = false;
  }
  const jumlahG = diterimaG + ditolakG;
  const sama = sah && beratTiketG !== null && jumlahG === beratTiketG;
  const aksi: AksiTutup | null = !sah || jumlahG === 0 ? null : ditolakG === 0 ? "TERIMA" : diterimaG === 0 ? "TOLAK" : "SEBAGIAN";
  return { sah, diterimaG, ditolakG, jumlahG, sama, alasanLengkap, aksi };
}
