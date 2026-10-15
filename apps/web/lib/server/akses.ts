import type { Peran } from "@serah/kontrak";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";
import type { Sesi } from "./sesi";

// Lapis kedua otorisasi (setelah RLS): peran di route handler, dan pemeriksaan asal permintaan (CSRF).

/** Mutasi wajib header Origin = BASE_URL (§K.1, §P.1). Webhook & cron dikecualikan oleh pemanggilnya. */
export function cekAsal(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const asal = request.headers.get("origin");
  if (!asal || asal !== new URL(muatEnv().BASE_URL).origin) throw new GalatApi("VALIDASI_GAGAL");
}

/** Peran aktif sesi harus salah satu dari daftar. */
export function wajibPeran(sesi: Sesi, ...peran: Peran[]): Peran {
  if (!sesi.peran || !peran.includes(sesi.peran)) throw new GalatApi("PERAN_TIDAK_BOLEH");
  return sesi.peran;
}
