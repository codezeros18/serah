import { LaporanKueri, LaporanParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { laporanKeluaran } from "@/lib/server/layanan/laporan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/laporan/[pihak]?periode=YYYY-MM&kawasanId? — tiga laporan dari satu fungsi core (baris §L.4).
// Pengangkut hanya `pengangkut`, penerima hanya `penerima`; pengelola ketiganya atas kawasannya.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ pihak: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA", "PENGANGKUT", "PENERIMA");
  const { pihak } = validasi(LaporanParams, await ctx.params);
  const { periode, kawasanId } = validasi(LaporanKueri, Object.fromEntries(new URL(request.url).searchParams));
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => laporanKeluaran(tx, sesi, pihak, periode, kawasanId)));
});
