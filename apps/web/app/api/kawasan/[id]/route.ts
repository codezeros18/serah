import { KawasanParams, KawasanUbahMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { ubahKawasan } from "@/lib/server/layanan/organisasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// PATCH /api/kawasan/[id] — PENGELOLA, hanya kawasan milik organisasinya.
export const PATCH = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { id } = validasi(KawasanParams, await ctx.params);
  const m = await bacaJson(request, KawasanUbahMasukan);
  const kawasan = await denganAkses(konteksAkses(sesi), (tx) => ubahKawasan(tx, sesi, id, m));
  return sukses({ kawasan });
});
