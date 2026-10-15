import { EksporKueri, HEADER_SIDIK_ISI, LaporanParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { GalatApi, tanganiRute, validasi } from "@/lib/server/galat";
import { eksporCsv } from "@/lib/server/layanan/laporan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/laporan/[pihak]/ekspor?periode&format=csv — CSV UTF-8 BOM, pemisah ";", catatan wajib di baris akhir,
// header X-Sidik-Isi. Ekspor CSV tidak pernah dikunci paket (kewajiban hukum pengguna). PDF = S23.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ pihak: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA", "PENGANGKUT", "PENERIMA");
  const { pihak } = validasi(LaporanParams, await ctx.params);
  const { periode, format, kawasanId } = validasi(EksporKueri, Object.fromEntries(new URL(request.url).searchParams));
  if (format !== "csv") throw new GalatApi("TIDAK_DITEMUKAN"); // PDF: S23-1/S23-3 (hak ekspor.pdf)
  const hasil = await denganAkses(konteksAkses(sesi), (tx) => eksporCsv(tx, sesi, pihak, periode, kawasanId, new Date()));
  return new Response(hasil.teks, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${hasil.namaBerkas}"`,
      [HEADER_SIDIK_ISI]: hasil.sidikIsi,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
