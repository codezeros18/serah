import { WebhookPembayaranMasukan } from "@serah/kontrak";
import { bacaJson, GalatApi, responsGalat, sukses, tanganiRute } from "@/lib/server/galat";
import { terimaNotifikasi } from "@/lib/server/layanan/tagihan";

export const dynamic = "force-dynamic";

// POST /api/webhook/midtrans — tanpa sesi & tanpa cek asal; keaslian dari tanda tangan penyedia (adaptor bayar).
// Tanda tangan salah → 401 tanpa menyimpan apa pun. Peristiwa tercatat (baru atau duplikat) → 200.
export const POST = tanganiRute(async (request: Request) => {
  const isi = await bacaJson(request, WebhookPembayaranMasukan);
  const h = await terimaNotifikasi(isi);
  if (h.status === "TIDAK_SAH") return responsGalat(new GalatApi("SESI_HABIS"));
  return sukses({ diterima: true as const });
});
