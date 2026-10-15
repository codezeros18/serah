import { AdminEntitlementMasukan, AdminPaketParams } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { ubahEntitlement } from "@/lib/server/layanan/admin";

// PUT /api/admin/paket/[kode]/entitlement — ubah satu hak; nilai lama & baru tercatat di perubahan_paket.
export const PUT = tanganiRute(async (request: Request, ctx: { params: Promise<{ kode: string }> }) => {
  const { kode } = validasi(AdminPaketParams, await ctx.params);
  const m = await bacaJson(request, AdminEntitlementMasukan);
  const paket = await dalamAdmin(request, { aksi: "ENTITLEMENT_DIUBAH", objekJenis: "paket", objekId: kode }, (tx, k) =>
    ubahEntitlement(tx, kode, { kunci: m.kunci, nilai: m.nilai }, k.alasan, k.sekarang),
  );
  return sukses({ paket });
});
