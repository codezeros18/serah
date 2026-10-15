import { KendaraanBuatMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { buatKendaraan, daftarKendaraan } from "@/lib/server/layanan/organisasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// POST/GET /api/kendaraan — PENGANGKUT (tambah: pengurus). Plat saja, tanpa nama sopir.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT");
  const { plat } = await bacaJson(request, KendaraanBuatMasukan);
  const kendaraan = await denganAkses(konteksAkses(sesi), (tx) => buatKendaraan(tx, sesi, plat, new Date()));
  return sukses({ kendaraan });
});

export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT");
  const kendaraan = await denganAkses(konteksAkses(sesi), (tx) => daftarKendaraan(tx, sesi));
  return sukses({ kendaraan }, { headers: { "Cache-Control": "no-store" } });
});
