-- CreateEnum
CREATE TYPE "Aliran" AS ENUM ('HIJAU', 'KUNING', 'MERAH', 'ABU');

-- CreateEnum
CREATE TYPE "Peran" AS ENUM ('PETUGAS', 'PENGELOLA', 'PENGANGKUT', 'PENERIMA', 'ADMIN');

-- CreateEnum
CREATE TYPE "JenisOrganisasi" AS ENUM ('KAWASAN', 'PENGANGKUT', 'PENERIMA', 'INTERNAL');

-- CreateEnum
CREATE TYPE "JenisKawasan" AS ENUM ('KOMERSIAL', 'PERMUKIMAN');

-- CreateEnum
CREATE TYPE "JenisPenerima" AS ENUM ('FASILITAS_BERIZIN', 'TPS3R', 'BANK_SAMPAH_INDUK', 'PELAPAK_BERIZIN', 'TPA_TPST');

-- CreateEnum
CREATE TYPE "StatusIzin" AS ENUM ('BELUM_DIAJUKAN', 'MENUNGGU', 'TERVERIFIKASI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "StatusSerah" AS ENUM ('DRAF', 'MENUNGGU_SETUJU', 'DIANGKUT', 'DITERIMA', 'DITERIMA_SEBAGIAN', 'DITOLAK', 'MENGGANTUNG');

-- CreateEnum
CREATE TYPE "StatusKontrak" AS ENUM ('USULAN', 'AKTIF', 'BERAKHIR', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "JenisFoto" AS ENUM ('MUATAN', 'TIKET', 'BUKTI_TRANSFER', 'DOKUMEN_IZIN');

-- CreateEnum
CREATE TYPE "SumberTiket" AS ENUM ('AI_DIKONFIRMASI', 'AI_DIKOREKSI', 'MANUAL');

-- CreateEnum
CREATE TYPE "AlasanTolak" AS ENUM ('TERCAMPUR_ORGANIK', 'BASAH_KOTOR', 'JENIS_TIDAK_SESUAI', 'RESIDU_BERLEBIH', 'LAINNYA');

-- CreateEnum
CREATE TYPE "JenisEvent" AS ENUM ('SERAH_DIBUAT', 'SERAH_DIAMBIL', 'SERAH_DISETUJUI', 'SERAH_DIKEMBALIKAN', 'SERAH_DITERIMA', 'SERAH_DITERIMA_SEBAGIAN', 'SERAH_DITOLAK', 'SERAH_MENGGANTUNG', 'KOREKSI_BERAT', 'PERMINTAAN_KOREKSI_DIAJUKAN', 'PERMINTAAN_KOREKSI_DISETUJUI', 'PERMINTAAN_KOREKSI_DITOLAK', 'WADAH_DICATAT');

-- CreateEnum
CREATE TYPE "AksiAturan" AS ENUM ('TOLAK', 'PERINGATAN', 'PRIORITAS', 'STATUS');

-- CreateEnum
CREATE TYPE "KodeAturan" AS ENUM ('R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11');

-- CreateEnum
CREATE TYPE "SumberCuaca" AS ENUM ('PRAKIRAAN', 'NOWCAST');

-- CreateEnum
CREATE TYPE "ModeData" AS ENUM ('LIVE', 'SNAPSHOT');

-- CreateEnum
CREATE TYPE "StatusLangganan" AS ENUM ('UJI_COBA', 'AKTIF', 'MENUNGGAK', 'BERAKHIR');

-- CreateEnum
CREATE TYPE "StatusTagihan" AS ENUM ('TERBIT', 'MENUNGGU_KONFIRMASI', 'LUNAS', 'KEDALUWARSA', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "Penyedia" AS ENUM ('MIDTRANS', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusPermintaan" AS ENUM ('DIAJUKAN', 'DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "JenisNotifikasi" AS ENUM ('SERAH_MENUNGGU_SETUJU', 'SERAH_DIANGKUT', 'SERAH_DITUTUP', 'SERAH_MENGGANTUNG', 'PRIORITAS_ANGKUT', 'WADAH_LEWAT_BATAS', 'CATATAN_HARIAN_BELUM', 'KONTRAK_PERLU_KONFIRMASI', 'PERMINTAAN_KOREKSI', 'IZIN_DIPUTUS', 'TAGIHAN_TERBIT', 'UJI_COBA_BERAKHIR');

-- CreateEnum
CREATE TYPE "JenisTokenSekali" AS ENUM ('VERIFIKASI_EMAIL', 'RESET_SANDI', 'UNDANGAN');

-- CreateEnum
CREATE TYPE "JenisPersetujuan" AS ENUM ('LAYANAN', 'TARIK');

-- CreateEnum
CREATE TYPE "Yurisdiksi" AS ENUM ('DKI', 'NASIONAL');

-- CreateEnum
CREATE TYPE "KeputusanIzin" AS ENUM ('TERVERIFIKASI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "KeyakinanAi" AS ENUM ('TINGGI', 'SEDANG', 'RENDAH');

-- CreateEnum
CREATE TYPE "TargetKoreksi" AS ENUM ('WADAH', 'TIKET', 'RINCIAN');

-- CreateEnum
CREATE TYPE "KeputusanPermintaan" AS ENUM ('DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "PihakEkspor" AS ENUM ('KAWASAN', 'PENGANGKUT', 'PENERIMA', 'LEMBAR_NERACA');

-- CreateEnum
CREATE TYPE "FormatEkspor" AS ENUM ('CSV', 'PDF');

-- CreateEnum
CREATE TYPE "KeputusanKonfirmasi" AS ENUM ('SETUJUI', 'TOLAK');

-- CreateTable
CREATE TABLE "pengguna" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "sandi_hash" TEXT,
    "email_terverifikasi_pada" TIMESTAMPTZ(3),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dihapus_pada" TIMESTAMPTZ(3),

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesi" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "organisasi_aktif_id" TEXT,
    "peran_aktif" "Peran",
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kedaluwarsa_pada" TIMESTAMPTZ(3) NOT NULL,
    "dicabut_pada" TIMESTAMPTZ(3),

    CONSTRAINT "sesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_sekali" (
    "id" TEXT NOT NULL,
    "jenis" "JenisTokenSekali" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "pengguna_id" TEXT,
    "organisasi_id" TEXT,
    "peran" "Peran",
    "email_tujuan_hash" CHAR(64) NOT NULL,
    "kedaluwarsa_pada" TIMESTAMPTZ(3) NOT NULL,
    "dipakai_pada" TIMESTAMPTZ(3),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_sekali_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teks_persetujuan" (
    "versi" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "berlaku_dari" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teks_persetujuan_pkey" PRIMARY KEY ("versi")
);

-- CreateTable
CREATE TABLE "persetujuan_pdp" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "versi" TEXT NOT NULL,
    "jenis" "JenisPersetujuan" NOT NULL,
    "pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persetujuan_pdp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisasi" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" "JenisOrganisasi" NOT NULL,
    "jenis_penerima" "JenisPenerima",
    "aliran_diterima" "Aliran"[],
    "nomor_izin" TEXT,
    "status_izin" "StatusIzin" NOT NULL DEFAULT 'BELUM_DIAJUKAN',
    "yurisdiksi" "Yurisdiksi" NOT NULL DEFAULT 'DKI',
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keanggotaan" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "peran" "Peran" NOT NULL,
    "pengurus" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keanggotaan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "izin_putusan" (
    "id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "nomor_izin" TEXT NOT NULL,
    "keputusan" "KeputusanIzin" NOT NULL,
    "alasan" TEXT NOT NULL,
    "foto_id" TEXT,
    "diputus_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "izin_putusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kawasan" (
    "id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" "JenisKawasan" NOT NULL,
    "alamat" TEXT NOT NULL,
    "adm4" TEXT NOT NULL,
    "kode_kecamatan" TEXT,
    "nama_kelurahan" TEXT,
    "nama_kecamatan" TEXT,
    "kota" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kawasan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tps" (
    "id" TEXT NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "lat_e6" INTEGER NOT NULL,
    "lon_e6" INTEGER NOT NULL,
    "qr_token_hash" CHAR(64) NOT NULL,
    "qr_versi" INTEGER NOT NULL DEFAULT 1,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kendaraan" (
    "id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "plat" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kendaraan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontrak" (
    "id" TEXT NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "org_pengangkut_id" TEXT NOT NULL,
    "org_penerima_id" TEXT NOT NULL,
    "aliran" "Aliran"[],
    "berlaku_dari" DATE NOT NULL,
    "berlaku_sampai" DATE NOT NULL,
    "tarif_per_rit_idr" INTEGER,
    "tarif_per_kg_idr" INTEGER,
    "status" "StatusKontrak" NOT NULL DEFAULT 'USULAN',
    "dikonfirmasi_pengangkut_pada" TIMESTAMPTZ(3),
    "dikonfirmasi_penerima_pada" TIMESTAMPTZ(3),
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kontrak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wadah_catat" (
    "id" TEXT NOT NULL,
    "tps_id" TEXT NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "aliran" "Aliran" NOT NULL,
    "berat_g" INTEGER,
    "jumlah_wadah" INTEGER,
    "terjadi_pada" TIMESTAMPTZ(3) NOT NULL,
    "diterima_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,
    "offline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "wadah_catat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serah" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "tps_id" TEXT NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "org_pengangkut_id" TEXT,
    "org_penerima_id" TEXT,
    "kontrak_id" TEXT,
    "kendaraan_id" TEXT,
    "status" "StatusSerah" NOT NULL DEFAULT 'DRAF',
    "versi" INTEGER NOT NULL DEFAULT 0,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diperbarui_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serah_wadah" (
    "serah_id" TEXT NOT NULL,
    "wadah_catat_id" TEXT NOT NULL,

    CONSTRAINT "serah_wadah_pkey" PRIMARY KEY ("serah_id","wadah_catat_id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "urutan" BIGSERIAL NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "urutan_rantai" INTEGER NOT NULL,
    "serah_id" TEXT,
    "org_kawasan_id" TEXT NOT NULL,
    "org_pengangkut_id" TEXT,
    "org_penerima_id" TEXT,
    "jenis" "JenisEvent" NOT NULL,
    "peran" "Peran",
    "payload" JSONB NOT NULL,
    "prev_hash" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "terjadi_pada" TIMESTAMPTZ(3) NOT NULL,
    "diterima_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foto" (
    "id" TEXT NOT NULL,
    "jenis" "JenisFoto" NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "serah_id" TEXT,
    "object_key" TEXT NOT NULL,
    "dhash" CHAR(16) NOT NULL,
    "ukuran_byte" INTEGER NOT NULL,
    "lebar" INTEGER NOT NULL,
    "tinggi" INTEGER NOT NULL,
    "diambil_pada" TIMESTAMPTZ(3),
    "diterima_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dihapus_retensi_pada" TIMESTAMPTZ(3),

    CONSTRAINT "foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiket_timbang" (
    "id" TEXT NOT NULL,
    "serah_id" TEXT NOT NULL,
    "foto_id" TEXT,
    "nomor" TEXT,
    "berat_g" INTEGER NOT NULL,
    "sumber" "SumberTiket" NOT NULL,
    "ai_model" TEXT,
    "ai_keyakinan" "KeyakinanAi",
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiket_timbang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penutupan_rincian" (
    "id" TEXT NOT NULL,
    "serah_id" TEXT NOT NULL,
    "aliran" "Aliran" NOT NULL,
    "diterima_g" INTEGER NOT NULL,
    "ditolak_g" INTEGER NOT NULL,
    "alasan" "AlasanTolak",
    "keterangan" TEXT,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penutupan_rincian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "koreksi" (
    "id" TEXT NOT NULL,
    "target_jenis" "TargetKoreksi" NOT NULL,
    "target_id" TEXT NOT NULL,
    "serah_id" TEXT,
    "kawasan_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "nilai_asli_g" INTEGER NOT NULL,
    "nilai_final_g" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL,
    "peran" "Peran" NOT NULL,
    "permintaan_id" TEXT,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "koreksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permintaan_koreksi" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "target_jenis" "TargetKoreksi" NOT NULL,
    "target_id" TEXT NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "org_penerima_id" TEXT,
    "nilai_usulan_g" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL,
    "peran_pengaju" "Peran" NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permintaan_koreksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permintaan_koreksi_putusan" (
    "id" TEXT NOT NULL,
    "permintaan_id" TEXT NOT NULL,
    "keputusan" "KeputusanPermintaan" NOT NULL,
    "alasan" TEXT NOT NULL,
    "peran" "Peran" NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permintaan_koreksi_putusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aturan_versi" (
    "id" TEXT NOT NULL,
    "kode" "KodeAturan" NOT NULL,
    "yurisdiksi" "Yurisdiksi" NOT NULL,
    "versi" INTEGER NOT NULL,
    "sumber" TEXT NOT NULL,
    "aksi" "AksiAturan" NOT NULL,
    "ambang" JSONB NOT NULL,
    "kunci_teks" TEXT NOT NULL,
    "berlaku_dari" TIMESTAMPTZ(3) NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aturan_versi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prakiraan_cuaca" (
    "id" TEXT NOT NULL,
    "adm4" TEXT NOT NULL,
    "analysis_date" TIMESTAMPTZ(3) NOT NULL,
    "slot_utc" TIMESTAMPTZ(3) NOT NULL,
    "weather_desc" TEXT NOT NULL,
    "weather_desc_en" TEXT,
    "mode" "ModeData" NOT NULL,
    "diambil_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prakiraan_cuaca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peringatan_cuaca" (
    "id" TEXT NOT NULL,
    "identifier_cap" TEXT NOT NULL,
    "provinsi" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "effective" TIMESTAMPTZ(3) NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,
    "poligon_e6" JSONB NOT NULL,
    "diambil_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peringatan_cuaca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prioritas_tercatat" (
    "id" TEXT NOT NULL,
    "tps_id" TEXT NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "sumber" "SumberCuaca" NOT NULL,
    "acuan" TEXT NOT NULL,
    "weather_desc" TEXT NOT NULL,
    "aliran" "Aliran" NOT NULL,
    "umur_jam" INTEGER NOT NULL,
    "ditetapkan_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prioritas_tercatat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harga_material" (
    "id" TEXT NOT NULL,
    "kunci" TEXT NOT NULL,
    "aliran" "Aliran" NOT NULL,
    "harga_bersih_idr_per_kg" INTEGER NOT NULL,
    "harga_kotor_idr_per_kg" INTEGER,
    "sumber_kode" TEXT NOT NULL,
    "tanggal_sumber" TEXT,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harga_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alasan_tolak" (
    "kode" "AlasanTolak" NOT NULL,
    "urutan" INTEGER NOT NULL,

    CONSTRAINT "alasan_tolak_pkey" PRIMARY KEY ("kode")
);

-- CreateTable
CREATE TABLE "notifikasi" (
    "id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "peran_tujuan" "Peran"[],
    "jenis" "JenisNotifikasi" NOT NULL,
    "objek_kode" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifikasi_dibaca" (
    "notifikasi_id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "dibaca_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_dibaca_pkey" PRIMARY KEY ("notifikasi_id","pengguna_id")
);

-- CreateTable
CREATE TABLE "langganan_push" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "langganan_push_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferensi_notifikasi" (
    "pengguna_id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preferensi_notifikasi_pkey" PRIMARY KEY ("pengguna_id","organisasi_id")
);

-- CreateTable
CREATE TABLE "ekspor" (
    "id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "pihak" "PihakEkspor" NOT NULL,
    "periode" TEXT NOT NULL,
    "format" "FormatEkspor" NOT NULL,
    "sidik_isi" CHAR(64) NOT NULL,
    "jumlah_baris" INTEGER NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ekspor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bayangan_entri" (
    "id" TEXT NOT NULL,
    "kawasan_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "aliran" "Aliran" NOT NULL,
    "berat_g" INTEGER NOT NULL,
    "sumber_catatan" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bayangan_entri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tagihan_angkut" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "kontrak_id" TEXT NOT NULL,
    "org_kawasan_id" TEXT NOT NULL,
    "org_pengangkut_id" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "rit_tertutup" INTEGER NOT NULL,
    "kg_diterima_g" INTEGER NOT NULL,
    "total_idr" INTEGER NOT NULL,
    "rincian" JSONB NOT NULL,
    "diterbitkan_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tagihan_angkut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paket" (
    "kode" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "harga_per_tps_idr" INTEGER NOT NULL,
    "berlaku_untuk" "JenisOrganisasi" NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "paket_pkey" PRIMARY KEY ("kode")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "paket_kode" TEXT NOT NULL,
    "kunci" TEXT NOT NULL,
    "nilai" JSONB NOT NULL,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("paket_kode","kunci")
);

-- CreateTable
CREATE TABLE "perubahan_paket" (
    "id" TEXT NOT NULL,
    "paket_kode" TEXT NOT NULL,
    "kunci" TEXT,
    "nilai_lama" JSONB,
    "nilai_baru" JSONB NOT NULL,
    "alasan" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perubahan_paket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "langganan" (
    "id" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "paket_kode" TEXT NOT NULL,
    "status" "StatusLangganan" NOT NULL,
    "uji_coba_mulai" TIMESTAMPTZ(3),
    "uji_coba_selesai" TIMESTAMPTZ(3),
    "harga_dibekukan_per_tps_idr" INTEGER,
    "periode_berjalan" TEXT,
    "diperbarui_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "langganan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peristiwa_langganan" (
    "id" TEXT NOT NULL,
    "langganan_id" TEXT NOT NULL,
    "dari" "StatusLangganan",
    "ke" "StatusLangganan" NOT NULL,
    "sebab" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peristiwa_langganan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tagihan" (
    "id" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    "organisasi_id" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "jumlah_tps" INTEGER NOT NULL,
    "harga_per_tps_idr" INTEGER NOT NULL,
    "total_idr" INTEGER NOT NULL,
    "status" "StatusTagihan" NOT NULL DEFAULT 'TERBIT',
    "jatuh_tempo" DATE NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tagihan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peristiwa_bayar" (
    "id" TEXT NOT NULL,
    "penyedia" "Penyedia" NOT NULL,
    "kunci_peristiwa" TEXT NOT NULL,
    "tagihan_id" TEXT,
    "jenis" TEXT NOT NULL,
    "jumlah_idr" INTEGER,
    "payload" JSONB NOT NULL,
    "terverifikasi" BOOLEAN NOT NULL,
    "diterima_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peristiwa_bayar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "konfirmasi_manual" (
    "id" TEXT NOT NULL,
    "tagihan_id" TEXT NOT NULL,
    "foto_bukti_id" TEXT,
    "keputusan" "KeputusanKonfirmasi" NOT NULL,
    "alasan" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "konfirmasi_manual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "organisasi_id" TEXT,
    "peran" "Peran",
    "aksi" TEXT NOT NULL,
    "objek_jenis" TEXT NOT NULL,
    "objek_id" TEXT NOT NULL,
    "alasan" TEXT,
    "data" JSONB NOT NULL,
    "dibuat_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batas_laju" (
    "kunci" TEXT NOT NULL,
    "jendela_mulai" TIMESTAMPTZ(3) NOT NULL,
    "hitungan" INTEGER NOT NULL,

    CONSTRAINT "batas_laju_pkey" PRIMARY KEY ("kunci","jendela_mulai")
);

-- CreateTable
CREATE TABLE "pekerjaan_cron" (
    "nama" TEXT NOT NULL,
    "jendela" TEXT NOT NULL,
    "mulai_pada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selesai_pada" TIMESTAMPTZ(3),
    "hasil" JSONB,

    CONSTRAINT "pekerjaan_cron_pkey" PRIMARY KEY ("nama","jendela")
);

-- CreateTable
CREATE TABLE "penomoran" (
    "jenis" TEXT NOT NULL,
    "tanggal_atau_periode" TEXT NOT NULL,
    "nomor_terakhir" INTEGER NOT NULL,

    CONSTRAINT "penomoran_pkey" PRIMARY KEY ("jenis","tanggal_atau_periode")
);

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sesi_token_hash_key" ON "sesi"("token_hash");

-- CreateIndex
CREATE INDEX "sesi_pengguna_id_idx" ON "sesi"("pengguna_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_sekali_token_hash_key" ON "token_sekali"("token_hash");

-- CreateIndex
CREATE INDEX "persetujuan_pdp_pengguna_id_idx" ON "persetujuan_pdp"("pengguna_id");

-- CreateIndex
CREATE UNIQUE INDEX "organisasi_kode_key" ON "organisasi"("kode");

-- CreateIndex
CREATE INDEX "keanggotaan_organisasi_id_idx" ON "keanggotaan"("organisasi_id");

-- CreateIndex
CREATE UNIQUE INDEX "keanggotaan_pengguna_id_organisasi_id_peran_key" ON "keanggotaan"("pengguna_id", "organisasi_id", "peran");

-- CreateIndex
CREATE UNIQUE INDEX "kawasan_kode_key" ON "kawasan"("kode");

-- CreateIndex
CREATE INDEX "kawasan_organisasi_id_idx" ON "kawasan"("organisasi_id");

-- CreateIndex
CREATE UNIQUE INDEX "tps_kode_key" ON "tps"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "tps_qr_token_hash_key" ON "tps"("qr_token_hash");

-- CreateIndex
CREATE INDEX "tps_kawasan_id_idx" ON "tps"("kawasan_id");

-- CreateIndex
CREATE UNIQUE INDEX "kendaraan_organisasi_id_plat_key" ON "kendaraan"("organisasi_id", "plat");

-- CreateIndex
CREATE INDEX "kontrak_kawasan_id_idx" ON "kontrak"("kawasan_id");

-- CreateIndex
CREATE INDEX "kontrak_org_pengangkut_id_idx" ON "kontrak"("org_pengangkut_id");

-- CreateIndex
CREATE INDEX "kontrak_org_penerima_id_idx" ON "kontrak"("org_penerima_id");

-- CreateIndex
CREATE UNIQUE INDEX "wadah_catat_idempotency_key_key" ON "wadah_catat"("idempotency_key");

-- CreateIndex
CREATE INDEX "wadah_catat_tps_id_diterima_pada_idx" ON "wadah_catat"("tps_id", "diterima_pada");

-- CreateIndex
CREATE INDEX "wadah_catat_org_kawasan_id_idx" ON "wadah_catat"("org_kawasan_id");

-- CreateIndex
CREATE UNIQUE INDEX "serah_kode_key" ON "serah"("kode");

-- CreateIndex
CREATE INDEX "serah_kawasan_id_status_idx" ON "serah"("kawasan_id", "status");

-- CreateIndex
CREATE INDEX "serah_org_pengangkut_id_status_idx" ON "serah"("org_pengangkut_id", "status");

-- CreateIndex
CREATE INDEX "serah_org_penerima_id_status_idx" ON "serah"("org_penerima_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "serah_wadah_wadah_catat_id_key" ON "serah_wadah"("wadah_catat_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_urutan_key" ON "event"("urutan");

-- CreateIndex
CREATE UNIQUE INDEX "event_idempotency_key_key" ON "event"("idempotency_key");

-- CreateIndex
CREATE INDEX "event_serah_id_idx" ON "event"("serah_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_kawasan_id_urutan_rantai_key" ON "event"("kawasan_id", "urutan_rantai");

-- CreateIndex
CREATE INDEX "foto_organisasi_id_jenis_diterima_pada_idx" ON "foto"("organisasi_id", "jenis", "diterima_pada");

-- CreateIndex
CREATE INDEX "foto_serah_id_idx" ON "foto"("serah_id");

-- CreateIndex
CREATE INDEX "tiket_timbang_serah_id_idx" ON "tiket_timbang"("serah_id");

-- CreateIndex
CREATE UNIQUE INDEX "penutupan_rincian_serah_id_aliran_key" ON "penutupan_rincian"("serah_id", "aliran");

-- CreateIndex
CREATE INDEX "koreksi_target_jenis_target_id_idx" ON "koreksi"("target_jenis", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "permintaan_koreksi_kode_key" ON "permintaan_koreksi"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "permintaan_koreksi_putusan_permintaan_id_key" ON "permintaan_koreksi_putusan"("permintaan_id");

-- CreateIndex
CREATE UNIQUE INDEX "aturan_versi_kode_yurisdiksi_versi_key" ON "aturan_versi"("kode", "yurisdiksi", "versi");

-- CreateIndex
CREATE UNIQUE INDEX "prakiraan_cuaca_adm4_analysis_date_slot_utc_key" ON "prakiraan_cuaca"("adm4", "analysis_date", "slot_utc");

-- CreateIndex
CREATE UNIQUE INDEX "peringatan_cuaca_identifier_cap_key" ON "peringatan_cuaca"("identifier_cap");

-- CreateIndex
CREATE INDEX "prioritas_tercatat_kawasan_id_ditetapkan_pada_idx" ON "prioritas_tercatat"("kawasan_id", "ditetapkan_pada");

-- CreateIndex
CREATE INDEX "notifikasi_organisasi_id_dibuat_pada_idx" ON "notifikasi"("organisasi_id", "dibuat_pada");

-- CreateIndex
CREATE UNIQUE INDEX "langganan_push_endpoint_key" ON "langganan_push"("endpoint");

-- CreateIndex
CREATE INDEX "bayangan_entri_kawasan_id_periode_idx" ON "bayangan_entri"("kawasan_id", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "tagihan_angkut_kode_key" ON "tagihan_angkut"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "langganan_organisasi_id_key" ON "langganan"("organisasi_id");

-- CreateIndex
CREATE UNIQUE INDEX "tagihan_nomor_key" ON "tagihan"("nomor");

-- CreateIndex
CREATE INDEX "tagihan_organisasi_id_periode_idx" ON "tagihan"("organisasi_id", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "peristiwa_bayar_penyedia_kunci_peristiwa_key" ON "peristiwa_bayar"("penyedia", "kunci_peristiwa");

-- CreateIndex
CREATE INDEX "audit_log_organisasi_id_dibuat_pada_idx" ON "audit_log"("organisasi_id", "dibuat_pada");

-- AddForeignKey
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_organisasi_aktif_id_fkey" FOREIGN KEY ("organisasi_aktif_id") REFERENCES "organisasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_sekali" ADD CONSTRAINT "token_sekali_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_sekali" ADD CONSTRAINT "token_sekali_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persetujuan_pdp" ADD CONSTRAINT "persetujuan_pdp_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persetujuan_pdp" ADD CONSTRAINT "persetujuan_pdp_versi_fkey" FOREIGN KEY ("versi") REFERENCES "teks_persetujuan"("versi") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keanggotaan" ADD CONSTRAINT "keanggotaan_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keanggotaan" ADD CONSTRAINT "keanggotaan_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_putusan" ADD CONSTRAINT "izin_putusan_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "izin_putusan" ADD CONSTRAINT "izin_putusan_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "foto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kawasan" ADD CONSTRAINT "kawasan_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tps" ADD CONSTRAINT "tps_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tps" ADD CONSTRAINT "tps_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kendaraan" ADD CONSTRAINT "kendaraan_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontrak" ADD CONSTRAINT "kontrak_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontrak" ADD CONSTRAINT "kontrak_org_kawasan_id_fkey" FOREIGN KEY ("org_kawasan_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontrak" ADD CONSTRAINT "kontrak_org_pengangkut_id_fkey" FOREIGN KEY ("org_pengangkut_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontrak" ADD CONSTRAINT "kontrak_org_penerima_id_fkey" FOREIGN KEY ("org_penerima_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wadah_catat" ADD CONSTRAINT "wadah_catat_tps_id_fkey" FOREIGN KEY ("tps_id") REFERENCES "tps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wadah_catat" ADD CONSTRAINT "wadah_catat_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah" ADD CONSTRAINT "serah_tps_id_fkey" FOREIGN KEY ("tps_id") REFERENCES "tps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah" ADD CONSTRAINT "serah_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah" ADD CONSTRAINT "serah_org_kawasan_id_fkey" FOREIGN KEY ("org_kawasan_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah" ADD CONSTRAINT "serah_org_pengangkut_id_fkey" FOREIGN KEY ("org_pengangkut_id") REFERENCES "organisasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah" ADD CONSTRAINT "serah_org_penerima_id_fkey" FOREIGN KEY ("org_penerima_id") REFERENCES "organisasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah" ADD CONSTRAINT "serah_kontrak_id_fkey" FOREIGN KEY ("kontrak_id") REFERENCES "kontrak"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah" ADD CONSTRAINT "serah_kendaraan_id_fkey" FOREIGN KEY ("kendaraan_id") REFERENCES "kendaraan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah_wadah" ADD CONSTRAINT "serah_wadah_serah_id_fkey" FOREIGN KEY ("serah_id") REFERENCES "serah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serah_wadah" ADD CONSTRAINT "serah_wadah_wadah_catat_id_fkey" FOREIGN KEY ("wadah_catat_id") REFERENCES "wadah_catat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_serah_id_fkey" FOREIGN KEY ("serah_id") REFERENCES "serah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto" ADD CONSTRAINT "foto_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foto" ADD CONSTRAINT "foto_serah_id_fkey" FOREIGN KEY ("serah_id") REFERENCES "serah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiket_timbang" ADD CONSTRAINT "tiket_timbang_serah_id_fkey" FOREIGN KEY ("serah_id") REFERENCES "serah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiket_timbang" ADD CONSTRAINT "tiket_timbang_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "foto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penutupan_rincian" ADD CONSTRAINT "penutupan_rincian_serah_id_fkey" FOREIGN KEY ("serah_id") REFERENCES "serah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "koreksi" ADD CONSTRAINT "koreksi_serah_id_fkey" FOREIGN KEY ("serah_id") REFERENCES "serah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "koreksi" ADD CONSTRAINT "koreksi_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "koreksi" ADD CONSTRAINT "koreksi_permintaan_id_fkey" FOREIGN KEY ("permintaan_id") REFERENCES "permintaan_koreksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permintaan_koreksi" ADD CONSTRAINT "permintaan_koreksi_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permintaan_koreksi_putusan" ADD CONSTRAINT "permintaan_koreksi_putusan_permintaan_id_fkey" FOREIGN KEY ("permintaan_id") REFERENCES "permintaan_koreksi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prioritas_tercatat" ADD CONSTRAINT "prioritas_tercatat_tps_id_fkey" FOREIGN KEY ("tps_id") REFERENCES "tps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prioritas_tercatat" ADD CONSTRAINT "prioritas_tercatat_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi_dibaca" ADD CONSTRAINT "notifikasi_dibaca_notifikasi_id_fkey" FOREIGN KEY ("notifikasi_id") REFERENCES "notifikasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi_dibaca" ADD CONSTRAINT "notifikasi_dibaca_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "langganan_push" ADD CONSTRAINT "langganan_push_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferensi_notifikasi" ADD CONSTRAINT "preferensi_notifikasi_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferensi_notifikasi" ADD CONSTRAINT "preferensi_notifikasi_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ekspor" ADD CONSTRAINT "ekspor_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bayangan_entri" ADD CONSTRAINT "bayangan_entri_kawasan_id_fkey" FOREIGN KEY ("kawasan_id") REFERENCES "kawasan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagihan_angkut" ADD CONSTRAINT "tagihan_angkut_kontrak_id_fkey" FOREIGN KEY ("kontrak_id") REFERENCES "kontrak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_paket_kode_fkey" FOREIGN KEY ("paket_kode") REFERENCES "paket"("kode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "langganan" ADD CONSTRAINT "langganan_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "langganan" ADD CONSTRAINT "langganan_paket_kode_fkey" FOREIGN KEY ("paket_kode") REFERENCES "paket"("kode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peristiwa_langganan" ADD CONSTRAINT "peristiwa_langganan_langganan_id_fkey" FOREIGN KEY ("langganan_id") REFERENCES "langganan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagihan" ADD CONSTRAINT "tagihan_organisasi_id_fkey" FOREIGN KEY ("organisasi_id") REFERENCES "organisasi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peristiwa_bayar" ADD CONSTRAINT "peristiwa_bayar_tagihan_id_fkey" FOREIGN KEY ("tagihan_id") REFERENCES "tagihan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konfirmasi_manual" ADD CONSTRAINT "konfirmasi_manual_tagihan_id_fkey" FOREIGN KEY ("tagihan_id") REFERENCES "tagihan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konfirmasi_manual" ADD CONSTRAINT "konfirmasi_manual_foto_bukti_id_fkey" FOREIGN KEY ("foto_bukti_id") REFERENCES "foto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
