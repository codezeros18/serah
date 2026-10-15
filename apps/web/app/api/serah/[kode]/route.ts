import { SerahKodeParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { detailSerah } from "@/lib/server/layanan/serah";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/serah/[kode] — detail + timeline (tanpa payload) + URL foto bertanda tangan 5 menit.
// Pihak tidak terkait tidak melihat serah (RLS) → 404, bukan 403.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ kode: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA");
  const { kode } = validasi(SerahKodeParams, await ctx.params);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => detailSerah(tx, kode, new Date())));
});
