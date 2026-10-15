import { AdminOrganisasiParams } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { detailOrganisasi } from "@/lib/server/layanan/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/organisasi/[id] — membuka detail organisasi butuh X-Alasan; tercatat dengan organisasi sasarannya.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = validasi(AdminOrganisasiParams, await ctx.params);
  const hasil = await dalamAdmin(request, { aksi: "ORGANISASI_DIBUKA", objekJenis: "organisasi", objekId: id, organisasiId: id }, (tx) => detailOrganisasi(tx, id));
  return sukses(hasil, { headers: { "Cache-Control": "no-store" } });
});
