import { SerahAmbilMasukan, SerahKodeParams } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { ambilSerah } from "@/lib/server/layanan/serah";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/serah/[kode]/ambil — DRAF → MENUNGGU_SETUJU (foto R-04, kendaraan, R-01/02/03/11).
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ kode: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT");
  const { kode } = validasi(SerahKodeParams, await ctx.params);
  const masukan = await bacaJson(request, SerahAmbilMasukan);
  return ruteIdempoten(request, sesi, "POST /api/serah/[kode]/ambil", (tx, kunci) => ambilSerah(tx, sesi, kode, masukan, kunci, new Date()));
});
