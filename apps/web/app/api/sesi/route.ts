import { sukses, tanganiRute } from "@/lib/server/galat";
import { keluaranSesi, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/sesi — pengguna, organisasi aktif, peran, paket, dan hak.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  return sukses(await keluaranSesi(sesi), { headers: { "Cache-Control": "no-store" } });
});
