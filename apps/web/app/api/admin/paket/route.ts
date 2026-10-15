import { AdminPaketBuatMasukan } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { buatPaket, daftarPaket } from "@/lib/server/layanan/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/paket — semua paket (termasuk nonaktif) + hak.
export const GET = tanganiRute(async (request: Request) => {
  const paket = await dalamAdmin(request, { aksi: "PAKET_DAFTAR", objekJenis: "paket", objekId: "-" }, (tx) => daftarPaket(tx));
  return sukses({ paket }, { headers: { "Cache-Control": "no-store" } });
});

// POST /api/admin/paket — paket baru; tercatat di perubahan_paket.
export const POST = tanganiRute(async (request: Request) => {
  const m = await bacaJson(request, AdminPaketBuatMasukan);
  const paket = await dalamAdmin(request, { aksi: "PAKET_DIBUAT", objekJenis: "paket", objekId: m.kode }, (tx, k) => buatPaket(tx, m, k.alasan, k.sekarang));
  return sukses({ paket });
});
