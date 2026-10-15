import { dalamAdmin } from "@/lib/server/admin-rute";
import { muatEnv } from "@/lib/server/env";
import { GalatApi, sukses, tanganiRute } from "@/lib/server/galat";
import { jalankanResetDemo } from "@/lib/server/layanan/demo-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/demo/reset — HANYA bila DEMO_MODE=true (selain itu 404). Mengembalikan basis data ke keadaan seed.
export const POST = tanganiRute(async (request: Request) => {
  // Alasan & audit permintaan diselesaikan (commit) LEBIH DULU: reset memerlukan kunci eksklusif atas semua tabel.
  const alasan = await dalamAdmin(request, { aksi: "DEMO_RESET_DIMINTA", objekJenis: "demo", objekId: "-" }, async (_tx, k) => {
    if (!muatEnv().DEMO_MODE) throw new GalatApi("TIDAK_DITEMUKAN");
    return k.alasan;
  });
  await jalankanResetDemo(alasan);
  return sukses({ ok: true });
});
