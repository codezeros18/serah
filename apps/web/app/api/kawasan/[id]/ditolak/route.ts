import { LembarNeracaParams, PeriodeKueri } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { ditolakKawasan } from "@/lib/server/layanan/laporan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/kawasan/[id]/ditolak?periode=YYYY-MM — pengelola, kawasan miliknya (selain itu 404).
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { id } = validasi(LembarNeracaParams, await ctx.params);
  const { periode } = validasi(PeriodeKueri, Object.fromEntries(new URL(request.url).searchParams));
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => ditolakKawasan(tx, sesi, id, periode)));
});
