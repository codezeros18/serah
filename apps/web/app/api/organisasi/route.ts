import { OrganisasiBuatMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { buatOrganisasi } from "@/lib/server/layanan/organisasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/organisasi — pembuat jadi pengurus; KAWASAN langsung uji coba 14 hari; sesi berpindah ke organisasi baru.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const m = await bacaJson(request, OrganisasiBuatMasukan);
  const organisasi = await denganAkses(konteksAkses(sesi), (tx) => buatOrganisasi(tx, sesi, m, new Date()));
  return sukses({ organisasi });
});
