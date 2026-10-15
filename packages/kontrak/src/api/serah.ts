import { z } from "zod";
import { Aliran, AlasanTolak, JenisEvent, JenisFoto, KeyakinanAi, PeranEvent, StatusSerah, SumberCuaca, SumberTiket } from "../enum";
import { RujukanAturan } from "../galat";
import {
  Alasan,
  BeratG,
  BeratGBolehNol,
  Id,
  Jam,
  JumlahWadah,
  KodeSerah,
  KodeTps,
  Periode,
  RefKode,
  RefRingkas,
  TanpaMasukan,
  WaktuIso,
  rute,
} from "./primitif";

// Inti serah (S08): buat, ambil, setujui/kembalikan, tutup, koreksi.

export const SerahKodeParams = z.object({ kode: KodeSerah });

export const SerahStatus = z.object({ kode: KodeSerah, status: StatusSerah, versi: z.number().int().min(0) });

export const SerahBuatMasukan = z.object({ tpsId: Id, wadahIds: z.array(Id).min(1).max(50) }).strict();
export const SerahBuatKeluaran = z.object({ kode: KodeSerah, qrToken: z.string() });

export const SerahWadah = z.object({
  id: Id,
  aliran: Aliran,
  beratG: BeratG.nullable(),
  jumlahWadah: JumlahWadah.nullable(),
  terjadiPada: WaktuIso,
});

export const SerahTimelineEvent = z.object({
  urutanRantai: z.number().int().min(1),
  jenis: JenisEvent,
  peran: PeranEvent,
  terjadiPada: WaktuIso,
  diterimaPada: WaktuIso,
  hash: z.string().length(64),
});

export const SerahFoto = z.object({
  id: Id,
  jenis: JenisFoto,
  /** URL bertanda tangan, berlaku 5 menit. */
  url: z.string(),
  kedaluwarsaPada: WaktuIso,
});

export const TiketTimbang = z.object({
  id: Id,
  fotoId: Id.nullable(),
  nomor: z.string().nullable(),
  beratG: BeratG,
  sumber: SumberTiket,
  aiModel: z.string().nullable(),
  aiKeyakinan: KeyakinanAi.nullable(),
  /** Nilai final setelah koreksi (nilai asli tetap di `beratG`). */
  beratFinalG: BeratG,
});

export const RincianPenutupan = z.object({
  id: Id,
  aliran: Aliran,
  diterimaG: BeratGBolehNol,
  ditolakG: BeratGBolehNol,
  alasan: AlasanTolak.nullable(),
  keterangan: z.string().nullable(),
  diterimaFinalG: BeratGBolehNol,
  ditolakFinalG: BeratGBolehNol,
});

export const SerahRingkas = z.object({
  kode: KodeSerah,
  status: StatusSerah,
  versi: z.number().int().min(0),
  tps: RefKode,
  kawasan: RefRingkas,
  aliran: z.array(Aliran),
  dibuatPada: WaktuIso,
  diperbaruiPada: WaktuIso,
});

export const SerahDetailKeluaran = SerahRingkas.extend({
  pengangkut: RefRingkas.nullable(),
  penerima: RefRingkas.nullable(),
  kendaraan: z.object({ id: Id, plat: z.string() }).nullable(),
  wadah: z.array(SerahWadah),
  timeline: z.array(SerahTimelineEvent),
  foto: z.array(SerahFoto),
  tiket: TiketTimbang.nullable(),
  rincian: z.array(RincianPenutupan),
});

export const SerahDaftarKueri = z.object({ status: StatusSerah.optional(), periode: Periode.optional() }).strict();
export const SerahDaftarKeluaran = z.object({ serah: z.array(SerahRingkas) });

export const AmbilItem = z.object({
  kode: KodeSerah,
  tps: z.object({ id: Id, kode: KodeTps, nama: z.string() }),
  kawasan: RefRingkas,
  aliran: z.array(Aliran),
  umurJamTertua: Jam,
  prioritas: z.object({ sumber: SumberCuaca, teks: z.string() }).optional(),
});
export const AmbilDaftarKeluaran = z.object({ serah: z.array(AmbilItem) });

export const SerahAmbilMasukan = z.object({ fotoId: Id, kendaraanId: Id, penerimaId: Id }).strict();
export const SerahSetujuiMasukan = z.object({ alasan: Alasan.optional() }).strict();
export const SerahKembalikanMasukan = z.object({ alasan: Alasan.optional() }).strict();

export const SerahTutupMasukan = z
  .object({
    tiket: z
      .object({
        fotoId: Id.optional(),
        nomor: z.string().trim().min(1).max(60).optional(),
        beratG: BeratG,
        sumber: SumberTiket,
        aiKeyakinan: KeyakinanAi.optional(),
        aiModel: z.string().max(80).optional(),
      })
      .strict(),
    rincian: z
      .array(
        z
          .object({
            aliran: Aliran,
            diterimaG: BeratGBolehNol,
            ditolakG: BeratGBolehNol,
            alasan: AlasanTolak.optional(),
            keterangan: z.string().trim().max(300).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();
export type SerahTutupMasukan = z.infer<typeof SerahTutupMasukan>;
export const SerahTutupKeluaran = SerahStatus.extend({ peringatan: z.array(RujukanAturan) });

/** Sasaran koreksi berat oleh penerima: tiket, atau kolom diterima/ditolak satu baris rincian. */
export const TargetKoreksiBerat = z.enum(["TIKET", "RINCIAN_DITERIMA", "RINCIAN_DITOLAK"]);
export const KOREKSI_PERUBAHAN_MAKS = 9;

// Keputusan pemilik (S08): koreksi = daftar perubahan yang diterapkan bersama, karena berat tiket harus tetap
// sama dengan Σ rincian. Satu baris koreksi per perubahan, satu event KOREKSI_BERAT.
export const SerahKoreksiMasukan = z
  .object({
    alasan: Alasan,
    perubahan: z
      .array(z.object({ target: TargetKoreksiBerat, targetId: Id, nilaiFinalG: BeratGBolehNol }).strict())
      .min(1)
      .max(KOREKSI_PERUBAHAN_MAKS),
  })
  .strict();
export type SerahKoreksiMasukan = z.infer<typeof SerahKoreksiMasukan>;
export const KoreksiTercatat = z.object({
  koreksiId: Id,
  target: TargetKoreksiBerat,
  targetId: Id,
  nilaiAsliG: BeratGBolehNol,
  nilaiFinalG: BeratGBolehNol,
});
/** Field puncak = perubahan pertama (kompatibel); `koreksi` = semua perubahan (selalu diisi server). */
export const SerahKoreksiKeluaran = z.object({
  koreksiId: Id,
  nilaiAsliG: BeratGBolehNol,
  nilaiFinalG: BeratGBolehNol,
  kode: KodeSerah.optional(),
  status: StatusSerah.optional(),
  versi: z.number().int().min(0).optional(),
  koreksi: z.array(KoreksiTercatat).optional(),
});

export const RUTE_SERAH = [
  rute({ metode: "POST", jalur: "/api/serah", akses: ["PETUGAS", "PENGELOLA"], masukan: SerahBuatMasukan, keluaran: SerahBuatKeluaran, idempoten: true }),
  rute({ metode: "GET", jalur: "/api/serah/[kode]", akses: ["PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA"], params: SerahKodeParams, masukan: TanpaMasukan, keluaran: SerahDetailKeluaran }),
  rute({ metode: "GET", jalur: "/api/serah", akses: ["PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA"], kueri: SerahDaftarKueri, masukan: TanpaMasukan, keluaran: SerahDaftarKeluaran }),
  rute({ metode: "GET", jalur: "/api/ambil", akses: ["PENGANGKUT"], masukan: TanpaMasukan, keluaran: AmbilDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/serah/[kode]/ambil", akses: ["PENGANGKUT"], params: SerahKodeParams, masukan: SerahAmbilMasukan, keluaran: SerahStatus, idempoten: true }),
  rute({ metode: "POST", jalur: "/api/serah/[kode]/setujui", akses: ["PENGELOLA"], params: SerahKodeParams, masukan: SerahSetujuiMasukan, keluaran: SerahStatus, idempoten: true }),
  rute({ metode: "POST", jalur: "/api/serah/[kode]/kembalikan", akses: ["PENGELOLA"], params: SerahKodeParams, masukan: SerahKembalikanMasukan, keluaran: SerahStatus, idempoten: true }),
  rute({ metode: "POST", jalur: "/api/serah/[kode]/tutup", akses: ["PENERIMA"], params: SerahKodeParams, masukan: SerahTutupMasukan, keluaran: SerahTutupKeluaran, idempoten: true }),
  rute({ metode: "POST", jalur: "/api/serah/[kode]/koreksi", akses: ["PENERIMA"], params: SerahKodeParams, masukan: SerahKoreksiMasukan, keluaran: SerahKoreksiKeluaran, idempoten: true }),
] as const;
