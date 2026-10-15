import { TpsParams, TpsQrKueri } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { tanganiRute, validasi } from "@/lib/server/galat";
import { gambarQr, tokenQrBerlaku } from "@/lib/server/layanan/tps";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/tps/[id]/qr?format=svg|png — gambar QR yang berlaku untuk dicetak. Berisi token rahasia → tidak di-cache.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { id } = validasi(TpsParams, await ctx.params);
  const { format } = validasi(TpsQrKueri, Object.fromEntries(new URL(request.url).searchParams));
  const token = await denganAkses(konteksAkses(sesi), (tx) => tokenQrBerlaku(tx, sesi, id));
  const { isi, mime } = await gambarQr(token, format);
  return new Response(isi, { headers: { "Content-Type": mime, "Cache-Control": "private, no-store" } });
});
