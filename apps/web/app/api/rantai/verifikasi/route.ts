import { RantaiVerifikasiKueri } from "@serah/kontrak";
import { wajibPeran } from "@/lib/server/akses";
import { denganAkses } from "@/lib/server/db";
import { GalatApi, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// GET /api/rantai/verifikasi?kawasanId — fungsi SQL SECURITY DEFINER menghitung ulang rantai kawasan dan hanya
// mengembalikan {utuh, jumlah, patahDiUrutan}. Bukan pihak terkait kawasan → 404.
export const GET = tanganiRute(async (request: Request) => {
  const sesi = await wajibSesi(request);
  wajibPeran(sesi, "PETUGAS", "PENGELOLA", "PENGANGKUT", "PENERIMA");
  const { kawasanId } = validasi(RantaiVerifikasiKueri, Object.fromEntries(new URL(request.url).searchParams));
  const hasil = await denganAkses(konteksAkses(sesi), async (tx) => {
    const terkait = await tx.$queryRaw<{ ok: boolean }[]>`SELECT app_terkait_kawasan(${kawasanId}) AS ok`;
    if (!terkait[0]?.ok) throw new GalatApi("TIDAK_DITEMUKAN");
    const [r] = await tx.$queryRaw<{ utuh: boolean; jumlah: number; patah_di_urutan: number | null }[]>`SELECT * FROM verifikasi_rantai(${kawasanId})`;
    if (!r) throw new GalatApi("TIDAK_DITEMUKAN");
    return { utuh: r.utuh, jumlah: r.jumlah, patahDiUrutan: r.patah_di_urutan };
  });
  return sukses(hasil);
});
