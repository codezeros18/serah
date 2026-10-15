import { CuacaParams } from "@serah/kontrak";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { cuacaAdm4 } from "@/lib/server/layanan/cuaca";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/cuaca/[adm4] — analisis prakiraan BMKG terbaru yang tersimpan (LIVE/SNAPSHOT) + penanda basi.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ adm4: string }> }) => {
  const sesi = await wajibSesi(request);
  const { adm4 } = validasi(CuacaParams, await ctx.params);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => cuacaAdm4(tx, adm4, new Date())));
});
