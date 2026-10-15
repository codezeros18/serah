import { KontrakBuatMasukan, KontrakDaftarKueri } from "@serah/kontrak";
import { cekAsal, wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { bacaJson, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { daftarKontrak, usulKontrak } from "@/lib/server/layanan/kontrak";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

export const dynamic = "force-dynamic";

// POST /api/kontrak — PENGELOLA mengusulkan (status USULAN); pengangkut & penerima diberi notifikasi.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA");
  const m = await bacaJson(request, KontrakBuatMasukan);
  const kontrak = await denganAkses(konteksAkses(sesi), (tx) => usulKontrak(tx, sesi, m, new Date()));
  return sukses({ kontrak });
});

// GET /api/kontrak — semua pihak terkait (RLS: hanya kontrak organisasinya).
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PENGELOLA", "PENGANGKUT", "PENERIMA");
  const { status } = validasi(KontrakDaftarKueri, Object.fromEntries(new URL(request.url).searchParams));
  const kontrak = await denganAkses(konteksAkses(sesi), (tx) => daftarKontrak(tx, sesi, status));
  return sukses({ kontrak }, { headers: { "Cache-Control": "no-store" } });
});
