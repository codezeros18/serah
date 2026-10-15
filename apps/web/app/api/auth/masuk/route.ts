import { AuthMasukMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { masuk } from "@/lib/server/auth";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { cookieSesi } from "@/lib/server/sesi";
import { ipPermintaan } from "@/lib/server/token";

// POST /api/auth/masuk — batas laju 10/15 menit per (IP, email); email wajib terverifikasi.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const m = await bacaJson(request, AuthMasukMasukan);
  const { token, keluaran } = await masuk(m, ipPermintaan(request));
  return sukses(keluaran, { headers: { "Set-Cookie": cookieSesi(token) } });
});
