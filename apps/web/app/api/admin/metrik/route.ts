import { dalamAdmin } from "@/lib/server/admin-rute";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { metrikPlatform } from "@/lib/server/layanan/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/metrik — agregat platform; tidak ada metrik per orang.
export const GET = tanganiRute(async (request: Request) => {
  const m = await dalamAdmin(request, { aksi: "METRIK_DIBACA", objekJenis: "metrik", objekId: "-" }, (tx, k) => metrikPlatform(tx, k.sekarang));
  return sukses(m, { headers: { "Cache-Control": "no-store" } });
});
