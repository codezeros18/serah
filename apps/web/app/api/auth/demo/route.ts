import { AuthDemoMasukan, emailDemo, type AuthDemoKeluaran } from "@serah/kontrak";
import type { z } from "zod";
import { cekAsal } from "@/lib/server/akses";
import { denganAuth } from "@/lib/server/db";
import { muatEnv } from "@/lib/server/env";
import { GalatApi, bacaJson, sukses, tanganiRute } from "@/lib/server/galat";
import { buatSesi, cookieSesi, organisasiPengguna } from "@/lib/server/sesi";

// POST /api/auth/demo — masuk sebagai akun demo per peran, tanpa sandi. Hanya bila DEMO_MODE=true.
export const POST = tanganiRute(async (request: Request) => {
  if (!muatEnv().DEMO_MODE) throw new GalatApi("TIDAK_DITEMUKAN");
  cekAsal(request);
  const { peran } = await bacaJson(request, AuthDemoMasukan);

  const { token, keluaran } = await denganAuth(async (tx) => {
    const anggota = await tx.keanggotaan.findFirst({
      where: { peran, aktif: true, pengguna: { email: emailDemo(peran), dihapusPada: null }, organisasi: { demo: true } },
      orderBy: { dibuatPada: "asc" },
    });
    if (!anggota) throw new GalatApi("TIDAK_DITEMUKAN");
    const { token } = await buatSesi(tx, { penggunaId: anggota.penggunaId, organisasiAktifId: anggota.organisasiId, peranAktif: peran });
    const keluaran: z.infer<typeof AuthDemoKeluaran> = {
      sesi: { organisasi: await organisasiPengguna(tx, anggota.penggunaId), peranAktif: peran },
    };
    return { token, keluaran };
  });

  return sukses(keluaran, { headers: { "Set-Cookie": cookieSesi(token) } });
});
