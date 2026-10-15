import { sukses, tanganiRute } from "@/lib/server/galat";
import { kunciPublikPush } from "@/lib/server/notifikasi";
import { wajibSesi } from "@/lib/server/sesi";

// GET /api/push/kunci-publik — kunci VAPID publik (null bila push belum dikonfigurasi).
export const GET = tanganiRute(async (request: Request) => {
  await wajibSesi(request);
  return sukses(kunciPublikPush());
});
