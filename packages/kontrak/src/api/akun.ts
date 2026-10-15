import { z } from "zod";
import { JenisPersetujuan, Peran } from "../enum";
import { Email, Id, Oke, TanpaMasukan, WaktuIso, rute } from "./primitif";

// Akun pribadi: unduh data, tarik persetujuan, hapus akun, preferensi notifikasi.

export const AkunDataSayaKeluaran = z.object({
  pengguna: z.object({
    id: Id,
    email: Email,
    emailTerverifikasiPada: WaktuIso.nullable(),
    dibuatPada: WaktuIso,
  }),
  keanggotaan: z.array(
    z.object({ organisasiId: Id, organisasiNama: z.string(), peran: Peran, pengurus: z.boolean(), aktif: z.boolean(), sejak: WaktuIso }),
  ),
  persetujuan: z.array(z.object({ versi: z.string(), jenis: JenisPersetujuan, pada: WaktuIso })),
  preferensiNotifikasi: z.array(z.object({ organisasiId: Id, email: z.boolean(), push: z.boolean() })),
  langgananPush: z.array(z.object({ endpoint: z.string(), dibuatPada: WaktuIso })),
});

export const AkunTarikPersetujuanKeluaran = Oke;

export const AkunHapusMasukan = z.object({ konfirmasi: z.literal("HAPUS") }).strict();
export const AkunHapusKeluaran = Oke;

export const PreferensiNotifikasi = z.object({ organisasiId: Id, email: z.boolean(), push: z.boolean() });
export const AkunNotifikasiKeluaran = z.object({ preferensi: z.array(PreferensiNotifikasi) });
export const AkunNotifikasiUbahMasukan = PreferensiNotifikasi.strict();

export const RUTE_AKUN = [
  rute({ metode: "GET", jalur: "/api/akun/data-saya", akses: ["SESI"], masukan: TanpaMasukan, keluaran: AkunDataSayaKeluaran }),
  rute({ metode: "POST", jalur: "/api/akun/tarik-persetujuan", akses: ["SESI"], masukan: TanpaMasukan, keluaran: AkunTarikPersetujuanKeluaran }),
  rute({ metode: "POST", jalur: "/api/akun/hapus", akses: ["SESI"], masukan: AkunHapusMasukan, keluaran: AkunHapusKeluaran }),
  rute({ metode: "GET", jalur: "/api/akun/notifikasi", akses: ["SESI"], masukan: TanpaMasukan, keluaran: AkunNotifikasiKeluaran }),
  rute({ metode: "PUT", jalur: "/api/akun/notifikasi", akses: ["SESI"], masukan: AkunNotifikasiUbahMasukan, keluaran: AkunNotifikasiKeluaran }),
] as const;
