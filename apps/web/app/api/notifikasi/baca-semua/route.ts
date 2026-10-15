import { cekAsal } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { bacaSemuaNotifikasi } from "@/lib/server/notifikasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/notifikasi/baca-semua — tandai semua notifikasi sesi sudah dibaca.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => bacaSemuaNotifikasi(tx, sesi, new Date())));
});
