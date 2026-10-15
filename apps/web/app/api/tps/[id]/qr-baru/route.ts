import { TanpaMasukan, TpsParams } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { qrBaru } from "@/lib/server/layanan/tps";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/tps/[id]/qr-baru — QR baru; QR lama langsung tidak dikenal (G_QR_TIDAK_DIKENAL).
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { id } = validasi(TpsParams, await ctx.params);
  await bacaJson(request, TanpaMasukan);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => qrBaru(tx, sesi, id)), { headers: { "Cache-Control": "no-store" } });
});
