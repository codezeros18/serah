import { AkunNotifikasiUbahMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { bacaPreferensi, ubahPreferensi } from "@/lib/server/akun";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// GET/PUT /api/akun/notifikasi — preferensi email & push per organisasi keanggotaan.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  return sukses({ preferensi: await bacaPreferensi(sesi) }, { headers: { "Cache-Control": "no-store" } });
});

export const PUT = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const p = await bacaJson(request, AkunNotifikasiUbahMasukan);
  return sukses({ preferensi: await ubahPreferensi(sesi, p) });
});
