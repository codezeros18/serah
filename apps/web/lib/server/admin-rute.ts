import { cekAsal, wajibPeran } from "./akses";
import { denganAdmin, type CatatanAdmin, type Tx } from "./db";
import { konteksAkses, wajibSesi, type Sesi } from "./sesi";

// Pintu semua rute /api/admin/* (S21-1): peran ADMIN, header X-Alasan (≥15 karakter) untuk SETIAP rute — baca
// maupun mutasi — dan satu baris audit_log di transaksi yang sama (denganAdmin). Alasan tidak pernah di body.
// Tanpa/terlalu pendek → 400 (ADM_ALASAN_PENDEK) sebelum data apa pun dibaca.

export const HEADER_ALASAN = "x-alasan";

export type KonteksAdmin = { sesi: Sesi; alasan: string; sekarang: Date };

export async function dalamAdmin<T>(request: Request, catatan: CatatanAdmin, fn: (tx: Tx, k: KonteksAdmin) => Promise<T>): Promise<T> {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "ADMIN");
  const alasan = request.headers.get(HEADER_ALASAN) ?? "";
  const sekarang = new Date();
  return denganAdmin(konteksAkses(sesi), alasan, (tx) => fn(tx, { sesi, alasan, sekarang }), catatan);
}
