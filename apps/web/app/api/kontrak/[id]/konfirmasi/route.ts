import { KontrakParams, TanpaMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { konfirmasiKontrak } from "@/lib/server/layanan/kontrak";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/kontrak/[id]/konfirmasi — pengangkut atau penerima pihak kontrak. Dua konfirmasi → AKTIF (R-11 dinilai).
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT", "PENERIMA");
  const { id } = validasi(KontrakParams, await ctx.params);
  await bacaJson(request, TanpaMasukan);
  const kontrak = await denganAkses(konteksAkses(sesi), (tx) => konfirmasiKontrak(tx, sesi, id, new Date()));
  return sukses({ kontrak });
});
