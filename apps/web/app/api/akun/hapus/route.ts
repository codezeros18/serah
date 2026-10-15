import { AkunHapusMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { hapusAkun } from "@/lib/server/akun";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { cookieHapus, wajibSesi } from "@/lib/server/sesi";

// POST /api/akun/hapus {konfirmasi:"HAPUS"} — email & sandi dihapus permanen; data operasional tetap (T31).
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  await bacaJson(request, AkunHapusMasukan);
  await hapusAkun(sesi);
  return sukses({ ok: true as const }, { headers: { "Set-Cookie": cookieHapus() } });
});
