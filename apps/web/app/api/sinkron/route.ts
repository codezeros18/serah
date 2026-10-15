import { SinkronMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { wajibDalamBatas } from "@/lib/server/batas-laju";
import { bacaJson, tanganiRute } from "@/lib/server/galat";
import { kunciIdempoten, responsIdempoten } from "@/lib/server/idempoten";
import { sinkronIdempoten } from "@/lib/server/layanan/sinkron";
import { wajibSesi } from "@/lib/server/sesi";

// POST /api/sinkron — antrean offline (≤20 aksi). Hasil per aksi: DITERAPKAN | DUPLIKAT | DITOLAK {kode}.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  // 60 sinkron per menit per sesi (§P.1).
  await wajibDalamBatas("SINKRON", sesi.id);
  const kunci = kunciIdempoten(request);
  const { aksi } = await bacaJson(request, SinkronMasukan);
  return responsIdempoten(await sinkronIdempoten(sesi, kunci, aksi, new Date()));
});
