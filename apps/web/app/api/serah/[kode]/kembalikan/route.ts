import { SerahKembalikanMasukan, SerahKodeParams } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { kembalikanSerah } from "@/lib/server/layanan/serah";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/serah/[kode]/kembalikan — oleh pengelola kawasan (Idempotency-Key wajib).
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ kode: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { kode } = validasi(SerahKodeParams, await ctx.params);
  const masukan = await bacaJson(request, SerahKembalikanMasukan);
  return ruteIdempoten(request, sesi, "POST /api/serah/[kode]/kembalikan", (tx, kunci) => kembalikanSerah(tx, sesi, kode, masukan.alasan, kunci, new Date()));
});
