import { tanggalWibKompak } from "@serah/core/waktu";
import { kodePermintaanKoreksi } from "@serah/core/kode";
import { bolehAjukan, bolehPutus, pemutusUntuk, periksaPenerapan, statusPermintaan, type DataTutup, type SebabPenerapan } from "@serah/core/permintaan-koreksi";
import type { KeputusanPermintaan, Peran, StatusPermintaan, StatusSerah, TargetKoreksi } from "@serah/kontrak";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { buatNotifikasi } from "../notifikasi";
import { nomorBerikut } from "../penomoran";
import type { Sesi } from "../sesi";
import { nilaiFinal } from "./serah";
import { tambahEvent } from "./transisi";

// Permintaan koreksi (S16, FITUR F27). Catatan tertutup tidak pernah diubah: DISETUJUI menambah satu baris
// `koreksi` (nilai_asli = nilai final saat itu) + event PERMINTAAN_KOREKSI_DISETUJUI di rantai kawasan; status serah tetap.
// Mengajukan dan memutus memakai satu rantai dengan transisi lain (tambahEvent di bawah kunci rantai kawasan).

const TUTUP: readonly StatusSerah[] = ["DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"];
const PERAN_PENGAJU: readonly Peran[] = ["PETUGAS", "PENGELOLA", "PENERIMA"];

type Target = {
  jenis: TargetKoreksi;
  id: string;
  kawasanId: string;
  orgKawasanId: string;
  orgPenerimaId: string | null;
  orgPengangkutId: string | null;
  serahId: string | null;
  serahKode: string | null;
  /** Nilai catatan awal dan nilai final sekarang (v_nilai_final). */
  nilaiAsliG: number;
  nilaiFinalG: number;
  tutup?: DataTutup;
};

const galatPenerapan = (sebab: SebabPenerapan) =>
  new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["nilaiUsulanG"], kode: sebab.toLowerCase() }] });

async function nilaiAsli(tx: Tx, jenis: TargetKoreksi, id: string): Promise<number | null> {
  const [r] = await tx.$queryRaw<{ nilai_asli_g: number | null }[]>`
    SELECT nilai_asli_g FROM v_nilai_final WHERE target_jenis = ${jenis}::"TargetKoreksi" AND target_id = ${id}`;
  return r?.nilai_asli_g ?? null;
}

async function dataTutup(tx: Tx, serahId: string, status: StatusSerah): Promise<DataTutup> {
  const tiket = await tx.tiketTimbang.findFirst({ where: { serahId }, orderBy: { dibuatPada: "desc" }, select: { id: true, beratG: true } });
  const rincian = await tx.penutupanRincian.findMany({ where: { serahId }, select: { id: true, aliran: true, diterimaG: true, ditolakG: true, alasan: true } });
  if (!tiket) throw new GalatApi("TIDAK_DITEMUKAN");
  const final = await nilaiFinal(tx, [tiket.id, ...rincian.map((r) => r.id)]);
  return {
    status,
    tiketG: final.get(`TIKET:${tiket.id}`) ?? tiket.beratG,
    rincian: rincian.map((r) => ({
      id: r.id,
      aliran: r.aliran,
      diterimaG: final.get(`RINCIAN_DITERIMA:${r.id}`) ?? r.diterimaG,
      ditolakG: final.get(`RINCIAN_DITOLAK:${r.id}`) ?? r.ditolakG,
      alasan: r.alasan,
    })),
  };
}

/** Muat target di bawah RLS pelaku. Tidak terlihat atau tidak ada → 404. */
async function muatTarget(tx: Tx, jenis: TargetKoreksi, id: string): Promise<Target> {
  if (jenis === "WADAH") {
    const w = await tx.wadahCatat.findUnique({
      where: { id },
      select: {
        id: true,
        kawasanId: true,
        orgKawasanId: true,
        beratG: true,
        serahWadah: { select: { serah: { select: { id: true, kode: true, orgPenerimaId: true, orgPengangkutId: true } } } },
      },
    });
    if (!w) throw new GalatApi("TIDAK_DITEMUKAN");
    if (w.beratG === null) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["targetId"], kode: "wadah_tanpa_berat" }] });
    const final = await nilaiFinal(tx, [w.id]);
    const s = w.serahWadah?.serah ?? null;
    return {
      jenis,
      id,
      kawasanId: w.kawasanId,
      orgKawasanId: w.orgKawasanId,
      orgPenerimaId: s?.orgPenerimaId ?? null,
      orgPengangkutId: s?.orgPengangkutId ?? null,
      serahId: s?.id ?? null,
      serahKode: s?.kode ?? null,
      nilaiAsliG: w.beratG,
      nilaiFinalG: final.get(`WADAH:${w.id}`) ?? w.beratG,
    };
  }

  const serahId =
    jenis === "TIKET"
      ? (await tx.tiketTimbang.findUnique({ where: { id }, select: { serahId: true } }))?.serahId
      : (await tx.penutupanRincian.findUnique({ where: { id }, select: { serahId: true } }))?.serahId;
  if (!serahId) throw new GalatApi("TIDAK_DITEMUKAN");
  const s = await tx.serah.findUnique({
    where: { id: serahId },
    select: { id: true, kode: true, status: true, kawasanId: true, orgKawasanId: true, orgPenerimaId: true, orgPengangkutId: true },
  });
  if (!s) throw new GalatApi("TIDAK_DITEMUKAN");
  if (!TUTUP.includes(s.status)) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["targetId"], kode: "serah_belum_tertutup" }] });
  const tutup = await dataTutup(tx, s.id, s.status);
  const final =
    jenis === "TIKET"
      ? tutup.tiketG
      : (() => {
          const r = tutup.rincian.find((x) => x.id === id);
          return r ? (jenis === "RINCIAN_DITERIMA" ? r.diterimaG : r.ditolakG) : null;
        })();
  const asli = await nilaiAsli(tx, jenis, id);
  if (final === null || asli === null) throw new GalatApi("TIDAK_DITEMUKAN");
  return {
    jenis,
    id,
    kawasanId: s.kawasanId,
    orgKawasanId: s.orgKawasanId,
    orgPenerimaId: s.orgPenerimaId,
    orgPengangkutId: s.orgPengangkutId,
    serahId: s.id,
    serahKode: s.kode,
    nilaiAsliG: asli,
    nilaiFinalG: final,
    tutup,
  };
}

function galatBoleh(sebab: "PERAN_TIDAK_BOLEH" | "BUKAN_PIHAK"): GalatApi {
  // Bukan pihak = tidak terlihat (sama seperti RLS): tidak membocorkan keberadaan catatan.
  return new GalatApi(sebab === "PERAN_TIDAK_BOLEH" ? "PERAN_TIDAK_BOLEH" : "TIDAK_DITEMUKAN");
}

function sesiPelaku(sesi: Sesi): { peran: Peran; orgAktifId: string } {
  if (!sesi.peran || !sesi.organisasiAktifId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  return { peran: sesi.peran, orgAktifId: sesi.organisasiAktifId };
}

// ── Ajukan (S16-2) ─────────────────────────────────────────────────────────

export type MasukanAjukan = { targetJenis: TargetKoreksi; targetId: string; nilaiUsulanG: number; alasan: string };

export async function ajukanPermintaan(tx: Tx, sesi: Sesi, m: MasukanAjukan, kunci: string, sekarang: Date) {
  const { peran, orgAktifId } = sesiPelaku(sesi);
  if (!PERAN_PENGAJU.includes(peran)) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const alasan = m.alasan.trim();
  if (alasan === "") throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["alasan"], kode: "alasan_kosong" }] });

  const t = await muatTarget(tx, m.targetJenis, m.targetId);
  const boleh = bolehAjukan(peran, t.jenis, { orgAktifId, orgKawasanId: t.orgKawasanId, orgPenerimaId: t.orgPenerimaId });
  if (!boleh.ok) throw galatBoleh(boleh.sebab);
  const p = periksaPenerapan({ jenis: t.jenis, targetId: t.id, nilaiFinalG: t.nilaiFinalG, nilaiUsulanG: m.nilaiUsulanG, ...(t.tutup ? { tutup: t.tutup } : {}) });
  if (!p.ok) throw galatPenerapan(p.sebab);

  const nomor = await nomorBerikut(tx, "PKR", tanggalWibKompak(sekarang));
  const kode = kodePermintaanKoreksi(sekarang, nomor);
  if (!kode.ok) throw new GalatApi("GALAT_SERVER");

  const baris = await tx.permintaanKoreksi.create({
    data: {
      kode: kode.kode,
      targetJenis: t.jenis,
      targetId: t.id,
      kawasanId: t.kawasanId,
      orgKawasanId: t.orgKawasanId,
      orgPenerimaId: t.orgPenerimaId,
      nilaiUsulanG: m.nilaiUsulanG,
      alasan,
      peranPengaju: peran,
      dibuatPada: sekarang,
    },
    select: { id: true },
  });

  await tambahEvent(
    tx,
    {
      kawasanId: t.kawasanId,
      serahId: t.serahId,
      serahKode: t.serahKode,
      orgKawasanId: t.orgKawasanId,
      orgPengangkutId: t.orgPengangkutId,
      orgPenerimaId: t.orgPenerimaId,
      jenis: "PERMINTAAN_KOREKSI_DIAJUKAN",
      peran,
      payload: { kode: kode.kode, targetJenis: t.jenis, targetId: t.id, nilaiAsliG: t.nilaiAsliG, nilaiUsulanG: m.nilaiUsulanG },
      terjadiPada: sekarang,
      idempotencyKey: kunci,
    },
    sekarang,
  );

  // Notifikasi ke organisasi pemutus: peran PENGELOLA (wadah) atau PENERIMA (tiket/rincian) lewat PERAN_TUJUAN.
  const tujuan = pemutusUntuk(t.jenis) === "PENGELOLA" ? t.orgKawasanId : t.orgPenerimaId;
  await buatNotifikasi(tx, [{ jenis: "PERMINTAAN_KOREKSI", organisasiId: tujuan, objekKode: kode.kode, data: { kode: kode.kode } }], sekarang);

  return { id: baris.id, kode: kode.kode };
}

// ── Putus (S16-2) ──────────────────────────────────────────────────────────

export type MasukanPutus = { keputusan: KeputusanPermintaan; alasan: string };

type BarisPermintaan = {
  id: string;
  kode: string;
  targetJenis: TargetKoreksi;
  targetId: string;
  nilaiUsulanG: number;
  alasan: string;
  peranPengaju: Peran;
  dibuatPada: Date;
  kawasanId: string;
  orgKawasanId: string;
  orgPenerimaId: string | null;
  putusan: { keputusan: KeputusanPermintaan; alasan: string; peran: Peran; dibuatPada: Date } | null;
};

const PILIH_PERMINTAAN = {
  id: true,
  kode: true,
  targetJenis: true,
  targetId: true,
  nilaiUsulanG: true,
  alasan: true,
  peranPengaju: true,
  dibuatPada: true,
  kawasanId: true,
  orgKawasanId: true,
  orgPenerimaId: true,
  putusan: { select: { keputusan: true, alasan: true, peran: true, dibuatPada: true } },
} as const;

export function keluaranPermintaan(b: BarisPermintaan, nilaiAsliG: number) {
  return {
    id: b.id,
    kode: b.kode,
    targetJenis: b.targetJenis,
    targetId: b.targetId,
    nilaiAsliG,
    nilaiUsulanG: b.nilaiUsulanG,
    alasan: b.alasan,
    peranPengaju: b.peranPengaju,
    status: statusPermintaan(b.putusan?.keputusan ?? null) as StatusPermintaan,
    dibuatPada: b.dibuatPada.toISOString(),
    putusan: b.putusan
      ? { keputusan: b.putusan.keputusan, alasan: b.putusan.alasan, peran: b.putusan.peran, dibuatPada: b.putusan.dibuatPada.toISOString() }
      : null,
  };
}

export async function putusPermintaan(tx: Tx, sesi: Sesi, id: string, m: MasukanPutus, kunci: string, sekarang: Date) {
  const { peran, orgAktifId } = sesiPelaku(sesi);
  if (peran !== "PENGELOLA" && peran !== "PENERIMA") throw new GalatApi("PERAN_TIDAK_BOLEH");
  const alasan = m.alasan.trim();
  if (alasan === "") throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["alasan"], kode: "alasan_kosong" }] });

  const p = await tx.permintaanKoreksi.findUnique({ where: { id }, select: PILIH_PERMINTAAN });
  if (!p) throw new GalatApi("TIDAK_DITEMUKAN");
  const boleh = bolehPutus(peran, p.targetJenis, { orgAktifId, orgKawasanId: p.orgKawasanId, orgPenerimaId: p.orgPenerimaId });
  if (!boleh.ok) throw galatBoleh(boleh.sebab);
  if (p.putusan) throw new GalatApi("TRANSISI_TIDAK_SAH");

  const t = await muatTarget(tx, p.targetJenis, p.targetId);
  let sigmaKonsisten: boolean | null = null;
  if (m.keputusan === "DISETUJUI") {
    // Nilai final bisa berubah sejak diajukan: periksa lagi terhadap nilai final saat ini.
    const ok = periksaPenerapan({ jenis: t.jenis, targetId: t.id, nilaiFinalG: t.nilaiFinalG, nilaiUsulanG: p.nilaiUsulanG, ...(t.tutup ? { tutup: t.tutup } : {}) });
    if (!ok.ok) throw galatPenerapan(ok.sebab);
    sigmaKonsisten = ok.sigmaKonsisten;
  }

  await tx.permintaanKoreksiPutusan.create({
    data: { permintaanId: p.id, keputusan: m.keputusan, alasan, peran, dibuatPada: sekarang },
    select: { id: true },
  });

  let koreksiId: string | null = null;
  if (m.keputusan === "DISETUJUI") {
    const k = await tx.koreksi.create({
      data: {
        targetJenis: t.jenis,
        targetId: t.id,
        serahId: t.serahId,
        kawasanId: t.kawasanId,
        orgKawasanId: t.orgKawasanId,
        nilaiAsliG: t.nilaiFinalG,
        nilaiFinalG: p.nilaiUsulanG,
        alasan: p.alasan,
        peran,
        permintaanId: p.id,
        dibuatPada: sekarang,
      },
      select: { id: true },
    });
    koreksiId = k.id;
  }

  await tambahEvent(
    tx,
    {
      kawasanId: t.kawasanId,
      serahId: t.serahId,
      serahKode: t.serahKode,
      orgKawasanId: t.orgKawasanId,
      orgPengangkutId: t.orgPengangkutId,
      orgPenerimaId: t.orgPenerimaId,
      jenis: m.keputusan === "DISETUJUI" ? "PERMINTAAN_KOREKSI_DISETUJUI" : "PERMINTAAN_KOREKSI_DITOLAK",
      peran,
      payload:
        m.keputusan === "DISETUJUI"
          ? { kode: p.kode, targetJenis: t.jenis, targetId: t.id, nilaiAsliG: t.nilaiFinalG, nilaiFinalG: p.nilaiUsulanG, koreksiId, sigmaKonsisten }
          : { kode: p.kode, targetJenis: t.jenis, targetId: t.id },
      terjadiPada: sekarang,
      idempotencyKey: kunci,
    },
    sekarang,
  );

  const akhir = await tx.permintaanKoreksi.findUniqueOrThrow({ where: { id: p.id }, select: PILIH_PERMINTAAN });
  return { permintaan: keluaranPermintaan(akhir, t.nilaiAsliG) };
}

// ── Daftar ─────────────────────────────────────────────────────────────────

/** Permintaan yang terlihat sesi (RLS: kawasan atau penerima terkait). Status diturunkan dari putusan. */
export async function daftarPermintaan(tx: Tx, status: StatusPermintaan | undefined) {
  const baris = await tx.permintaanKoreksi.findMany({
    where: status === undefined ? {} : status === "DIAJUKAN" ? { putusan: null } : { putusan: { keputusan: status } },
    orderBy: [{ dibuatPada: "desc" }, { id: "desc" }],
    select: PILIH_PERMINTAAN,
    take: 200,
  });
  const keluar = [];
  for (const b of baris) {
    // Nilai asli = nilai catatan awal (tidak berubah oleh koreksi mana pun).
    keluar.push(keluaranPermintaan(b, (await nilaiAsli(tx, b.targetJenis, b.targetId)) ?? 0));
  }
  return { permintaan: keluar };
}
