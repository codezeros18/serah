import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { daftarAmbil } from "@/lib/server/layanan/serah";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/ambil — serah DRAF di kawasan berkontrak AKTIF dengan pengangkut; prioritas R-10 lebih dulu, lalu umur.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT");
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => daftarAmbil(tx, new Date())));
});
