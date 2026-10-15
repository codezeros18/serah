import { AnggotaParams, TanpaMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { nonaktifkanAnggota } from "@/lib/server/akun";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/anggota/[id]/nonaktif — pengurus menonaktifkan keanggotaan di organisasi aktifnya.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  await bacaJson(request, TanpaMasukan);
  const { id } = validasi(AnggotaParams, await ctx.params);
  return sukses(await nonaktifkanAnggota(sesi, id));
});
