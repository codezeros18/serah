import { denganPublik } from "@/lib/server/db";
import { sukses, tanganiRute } from "@/lib/server/galat";
import { daftarPaket } from "@/lib/server/layanan/langganan";

export const dynamic = "force-dynamic";

// GET /api/paket — katalog paket (publik).
export const GET = tanganiRute(async () => sukses({ paket: await denganPublik((tx) => daftarPaket(tx)) }));
