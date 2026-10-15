import { SerahKodeParams, SerahTutupMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { tutupSerah } from "@/lib/server/layanan/serah";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/serah/[kode]/tutup — penerima menutup: terima / sebagian / tolak (diturunkan dari rincian), R-08 peringatan.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ kode: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENERIMA");
  const { kode } = validasi(SerahKodeParams, await ctx.params);
  const masukan = await bacaJson(request, SerahTutupMasukan);
  return ruteIdempoten(request, sesi, "POST /api/serah/[kode]/tutup", (tx, kunci) => tutupSerah(tx, sesi, kode, masukan, kunci, new Date()));
});
