import { wajibPeran } from "@/lib/server/akses";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { daftarTagihan } from "@/lib/server/layanan/tagihan";
import { wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/tagihan — PENGELOLA kawasan, terbaru dulu.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  return sukses({ tagihan: await daftarTagihan(sesi) }, { headers: { "Cache-Control": "no-store" } });
});
