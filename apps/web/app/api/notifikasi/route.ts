import { NotifikasiDaftarKueri } from "@serah/kontrak";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { daftarNotifikasi } from "@/lib/server/notifikasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/notifikasi?belumDibaca — notifikasi organisasi aktif untuk peran sesi (terbaru dulu, maks 100).
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  const { belumDibaca } = validasi(NotifikasiDaftarKueri, Object.fromEntries(new URL(request.url).searchParams));
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => daftarNotifikasi(tx, sesi, belumDibaca)));
});
