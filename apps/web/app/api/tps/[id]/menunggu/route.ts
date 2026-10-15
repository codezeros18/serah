import { TpsMenungguParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { wadahMenunggu } from "@/lib/server/layanan/wadah";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/tps/[id]/menunggu — wadah yang belum masuk serah + peringatan R-05/R-06/R-09.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA");
  const { id } = validasi(TpsMenungguParams, await ctx.params);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => wadahMenunggu(tx, id, new Date())));
});
