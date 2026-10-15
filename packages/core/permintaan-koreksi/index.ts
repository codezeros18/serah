import type { Aliran, AlasanTolak, KeputusanPermintaan, Peran, StatusPermintaan, StatusSerah, TargetKoreksi } from "@serah/kontrak";
import { periksaKonsistensiTertutup } from "../status";

// Permintaan koreksi (FITUR F27, BLUEPRINT §G/§H). Murni: siapa boleh mengajukan/memutus target apa, dan apakah
// nilai usulan boleh diterapkan. Catatan tertutup tidak pernah diubah; DISETUJUI menambah baris koreksi baru.

/** Target yang melekat pada serah tertutup (tiket & rincian penutupan). */
export const TARGET_DARI_SERAH = ["TIKET", "RINCIAN_DITERIMA", "RINCIAN_DITOLAK"] as const satisfies readonly TargetKoreksi[];

const dariSerah = (t: TargetKoreksi): boolean => (TARGET_DARI_SERAH as readonly TargetKoreksi[]).includes(t);

export type RelasiPermintaan = {
  readonly orgKawasanId: string;
  /** Penerima pemilik serah; null untuk wadah yang belum/tidak punya penerima. */
  readonly orgPenerimaId: string | null;
};

export type KonteksPelaku = RelasiPermintaan & { readonly orgAktifId: string };

export type HasilBoleh = { ok: true } | { ok: false; sebab: "PERAN_TIDAK_BOLEH" | "BUKAN_PIHAK" };

const BOLEH: HasilBoleh = { ok: true };
const PERAN_SALAH: HasilBoleh = { ok: false, sebab: "PERAN_TIDAK_BOLEH" };
const BUKAN_PIHAK: HasilBoleh = { ok: false, sebab: "BUKAN_PIHAK" };

/** Peran yang memutus: wadah oleh pengelola kawasan; tiket/rincian oleh penerima pemilik serah. */
export function pemutusUntuk(target: TargetKoreksi): "PENGELOLA" | "PENERIMA" {
  return dariSerah(target) ? "PENERIMA" : "PENGELOLA";
}

/**
 * Mengajukan: petugas & pengelola atas target di kawasannya; penerima atas tiket/rincian serah miliknya.
 * Pengangkut dan admin tidak mengajukan (§G).
 */
export function bolehAjukan(peran: Peran, target: TargetKoreksi, k: KonteksPelaku): HasilBoleh {
  switch (peran) {
    case "PETUGAS":
    case "PENGELOLA":
      return k.orgAktifId === k.orgKawasanId ? BOLEH : BUKAN_PIHAK;
    case "PENERIMA":
      if (!dariSerah(target)) return PERAN_SALAH;
      return k.orgPenerimaId !== null && k.orgAktifId === k.orgPenerimaId ? BOLEH : BUKAN_PIHAK;
    default:
      return PERAN_SALAH;
  }
}

/** Memutus: hanya peran pemutus target, dan hanya dari organisasi pihak terkait. */
export function bolehPutus(peran: Peran, target: TargetKoreksi, k: KonteksPelaku): HasilBoleh {
  if (peran !== pemutusUntuk(target)) return PERAN_SALAH;
  const org = peran === "PENGELOLA" ? k.orgKawasanId : k.orgPenerimaId;
  return org !== null && k.orgAktifId === org ? BOLEH : BUKAN_PIHAK;
}

/** Status tidak disimpan: tanpa baris putusan = DIAJUKAN. */
export function statusPermintaan(putusan: KeputusanPermintaan | null): StatusPermintaan {
  return putusan ?? "DIAJUKAN";
}

export type DataTutup = {
  readonly status: StatusSerah;
  readonly tiketG: number;
  readonly rincian: readonly {
    readonly id: string;
    readonly aliran: Aliran;
    readonly diterimaG: number;
    readonly ditolakG: number;
    readonly alasan: AlasanTolak | null;
  }[];
};

export type SebabPenerapan = "NILAI_TIDAK_SAH" | "NILAI_SAMA" | "TARGET_TIDAK_DIKENAL" | "SIGMA_TIDAK_KONSISTEN" | "ALASAN_TOLAK_KURANG";

export type HasilPenerapan =
  | {
      ok: true;
      /** Σ status tertutup tetap konsisten bila nilai ini diterapkan; null bila tidak berlaku (wadah). */
      sigmaKonsisten: boolean | null;
    }
  | { ok: false; sebab: SebabPenerapan };

/**
 * Apakah nilai usulan boleh menjadi nilai final. Berlaku saat mengajukan dan sekali lagi saat disetujui
 * (nilai final bisa berubah di antaranya).
 *
 * Satu permintaan = satu nilai, sedangkan Σ status tertutup (tiket = diterima + ditolak) mengikat beberapa nilai
 * sekaligus; satu nilai tunggal hampir tidak pernah menjaga Σ. Karena itu Σ TIDAK memblokir secara bawaan:
 * hasilnya dilaporkan di `sigmaKonsisten` dan dicatat di event (jejak audit). `ketat: true` menolaknya
 * (SIGMA_TIDAK_KONSISTEN) bila kelak diputuskan demikian.
 */
export function periksaPenerapan(m: {
  jenis: TargetKoreksi;
  targetId?: string;
  nilaiFinalG: number;
  nilaiUsulanG: number;
  tutup?: DataTutup;
  ketat?: boolean;
}): HasilPenerapan {
  if (!Number.isSafeInteger(m.nilaiUsulanG) || m.nilaiUsulanG < 0) return { ok: false, sebab: "NILAI_TIDAK_SAH" };
  if (m.nilaiUsulanG === m.nilaiFinalG) return { ok: false, sebab: "NILAI_SAMA" };
  if (!dariSerah(m.jenis)) return { ok: true, sigmaKonsisten: null };

  const t = m.tutup;
  if (!t) return { ok: false, sebab: "TARGET_TIDAK_DIKENAL" };
  let tiketG = t.tiketG;
  const rincian = t.rincian.map((r) => ({ ...r }));
  if (m.jenis === "TIKET") {
    tiketG = m.nilaiUsulanG;
  } else {
    const baris = rincian.find((r) => r.id === m.targetId);
    if (!baris) return { ok: false, sebab: "TARGET_TIDAK_DIKENAL" };
    if (m.jenis === "RINCIAN_DITERIMA") baris.diterimaG = m.nilaiUsulanG;
    else {
      // Berat ditolak tanpa alasan baku tidak boleh lahir dari koreksi, apa pun status tertutupnya (laporan K3
      // mengelompokkan per alasan).
      if (m.nilaiUsulanG > 0 && baris.alasan === null) return { ok: false, sebab: "ALASAN_TOLAK_KURANG" };
      baris.ditolakG = m.nilaiUsulanG;
    }
  }
  const sebab = periksaKonsistensiTertutup(t.status, tiketG, rincian);
  // Baris yang ditolak tanpa alasan baku tidak boleh lahir dari koreksi, terlepas dari mode Σ.
  if (sebab === "ALASAN_TOLAK_KURANG") return { ok: false, sebab: "ALASAN_TOLAK_KURANG" };
  if (sebab && m.ketat) return { ok: false, sebab: "SIGMA_TIDAK_KONSISTEN" };
  return { ok: true, sigmaKonsisten: sebab === null };
}
