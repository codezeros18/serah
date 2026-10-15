import { OrganisasiUbahMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { bacaOrganisasiSaya, ubahOrganisasiSaya } from "@/lib/server/layanan/organisasi";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET/PATCH /api/organisasi/saya — organisasi aktif sesi; hanya pengurus.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  const organisasi = await denganAkses(konteksAkses(sesi), (tx) => bacaOrganisasiSaya(tx, sesi));
  return sukses({ organisasi }, { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const m = await bacaJson(request, OrganisasiUbahMasukan);
  const organisasi = await denganAkses(konteksAkses(sesi), (tx) => ubahOrganisasiSaya(tx, sesi, m));
  return sukses({ organisasi });
});
