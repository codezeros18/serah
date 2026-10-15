import type { AlasanTolak, Aliran, JenisPenerima, PihakLaporan, StatusSerah } from "@serah/kontrak";

// Data masukan tiga laporan (BLUEPRINT §L.4). Murni: tanpa DB. Nilai berat sudah nilai FINAL (setelah koreksi,
// dari v_nilai_final); nilai asli tidak pernah dibaca di sini.

/** Serah dianggap tertutup bila status ini (DITOLAK = tertutup dengan penolakan penuh). */
export const STATUS_TERTUTUP = ["DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"] as const satisfies readonly StatusSerah[];
export type StatusTertutup = (typeof STATUS_TERTUTUP)[number];

export type AliranTertutup = {
  aliran: Aliran;
  /** Σ berat final wadah aliran ini di serah. Wadah tanpa berat tidak ditebak: dihitung 0. */
  beratTpsG: number;
  diterimaG: number;
  ditolakG: number;
  alasan: AlasanTolak | null;
};

export type SerahTertutup = {
  kode: string;
  status: StatusSerah;
  /** Waktu server event penutupan (SERAH_DITERIMA / _SEBAGIAN / SERAH_DITOLAK). */
  ditutupPada: Date;
  /** Sidik event terakhir serah ini (penutupan atau koreksi sesudahnya). */
  sidikEvent: string;
  kawasanId: string;
  orgKawasanId: string;
  orgPengangkutId: string | null;
  orgPenerimaId: string | null;
  tpsKode: string;
  kawasanNama: string;
  kawasanAlamat: string;
  pengangkutNama: string | null;
  plat: string | null;
  penerimaNama: string | null;
  penerimaJenis: JenisPenerima | null;
  aliran: readonly AliranTertutup[];
};

/**
 * Filter laporan: serah di mana organisasi `organisasiId` menempati kolom pihak `jenis`.
 * `kawasanId` (opsional) membatasi ke satu kawasan.
 */
export type FilterPihak = {
  jenis: PihakLaporan;
  organisasiId: string;
  kawasanId?: string | undefined;
};
