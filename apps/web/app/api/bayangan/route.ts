import { BayanganBuatMasukan } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { tambahBayangan } from "@/lib/server/layanan/bayangan";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/bayangan — PENGELOLA dengan hak `mode_bayangan`: tambah angka catatan lama (catat-saja).
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const masukan = await bacaJson(request, BayanganBuatMasukan);
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => tambahBayangan(tx, sesi, masukan, new Date())));
});
