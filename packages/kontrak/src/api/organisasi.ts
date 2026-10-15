import { z } from "zod";
import { Aliran, JenisOrganisasi, JenisPenerima, Peran, StatusIzin, Yurisdiksi } from "../enum";
import { Email, Id, Sandi, TanpaMasukan, TokenSekali, WaktuIso, rute } from "./primitif";

// Organisasi, izin, undangan, anggota (S07, S13, S15).

export const Organisasi = z.object({
  id: Id,
  kode: z.string(),
  nama: z.string(),
  jenis: JenisOrganisasi,
  jenisPenerima: JenisPenerima.nullable(),
  aliranDiterima: z.array(Aliran),
  nomorIzin: z.string().nullable(),
  statusIzin: StatusIzin,
  yurisdiksi: Yurisdiksi,
  demo: z.boolean(),
});
export type Organisasi = z.infer<typeof Organisasi>;

const NamaOrganisasi = z.string().trim().min(2).max(120);
const NomorIzin = z.string().trim().min(3).max(80);

export const OrganisasiBuatMasukan = z
  .object({
    jenis: z.enum(["KAWASAN", "PENGANGKUT", "PENERIMA"]),
    nama: NamaOrganisasi,
    jenisPenerima: JenisPenerima.optional(),
    aliranDiterima: z.array(Aliran).min(1).optional(),
    nomorIzin: NomorIzin.optional(),
    yurisdiksi: Yurisdiksi,
  })
  .strict();
export const OrganisasiBuatKeluaran = z.object({ organisasi: Organisasi });

export const OrganisasiSayaKeluaran = z.object({ organisasi: Organisasi });
export const OrganisasiUbahMasukan = z
  .object({ nama: NamaOrganisasi.optional(), aliranDiterima: z.array(Aliran).min(1).optional() })
  .strict();

export const OrganisasiIzinMasukan = z.object({ nomorIzin: NomorIzin, fotoDokumenId: Id.optional() }).strict();
export const OrganisasiIzinKeluaran = z.object({ statusIzin: z.literal("MENUNGGU") });

export const UndanganMasukan = z.object({ email: Email, peran: Peran.exclude(["ADMIN"]) }).strict();
export const UndanganKeluaran = z.object({ kadaluwarsaPada: WaktuIso });

export const UndanganTerimaMasukan = z.object({ token: TokenSekali, sandi: Sandi.optional() }).strict();
export const UndanganTerimaKeluaran = z.object({ organisasiId: Id, peran: Peran });

/** Daftar anggota — tanpa email orang lain. */
export const Anggota = z.object({ id: Id, peran: Peran, pengurus: z.boolean(), aktif: z.boolean(), sejak: WaktuIso });
export const AnggotaDaftarKeluaran = z.object({ anggota: z.array(Anggota) });
export const AnggotaParams = z.object({ id: Id });
export const AnggotaNonaktifKeluaran = z.object({ id: Id, aktif: z.literal(false) });

export const RUTE_ORGANISASI = [
  rute({ metode: "POST", jalur: "/api/organisasi", akses: ["SESI"], masukan: OrganisasiBuatMasukan, keluaran: OrganisasiBuatKeluaran }),
  rute({ metode: "GET", jalur: "/api/organisasi/saya", akses: ["PENGURUS"], masukan: TanpaMasukan, keluaran: OrganisasiSayaKeluaran }),
  rute({ metode: "PATCH", jalur: "/api/organisasi/saya", akses: ["PENGURUS"], masukan: OrganisasiUbahMasukan, keluaran: OrganisasiSayaKeluaran }),
  rute({ metode: "POST", jalur: "/api/organisasi/izin", akses: ["PENGURUS"], masukan: OrganisasiIzinMasukan, keluaran: OrganisasiIzinKeluaran }),
  rute({ metode: "POST", jalur: "/api/undangan", akses: ["PENGURUS"], masukan: UndanganMasukan, keluaran: UndanganKeluaran }),
  rute({ metode: "POST", jalur: "/api/undangan/terima", akses: ["PUBLIK", "SESI"], masukan: UndanganTerimaMasukan, keluaran: UndanganTerimaKeluaran }),
  rute({ metode: "GET", jalur: "/api/anggota", akses: ["PENGURUS"], masukan: TanpaMasukan, keluaran: AnggotaDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/anggota/[id]/nonaktif", akses: ["PENGURUS"], params: AnggotaParams, masukan: TanpaMasukan, keluaran: AnggotaNonaktifKeluaran }),
] as const;
