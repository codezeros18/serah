import { wajibPeran } from "@/lib/server/akses";
import { wajibPengurusAktif } from "@/lib/server/auth";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { bacaLangganan } from "@/lib/server/layanan/langganan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/langganan — PENGELOLA kawasan: paket efektif, status, TPS yang akan ditagih.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const data = await denganAkses(konteksAkses(sesi), async (tx) => bacaLangganan(tx, await wajibPengurusAktif(tx, sesi), new Date()));
  return sukses(data, { headers: { "Cache-Control": "no-store" } });
});
