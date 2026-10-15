import { OrganisasiIzinMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { ajukanIzin } from "@/lib/server/layanan/izin";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/organisasi/izin — pengurus PENGANGKUT/PENERIMA mengajukan pemeriksaan izin → MENUNGGU.
// Putusan hanya oleh ADMIN (lewat rute admin, S21); pengajuan ulang hanya dari BELUM_DIAJUKAN/DITOLAK.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const m = await bacaJson(request, OrganisasiIzinMasukan);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => ajukanIzin(tx, sesi, m, new Date())));
});
