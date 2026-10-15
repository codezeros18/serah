import { AuthDaftarMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { daftar } from "@/lib/server/auth";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { ipPermintaan } from "@/lib/server/token";

// POST /api/auth/daftar — persetujuan PDP dicatat sebelum akun dibuat; respons sama walau email sudah terdaftar.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const m = await bacaJson(request, AuthDaftarMasukan);
  await daftar(m, ipPermintaan(request));
  return sukses({ perluVerifikasi: true as const });
});
