import { KontrakParams, TanpaMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { akhiriKontrak } from "@/lib/server/layanan/kontrak";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/kontrak/[id]/akhiri — PENGELOLA pemilik kontrak: AKTIF → BERAKHIR, USULAN → DIBATALKAN.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { id } = validasi(KontrakParams, await ctx.params);
  await bacaJson(request, TanpaMasukan);
  const kontrak = await denganAkses(konteksAkses(sesi), (tx) => akhiriKontrak(tx, sesi, id));
  return sukses({ kontrak });
});
