import { SesiOrganisasiMasukan } from "@serah/kontrak";
import { cekAsal } from "@/lib/server/akses";
import { denganAuth } from "@/lib/server/db";
import { GalatApi, bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { keluaranSesi, wajibSesi } from "@/lib/server/sesi";

// POST /api/sesi/organisasi — ganti organisasi/peran aktif. Hanya ke keanggotaan aktif milik pengguna sendiri.
export const POST = tanganiRute(async (request: Request) => {
  cekAsal(request);
  const sesi = await wajibSesi(request);
  const { organisasiId, peran } = await bacaJson(request, SesiOrganisasiMasukan);

  await denganAuth(async (tx) => {
    const anggota = await tx.keanggotaan.findFirst({
      where: { penggunaId: sesi.penggunaId, organisasiId, peran, aktif: true },
      select: { id: true },
    });
    if (!anggota) throw new GalatApi("PERAN_TIDAK_BOLEH");
    await tx.sesi.update({ where: { id: sesi.id }, data: { organisasiAktifId: organisasiId, peranAktif: peran } });
  });

  return sukses(await keluaranSesi({ ...sesi, organisasiAktifId: organisasiId, peran }));
});
