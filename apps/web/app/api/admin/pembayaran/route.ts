import { AdminPembayaranKueri } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { daftarPembayaran } from "@/lib/server/layanan/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/pembayaran?status= — tagihan lintas organisasi + antrean tinjauan pembayaran.
export const GET = tanganiRute(async (request: Request) => {
  const { status } = validasi(AdminPembayaranKueri, Object.fromEntries(new URL(request.url).searchParams));
  const hasil = await dalamAdmin(request, { aksi: "PEMBAYARAN_DAFTAR", objekJenis: "tagihan", objekId: "-" }, (tx) => daftarPembayaran(tx, status));
  return sukses(hasil, { headers: { "Cache-Control": "no-store" } });
});
