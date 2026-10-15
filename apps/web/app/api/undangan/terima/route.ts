import { UndanganTerimaMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { terimaUndangan } from "@/lib/server/auth";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { bacaSesi, cookieSesi } from "@/lib/server/sesi";

// POST /api/undangan/terima — dengan sesi (akun ada) atau tanpa sesi (akun baru: email, sandi, persetujuan).
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const m = await bacaJson(request, UndanganTerimaMasukan);
  const hasil = await terimaUndangan(await bacaSesi(request), m);
  const data = { organisasiId: hasil.organisasiId, peran: hasil.peran };
  return sukses(data, hasil.tokenSesi ? { headers: { "Set-Cookie": cookieSesi(hasil.tokenSesi) } } : {});
});
