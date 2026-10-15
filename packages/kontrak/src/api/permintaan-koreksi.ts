import { z } from "zod";
import { KeputusanPermintaan, Peran, StatusPermintaan, TargetKoreksi } from "../enum";
import { Alasan, BeratGBolehNol, Id, KodePermintaanKoreksi, TanpaMasukan, WaktuIso, rute } from "./primitif";

// Permintaan koreksi atas catatan tertutup (S16). Catatan asli tidak diubah.

export const PermintaanKoreksi = z.object({
  id: Id,
  kode: KodePermintaanKoreksi,
  targetJenis: TargetKoreksi,
  targetId: Id,
  nilaiAsliG: BeratGBolehNol,
  nilaiUsulanG: BeratGBolehNol,
  alasan: z.string(),
  peranPengaju: Peran,
  status: StatusPermintaan,
  dibuatPada: WaktuIso,
  putusan: z.object({ keputusan: KeputusanPermintaan, alasan: z.string(), peran: Peran, dibuatPada: WaktuIso }).nullable(),
});

export const PermintaanKoreksiBuatMasukan = z
  .object({ targetJenis: TargetKoreksi, targetId: Id, nilaiUsulanG: BeratGBolehNol, alasan: Alasan })
  .strict();
export const PermintaanKoreksiBuatKeluaran = z.object({ id: Id, kode: KodePermintaanKoreksi });

export const PermintaanKoreksiDaftarKueri = z.object({ status: StatusPermintaan.optional() }).strict();
export const PermintaanKoreksiDaftarKeluaran = z.object({ permintaan: z.array(PermintaanKoreksi) });

export const PermintaanKoreksiParams = z.object({ id: Id });
export const PermintaanKoreksiPutusMasukan = z.object({ keputusan: KeputusanPermintaan, alasan: Alasan }).strict();
export const PermintaanKoreksiPutusKeluaran = z.object({ permintaan: PermintaanKoreksi });

export const RUTE_PERMINTAAN_KOREKSI = [
  rute({ metode: "POST", jalur: "/api/permintaan-koreksi", akses: ["PETUGAS", "PENGELOLA", "PENERIMA"], masukan: PermintaanKoreksiBuatMasukan, keluaran: PermintaanKoreksiBuatKeluaran, idempoten: true }),
  rute({ metode: "GET", jalur: "/api/permintaan-koreksi", akses: ["PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA"], kueri: PermintaanKoreksiDaftarKueri, masukan: TanpaMasukan, keluaran: PermintaanKoreksiDaftarKeluaran }),
  rute({ metode: "POST", jalur: "/api/permintaan-koreksi/[id]/putus", akses: ["PENGELOLA", "PENERIMA"], params: PermintaanKoreksiParams, masukan: PermintaanKoreksiPutusMasukan, keluaran: PermintaanKoreksiPutusKeluaran }),
] as const;
