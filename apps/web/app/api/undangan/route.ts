import { UndanganMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { undang } from "@/lib/server/auth";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/undangan — pengurus mengundang ke organisasi AKTIF sesinya (berlaku 7 hari).
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const m = await bacaJson(request, UndanganMasukan);
  return sukses(await undang(sesi, m));
});
