import { TagihanParams, TagihanTransferMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { kirimBuktiTransfer } from "@/lib/server/layanan/tagihan";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/tagihan/[nomor]/transfer — bukti transfer manual → MENUNGGU_KONFIRMASI (dikonfirmasi admin, S21).
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ nomor: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { nomor } = validasi(TagihanParams, await ctx.params);
  const { fotoBuktiId } = await bacaJson(request, TagihanTransferMasukan);
  return sukses({ tagihan: await kirimBuktiTransfer(sesi, nomor, fotoBuktiId) });
});
