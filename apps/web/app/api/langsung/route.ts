import { bukaAliran } from "@/lib/server/sse";
import { tanganiRute } from "@/lib/server/galat";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/langsung — SSE live sync. Event `serah`/`notifikasi` hanya untuk organisasi aktif sesi; heartbeat 25 dtk.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  const { orgIds } = konteksAkses(sesi);
  return new Response(bukaAliran({ orgIds, peran: sesi.peran, signal: request.signal }), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
