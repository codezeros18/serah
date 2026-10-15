import { NotifikasiParams } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { bacaNotifikasi } from "@/lib/server/notifikasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/notifikasi/[id]/baca — tandai dibaca (pribadi). Bukan untuk organisasi/peran sesi → 404.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const { id } = validasi(NotifikasiParams, await ctx.params);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => bacaNotifikasi(tx, sesi, id, new Date())));
});
