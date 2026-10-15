import { TanpaMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { tarikPersetujuan } from "@/lib/server/akun";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { cookieHapus, wajibSesi } from "@/lib/server/sesi";

// POST /api/akun/tarik-persetujuan — catat penarikan (baris baru), cabut semua sesi.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  await bacaJson(request, TanpaMasukan);
  await tarikPersetujuan(sesi);
  return sukses({ ok: true as const }, { headers: { "Set-Cookie": cookieHapus() } });
});
