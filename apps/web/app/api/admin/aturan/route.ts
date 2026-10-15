import { AdminAturanBuatMasukan } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { daftarAturan, tambahVersiAturan } from "@/lib/server/layanan/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/aturan — semua versi aturan berpasal.
export const GET = tanganiRute(async (request: Request) => {
  const aturan = await dalamAdmin(request, { aksi: "ATURAN_DAFTAR", objekJenis: "aturan", objekId: "-" }, (tx) => daftarAturan(tx));
  return sukses({ aturan }, { headers: { "Cache-Control": "no-store" } });
});

// POST /api/admin/aturan — versi BARU (versi lama tidak pernah diubah; berlaku_dari tidak di masa lalu).
export const POST = tanganiRute(async (request: Request) => {
  const m = await bacaJson(request, AdminAturanBuatMasukan);
  const aturan = await dalamAdmin(request, { aksi: "ATURAN_VERSI_BARU", objekJenis: "aturan", objekId: m.kode }, (tx, k) => tambahVersiAturan(tx, m, k.sekarang));
  return sukses({ aturan });
});
