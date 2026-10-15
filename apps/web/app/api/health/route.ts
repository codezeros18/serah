import type { AmplopSukses, HealthKeluaran } from "@serah/kontrak";
import { denganPublik } from "@/lib/server/db";

export const dynamic = "force-dynamic";

const JAM_MS = 3_600_000;

// GET /api/health — versi, koneksi DB, umur prakiraan BMKG terbaru (jam). Publik; tanpa data organisasi.
// Hanya membaca tabel global prakiraan_cuaca (kebijakan RLS baca = semua), jadi tidak butuh konteks sesi.
export async function GET() {
  const versi = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  let isi: HealthKeluaran;
  try {
    const [r] = await denganPublik((tx) => tx.$queryRaw<{ terbaru: Date | null }[]>`SELECT max(analysis_date) AS terbaru FROM prakiraan_cuaca`);
    const terbaru = r?.terbaru ?? null;
    isi = { versi, db: "ok", bmkgUmurJam: terbaru ? Math.max(0, Math.floor((Date.now() - terbaru.getTime()) / JAM_MS)) : null };
  } catch {
    isi = { versi, db: "galat", bmkgUmurJam: null };
  }
  const amplop: AmplopSukses<HealthKeluaran> = { ok: true, data: isi };
  return Response.json(amplop, { status: isi.db === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
