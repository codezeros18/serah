import type { AmplopSukses, HealthKeluaran } from "@serah/kontrak";

export const dynamic = "force-dynamic";

// Kerangka S00: hanya versi. `db` & `bmkgUmurJam` ditambahkan saat DB & BMKG tersambung.
export function GET() {
  const versi = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  const isi: AmplopSukses<HealthKeluaran> = { ok: true, data: { versi } };
  return Response.json(isi, { headers: { "Cache-Control": "no-store" } });
}
