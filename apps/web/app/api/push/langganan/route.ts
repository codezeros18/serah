import { PushBerhentiMasukan, PushLanggananMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { hapusLanggananPush, simpanLanggananPush } from "@/lib/server/notifikasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/push/langganan — simpan langganan Web Push perangkat ini. DELETE — berhenti berlangganan.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const m = await bacaJson(request, PushLanggananMasukan);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => simpanLanggananPush(tx, sesi.penggunaId, m, new Date())));
});

export const DELETE = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const { endpoint } = await bacaJson(request, PushBerhentiMasukan);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => hapusLanggananPush(tx, sesi.penggunaId, endpoint)));
});
