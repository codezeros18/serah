import { TpsParams, TpsUbahMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { ubahTps } from "@/lib/server/layanan/tps";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// PATCH /api/tps/[id] — PENGELOLA. Mengaktifkan kembali TPS tunduk pada batas `tps.maks`.
export const PATCH = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { id } = validasi(TpsParams, await ctx.params);
  const m = await bacaJson(request, TpsUbahMasukan);
  const tps = await denganAkses(konteksAkses(sesi), (tx) => ubahTps(tx, sesi, id, m));
  return sukses({ tps });
});
