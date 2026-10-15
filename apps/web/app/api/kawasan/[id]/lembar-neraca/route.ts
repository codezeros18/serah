import { HEADER_SIDIK_ISI, LembarNeracaParams, PeriodeKueri } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { tanganiRute, validasi } from "@/lib/server/galat";
import { lembarNeraca } from "@/lib/server/layanan/laporan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/kawasan/[id]/lembar-neraca?periode=YYYY-MM — PDF berjejak asal: setiap total aliran disertai kode serah
// asal beserta statusnya. Pengelola kawasan miliknya (selain itu 404); butuh hak lembar_neraca.
export const GET = tanganiRute(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const { id } = validasi(LembarNeracaParams, await ctx.params);
  const { periode } = validasi(PeriodeKueri, Object.fromEntries(new URL(request.url).searchParams));
  const hasil = await denganAkses(konteksAkses(sesi), (tx) => lembarNeraca(tx, sesi, id, periode, new Date()));
  return new Response(hasil.isi.slice().buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${hasil.namaBerkas}"`,
      [HEADER_SIDIK_ISI]: hasil.sidikIsi,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
