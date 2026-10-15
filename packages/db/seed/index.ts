// `pnpm --filter @serah/db db:seed` — seed global (selalu) + demo (hanya DEMO_MODE=true). Satu transaksi.
import { sambung, tulis } from "./alat.ts";
import { seedDemo } from "./demo.ts";
import { seedGlobal } from "./global.ts";

const k = await sambung();
try {
  await k.query("BEGIN");
  await seedGlobal(k);
  tulis("✓ global: teks persetujuan, paket & hak, alasan tolak, aturan berpasal, harga material");
  if (process.env.DEMO_MODE === "true") await seedDemo(k, new Date());
  else tulis("· DEMO_MODE bukan true — seed demo tidak dijalankan");
  await k.query("COMMIT");
} catch (e) {
  await k.query("ROLLBACK");
  throw e;
} finally {
  await k.end();
}
