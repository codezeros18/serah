import { TpsQrTokenParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { tpsDariQr } from "@/lib/server/layanan/wadah";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/tps/qr/[token] — QR TPS → TPS & kawasan (hanya TPS aktif kawasan sesi; selain itu 404).
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ token: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA");
  const { token } = validasi(TpsQrTokenParams, await ctx.params);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => tpsDariQr(tx, token)));
});
