import { dalamAdmin } from "@/lib/server/admin-rute";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { daftarOrganisasi } from "@/lib/server/layanan/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/organisasi — semua organisasi (X-Alasan wajib; tercatat di audit_log).
export const GET = tanganiRute(async (request: Request) => {
  const organisasi = await dalamAdmin(request, { aksi: "ORGANISASI_DAFTAR", objekJenis: "organisasi", objekId: "-" }, (tx) => daftarOrganisasi(tx));
  return sukses({ organisasi }, { headers: { "Cache-Control": "no-store" } });
});
