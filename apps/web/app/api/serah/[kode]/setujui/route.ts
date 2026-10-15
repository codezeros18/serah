import { SerahSetujuiMasukan, SerahKodeParams } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { setujuiSerah } from "@/lib/server/layanan/serah";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/serah/[kode]/setujui — oleh pengelola kawasan (Idempotency-Key wajib).
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ kode: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { kode } = validasi(SerahKodeParams, await ctx.params);
  await bacaJson(request, SerahSetujuiMasukan);
  return ruteIdempoten(request, sesi, "POST /api/serah/[kode]/setujui", (tx, kunci) => setujuiSerah(tx, sesi, kode, kunci, new Date()));
});
