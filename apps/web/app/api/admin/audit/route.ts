import { AdminAuditKueri } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { daftarAudit } from "@/lib/server/layanan/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/audit?dari=&sampai=&organisasiId=&aksi= — jejak audit tanpa nama/email orang.
export const GET = tanganiRute(async (request: Request) => {
  const kueri = validasi(AdminAuditKueri, Object.fromEntries(new URL(request.url).searchParams));
  const audit = await dalamAdmin(request, { aksi: "AUDIT_DIBACA", objekJenis: "audit_log", objekId: "-" }, (tx) => daftarAudit(tx, kueri));
  return sukses({ audit }, { headers: { "Cache-Control": "no-store" } });
});
