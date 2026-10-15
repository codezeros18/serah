// `pnpm demo:reset` — kembalikan basis data ke keadaan seed (global + demo). HANYA bila DEMO_MODE=true.
// Dipakai juga oleh POST /api/admin/demo/reset (proses anak dengan kredensial pemilik, bukan role runtime).
//
// Tabel catat-saja menolak UPDATE/DELETE/TRUNCATE lewat trigger; pemilik tabel boleh menonaktifkan trigger pengguna
// SELAMA transaksi ini saja (DDL transaksional → semua kembali bila gagal). Setelah TRUNCATE trigger diaktifkan lagi
// SEBELUM seed, sehingga seed berjalan di bawah aturan normal. Idempoten: dijalankan 2× menghasilkan data yang sama
// (kode, jumlah, status); hanya id & stempel waktu yang baru.
import { idBaru, sambung, sisip, tulis } from "./alat.ts";
import { seedDemo } from "./demo.ts";
import { seedGlobal } from "./global.ts";

if (process.env.DEMO_MODE !== "true") {
  process.stderr.write("demo:reset ditolak: DEMO_MODE bukan true\n");
  process.exit(1);
}

const alasan = (process.env.DEMO_RESET_ALASAN ?? "pnpm demo:reset").trim().slice(0, 500);
const k = await sambung();
try {
  await k.query("BEGIN");
  const tabel = (
    await k.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations' ORDER BY tablename`)
  ).rows.map((r) => `"${r.tablename}"`);
  if (tabel.length === 0) throw new Error("Tidak ada tabel — jalankan migrasi dulu");

  for (const t of tabel) await k.query(`ALTER TABLE ${t} DISABLE TRIGGER USER`);
  await k.query(`TRUNCATE ${tabel.join(", ")} RESTART IDENTITY CASCADE`);
  for (const t of tabel) await k.query(`ALTER TABLE ${t} ENABLE TRIGGER USER`);

  await seedGlobal(k);
  const sekarang = new Date();
  await seedDemo(k, sekarang);
  // Jejak reset itu sendiri (audit_log ikut dikosongkan, jadi ini baris pertama sesudah reset).
  await sisip(
    k,
    "audit_log",
    { id: idBaru(), organisasi_id: null, peran: "ADMIN", aksi: "DEMO_RESET", objek_jenis: "demo", objek_id: "-", alasan, data: {}, dibuat_pada: sekarang },
    { json: ["data"] },
  );
  await k.query("COMMIT");
  tulis("✓ demo di-reset: global + demo di-seed ulang");
} catch (e) {
  await k.query("ROLLBACK");
  throw e;
} finally {
  await k.end();
}
