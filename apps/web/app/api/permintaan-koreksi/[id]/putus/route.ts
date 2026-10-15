import { PermintaanKoreksiParams, PermintaanKoreksiPutusMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { putusPermintaan } from "@/lib/server/layanan/permintaan-koreksi";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/permintaan-koreksi/[id]/putus — wadah diputus pengelola kawasan; tiket/rincian diputus penerima pemilik serah.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA", "PENERIMA");
  const { id } = validasi(PermintaanKoreksiParams, await ctx.params);
  const masukan = await bacaJson(request, PermintaanKoreksiPutusMasukan);
  return ruteIdempoten(request, sesi, "POST /api/permintaan-koreksi/[id]/putus", (tx, kunci) => putusPermintaan(tx, sesi, id, masukan, kunci, new Date()));
});
