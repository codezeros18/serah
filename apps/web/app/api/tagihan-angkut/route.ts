import { TagihanAngkutKueri } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { daftarTagihanAngkut } from "@/lib/server/layanan/tagihan-angkut";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET /api/tagihan-angkut[?kontrakId&periode] — daftar milik organisasi aktif; dengan kontrakId+periode juga pratinjau.
// Butuh hak paket `tagihan_angkut` (selain itu 403 HAK_PAKET_TIDAK_ADA).
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGANGKUT", "PENGELOLA");
  const kueri = validasi(TagihanAngkutKueri, Object.fromEntries(new URL(request.url).searchParams));
  const hasil = await denganAkses(konteksAkses(sesi), (tx) => daftarTagihanAngkut(tx, sesi, kueri));
  return sukses(hasil, { headers: { "Cache-Control": "no-store" } });
});
