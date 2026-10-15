import { KawasanBuatMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { buatKawasan, daftarKawasan } from "@/lib/server/layanan/organisasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// POST/GET /api/kawasan — PENGELOLA. Kode KWS-<3–5 huruf> diturunkan dari nama; keunikan ditegakkan oleh basis data.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const m = await bacaJson(request, KawasanBuatMasukan);
  const kawasan = await denganAkses(konteksAkses(sesi), (tx) => buatKawasan(tx, sesi, m, new Date()));
  return sukses({ kawasan });
});

export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const kawasan = await denganAkses(konteksAkses(sesi), (tx) => daftarKawasan(tx, sesi));
  return sukses({ kawasan }, { headers: { "Cache-Control": "no-store" } });
});
