import { randomBytes } from "node:crypto";
import { hurufKodeKawasan, kodeKawasan } from "@serah/core/kode";
import { masaUjiCoba } from "@serah/core/langganan";
import type {
  Aliran,
  JenisKawasan,
  JenisOrganisasi,
  JenisPenerima,
  Kawasan,
  Kendaraan,
  Organisasi,
  Peran,
  Yurisdiksi,
} from "@serah/kontrak";
import { larikPg, type Tx } from "../db";
import { GalatApi } from "../galat";
import { PAKET_UJI_COBA } from "../hak";
import { idBaru } from "../id";
import { wajibPengurusAktif } from "../auth";
import type { Sesi } from "../sesi";

// Layanan organisasi, kawasan, kendaraan, dan direktori mitra (S13). Semua dalam transaksi `denganAkses` pemanggil;
// RLS adalah lapis pertama, pemeriksaan kepemilikan eksplisit di sini adalah lapis kedua.

const PERAN_PEMBUAT: Record<Exclude<JenisOrganisasi, "INTERNAL">, Peran> = {
  KAWASAN: "PENGELOLA",
  PENGANGKUT: "PENGANGKUT",
  PENERIMA: "PENERIMA",
};

const PILIH_ORG = {
  id: true,
  kode: true,
  nama: true,
  jenis: true,
  jenisPenerima: true,
  aliranDiterima: true,
  nomorIzin: true,
  statusIzin: true,
  yurisdiksi: true,
  demo: true,
} as const;

export function keDtoOrganisasi(o: {
  id: string;
  kode: string;
  nama: string;
  jenis: JenisOrganisasi;
  jenisPenerima: JenisPenerima | null;
  aliranDiterima: Aliran[];
  nomorIzin: string | null;
  statusIzin: Organisasi["statusIzin"];
  yurisdiksi: Yurisdiksi;
  demo: boolean;
}): Organisasi {
  return { ...o };
}

function kodeOrganisasiAcak(): string {
  const b = randomBytes(5);
  return `ORG-${[...b].map((x) => (x % 36).toString(36)).join("").toUpperCase()}`;
}

export type MasukanOrganisasi = {
  jenis: "KAWASAN" | "PENGANGKUT" | "PENERIMA";
  nama: string;
  jenisPenerima?: JenisPenerima;
  aliranDiterima?: Aliran[];
  nomorIzin?: string;
  yurisdiksi: Yurisdiksi;
};

function wajibKonsisten(m: MasukanOrganisasi): void {
  const penerima = m.jenis === "PENERIMA";
  if (penerima && (!m.jenisPenerima || !m.aliranDiterima?.length)) {
    throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: [m.jenisPenerima ? "aliranDiterima" : "jenisPenerima"], kode: "wajib_untuk_penerima" }] });
  }
  if (!penerima && (m.jenisPenerima !== undefined || m.aliranDiterima !== undefined)) {
    throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: [m.jenisPenerima !== undefined ? "jenisPenerima" : "aliranDiterima"], kode: "hanya_untuk_penerima" }] });
  }
}

/**
 * Buat organisasi: pembuat menjadi pengurus dengan peran sesuai jenis; organisasi KAWASAN langsung mendapat langganan
 * uji coba 14 hari (akhir dihitung core/langganan dari tanggal WIB sekarang). Sesi berpindah ke organisasi baru.
 */
export async function buatOrganisasi(tx: Tx, sesi: Sesi, m: MasukanOrganisasi, sekarang: Date): Promise<Organisasi> {
  wajibKonsisten(m);
  const id = idBaru();
  const peran = PERAN_PEMBUAT[m.jenis];
  // Organisasi baru dimasukkan ke konteks akses SEBELUM disisipkan: INSERT … ON CONFLICT juga menilai kebijakan SELECT
  // atas baris baru, dan pembuat belum menjadi anggotanya.
  await tx.$queryRaw`SELECT set_config('app.org_ids', ${larikPg([...(sesi.organisasiAktifId ? [sesi.organisasiAktifId] : []), id])}, true)`;
  // INSERT … ON CONFLICT: kode organisasi lain tak terlihat (RLS), jadi keunikan dijaga oleh DB dan diulang bila bentrok.
  let tersimpan = false;
  for (let i = 0; i < 5 && !tersimpan; i++) {
    const n = await tx.$executeRaw`
      INSERT INTO organisasi (id, kode, nama, jenis, jenis_penerima, aliran_diterima, nomor_izin, status_izin, yurisdiksi, demo, dibuat_pada)
      VALUES (${id}, ${kodeOrganisasiAcak()}, ${m.nama}, ${m.jenis}::"JenisOrganisasi", ${m.jenisPenerima ?? null}::"JenisPenerima",
              ${m.aliranDiterima ?? []}::"Aliran"[], ${m.nomorIzin ?? null}, 'BELUM_DIAJUKAN'::"StatusIzin", ${m.yurisdiksi}::"Yurisdiksi", false, ${sekarang})
      ON CONFLICT (kode) DO NOTHING`;
    tersimpan = n === 1;
  }
  if (!tersimpan) throw new GalatApi("GALAT_SERVER");

  await tx.keanggotaan.create({ data: { penggunaId: sesi.penggunaId, organisasiId: id, peran, pengurus: true, aktif: true, dibuatPada: sekarang } });

  if (m.jenis === "KAWASAN") {
    const { mulai, selesai } = masaUjiCoba(sekarang);
    const langganan = await tx.langganan.create({
      data: { organisasiId: id, paketKode: PAKET_UJI_COBA, status: "UJI_COBA", ujiCobaMulai: mulai, ujiCobaSelesai: selesai, diperbaruiPada: sekarang },
    });
    await tx.peristiwaLangganan.create({ data: { langgananId: langganan.id, dari: null, ke: "UJI_COBA", sebab: "organisasi kawasan dibuat", dibuatPada: sekarang } });
  }

  await tx.sesi.update({ where: { id: sesi.id }, data: { organisasiAktifId: id, peranAktif: peran } });
  const o = await tx.organisasi.findUniqueOrThrow({ where: { id }, select: PILIH_ORG });
  return keDtoOrganisasi(o);
}

export async function bacaOrganisasiSaya(tx: Tx, sesi: Sesi): Promise<Organisasi> {
  const id = await wajibPengurusAktif(tx, sesi);
  const o = await tx.organisasi.findUnique({ where: { id }, select: PILIH_ORG });
  if (!o) throw new GalatApi("TIDAK_DITEMUKAN");
  return keDtoOrganisasi(o);
}

export async function ubahOrganisasiSaya(tx: Tx, sesi: Sesi, m: { nama?: string; aliranDiterima?: Aliran[] }): Promise<Organisasi> {
  const id = await wajibPengurusAktif(tx, sesi);
  const kini = await tx.organisasi.findUnique({ where: { id }, select: { jenis: true } });
  if (!kini) throw new GalatApi("TIDAK_DITEMUKAN");
  if (m.aliranDiterima !== undefined && kini.jenis !== "PENERIMA") {
    throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["aliranDiterima"], kode: "hanya_untuk_penerima" }] });
  }
  const o = await tx.organisasi.update({
    where: { id },
    data: { ...(m.nama !== undefined ? { nama: m.nama } : {}), ...(m.aliranDiterima !== undefined ? { aliranDiterima: m.aliranDiterima } : {}) },
    select: PILIH_ORG,
  });
  return keDtoOrganisasi(o);
}

// ── Kawasan ────────────────────────────────────────────────────────────────

type BarisKawasan = {
  id: string;
  organisasiId: string;
  kode: string;
  nama: string;
  jenis: JenisKawasan;
  alamat: string;
  adm4: string;
  kodeKecamatan: string | null;
  namaKelurahan: string | null;
  namaKecamatan: string | null;
  kota: string;
};

export function keDtoKawasan(k: BarisKawasan): Kawasan {
  return {
    id: k.id,
    organisasiId: k.organisasiId,
    kode: k.kode as Kawasan["kode"],
    nama: k.nama,
    jenis: k.jenis,
    alamat: k.alamat,
    adm4: k.adm4,
    kodeKecamatan: k.kodeKecamatan,
    namaKelurahan: k.namaKelurahan,
    namaKecamatan: k.namaKecamatan,
    kota: k.kota,
  };
}

/** Jalankan sisipan di dalam SAVEPOINT; true bila sukses, false bila melanggar kendala unik (23505). Galat lain dilempar ulang. */
async function sisipUnik(tx: Tx, sisip: () => Promise<unknown>): Promise<boolean> {
  await tx.$executeRaw`SAVEPOINT sisip_unik`;
  try {
    await sisip();
    await tx.$executeRaw`RELEASE SAVEPOINT sisip_unik`;
    return true;
  } catch (e) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT sisip_unik`;
    const teks = e instanceof Error ? e.message : String(e);
    if (/23505|duplicate key|unique constraint/i.test(teks)) return false;
    throw e;
  }
}

/** Kode kecamatan = tiga segmen pertama adm4 (mis. 31.71.03 dari 31.71.03.1001). */
export function kodeKecamatanDariAdm4(adm4: string): string {
  return adm4.split(".").slice(0, 3).join(".");
}

/** Organisasi aktif sesi harus KAWASAN. Mengembalikan id organisasi. */
async function orgKawasanAktif(tx: Tx, sesi: Sesi): Promise<string> {
  if (!sesi.organisasiAktifId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const o = await tx.organisasi.findUnique({ where: { id: sesi.organisasiAktifId }, select: { jenis: true } });
  if (o?.jenis !== "KAWASAN") throw new GalatApi("PERAN_TIDAK_BOLEH");
  return sesi.organisasiAktifId;
}

export async function buatKawasan(
  tx: Tx,
  sesi: Sesi,
  m: { nama: string; jenis: JenisKawasan; alamat: string; adm4: string; kota: string },
  sekarang: Date,
): Promise<Kawasan> {
  const organisasiId = await orgKawasanAktif(tx, sesi);
  const id = idBaru();
  // Kode kawasan unik GLOBAL tetapi kawasan organisasi lain tak terlihat (RLS): keunikan dijaga DB, bentrok diulang
  // dengan usulan huruf berikutnya. SAVEPOINT agar transaksi tetap hidup setelah pelanggaran unik.
  let kode: string | null = null;
  for (let p = 0; p < 200 && kode === null; p++) {
    const k = kodeKawasan(hurufKodeKawasan(m.nama, p));
    if (!k.ok) throw new GalatApi("GALAT_SERVER");
    const berhasil = await sisipUnik(
      tx,
      () => tx.$executeRaw`
        INSERT INTO kawasan (id, organisasi_id, kode, nama, jenis, alamat, adm4, kode_kecamatan, kota, dibuat_pada)
        VALUES (${id}, ${organisasiId}, ${k.kode}, ${m.nama}, ${m.jenis}::"JenisKawasan", ${m.alamat}, ${m.adm4}, ${kodeKecamatanDariAdm4(m.adm4)}, ${m.kota}, ${sekarang})`,
    );
    if (berhasil) kode = k.kode;
  }
  if (kode === null) throw new GalatApi("GALAT_SERVER");
  return keDtoKawasan(await tx.kawasan.findUniqueOrThrow({ where: { id } }));
}

export async function daftarKawasan(tx: Tx, sesi: Sesi): Promise<Kawasan[]> {
  const organisasiId = await orgKawasanAktif(tx, sesi);
  const baris = await tx.kawasan.findMany({ where: { organisasiId }, orderBy: { dibuatPada: "asc" } });
  return baris.map(keDtoKawasan);
}

/** Kawasan milik organisasi aktif; milik organisasi lain (walau terlihat lewat kontrak) → 404. */
export async function muatKawasanMilik(tx: Tx, sesi: Sesi, id: string): Promise<BarisKawasan> {
  const organisasiId = await orgKawasanAktif(tx, sesi);
  const k = await tx.kawasan.findUnique({ where: { id } });
  if (!k || k.organisasiId !== organisasiId) throw new GalatApi("TIDAK_DITEMUKAN");
  return k;
}

export async function ubahKawasan(
  tx: Tx,
  sesi: Sesi,
  id: string,
  m: Partial<{ nama: string; jenis: JenisKawasan; alamat: string; adm4: string; kota: string }>,
): Promise<Kawasan> {
  await muatKawasanMilik(tx, sesi, id);
  const k = await tx.kawasan.update({
    where: { id },
    data: {
      ...m,
      // Kelurahan/kecamatan hasil BMKG milik adm4 lama; kosongkan bila adm4 berubah, kode kecamatan mengikuti.
      ...(m.adm4 !== undefined ? { kodeKecamatan: kodeKecamatanDariAdm4(m.adm4), namaKelurahan: null, namaKecamatan: null } : {}),
    },
  });
  return keDtoKawasan(k);
}

// ── Kendaraan ──────────────────────────────────────────────────────────────

export function keDtoKendaraan(k: { id: string; plat: string; aktif: boolean }): Kendaraan {
  return { id: k.id, plat: k.plat, aktif: k.aktif };
}

/** Organisasi aktif sesi harus PENGANGKUT. */
async function orgPengangkutAktif(tx: Tx, sesi: Sesi): Promise<string> {
  if (!sesi.organisasiAktifId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const o = await tx.organisasi.findUnique({ where: { id: sesi.organisasiAktifId }, select: { jenis: true } });
  if (o?.jenis !== "PENGANGKUT") throw new GalatApi("PERAN_TIDAK_BOLEH");
  return sesi.organisasiAktifId;
}

export async function buatKendaraan(tx: Tx, sesi: Sesi, plat: string, sekarang: Date): Promise<Kendaraan> {
  const organisasiId = await wajibPengurusAktif(tx, sesi);
  await orgPengangkutAktif(tx, sesi);
  const n = await tx.$executeRaw`
    INSERT INTO kendaraan (id, organisasi_id, plat, aktif, dibuat_pada) VALUES (${idBaru()}, ${organisasiId}, ${plat}, true, ${sekarang})
    ON CONFLICT (organisasi_id, plat) DO NOTHING`;
  if (n !== 1) throw new GalatApi("VALIDASI_GAGAL", { kunciPesan: "KND_PLAT_SALAH", rincian: [{ jalur: ["plat"], kode: "sudah_ada" }] });
  return keDtoKendaraan(await tx.kendaraan.findUniqueOrThrow({ where: { organisasiId_plat: { organisasiId, plat } } }));
}

export async function daftarKendaraan(tx: Tx, sesi: Sesi): Promise<Kendaraan[]> {
  const organisasiId = await orgPengangkutAktif(tx, sesi);
  const baris = await tx.kendaraan.findMany({ where: { organisasiId }, orderBy: [{ aktif: "desc" }, { plat: "asc" }] });
  return baris.map(keDtoKendaraan);
}

export async function nonaktifkanKendaraan(tx: Tx, sesi: Sesi, id: string): Promise<Kendaraan> {
  const organisasiId = await wajibPengurusAktif(tx, sesi);
  await orgPengangkutAktif(tx, sesi);
  const k = await tx.kendaraan.findUnique({ where: { id } });
  if (!k || k.organisasiId !== organisasiId) throw new GalatApi("TIDAK_DITEMUKAN");
  return keDtoKendaraan(await tx.kendaraan.update({ where: { id }, data: { aktif: false } }));
}

// ── Direktori mitra ────────────────────────────────────────────────────────

export type Mitra = {
  id: string;
  nama: string;
  jenis: "PENGANGKUT" | "PENERIMA";
  jenisPenerima: JenisPenerima | null;
  statusIzin: Organisasi["statusIzin"];
  aliranDiterima: Aliran[];
};

/** Organisasi PENGANGKUT/PENERIMA untuk memilih mitra kontrak. Tanpa data pribadi: nama badan usaha, jenis, status izin. */
export async function direktoriMitra(tx: Tx, sesi: Sesi, jenis?: "PENGANGKUT" | "PENERIMA"): Promise<Mitra[]> {
  await orgKawasanAktif(tx, sesi);
  const baris = await tx.organisasi.findMany({
    where: { jenis: jenis ?? { in: ["PENGANGKUT", "PENERIMA"] } },
    select: { id: true, nama: true, jenis: true, jenisPenerima: true, statusIzin: true, aliranDiterima: true },
    orderBy: { nama: "asc" },
  });
  return baris.map((b) => ({ ...b, jenis: b.jenis as "PENGANGKUT" | "PENERIMA" }));
}
