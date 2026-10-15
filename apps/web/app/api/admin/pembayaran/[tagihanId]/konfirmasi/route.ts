import { AdminKonfirmasiMasukan, AdminPembayaranParams } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { konfirmasiPembayaran } from "@/lib/server/layanan/admin";

// POST /api/admin/pembayaran/[tagihanId]/konfirmasi — SETUJUI → LUNAS (+ langganan AKTIF); TOLAK → kembali TERBIT.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ tagihanId: string }> }) => {
  const { tagihanId } = validasi(AdminPembayaranParams, await ctx.params);
  const m = await bacaJson(request, AdminKonfirmasiMasukan);
  const tagihan = await dalamAdmin(request, { aksi: "PEMBAYARAN_KONFIRMASI", objekJenis: "tagihan", objekId: tagihanId }, (tx, k) =>
    konfirmasiPembayaran(tx, tagihanId, m.keputusan, m.alasan, k.sekarang),
  );
  return sukses({ tagihan });
});
