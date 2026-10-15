import { SinkronMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { bacaJson, tanganiRute } from "@/lib/server/galat";
import { kunciIdempoten, responsIdempoten } from "@/lib/server/idempoten";
import { sinkronIdempoten } from "@/lib/server/layanan/sinkron";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/sinkron — antrean offline (≤20 aksi). Hasil per aksi: DITERAPKAN | DUPLIKAT | DITOLAK {kode}.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const kunci = kunciIdempoten(request);
  const { aksi } = await bacaJson(request, SinkronMasukan);
  return responsIdempoten(await sinkronIdempoten(sesi, kunci, aksi, new Date()));
});
