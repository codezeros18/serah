import { evaluasiKontrak, type HasilAturan } from "@serah/core/aturan";
import { akhiriKontrak as akhiriCore, bolehUbahKontrak, rentangSah, terapkanKonfirmasi, type PerubahanKontrak } from "@serah/core/kontrak";
import type { Aliran, Kontrak, StatusKontrak, Yurisdiksi } from "@serah/kontrak";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import type { Sesi } from "../sesi";
import { buatNotifikasi } from "../notifikasi";
import { rujukan } from "./wadah";

// Layanan kontrak kawasan–pengangkut–penerima (S13): usul → konfirmasi dua pihak → AKTIF (R-11) → akhiri.
// Kontrak bukan bagian rantai event; perubahan setelah AKTIF dicatat di audit_log.

const PILIH = {
  id: true,
  kawasanId: true,
  aliran: true,
  berlakuDari: true,
  berlakuSampai: true,
  tarifPerRitIdr: true,
  tarifPerKgIdr: true,
  status: true,
  dikonfirmasiPengangkutPada: true,
  dikonfirmasiPenerimaPada: true,
  orgKawasanId: true,
  orgPengangkutId: true,
  orgPenerimaId: true,
  kawasan: { select: { id: true, nama: true } },
  orgPengangkut: { select: { id: true, nama: true } },
  orgPenerima: { select: { id: true, nama: true } },
} as const;

const tanggal = (d: Date) => d.toISOString().slice(0, 10);
const keDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

type BarisKontrak = {
  id: string;
  kawasanId: string;
  aliran: Aliran[];
  berlakuDari: Date;
  berlakuSampai: Date;
  tarifPerRitIdr: number | null;
  tarifPerKgIdr: number | null;
  status: StatusKontrak;
  dikonfirmasiPengangkutPada: Date | null;
  dikonfirmasiPenerimaPada: Date | null;
  orgKawasanId: string;
  orgPengangkutId: string;
  orgPenerimaId: string;
  kawasan: { id: string; nama: string };
  orgPengangkut: { id: string; nama: string };
  orgPenerima: { id: string; nama: string };
};

export function keDtoKontrak(k: BarisKontrak): Kontrak {
  return {
    id: k.id,
    kawasanId: k.kawasanId,
    kawasan: { id: k.kawasan.id, nama: k.kawasan.nama },
    pengangkut: { id: k.orgPengangkut.id, nama: k.orgPengangkut.nama },
    penerima: { id: k.orgPenerima.id, nama: k.orgPenerima.nama },
    aliran: k.aliran,
    berlakuDari: tanggal(k.berlakuDari),
    berlakuSampai: tanggal(k.berlakuSampai),
    tarifPerRitIdr: k.tarifPerRitIdr,
    tarifPerKgIdr: k.tarifPerKgIdr,
    status: k.status,
    dikonfirmasiPengangkutPada: k.dikonfirmasiPengangkutPada?.toISOString() ?? null,
    dikonfirmasiPenerimaPada: k.dikonfirmasiPenerimaPada?.toISOString() ?? null,
  };
}

async function muatKontrak(tx: Tx, id: string): Promise<BarisKontrak> {
  const k = await tx.kontrak.findUnique({ where: { id }, select: PILIH });
  if (!k) throw new GalatApi("TIDAK_DITEMUKAN");
  return k;
}

function wajibOrgAktif(sesi: Sesi): string {
  if (!sesi.organisasiAktifId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  return sesi.organisasiAktifId;
}

function galatAturan(h: HasilAturan): GalatApi {
  return new GalatApi("ATURAN_DITOLAK", { aturan: rujukan(h) });
}

// ── Usul ───────────────────────────────────────────────────────────────────

export type MasukanKontrak = {
  kawasanId: string;
  pengangkutId: string;
  penerimaId: string;
  aliran: Aliran[];
  berlakuDari: string;
  berlakuSampai: string;
  tarifPerRitIdr?: number;
  tarifPerKgIdr?: number;
};

export async function usulKontrak(tx: Tx, sesi: Sesi, m: MasukanKontrak, sekarang: Date): Promise<Kontrak> {
  const orgKawasan = wajibOrgAktif(sesi);
  if (!rentangSah(m.berlakuDari, m.berlakuSampai)) {
    throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["berlakuSampai"], kode: "rentang_tidak_sah" }] });
  }
  const kawasan = await tx.kawasan.findUnique({ where: { id: m.kawasanId }, select: { id: true, nama: true, organisasiId: true } });
  if (!kawasan || kawasan.organisasiId !== orgKawasan) throw new GalatApi("TIDAK_DITEMUKAN");

  const mitra = await tx.organisasi.findMany({ where: { id: { in: [m.pengangkutId, m.penerimaId] } }, select: { id: true, jenis: true } });
  const jenisDari = (id: string) => mitra.find((x) => x.id === id)?.jenis;
  if (jenisDari(m.pengangkutId) !== "PENGANGKUT") throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["pengangkutId"], kode: "bukan_pengangkut" }] });
  if (jenisDari(m.penerimaId) !== "PENERIMA") throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["penerimaId"], kode: "bukan_penerima" }] });

  const k = await tx.kontrak.create({
    data: {
      kawasanId: kawasan.id,
      orgKawasanId: orgKawasan,
      orgPengangkutId: m.pengangkutId,
      orgPenerimaId: m.penerimaId,
      aliran: [...new Set(m.aliran)],
      berlakuDari: keDate(m.berlakuDari),
      berlakuSampai: keDate(m.berlakuSampai),
      tarifPerRitIdr: m.tarifPerRitIdr ?? null,
      tarifPerKgIdr: m.tarifPerKgIdr ?? null,
      status: "USULAN",
      dibuatPada: sekarang,
    },
    select: PILIH,
  });
  await buatNotifikasi(
    tx,
    [
      { organisasiId: m.pengangkutId, jenis: "KONTRAK_PERLU_KONFIRMASI", objekKode: k.id, data: { nama_kawasan: kawasan.nama } },
      { organisasiId: m.penerimaId, jenis: "KONTRAK_PERLU_KONFIRMASI", objekKode: k.id, data: { nama_kawasan: kawasan.nama } },
    ],
    sekarang,
  );
  return keDtoKontrak(k);
}

// ── Konfirmasi (R-11 saat aktivasi) ───────────────────────────────────────

export async function konfirmasiKontrak(tx: Tx, sesi: Sesi, id: string, sekarang: Date): Promise<Kontrak> {
  const org = wajibOrgAktif(sesi);
  const k = await muatKontrak(tx, id);
  const pihak = sesi.peran === "PENGANGKUT" && org === k.orgPengangkutId ? "PENGANGKUT" : sesi.peran === "PENERIMA" && org === k.orgPenerimaId ? "PENERIMA" : null;
  if (!pihak) throw new GalatApi("PERAN_TIDAK_BOLEH");

  const r = terapkanKonfirmasi(k, pihak, sekarang);
  if (!r.ok) throw new GalatApi("TRANSISI_TIDAK_SAH");

  // R-11: penerima harus pelaku usaha berizin terverifikasi. Dinilai saat PENERIMA sendiri mengonfirmasi dan saat
  // konfirmasi akan mengaktifkan kontrak; pengangkut boleh lebih dulu mengonfirmasi kontrak yang belum aktif.
  if (pihak === "PENERIMA" || r.aktifBaru) await wajibPenerimaBerizin(tx, k);
  const baru = await tx.kontrak.update({
    where: { id },
    data: { status: r.status, dikonfirmasiPengangkutPada: r.dikonfirmasiPengangkutPada, dikonfirmasiPenerimaPada: r.dikonfirmasiPenerimaPada },
    select: PILIH,
  });
  return keDtoKontrak(baru);
}

async function wajibPenerimaBerizin(tx: Tx, k: BarisKontrak): Promise<void> {
  const penerima = await tx.organisasi.findUnique({ where: { id: k.orgPenerimaId }, select: { id: true, jenis: true, jenisPenerima: true, aliranDiterima: true, statusIzin: true } });
  const pemilik = await tx.organisasi.findUnique({ where: { id: k.orgKawasanId }, select: { yurisdiksi: true } });
  if (!penerima || !penerima.jenisPenerima) throw new GalatApi("TIDAK_DITEMUKAN");
  const yurisdiksi: Yurisdiksi = pemilik?.yurisdiksi ?? "DKI";
  const tolak = evaluasiKontrak({
    yurisdiksi,
    penerima: { id: penerima.id, jenis: penerima.jenisPenerima, aliranDiterima: penerima.aliranDiterima, statusIzin: penerima.statusIzin },
  }).find((h) => h.aksi === "TOLAK");
  if (tolak) throw galatAturan(tolak);
}

export async function akhiriKontrak(tx: Tx, sesi: Sesi, id: string): Promise<Kontrak> {
  const org = wajibOrgAktif(sesi);
  const k = await muatKontrak(tx, id);
  if (k.orgKawasanId !== org) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const r = akhiriCore(k.status);
  if (!r.ok) throw new GalatApi("TRANSISI_TIDAK_SAH");
  return keDtoKontrak(await tx.kontrak.update({ where: { id }, data: { status: r.statusBaru }, select: PILIH }));
}

export async function daftarKontrak(tx: Tx, sesi: Sesi, status?: StatusKontrak): Promise<Kontrak[]> {
  const org = wajibOrgAktif(sesi);
  // RLS sudah membatasi ke pihak kontrak; filter eksplisit sebagai lapis kedua.
  const baris = await tx.kontrak.findMany({
    where: { OR: [{ orgKawasanId: org }, { orgPengangkutId: org }, { orgPenerimaId: org }], ...(status ? { status } : {}) },
    select: PILIH,
    orderBy: { dibuatPada: "desc" },
  });
  return baris.map(keDtoKontrak);
}

// ── Ubah (layanan internal) ───────────────────────────────────────────────

/**
 * Ubah kontrak oleh pengelola. Pihak & aliran terkunci setelah AKTIF (core/kontrak.bolehUbahKontrak); perubahan
 * lain pada kontrak AKTIF tercatat di audit_log; perubahan pada USULAN menghapus konfirmasi yang sudah masuk.
 * TIDAK ada rute HTTP (§K.2 tidak memuatnya): dipakai layanan lain/admin.
 */
export async function ubahKontrak(tx: Tx, sesi: Sesi, id: string, p: PerubahanKontrak, sekarang: Date): Promise<Kontrak> {
  const org = wajibOrgAktif(sesi);
  const k = await muatKontrak(tx, id);
  if (k.orgKawasanId !== org) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const h = bolehUbahKontrak({ status: k.status, berlakuDari: tanggal(k.berlakuDari), berlakuSampai: tanggal(k.berlakuSampai) }, p);
  if (!h.ok) {
    throw new GalatApi("TRANSISI_TIDAK_SAH", { rincian: [{ jalur: ["kontrak"], kode: h.sebab }] });
  }
  const baru = await tx.kontrak.update({
    where: { id },
    data: {
      ...(p.pengangkutId !== undefined ? { orgPengangkutId: p.pengangkutId } : {}),
      ...(p.penerimaId !== undefined ? { orgPenerimaId: p.penerimaId } : {}),
      ...(p.aliran !== undefined ? { aliran: [...new Set(p.aliran)] } : {}),
      ...(p.berlakuDari !== undefined ? { berlakuDari: keDate(p.berlakuDari) } : {}),
      ...(p.berlakuSampai !== undefined ? { berlakuSampai: keDate(p.berlakuSampai) } : {}),
      ...(p.tarifPerRitIdr !== undefined ? { tarifPerRitIdr: p.tarifPerRitIdr } : {}),
      ...(p.tarifPerKgIdr !== undefined ? { tarifPerKgIdr: p.tarifPerKgIdr } : {}),
      ...(h.perluKonfirmasiUlang ? { dikonfirmasiPengangkutPada: null, dikonfirmasiPenerimaPada: null } : {}),
    },
    select: PILIH,
  });
  if (h.teraudit) {
    // createMany (tanpa RETURNING): audit_log hanya terbaca admin, jadi INSERT … RETURNING ditolak RLS.
    await tx.auditLog.createMany({
      data: [{ organisasiId: org, peran: sesi.peran, aksi: "KONTRAK_DIUBAH", objekJenis: "kontrak", objekId: id, data: { bidang: Object.keys(p).sort() }, dibuatPada: sekarang }],
    });
  }
  return keDtoKontrak(baru);
}
