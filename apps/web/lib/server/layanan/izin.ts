import { evaluasiKontrak } from "@serah/core/aturan";
import type { Prisma } from "@serah/db";
import { TEKS, type JenisOrganisasi, type StatusIzin, type Yurisdiksi } from "@serah/kontrak";
import { ALASAN_ADMIN_MIN, type Tx } from "../db";
import { GalatApi } from "../galat";
import { buatNotifikasi } from "../notifikasi";
import type { Sesi } from "../sesi";
import { wajibPengurusAktif } from "../auth";

// Izin pelaku usaha (R-11, FITUR F23). Pengangkut & penerima mengajukan; ADMIN memutus (lewat denganAdmin).
// Status: BELUM_DIAJUKAN | DITOLAK → (ajukan) MENUNGGU → (putus) TERVERIFIKASI | DITOLAK.
// Sistem hanya mencatat hasil pemeriksaan; ia tidak pernah menyatakan siapa pun melanggar hukum.

const JENIS_PENGAJU: readonly JenisOrganisasi[] = ["PENGANGKUT", "PENERIMA"];
export const AKSI_AUDIT_IZIN_DIAJUKAN = "IZIN_DIAJUKAN";

// ── Ajukan (S15-1) ─────────────────────────────────────────────────────────

export async function ajukanIzin(tx: Tx, sesi: Sesi, m: { nomorIzin: string; fotoDokumenId?: string | undefined }, sekarang: Date): Promise<{ statusIzin: "MENUNGGU" }> {
  const id = await wajibPengurusAktif(tx, sesi);
  const org = await tx.organisasi.findUnique({ where: { id }, select: { jenis: true, statusIzin: true } });
  if (!org) throw new GalatApi("TIDAK_DITEMUKAN");
  // Hanya pengangkut & penerima yang berurusan dengan izin (§G); kawasan tidak.
  if (!JENIS_PENGAJU.includes(org.jenis)) throw new GalatApi("PERAN_TIDAK_BOLEH");
  // Sedang diperiksa atau sudah terverifikasi: tidak diajukan ulang.
  if (org.statusIzin === "MENUNGGU" || org.statusIzin === "TERVERIFIKASI") throw new GalatApi("TRANSISI_TIDAK_SAH");

  if (m.fotoDokumenId) {
    const f = await tx.foto.findUnique({ where: { id: m.fotoDokumenId }, select: { jenis: true, organisasiId: true } });
    if (!f || f.jenis !== "DOKUMEN_IZIN" || f.organisasiId !== id) {
      throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["fotoDokumenId"], kode: "foto_dokumen_izin" }] });
    }
  }

  await tx.organisasi.update({ where: { id }, data: { nomorIzin: m.nomorIzin.trim(), statusIzin: "MENUNGGU" } });
  // Jejak pengajuan untuk admin (tabel catat-saja). Foto dokumen dirujuk di sini karena organisasi tak punya kolomnya.
  await tx.auditLog.createMany({
    data: [
      {
        organisasiId: id,
        peran: sesi.peran,
        aksi: AKSI_AUDIT_IZIN_DIAJUKAN,
        objekJenis: "organisasi",
        objekId: id,
        data: { nomorIzin: m.nomorIzin.trim(), fotoId: m.fotoDokumenId ?? null } as Prisma.InputJsonValue,
        dibuatPada: sekarang,
      },
    ],
  });
  return { statusIzin: "MENUNGGU" };
}

// ── Putusan admin (S15-2) ──────────────────────────────────────────────────

export type MasukanPutusan = { organisasiId: string; keputusan: "TERVERIFIKASI" | "DITOLAK"; alasan: string };

export type HasilPutusan = { statusIzin: StatusIzin; kontrakDiaktifkan: number };

/**
 * Putusan atas izin yang MENUNGGU. Dipanggil di dalam `denganAdmin` (alasan ≥15 & audit_log dari pintu itu).
 * Menulis izin_putusan (🔒), mengubah status_izin, mengirim IZIN_DIPUTUS ke organisasi, dan — bila TERVERIFIKASI —
 * mengevaluasi ulang kontrak USULAN yang menunggu izin ini.
 */
export async function putuskanIzin(tx: Tx, sesi: Sesi, m: MasukanPutusan, sekarang: Date): Promise<HasilPutusan> {
  if (sesi.peran !== "ADMIN") throw new GalatApi("PERAN_TIDAK_BOLEH");
  const alasan = m.alasan.trim();
  if (alasan.length < ALASAN_ADMIN_MIN) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "ADM_ALASAN_PENDEK" });

  const org = await tx.organisasi.findUnique({ where: { id: m.organisasiId }, select: { id: true, jenis: true, statusIzin: true, nomorIzin: true } });
  if (!org) throw new GalatApi("TIDAK_DITEMUKAN");
  if (!JENIS_PENGAJU.includes(org.jenis)) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["organisasiId"], kode: "bukan_pengangkut_atau_penerima" }] });
  if (org.statusIzin !== "MENUNGGU") throw new GalatApi("TRANSISI_TIDAK_SAH");

  const pengajuan = await tx.auditLog.findFirst({
    where: { organisasiId: org.id, aksi: AKSI_AUDIT_IZIN_DIAJUKAN },
    orderBy: { dibuatPada: "desc" },
    select: { data: true },
  });
  const fotoId = (pengajuan?.data as { fotoId?: string | null } | null)?.fotoId ?? null;

  await tx.izinPutusan.createMany({
    data: [{ organisasiId: org.id, nomorIzin: org.nomorIzin ?? "-", keputusan: m.keputusan, alasan, fotoId, diputusPada: sekarang }],
  });
  await tx.organisasi.update({ where: { id: org.id }, data: { statusIzin: m.keputusan } });

  await buatNotifikasi(
    tx,
    [{ jenis: "IZIN_DIPUTUS", organisasiId: org.id, objekKode: org.id, data: { status: m.keputusan === "TERVERIFIKASI" ? TEKS.IZIN_TERVERIFIKASI : TEKS.IZIN_DITOLAK } }],
    sekarang,
  );

  const kontrakDiaktifkan = m.keputusan === "TERVERIFIKASI" ? await evaluasiUlangKontrakMenunggu(tx, org.id) : 0;
  return { statusIzin: m.keputusan, kontrakDiaktifkan };
}

/**
 * Kontrak USULAN ke penerima ini yang sudah dikonfirmasi KEDUA pihak tetapi belum aktif (karena R-11 saat itu):
 * dinilai ulang dengan evaluator core; lulus → AKTIF. Konfirmasi yang belum lengkap tidak diubah (pihak yang
 * kurang tetap harus mengonfirmasi sendiri).
 */
export async function evaluasiUlangKontrakMenunggu(tx: Tx, penerimaId: string): Promise<number> {
  const penerima = await tx.organisasi.findUnique({ where: { id: penerimaId }, select: { id: true, jenisPenerima: true, aliranDiterima: true, statusIzin: true } });
  if (!penerima?.jenisPenerima) return 0;
  const menunggu = await tx.kontrak.findMany({
    where: { orgPenerimaId: penerimaId, status: "USULAN", dikonfirmasiPengangkutPada: { not: null }, dikonfirmasiPenerimaPada: { not: null } },
    select: { id: true, orgKawasanId: true },
  });
  let n = 0;
  for (const k of menunggu) {
    const pemilik = await tx.organisasi.findUnique({ where: { id: k.orgKawasanId }, select: { yurisdiksi: true } });
    const yurisdiksi: Yurisdiksi = pemilik?.yurisdiksi ?? "DKI";
    const tolak = evaluasiKontrak({
      yurisdiksi,
      penerima: { id: penerima.id, jenis: penerima.jenisPenerima, aliranDiterima: penerima.aliranDiterima, statusIzin: penerima.statusIzin },
    }).some((h) => h.aksi === "TOLAK");
    if (tolak) continue;
    await tx.kontrak.update({ where: { id: k.id }, data: { status: "AKTIF" } });
    n += 1;
  }
  return n;
}
