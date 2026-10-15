import { createHash } from "node:crypto";
import { evaluasiTPS, type HasilAturan, type WadahBelumDiserahkan } from "@serah/core/aturan";
import { selisihJam } from "@serah/core/waktu";
import type { Aliran, Peran, RujukanAturan, StatusSerah, Yurisdiksi } from "@serah/kontrak";
import type { Tx } from "../db";
import { muatEnv } from "../env";
import { GalatApi } from "../galat";
import type { Sesi } from "../sesi";
import { tambahEvent } from "./transisi";

// Layanan petugas (S08-2): QR TPS, catat wadah per aliran, wadah menunggu + peringatan R-05/R-06/R-09.

/** Serah yang sudah DIANGKUT atau tertutup: wadahnya dianggap sudah diserahkan (R-05/R-06/R-10). */
const STATUS_SUDAH_DIANGKUT: readonly StatusSerah[] = ["DIANGKUT", "MENGGANTUNG", "DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"];

export function hashTokenQr(token: string): string {
  return createHash("sha256").update(token + muatEnv().TOKEN_PEPPER, "utf8").digest("hex");
}

export function rujukan(h: HasilAturan): RujukanAturan {
  return { kode: h.kode, aksi: h.aksi, teks: h.teks };
}

export type TpsAkses = { id: string; kode: string; nama: string; aktif: boolean; latE6: number; lonE6: number; kawasanId: string; organisasiId: string };

/** TPS yang terlihat sesi (RLS). Tidak terlihat / tidak ada → 404. */
export async function muatTps(tx: Tx, id: string): Promise<TpsAkses> {
  const t = await tx.tps.findUnique({
    where: { id },
    select: { id: true, kode: true, nama: true, aktif: true, latE6: true, lonE6: true, kawasanId: true, organisasiId: true },
  });
  if (!t) throw new GalatApi("TIDAK_DITEMUKAN");
  return t;
}

/** Yurisdiksi aturan = yurisdiksi organisasi kawasan. */
export async function yurisdiksiKawasan(tx: Tx, kawasanId: string): Promise<Yurisdiksi> {
  const k = await tx.kawasan.findUnique({ where: { id: kawasanId }, select: { organisasi: { select: { yurisdiksi: true } } } });
  return k?.organisasi.yurisdiksi ?? "DKI";
}

/** GET /api/tps/qr/[token]: TPS aktif milik kawasan sesi. */
export async function tpsDariQr(tx: Tx, token: string) {
  const t = await tx.tps.findUnique({
    where: { qrTokenHash: hashTokenQr(token) },
    select: { id: true, kode: true, nama: true, aktif: true, kawasan: { select: { id: true, kode: true, nama: true } } },
  });
  if (!t || !t.aktif) throw new GalatApi("TIDAK_DITEMUKAN", { kunciPesan: "G_QR_TIDAK_DIKENAL" });
  return { tps: { id: t.id, kode: t.kode, nama: t.nama }, kawasan: t.kawasan };
}

/** Wadah TPS yang belum diserahkan: tanpa serah, atau serahnya masih DRAF/MENUNGGU_SETUJU. */
export async function wadahBelumDiserahkan(tx: Tx, tpsId: string): Promise<{ id: string; aliran: Aliran; beratG: number | null; jumlahWadah: number | null; terjadiPada: Date; diSerah: boolean }[]> {
  const baris = await tx.wadahCatat.findMany({
    where: { tpsId, OR: [{ serahWadah: null }, { serahWadah: { serah: { status: { notIn: [...STATUS_SUDAH_DIANGKUT] } } } }] },
    select: { id: true, aliran: true, beratG: true, jumlahWadah: true, terjadiPada: true, serahWadah: { select: { serahId: true } } },
    orderBy: { terjadiPada: "asc" },
  });
  return baris.map((w) => ({ id: w.id, aliran: w.aliran, beratG: w.beratG, jumlahWadah: w.jumlahWadah, terjadiPada: w.terjadiPada, diSerah: w.serahWadah !== null }));
}

/** Peringatan R-05/R-06/R-09 untuk satu TPS (dipakai T1/T2 & cron). */
export async function peringatanTps(tx: Tx, tps: TpsAkses, sekarang: Date): Promise<HasilAturan[]> {
  const belum: WadahBelumDiserahkan[] = (await wadahBelumDiserahkan(tx, tps.id)).map((w) => ({ aliran: w.aliran, terjadiPada: w.terjadiPada }));
  const sejak = new Date(sekarang.getTime() - 2 * 86_400_000);
  const catatan = await tx.wadahCatat.findMany({ where: { tpsId: tps.id, terjadiPada: { gte: sejak } }, select: { terjadiPada: true } });
  return evaluasiTPS({
    yurisdiksi: await yurisdiksiKawasan(tx, tps.kawasanId),
    sekarang,
    kodeTps: tps.kode,
    aktif: tps.aktif,
    wadahBelumDiserahkan: belum,
    waktuCatatan: catatan.map((c) => c.terjadiPada),
  });
}

/** GET /api/tps/[id]/menunggu: wadah yang belum masuk serah + peringatan. */
export async function wadahMenunggu(tx: Tx, tpsId: string, sekarang: Date) {
  const tps = await muatTps(tx, tpsId);
  const belum = await wadahBelumDiserahkan(tx, tps.id);
  const peringatan = await peringatanTps(tx, tps, sekarang);
  return {
    wadah: belum
      .filter((w) => !w.diSerah)
      .map((w) => ({
        id: w.id,
        aliran: w.aliran,
        beratG: w.beratG,
        jumlahWadah: w.jumlahWadah,
        terjadiPada: w.terjadiPada.toISOString(),
        umurJam: Math.max(0, selisihJam(w.terjadiPada, sekarang)),
      })),
    peringatan: peringatan.map(rujukan),
  };
}

export type MasukanCatat = { tpsId: string; aliran: Aliran; beratG?: number | undefined; jumlahWadah?: number | undefined; terjadiPada: string };

/** POST /api/wadah (dan WADAH_CATAT dari antrean offline): satu baris 🔒 + event WADAH_DICATAT di rantai kawasan. */
export async function catatWadah(tx: Tx, sesi: Sesi, m: MasukanCatat, kunci: string, sekarang: Date, offline = false) {
  const peran = wajibPeranLayanan(sesi, ["PETUGAS", "PENGELOLA"]);
  const tps = await muatTps(tx, m.tpsId);
  if (!tps.aktif || !sesi.organisasiAktifId || tps.organisasiId !== sesi.organisasiAktifId) throw new GalatApi("TIDAK_DITEMUKAN");
  const terjadiPada = new Date(m.terjadiPada);
  const w = await tx.wadahCatat.create({
    data: {
      tpsId: tps.id,
      kawasanId: tps.kawasanId,
      orgKawasanId: tps.organisasiId,
      aliran: m.aliran,
      beratG: m.beratG ?? null,
      jumlahWadah: m.jumlahWadah ?? null,
      terjadiPada,
      diterimaPada: sekarang,
      idempotencyKey: kunci,
      offline,
    },
    select: { id: true },
  });
  await tambahEvent(
    tx,
    {
      kawasanId: tps.kawasanId,
      serahId: null,
      serahKode: null,
      orgKawasanId: tps.organisasiId,
      orgPengangkutId: null,
      orgPenerimaId: null,
      jenis: "WADAH_DICATAT",
      peran,
      payload: { aliran: m.aliran, beratG: m.beratG ?? null, jumlahWadah: m.jumlahWadah ?? null, offline, tpsId: tps.id, wadahId: w.id },
      terjadiPada,
      idempotencyKey: kunci,
    },
    sekarang,
  );
  return { id: w.id, diterimaPada: sekarang.toISOString() };
}

/** Pemeriksaan peran di dalam layanan (dipakai juga oleh /api/sinkron per aksi). */
export function wajibPeranLayanan(sesi: Sesi, peran: readonly Peran[]): Peran {
  if (!sesi.peran || !peran.includes(sesi.peran)) throw new GalatApi("PERAN_TIDAK_BOLEH");
  return sesi.peran;
}
