import { EksporKueri, HEADER_SIDIK_ISI, LaporanParams } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { tanganiRute, validasi } from "@/lib/server/galat";
import { eksporCsv, eksporPdf } from "@/lib/server/layanan/laporan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER_BERKAS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;

// GET /api/laporan/[pihak]/ekspor?periode&format=csv|pdf
// - csv: UTF-8 BOM, pemisah ";", catatan wajib di baris akhir. Tidak pernah dikunci paket (kewajiban hukum pengguna).
// - pdf: kolom, angka, dan sidik sama dengan CSV; butuh hak ekspor.pdf (tanpa hak → HAK_PAKET_TIDAK_ADA).
// Header X-Sidik-Isi = sidik isi tabel (sama untuk CSV & PDF pada pihak & periode yang sama).
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ pihak: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA", "PENGANGKUT", "PENERIMA");
  const { pihak } = validasi(LaporanParams, await ctx.params);
  const { periode, format, kawasanId } = validasi(EksporKueri, Object.fromEntries(new URL(request.url).searchParams));

  if (format === "pdf") {
    const hasil = await denganAkses(konteksAkses(sesi), (tx) => eksporPdf(tx, sesi, pihak, periode, kawasanId, new Date()));
    return new Response(hasil.isi.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${hasil.namaBerkas}"`,
        [HEADER_SIDIK_ISI]: hasil.sidikIsi,
        ...HEADER_BERKAS,
      },
    });
  }

  const hasil = await denganAkses(konteksAkses(sesi), (tx) => eksporCsv(tx, sesi, pihak, periode, kawasanId, new Date()));
  return new Response(hasil.teks, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${hasil.namaBerkas}"`,
      [HEADER_SIDIK_ISI]: hasil.sidikIsi,
      ...HEADER_BERKAS,
    },
  });
});
