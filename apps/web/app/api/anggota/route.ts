import { daftarAnggota } from "@/lib/server/akun";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/anggota — pengurus: peran, sejak, aktif. Tidak pernah memuat email anggota.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  return sukses(await daftarAnggota(sesi), { headers: { "Cache-Control": "no-store" } });
});
