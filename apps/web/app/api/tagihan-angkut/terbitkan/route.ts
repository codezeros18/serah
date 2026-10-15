import { TagihanAngkutTerbitkanMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { terbitkanTagihanAngkut } from "@/lib/server/layanan/tagihan-angkut";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/tagihan-angkut/terbitkan — PENGANGKUT; hanya serah DITERIMA/DITERIMA_SEBAGIAN pada periode yang sudah berakhir.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT");
  const masukan = await bacaJson(request, TagihanAngkutTerbitkanMasukan);
  const tagihan = await denganAkses(konteksAkses(sesi), (tx) => terbitkanTagihanAngkut(tx, sesi, masukan, new Date()));
  return sukses({ tagihan });
});
