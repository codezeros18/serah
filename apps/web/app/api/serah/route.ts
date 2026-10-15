import { SerahBuatMasukan, SerahDaftarKueri } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { buatSerah, daftarSerah } from "@/lib/server/layanan/serah";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/serah — buat serah DRAF dari wadah TPS (Idempotency-Key wajib).
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA");
  const masukan = await bacaJson(request, SerahBuatMasukan);
  return ruteIdempoten(request, sesi, "POST /api/serah", (tx, kunci) => buatSerah(tx, sesi, masukan, kunci, new Date()));
});

// GET /api/serah — serah yang terlihat sesi (RLS), terbaru dulu.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA");
  const kueri = validasi(SerahDaftarKueri, Object.fromEntries(new URL(request.url).searchParams));
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => daftarSerah(tx, kueri)));
});
