import { TiketBacaMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { wajibDalamBatas } from "@/lib/server/batas-laju";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { bacaTiket } from "@/lib/server/layanan/tiket";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/tiket/baca — saran berlabel dari pembaca tiket; tanpa AI → 503 AI_TIDAK_TERSEDIA (isi manual).
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENERIMA");
  // 30 pembacaan tiket per jam per organisasi (§P.1) — membatasi biaya AI.
  await wajibDalamBatas("TIKET", sesi.organisasiAktifId ?? sesi.id);
  const { fotoId } = await bacaJson(request, TiketBacaMasukan);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => bacaTiket(tx, sesi, fotoId)));
});
