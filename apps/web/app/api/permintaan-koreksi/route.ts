import { PermintaanKoreksiBuatMasukan, PermintaanKoreksiDaftarKueri } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { ruteIdempoten } from "@/lib/server/idempoten";
import { ajukanPermintaan, daftarPermintaan } from "@/lib/server/layanan/permintaan-koreksi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/permintaan-koreksi — petugas/pengelola (target kawasan) atau penerima (tiket/rincian miliknya) mengajukan.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA", "PENERIMA");
  const masukan = await bacaJson(request, PermintaanKoreksiBuatMasukan);
  return ruteIdempoten(request, sesi, "POST /api/permintaan-koreksi", (tx, kunci) => ajukanPermintaan(tx, sesi, masukan, kunci, new Date()));
});

// GET /api/permintaan-koreksi?status= — permintaan yang terlihat organisasi aktif (RLS).
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  const kueri = validasi(PermintaanKoreksiDaftarKueri, Object.fromEntries(new URL(request.url).searchParams));
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => daftarPermintaan(tx, kueri.status)));
});
