import { PrioritasParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { prioritasTpsKeluaran } from "@/lib/server/layanan/cuaca";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/tps/[id]/prioritas — R-10 (BMKG + umur wadah). Bukan peringatan dini resmi: teks selalu disertai R10_CATATAN.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA", "PENGANGKUT");
  const { id } = validasi(PrioritasParams, await ctx.params);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => prioritasTpsKeluaran(tx, id, new Date())));
});
