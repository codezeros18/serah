import type { AmplopSukses, HealthKeluaran } from "@serah/kontrak";
import { denganPublik, denganSistem } from "@/lib/server/db";
import { NAMA_CRON } from "@/lib/server/layanan/cron";

export const dynamic = "force-dynamic";

const JAM_MS = 3_600_000;

// GET /api/health — versi, koneksi DB, umur prakiraan BMKG terbaru (jam), selesai terakhir tiap cron (S26-4).
// Publik; tanpa data organisasi. Healthcheck Railway (railway.json): DB tidak terjangkau → 503 → deploy ditahan.
// prakiraan_cuaca baca-semua (RLS); pekerjaan_cron hanya nama & waktu (bukan data pengguna), dibaca konteks sistem.
export async function GET() {
  const versi = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
  let isi: HealthKeluaran;
  try {
    const [r] = await denganPublik((tx) => tx.$queryRaw<{ terbaru: Date | null }[]>`SELECT max(analysis_date) AS terbaru FROM prakiraan_cuaca`);
    const terbaru = r?.terbaru ?? null;
    const cron = await denganSistem((tx) =>
      tx.$queryRaw<{ nama: string; selesai: Date | null }[]>`SELECT nama, max(selesai_pada) AS selesai FROM pekerjaan_cron GROUP BY nama`,
    );
    const selesai = new Map(cron.map((c) => [c.nama, c.selesai]));
    isi = {
      versi,
      db: "ok",
      bmkgUmurJam: terbaru ? Math.max(0, Math.floor((Date.now() - terbaru.getTime()) / JAM_MS)) : null,
      cron: NAMA_CRON.map((nama) => ({ nama, selesaiPada: selesai.get(nama)?.toISOString() ?? null })),
    };
  } catch {
    isi = { versi, db: "galat", bmkgUmurJam: null };
  }
  const amplop: AmplopSukses<HealthKeluaran> = { ok: true, data: isi };
  return Response.json(amplop, { status: isi.db === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
