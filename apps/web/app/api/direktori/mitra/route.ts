import { DirektoriMitraKueri } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { direktoriMitra } from "@/lib/server/layanan/organisasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/direktori/mitra?jenis= — PENGELOLA: pengangkut/penerima untuk dipilih sebagai pihak kontrak.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { jenis } = validasi(DirektoriMitraKueri, Object.fromEntries(new URL(request.url).searchParams));
  const mitra = await denganAkses(konteksAkses(sesi), (tx) => direktoriMitra(tx, sesi, jenis));
  return sukses({ mitra }, { headers: { "Cache-Control": "no-store" } });
});
