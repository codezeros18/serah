import { dataSaya } from "@/lib/server/akun";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/akun/data-saya — unduhan JSON data pribadi pengguna sendiri (hak subjek PDP).
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  const data = await dataSaya(sesi);
  return sukses(data, {
    headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="data-saya-serah.json"' },
  });
});
