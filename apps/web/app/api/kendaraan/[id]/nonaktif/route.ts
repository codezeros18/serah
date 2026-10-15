import { KendaraanParams, TanpaMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { nonaktifkanKendaraan } from "@/lib/server/layanan/organisasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/kendaraan/[id]/nonaktif — pengurus pengangkut.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT");
  const { id } = validasi(KendaraanParams, await ctx.params);
  await bacaJson(request, TanpaMasukan);
  const kendaraan = await denganAkses(konteksAkses(sesi), (tx) => nonaktifkanKendaraan(tx, sesi, id));
  return sukses({ kendaraan });
});
