import { AdminIzinParams, AdminIzinPutusMasukan } from "@serah/kontrak";
import { dalamAdmin } from "@/lib/server/admin-rute";
import { bacaJson, GalatApi, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { putuskanIzin } from "@/lib/server/layanan/izin";
import { keDtoOrganisasi } from "@/lib/server/layanan/organisasi";

// POST /api/admin/izin/[organisasiId]/putus — putusan izin (TERVERIFIKASI | DITOLAK). X-Alasan = alasan akses admin;
// `alasan` di body = alasan putusan yang tersimpan di izin_putusan.
export const POST = tanganiRute(async (request: Request, ctx: { params: Promise<{ organisasiId: string }> }) => {
  const { organisasiId } = validasi(AdminIzinParams, await ctx.params);
  const m = await bacaJson(request, AdminIzinPutusMasukan);
  const organisasi = await dalamAdmin(request, { aksi: "IZIN_DIPUTUS", objekJenis: "organisasi", objekId: organisasiId, organisasiId }, async (tx, k) => {
    await putuskanIzin(tx, k.sesi, { organisasiId, keputusan: m.keputusan, alasan: m.alasan }, k.sekarang);
    const o = await tx.organisasi.findUnique({
      where: { id: organisasiId },
      select: { id: true, kode: true, nama: true, jenis: true, jenisPenerima: true, aliranDiterima: true, nomorIzin: true, statusIzin: true, yurisdiksi: true, demo: true },
    });
    if (!o) throw new GalatApi("TIDAK_DITEMUKAN");
    return keDtoOrganisasi(o);
  });
  return sukses({ organisasi });
});
