import { AuthLupaMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { lupaSandi } from "@/lib/server/auth";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";

// POST /api/auth/lupa — selalu {ok:true}: tidak membocorkan keberadaan email.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const { email } = await bacaJson(request, AuthLupaMasukan);
  await lupaSandi(email);
  return sukses({ ok: true as const });
});
