import { BayanganPerbandinganKueri } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { perbandinganBayangan } from "@/lib/server/layanan/bayangan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/bayangan/perbandingan?kawasanId&periode — selisih dua arah per aliran (catatan lama vs SERAH).
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { kawasanId, periode } = validasi(BayanganPerbandinganKueri, Object.fromEntries(new URL(request.url).searchParams));
  const hasil = await denganAkses(konteksAkses(sesi), (tx) => perbandinganBayangan(tx, sesi, kawasanId, periode));
  return sukses(hasil, { headers: { "Cache-Control": "no-store" } });
});
