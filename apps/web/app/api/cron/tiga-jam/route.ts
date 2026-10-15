import { wajibCron } from "@/lib/server/cron-akses";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { jalankanCron } from "@/lib/server/layanan/cron";

export const dynamic = "force-dynamic";

// POST /api/cron/tiga-jam — Bearer CRON_SECRET; idempoten per jendela (pekerjaan_cron).
export const POST = tanganiRute(async (request: Request) => {
  wajibCron(request);
  return sukses(await jalankanCron("tiga-jam", new Date()));
});
