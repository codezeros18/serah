import { cekAsal } from "@/lib/server/akses";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { bacaSesi, cabutSesi, cookieHapus } from "@/lib/server/sesi";

// POST /api/auth/keluar — cabut sesi & hapus cookie. Idempoten: tanpa sesi tetap {ok:true}.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await bacaSesi(request);
  if (sesi) await cabutSesi(sesi.id);
  return sukses({ ok: true }, { headers: { "Set-Cookie": cookieHapus() } });
});
