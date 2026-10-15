import { createHash, timingSafeEqual } from "node:crypto";
import { muatEnv } from "./env";
import { GalatApi } from "./galat";

// Rute cron hanya untuk Railway cron: header Authorization: Bearer ${CRON_SECRET} (§F.5). Tanpa CRON_SECRET → selalu ditolak.
export function wajibCron(request: Request): void {
  const rahasia = muatEnv().CRON_SECRET;
  const h = request.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  // Bandingkan sidik (panjang sama) agar waktu tidak membocorkan isi.
  const sidik = (s: string) => createHash("sha256").update(s).digest();
  if (!rahasia || !token || !timingSafeEqual(sidik(token), sidik(rahasia))) throw new GalatApi("SESI_HABIS");
}
