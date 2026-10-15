import { TagihanParams } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { bayarOnline } from "@/lib/server/layanan/tagihan";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/tagihan/[nomor]/bayar — buat pembayaran online (sandbox); idempoten per tagihan.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ nomor: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { nomor } = validasi(TagihanParams, await ctx.params);
  return sukses(await bayarOnline(sesi, nomor));
});
