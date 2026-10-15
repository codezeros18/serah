// Data mock yang meniru seed demo BLUEPRINT §H.5. Semua nama adalah CONTOH berlabel; tidak ada nama nyata.
// Hanya dipakai bila NEXT_PUBLIC_API_MOCK=true (lihat mock.ts). Tipe memakai skema kontrak.
import type { Aliran, Peran } from "@serah/kontrak/enum";
import type { z } from "zod";
import type {
  Anggota as SkemaAnggota,
  AmbilItem as SkemaAmbilItem,
  Kawasan,
  Kendaraan,
  Kontrak,
  Mitra as SkemaMitra,
  Notifikasi as SkemaNotifikasi,
  Organisasi,
  Paket,
  SerahDetailKeluaran,
  Tagihan,
  Tps,
} from "@serah/kontrak";

type Anggota = z.infer<typeof SkemaAnggota>;
type Mitra = z.infer<typeof SkemaMitra>;
type Notifikasi = z.infer<typeof SkemaNotifikasi>;
type AmbilItem = z.infer<typeof SkemaAmbilItem>;
type SerahDetail = z.infer<typeof SerahDetailKeluaran>;
import { TEKS, isi } from "@serah/kontrak/teks";

/** Id mock berbentuk cuid2 (huruf kecil/angka). */
export function idm(awalan: string, n: number): string {
  return `mock${awalan}${String(n).padStart(6, "0")}`.toLowerCase();
}

export function hash64(n: number): string {
  return n.toString(16).padStart(64, "0");
}

export const ALIRAN_SEMUA: readonly Aliran[] = ["HIJAU", "KUNING", "MERAH", "ABU"];

export const ORG = {
  kawasan: idm("org", 1),
  pengangkut: idm("org", 2),
  daurUlang: idm("org", 3),
  pelapakBerkah: idm("org", 4),
  pelapakBaru: idm("org", 5),
  tpst: idm("org", 6),
  b3: idm("org", 7),
  tps3r: idm("org", 8),
  internal: idm("org", 9),
} as const;

function org(
  id: string,
  kode: string,
  nama: string,
  jenis: Organisasi["jenis"],
  jenisPenerima: Organisasi["jenisPenerima"],
  aliran: Aliran[],
  statusIzin: Organisasi["statusIzin"],
): Organisasi {
  return {
    id,
    kode,
    nama,
    jenis,
    jenisPenerima,
    aliranDiterima: aliran,
    nomorIzin: statusIzin === "TERVERIFIKASI" ? `CONTOH-${kode}` : null,
    statusIzin,
    yurisdiksi: "DKI",
    demo: true,
  };
}

export const ORGANISASI: Organisasi[] = [
  org(ORG.kawasan, "KWS-PCS", "Pasar Contoh Sejahtera", "KAWASAN", null, [], "BELUM_DIAJUKAN"),
  org(ORG.pengangkut, "PGK-ACB", "Angkut Contoh Bersih", "PENGANGKUT", null, [], "TERVERIFIKASI"),
  org(ORG.daurUlang, "PNM-DCM", "Daur Ulang Contoh Mandiri", "PENERIMA", "FASILITAS_BERIZIN", ["KUNING"], "TERVERIFIKASI"),
  org(ORG.pelapakBerkah, "PNM-PCB", "Pelapak Contoh Berkah", "PENERIMA", "PELAPAK_BERIZIN", ["KUNING"], "TERVERIFIKASI"),
  org(ORG.pelapakBaru, "PNM-PCN", "Pelapak Contoh Baru", "PENERIMA", "PELAPAK_BERIZIN", ["KUNING"], "MENUNGGU"),
  org(ORG.tpst, "PNM-TPC", "TPST Contoh", "PENERIMA", "TPA_TPST", ["ABU"], "TERVERIFIKASI"),
  org(ORG.b3, "PNM-FBC", "Fasilitas B3 Contoh", "PENERIMA", "FASILITAS_BERIZIN", ["MERAH"], "TERVERIFIKASI"),
  org(ORG.tps3r, "PNM-T3C", "TPS3R Contoh", "PENERIMA", "TPS3R", ["HIJAU"], "TERVERIFIKASI"),
  org(ORG.internal, "INT-SRH", "SERAH Internal", "INTERNAL", null, [], "TERVERIFIKASI"),
];

export const KAWASAN: Kawasan = {
  id: idm("kws", 1),
  organisasiId: ORG.kawasan,
  kode: "KWS-PCS",
  nama: "Pasar Contoh Sejahtera",
  jenis: "KOMERSIAL",
  alamat: "Alamat contoh (data demo)",
  adm4: "31.71.03.1001",
  kodeKecamatan: null,
  namaKelurahan: "Kemayoran",
  namaKecamatan: "Kemayoran",
  kota: "Jakarta Pusat",
};

/** Koordinat contoh berlabel (bukan lokasi nyata TPS). */
export const TPS_DAFTAR: Tps[] = [
  { id: idm("tps", 1), kawasanId: KAWASAN.id, kode: "TPS-PCS-01", nama: "TPS 1 (contoh)", latE6: -6_160_000, lonE6: 106_850_000, aktif: true, qrVersi: 1 },
  { id: idm("tps", 2), kawasanId: KAWASAN.id, kode: "TPS-PCS-02", nama: "TPS 2 (contoh)", latE6: -6_160_500, lonE6: 106_850_500, aktif: true, qrVersi: 1 },
];

export const KENDARAAN: Kendaraan[] = [
  { id: idm("knd", 1), plat: "B 9001 SRH", aktif: true },
  { id: idm("knd", 2), plat: "B 9002 SRH", aktif: true },
];

function mitra(o: Organisasi): Mitra {
  return {
    id: o.id,
    nama: o.nama,
    jenis: o.jenis === "PENGANGKUT" ? "PENGANGKUT" : "PENERIMA",
    jenisPenerima: o.jenisPenerima,
    statusIzin: o.statusIzin,
    aliranDiterima: o.aliranDiterima,
  };
}

export const MITRA: Mitra[] = ORGANISASI.filter((o) => o.jenis === "PENGANGKUT" || o.jenis === "PENERIMA").map(mitra);

function kontrakAktif(n: number, penerima: Organisasi, aliran: Aliran[], status: Kontrak["status"] = "AKTIF"): Kontrak {
  return {
    id: idm("ktr", n),
    kawasanId: KAWASAN.id,
    kawasan: { id: KAWASAN.id, nama: KAWASAN.nama },
    pengangkut: { id: ORG.pengangkut, nama: "Angkut Contoh Bersih" },
    penerima: { id: penerima.id, nama: penerima.nama },
    aliran,
    berlakuDari: "2026-01-01",
    berlakuSampai: "2026-12-31",
    tarifPerRitIdr: 150_000,
    tarifPerKgIdr: null,
    status,
    dikonfirmasiPengangkutPada: "2026-01-01T03:00:00Z",
    dikonfirmasiPenerimaPada: status === "AKTIF" ? "2026-01-01T04:00:00Z" : null,
  };
}

const o = (id: string): Organisasi => ORGANISASI.find((x) => x.id === id) as Organisasi;
export const KONTRAK: Kontrak[] = [
  kontrakAktif(1, o(ORG.daurUlang), ["KUNING"]),
  kontrakAktif(2, o(ORG.pelapakBerkah), ["KUNING"]),
  kontrakAktif(3, o(ORG.tpst), ["ABU"]),
  kontrakAktif(4, o(ORG.tps3r), ["HIJAU"]),
  kontrakAktif(5, o(ORG.b3), ["MERAH"]),
  kontrakAktif(6, o(ORG.pelapakBaru), ["KUNING"], "USULAN"),
];

export const PAKET: Paket[] = [
  {
    kode: "PAKET_CONTOH",
    urutan: 1,
    hargaPerTpsIdr: 0,
    berlakuUntuk: "KAWASAN",
    aktif: true,
    hak: [
      { kunci: "tps.maks", nilai: 2 },
      { kunci: "anggota.maks", nilai: 5 },
      { kunci: "ekspor.pdf", nilai: true },
      { kunci: "lembar_neraca", nilai: true },
      { kunci: "mode_bayangan", nilai: true },
      { kunci: "tagihan_angkut", nilai: true },
      { kunci: "notifikasi.email", nilai: true },
      { kunci: "notifikasi.push", nilai: true },
    ],
  },
];

export const ANGGOTA: Anggota[] = [
  { id: idm("agt", 1), peran: "PENGELOLA", pengurus: true, aktif: true, sejak: "2026-01-01T03:00:00Z" },
  { id: idm("agt", 2), peran: "PETUGAS", pengurus: false, aktif: true, sejak: "2026-01-02T03:00:00Z" },
];

export function tagihanContoh(): Tagihan[] {
  return [
    {
      id: idm("tgh", 1),
      nomor: "TGH-202610-0001",
      periode: "2026-10",
      jumlahTps: 2,
      hargaPerTpsIdr: 0,
      totalIdr: 0,
      status: "TERBIT",
      jatuhTempo: "2026-10-31",
      dibuatPada: "2026-10-01T01:00:00Z",
    },
  ];
}

export function notifikasiContoh(sekarang: number): Notifikasi[] {
  const t = (jam: number) => new Date(sekarang - jam * 3_600_000).toISOString();
  return [
    { id: idm("ntf", 1), jenis: "SERAH_MENUNGGU_SETUJU", objekKode: "SRH-20261015-0002", data: {}, dibuatPada: t(1), dibaca: false },
    { id: idm("ntf", 2), jenis: "PRIORITAS_ANGKUT", objekKode: "TPS-PCS-01", data: {}, dibuatPada: t(3), dibaca: false },
    { id: idm("ntf", 3), jenis: "SERAH_DITUTUP", objekKode: "SRH-20261015-0004", data: {}, dibuatPada: t(26), dibaca: true },
  ];
}

export const PERAN_NAMA: Record<Peran, string> = {
  PETUGAS: "petugas",
  PENGELOLA: "pengelola",
  PENGANGKUT: "pengangkut",
  PENERIMA: "penerima",
  ADMIN: "admin",
};

export function teksR10Prakiraan(jam: number): string {
  return isi("ATURAN_R10_PRAKIRAAN", {
    weather_desc: "Hujan Lebat",
    nama_kelurahan: KAWASAN.namaKelurahan ?? "",
    jam_slot: "15:00",
    aliran: TEKS.ALIRAN_KUNING_PENDEK,
    kode_tps: "TPS-PCS-01",
    jam,
  });
}

export type SerahMock = SerahDetail;
export type AmbilMock = AmbilItem;
