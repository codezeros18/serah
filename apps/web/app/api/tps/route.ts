import { TpsBuatMasukan, TpsDaftarKueri } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { buatTps, daftarTps } from "@/lib/server/layanan/tps";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// POST/GET /api/tps — PENGELOLA. Batas jumlah TPS aktif mengikuti hak paket `tps.maks`.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const m = await bacaJson(request, TpsBuatMasukan);
  const tps = await denganAkses(konteksAkses(sesi), (tx) => buatTps(tx, sesi, m, new Date()));
  return sukses({ tps });
});

export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { kawasanId } = validasi(TpsDaftarKueri, Object.fromEntries(new URL(request.url).searchParams));
  const tps = await denganAkses(konteksAkses(sesi), (tx) => daftarTps(tx, sesi, kawasanId));
  return sukses({ tps }, { headers: { "Cache-Control": "no-store" } });
});
