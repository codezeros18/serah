import { FotoUnggahMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { wajibDalamBatas } from "@/lib/server/batas-laju";
import { denganAkses } from "@/lib/server/db";
import { GalatApi, sukses, tanganiRute, validasi } from "@/lib/server/galat";
import { unggahFoto } from "@/lib/server/layanan/foto";
import { konteksAkses, wajibSesi } from "@/lib/server/sesi";

// POST /api/foto — multipart (jenis, berkas, serahKode). Metadata dibuang sebelum disimpan; R-04 untuk MUATAN.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  // 120 foto per jam per organisasi (§P.1), dihitung sebelum berkas dibaca.
  await wajibDalamBatas("FOTO", sesi.organisasiAktifId ?? sesi.id);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new GalatApi("VALIDASI_GAGAL");
  }
  const masukan = validasi(FotoUnggahMasukan, Object.fromEntries(form.entries()));
  return sukses(await denganAkses(konteksAkses(sesi), (tx) => unggahFoto(tx, sesi, masukan, new Date())));
});
