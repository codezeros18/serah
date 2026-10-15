import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { GalatApi } from "../galat";

// Reset demo (S21-4). Dijalankan sebagai proses anak: tabel catat-saja hanya bisa dikosongkan oleh pemilik tabel
// (DATABASE_URL_MIGRASI) dengan menonaktifkan trigger di dalam satu transaksi — kredensial itu TIDAK dipakai role
// runtime. Pemanggil (rute) sudah memastikan peran ADMIN, X-Alasan, dan DEMO_MODE=true.

const BERKAS = "packages/db/seed/reset-demo.ts";
const BATAS_WAKTU_MS = 180_000;

function cariAkar(dari: string): string {
  let d = dari;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(d, BERKAS))) return d;
    const atas = dirname(d);
    if (atas === d) break;
    d = atas;
  }
  throw new GalatApi("GALAT_SERVER");
}

export async function jalankanResetDemo(alasan: string): Promise<void> {
  const akar = cariAkar(process.cwd());
  await new Promise<void>((selesai, gagal) => {
    execFile(
      process.execPath,
      [resolve(akar, BERKAS)],
      { cwd: resolve(akar, "packages/db"), env: { ...process.env, DEMO_MODE: "true", DEMO_RESET_ALASAN: alasan }, timeout: BATAS_WAKTU_MS, maxBuffer: 1024 * 1024 },
      (galat, _out, err) => {
        if (!galat) return selesai();
        // Keluaran proses anak bisa memuat detail DB; yang dicatat hanya akhir pesan tanpa kredensial.
        process.stderr.write(`[serah] demo reset gagal: ${String(err).split("\n").filter(Boolean).slice(-1)[0] ?? "unknown"}\n`);
        gagal(new GalatApi("GALAT_SERVER"));
      },
    );
  });
}
