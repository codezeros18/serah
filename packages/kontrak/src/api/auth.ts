import { z } from "zod";
import { JenisOrganisasi, Peran } from "../enum";
import { Hak } from "../hak";
import { Email, Id, Oke, Sandi, TanpaMasukan, TokenSekali, rute } from "./primitif";

// Auth & sesi (S01 dasar, S07 penuh).

export const OrganisasiPeran = z.object({
  id: Id,
  nama: z.string(),
  jenis: JenisOrganisasi,
  peran: z.array(Peran),
});
export type OrganisasiPeran = z.infer<typeof OrganisasiPeran>;

export const SesiRingkas = z.object({
  organisasi: z.array(OrganisasiPeran),
  peranAktif: Peran.nullable(),
});

export const AuthDaftarMasukan = z
  .object({ email: Email, sandi: Sandi, persetujuanVersi: z.string().min(1).max(40) })
  .strict();
// `langsungAktif`: hanya mode demo (email verifikasi tidak dikirim; akun langsung terverifikasi).
export const AuthDaftarKeluaran = z.object({ perluVerifikasi: z.literal(true), langsungAktif: z.literal(true).optional() });

export const AuthVerifikasiMasukan = z.object({ token: TokenSekali }).strict();
export const AuthVerifikasiKeluaran = Oke;

export const AuthMasukMasukan = z.object({ email: Email, sandi: z.string().min(1).max(200) }).strict();
export const AuthMasukKeluaran = z.object({ sesi: SesiRingkas });

export const AuthKeluarKeluaran = Oke;

export const AuthLupaMasukan = z.object({ email: Email }).strict();
/** Selalu `{ok:true}` agar keberadaan akun tidak terbuka. */
export const AuthLupaKeluaran = Oke;

export const AuthResetMasukan = z.object({ token: TokenSekali, sandi: Sandi }).strict();
export const AuthResetKeluaran = Oke;

export const AuthDemoMasukan = z.object({ peran: Peran }).strict();
export const AuthDemoKeluaran = z.object({ sesi: SesiRingkas });

export const SesiKeluaran = z.object({
  pengguna: z.object({ id: Id }),
  organisasiAktif: z
    .object({ id: Id, kode: z.string(), nama: z.string(), jenis: JenisOrganisasi })
    .nullable(),
  peran: Peran.nullable(),
  paket: z.string().nullable(),
  hak: z.array(Hak),
});
export type SesiKeluaran = z.infer<typeof SesiKeluaran>;

export const SesiOrganisasiMasukan = z.object({ organisasiId: Id, peran: Peran }).strict();
export const SesiOrganisasiKeluaran = SesiKeluaran;

export const RUTE_AUTH = [
  rute({ metode: "POST", jalur: "/api/auth/daftar", akses: ["PUBLIK"], masukan: AuthDaftarMasukan, keluaran: AuthDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/auth/verifikasi", akses: ["PUBLIK"], masukan: AuthVerifikasiMasukan, keluaran: AuthVerifikasiKeluaran }),
  rute({ metode: "POST", jalur: "/api/auth/masuk", akses: ["PUBLIK"], masukan: AuthMasukMasukan, keluaran: AuthMasukKeluaran }),
  rute({ metode: "POST", jalur: "/api/auth/keluar", akses: ["SESI"], masukan: TanpaMasukan, keluaran: AuthKeluarKeluaran }),
  rute({ metode: "POST", jalur: "/api/auth/lupa", akses: ["PUBLIK"], masukan: AuthLupaMasukan, keluaran: AuthLupaKeluaran }),
  rute({ metode: "POST", jalur: "/api/auth/reset", akses: ["PUBLIK"], masukan: AuthResetMasukan, keluaran: AuthResetKeluaran }),
  rute({ metode: "POST", jalur: "/api/auth/demo", akses: ["PUBLIK"], masukan: AuthDemoMasukan, keluaran: AuthDemoKeluaran }),
  rute({ metode: "GET", jalur: "/api/sesi", akses: ["SESI"], masukan: TanpaMasukan, keluaran: SesiKeluaran }),
  rute({ metode: "POST", jalur: "/api/sesi/organisasi", akses: ["SESI"], masukan: SesiOrganisasiMasukan, keluaran: SesiOrganisasiKeluaran }),
] as const;
