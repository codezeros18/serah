import { WadahCatatMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { bacaJson, tanganiRute } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { catatWadah } from "@/lib/server/layanan/wadah";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/wadah — catat satu wadah per aliran (Idempotency-Key wajib).
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA");
  const masukan = await bacaJson(request, WadahCatatMasukan);
  return ruteIdempoten(request, sesi, "POST /api/wadah", (tx, kunci) => catatWadah(tx, sesi, masukan, kunci, new Date()));
});
