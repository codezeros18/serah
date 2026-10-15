import type { AksiAturan, AlasanTolak, Aliran, JenisEvent, JenisFoto, KodeAturan, KodeGalat, Peran, StatusSerah, SumberTiket } from "@serah/kontrak";

// Tipe mesin status serah (BLUEPRINT §I). Murni: tanpa I/O, tanpa jam sistem.

/** Peran pencatat event. `SISTEM` untuk transisi oleh cron (R-07). */
export type PeranPelaku = Peran | "SISTEM";

export type Pelaku = {
  peran: PeranPelaku;
  /** Organisasi aktif sesi (app.org_ids). */
  orgIds: readonly string[];
};

/** Proyeksi serah saat ini (baris `serah`). */
export type SerahKini = {
  kode: string;
  status: StatusSerah;
  versi: number;
  tpsId: string;
  orgKawasanId: string;
  orgPengangkutId: string | null;
  orgPenerimaId: string | null;
  /** Aliran wadah di serah ini. */
  aliran: readonly Aliran[];
};

export type RincianTutup = {
  aliran: Aliran;
  diterimaG: number;
  ditolakG: number;
  alasan?: AlasanTolak | null;
};

export type TiketTutup = {
  beratG: number;
  nomor?: string | null;
  sumber: SumberTiket;
  fotoId?: string | null;
};

export type JenisTutup = "TUTUP_TERIMA" | "TUTUP_SEBAGIAN" | "TUTUP_TOLAK";

/** Sasaran koreksi berat. RINCIAN dipecah per kolom agar satu nilai = satu kolom. */
export type TargetKoreksiBerat = "TIKET" | "RINCIAN_DITERIMA" | "RINCIAN_DITOLAK";

export type PerubahanBerat = { target: TargetKoreksiBerat; targetId: string; nilaiFinalG: number };

export type AksiTransisi =
  | { jenis: "BUAT"; kode: string; tpsId: string; orgKawasanId: string; wadahIds: readonly string[] }
  | { jenis: "AMBIL"; fotoId: string; kendaraanId: string; penerimaId: string }
  | { jenis: "SETUJUI" }
  | { jenis: "KEMBALIKAN"; alasan: string }
  | { jenis: JenisTutup; tiket: TiketTutup | null; rincian: readonly RincianTutup[] }
  | { jenis: "TANDAI_MENGGANTUNG" }
  | { jenis: "KOREKSI_BERAT"; alasan: string; perubahan: readonly PerubahanBerat[] };

export type JenisAksiTransisi = AksiTransisi["jenis"];

export type WadahKonteks = { id: string; tpsId: string; aliran: Aliran; diSerahLain: boolean };
export type FotoKonteks = { id: string; jenis: JenisFoto; organisasiId: string; /** Hasil R-04 saat unggah. */ r04Lolos: boolean };
export type KendaraanKonteks = { id: string; organisasiId: string; aktif: boolean };
/** Hasil evaluasi core/aturan yang relevan untuk aksi ini. */
export type HasilAturanKonteks = { kode: KodeAturan; aksi: AksiAturan };
/** Nilai final (setelah koreksi sebelumnya) dari serah tertutup — untuk KOREKSI_BERAT. */
export type NilaiTertutup = {
  tiket: { id: string; beratG: number };
  rincian: readonly { id: string; aliran: Aliran; diterimaG: number; ditolakG: number; alasan: AlasanTolak | null }[];
};

export type KonteksTransisi = {
  pelaku: Pelaku;
  /** Waktu perangkat; event menyimpannya sebagai terjadi_pada. Bawaan: sekarang. */
  terjadiPada?: Date;
  wadah?: readonly WadahKonteks[];
  foto?: FotoKonteks | null;
  kendaraan?: KendaraanKonteks | null;
  aturan?: readonly HasilAturanKonteks[];
  nilaiTertutup?: NilaiTertutup | null;
};

/** Kode mesin (bukan teks pengguna) untuk diagnosis & test. */
export type SebabTransisi =
  | "STATUS_TIDAK_COCOK"
  | "PERAN"
  | "BUKAN_PIHAK"
  | "WADAH_KOSONG"
  | "WADAH_GANDA"
  | "WADAH_TIDAK_DIKENAL"
  | "WADAH_BUKAN_TPS"
  | "WADAH_SUDAH_DISERAH"
  | "FOTO_TIDAK_SAH"
  | "KENDARAAN_TIDAK_SAH"
  | "ATURAN"
  | "ALASAN_KURANG"
  | "TIKET_TIDAK_ADA"
  | "RINCIAN_ALIRAN"
  | "NILAI_TIDAK_SAH"
  | "JUMLAH_TIDAK_SAMA"
  | "DITOLAK_ADA"
  | "DITOLAK_KOSONG"
  | "DITERIMA_ADA"
  | "ALASAN_TOLAK_KURANG"
  | "R07_BELUM"
  | "PERUBAHAN_KOSONG"
  | "TARGET_TIDAK_DIKENAL"
  | "SIGMA_TIDAK_KONSISTEN";

export type GalatTransisi = {
  kode: KodeGalat;
  sebab: SebabTransisi;
  aturan?: HasilAturanKonteks;
};

export type EventBaru = {
  jenis: JenisEvent;
  peran: PeranPelaku;
  serahKode: string;
  /** Hanya string, integer, boolean, null, larik & objek — siap `kanonis()`. */
  payload: Record<string, unknown>;
  terjadiPada: Date;
  diterimaPada: Date;
};

/** Kolom proyeksi `serah` yang berubah selain status & versi. */
export type ProyeksiSerah = {
  orgPengangkutId?: string | null;
  orgPenerimaId?: string | null;
  kendaraanId?: string | null;
  aliran?: readonly Aliran[];
};

export type HasilTransisi =
  | { ok: true; statusBaru: StatusSerah; versiBaru: number; proyeksi: ProyeksiSerah; event: EventBaru }
  | { ok: false; galat: GalatTransisi };
