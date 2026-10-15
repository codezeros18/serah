import { AuthResetMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { resetSandi } from "@/lib/server/auth";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";

// POST /api/auth/reset — token 1 jam, sekali pakai; semua sesi dicabut.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const { token, sandi } = await bacaJson(request, AuthResetMasukan);
  await resetSandi(token, sandi);
  return sukses({ ok: true as const });
});
