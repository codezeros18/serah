import { GalatApi, tanganiRute } from "@/lib/server/galat";
import { integrasi, tandaFotoSah } from "@/lib/server/integrasi-stub";

// GET /api/foto/berkas?k&e&t — penyaji objek foto untuk penyimpanan aktif (lokal atau R2 privat).
// Hanya lewat URL bertanda tangan (HMAC, 5 menit) yang diterbitkan untuk pihak serah; tanda salah/kedaluwarsa → 404.
const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export const GET = tanganiRute(async (request: Request) => {
  const q = new URL(request.url).searchParams;
  const kunci = q.get("k") ?? "";
  if (!tandaFotoSah(kunci, Number(q.get("e")), q.get("t") ?? "", new Date())) throw new GalatApi("TIDAK_DITEMUKAN");
  const isi = await integrasi().penyimpanan.baca(kunci);
  if (!isi) throw new GalatApi("TIDAK_DITEMUKAN");
  return new Response(isi.slice().buffer as ArrayBuffer, {
    headers: { "Content-Type": MIME[kunci.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
});
