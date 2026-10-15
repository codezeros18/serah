import { TagihanParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { tarikStatusManual } from "@/lib/server/layanan/tagihan";
import { wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/tagihan/[nomor]/status — tarik ulang status ke penyedia (bila notifikasi tidak sampai).
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ nomor: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { nomor } = validasi(TagihanParams, await ctx.params);
  return sukses({ tagihan: await tarikStatusManual(sesi, nomor) }, { headers: { "Cache-Control": "no-store" } });
});
