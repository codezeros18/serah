import { AuthVerifikasiMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { verifikasiEmail } from "@/lib/server/auth";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";

// POST /api/auth/verifikasi — token 24 jam, sekali pakai.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const { token } = await bacaJson(request, AuthVerifikasiMasukan);
  await verifikasiEmail(token);
  return sukses({ ok: true as const });
});
