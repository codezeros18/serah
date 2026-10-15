import { SerahKodeParams, SerahKoreksiMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { koreksiSerah } from "@/lib/server/layanan/serah";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/serah/[kode]/koreksi — koreksi berat oleh penerima: daftar perubahan diterapkan bersama (Σ tetap konsisten).
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ kode: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENERIMA");
  const { kode } = validasi(SerahKodeParams, await ctx.params);
  const masukan = await bacaJson(request, SerahKoreksiMasukan);
  return ruteIdempoten(request, sesi, "POST /api/serah/[kode]/koreksi", (tx, kunci) => koreksiSerah(tx, sesi, kode, masukan, kunci, new Date()));
});
