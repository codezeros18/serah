import { z } from "zod";

// Semua enum model data (§H.2) + enum pendukung kolom tabel (§H.3) dan rute (§K.2).
// Pola: daftar `as const` → skema zod → tipe.

export const ALIRAN = ["HIJAU", "KUNING", "MERAH", "ABU"] as const;
export const Aliran = z.enum(ALIRAN);
export type Aliran = z.infer<typeof Aliran>;

export const PERAN = ["PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA", "ADMIN"] as const;
export const Peran = z.enum(PERAN);
export type Peran = z.infer<typeof Peran>;

/** Peran pada event rantai: peran manusia + SISTEM (cron, mis. TANDAI_MENGGANTUNG). */
export const PERAN_EVENT = [...PERAN, "SISTEM"] as const;
export const PeranEvent = z.enum(PERAN_EVENT);
export type PeranEvent = z.infer<typeof PeranEvent>;

export const JENIS_ORGANISASI =["KAWASAN", "PENGANGKUT", "PENERIMA", "INTERNAL"] as const;
export const JenisOrganisasi = z.enum(JENIS_ORGANISASI);
export type JenisOrganisasi = z.infer<typeof JenisOrganisasi>;

export const JENIS_KAWASAN = ["KOMERSIAL", "PERMUKIMAN"] as const;
export const JenisKawasan = z.enum(JENIS_KAWASAN);
export type JenisKawasan = z.infer<typeof JenisKawasan>;

export const JENIS_PENERIMA = ["FASILITAS_BERIZIN", "TPS3R", "BANK_SAMPAH_INDUK", "PELAPAK_BERIZIN", "TPA_TPST"] as const;
export const JenisPenerima = z.enum(JENIS_PENERIMA);
export type JenisPenerima = z.infer<typeof JenisPenerima>;

export const STATUS_IZIN = ["BELUM_DIAJUKAN", "MENUNGGU", "TERVERIFIKASI", "DITOLAK"] as const;
export const StatusIzin = z.enum(STATUS_IZIN);
export type StatusIzin = z.infer<typeof StatusIzin>;

export const STATUS_SERAH = [
  "DRAF",
  "MENUNGGU_SETUJU",
  "DIANGKUT",
  "DITERIMA",
  "DITERIMA_SEBAGIAN",
  "DITOLAK",
  "MENGGANTUNG",
] as const;
export const StatusSerah = z.enum(STATUS_SERAH);
export type StatusSerah = z.infer<typeof StatusSerah>;

export const STATUS_KONTRAK = ["USULAN", "AKTIF", "BERAKHIR", "DIBATALKAN"] as const;
export const StatusKontrak = z.enum(STATUS_KONTRAK);
export type StatusKontrak = z.infer<typeof StatusKontrak>;

export const JENIS_FOTO = ["MUATAN", "TIKET", "BUKTI_TRANSFER", "DOKUMEN_IZIN"] as const;
export const JenisFoto = z.enum(JENIS_FOTO);
export type JenisFoto = z.infer<typeof JenisFoto>;

export const SUMBER_TIKET = ["AI_DIKONFIRMASI", "AI_DIKOREKSI", "MANUAL"] as const;
export const SumberTiket = z.enum(SUMBER_TIKET);
export type SumberTiket = z.infer<typeof SumberTiket>;

export const ALASAN_TOLAK = ["TERCAMPUR_ORGANIK", "BASAH_KOTOR", "JENIS_TIDAK_SESUAI", "RESIDU_BERLEBIH", "LAINNYA"] as const;
export const AlasanTolak = z.enum(ALASAN_TOLAK);
export type AlasanTolak = z.infer<typeof AlasanTolak>;

export const JENIS_EVENT = [
  "SERAH_DIBUAT",
  "SERAH_DIAMBIL",
  "SERAH_DISETUJUI",
  "SERAH_DIKEMBALIKAN",
  "SERAH_DITERIMA",
  "SERAH_DITERIMA_SEBAGIAN",
  "SERAH_DITOLAK",
  "SERAH_MENGGANTUNG",
  "KOREKSI_BERAT",
  "PERMINTAAN_KOREKSI_DIAJUKAN",
  "PERMINTAAN_KOREKSI_DISETUJUI",
  "PERMINTAAN_KOREKSI_DITOLAK",
  "WADAH_DICATAT",
] as const;
export const JenisEvent = z.enum(JENIS_EVENT);
export type JenisEvent = z.infer<typeof JenisEvent>;

export const AKSI_ATURAN = ["TOLAK", "PERINGATAN", "PRIORITAS", "STATUS"] as const;
export const AksiAturan = z.enum(AKSI_ATURAN);
export type AksiAturan = z.infer<typeof AksiAturan>;

export const KODE_ATURAN = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11"] as const;
export const KodeAturan = z.enum(KODE_ATURAN);
export type KodeAturan = z.infer<typeof KodeAturan>;

export const SUMBER_CUACA = ["PRAKIRAAN", "NOWCAST"] as const;
export const SumberCuaca = z.enum(SUMBER_CUACA);
export type SumberCuaca = z.infer<typeof SumberCuaca>;

export const MODE_DATA = ["LIVE", "SNAPSHOT"] as const;
export const ModeData = z.enum(MODE_DATA);
export type ModeData = z.infer<typeof ModeData>;

export const STATUS_LANGGANAN = ["UJI_COBA", "AKTIF", "MENUNGGAK", "BERAKHIR"] as const;
export const StatusLangganan = z.enum(STATUS_LANGGANAN);
export type StatusLangganan = z.infer<typeof StatusLangganan>;

export const STATUS_TAGIHAN = ["TERBIT", "MENUNGGU_KONFIRMASI", "LUNAS", "KEDALUWARSA", "DIBATALKAN"] as const;
export const StatusTagihan = z.enum(STATUS_TAGIHAN);
export type StatusTagihan = z.infer<typeof StatusTagihan>;

export const PENYEDIA = ["MIDTRANS", "MANUAL"] as const;
export const Penyedia = z.enum(PENYEDIA);
export type Penyedia = z.infer<typeof Penyedia>;

export const STATUS_PERMINTAAN = ["DIAJUKAN", "DISETUJUI", "DITOLAK"] as const;
export const StatusPermintaan = z.enum(STATUS_PERMINTAAN);
export type StatusPermintaan = z.infer<typeof StatusPermintaan>;

export const JENIS_NOTIFIKASI = [
  "SERAH_MENUNGGU_SETUJU",
  "SERAH_DIANGKUT",
  "SERAH_DITUTUP",
  "SERAH_MENGGANTUNG",
  "PRIORITAS_ANGKUT",
  "WADAH_LEWAT_BATAS",
  "CATATAN_HARIAN_BELUM",
  "KONTRAK_PERLU_KONFIRMASI",
  "PERMINTAAN_KOREKSI",
  "IZIN_DIPUTUS",
  "TAGIHAN_TERBIT",
  "UJI_COBA_BERAKHIR",
] as const;
export const JenisNotifikasi = z.enum(JENIS_NOTIFIKASI);
export type JenisNotifikasi = z.infer<typeof JenisNotifikasi>;

// ── Pendukung kolom tabel (§H.3) ────────────────────────────────────────────

export const JENIS_TOKEN_SEKALI = ["VERIFIKASI_EMAIL", "RESET_SANDI", "UNDANGAN"] as const;
export const JenisTokenSekali = z.enum(JENIS_TOKEN_SEKALI);
export type JenisTokenSekali = z.infer<typeof JenisTokenSekali>;

export const JENIS_PERSETUJUAN = ["LAYANAN", "TARIK"] as const;
export const JenisPersetujuan = z.enum(JENIS_PERSETUJUAN);
export type JenisPersetujuan = z.infer<typeof JenisPersetujuan>;

export const YURISDIKSI = ["DKI", "NASIONAL"] as const;
export const Yurisdiksi = z.enum(YURISDIKSI);
export type Yurisdiksi = z.infer<typeof Yurisdiksi>;

export const KEPUTUSAN_IZIN = ["TERVERIFIKASI", "DITOLAK"] as const;
export const KeputusanIzin = z.enum(KEPUTUSAN_IZIN);
export type KeputusanIzin = z.infer<typeof KeputusanIzin>;

export const KEYAKINAN_AI = ["TINGGI", "SEDANG", "RENDAH"] as const;
export const KeyakinanAi = z.enum(KEYAKINAN_AI);
export type KeyakinanAi = z.infer<typeof KeyakinanAi>;

/** RINCIAN dipecah per kolom: satu baris koreksi = satu nilai (keputusan pemilik S08). */
export const TARGET_KOREKSI = ["WADAH", "TIKET", "RINCIAN_DITERIMA", "RINCIAN_DITOLAK"] as const;
export const TargetKoreksi = z.enum(TARGET_KOREKSI);
export type TargetKoreksi = z.infer<typeof TargetKoreksi>;

export const KEPUTUSAN_PERMINTAAN = ["DISETUJUI", "DITOLAK"] as const;
export const KeputusanPermintaan = z.enum(KEPUTUSAN_PERMINTAAN);
export type KeputusanPermintaan = z.infer<typeof KeputusanPermintaan>;

export const PIHAK_EKSPOR = ["KAWASAN", "PENGANGKUT", "PENERIMA", "LEMBAR_NERACA"] as const;
export const PihakEkspor = z.enum(PIHAK_EKSPOR);
export type PihakEkspor = z.infer<typeof PihakEkspor>;

export const FORMAT_EKSPOR = ["CSV", "PDF"] as const;
export const FormatEkspor = z.enum(FORMAT_EKSPOR);
export type FormatEkspor = z.infer<typeof FormatEkspor>;

export const KEPUTUSAN_KONFIRMASI = ["SETUJUI", "TOLAK"] as const;
export const KeputusanKonfirmasi = z.enum(KEPUTUSAN_KONFIRMASI);
export type KeputusanKonfirmasi = z.infer<typeof KeputusanKonfirmasi>;

// ── Pendukung rute (§K.2) ───────────────────────────────────────────────────

/** Segmen `[pihak]` di /api/laporan/[pihak]. */
export const PIHAK_LAPORAN = ["kawasan", "pengangkut", "penerima"] as const;
export const PihakLaporan = z.enum(PIHAK_LAPORAN);
export type PihakLaporan = z.infer<typeof PihakLaporan>;

/** Hasil per aksi di /api/sinkron. */
export const STATUS_SINKRON = ["DITERAPKAN", "DUPLIKAT", "DITOLAK"] as const;
export const StatusSinkron = z.enum(STATUS_SINKRON);
export type StatusSinkron = z.infer<typeof StatusSinkron>;

/** Jenis aksi lapangan yang boleh masuk antrean offline (T1/T2/A2/P1). */
export const JENIS_AKSI_SINKRON = ["WADAH_CATAT", "SERAH_BUAT", "SERAH_AMBIL", "SERAH_TUTUP"] as const;
export const JenisAksiSinkron = z.enum(JENIS_AKSI_SINKRON);
export type JenisAksiSinkron = z.infer<typeof JenisAksiSinkron>;
