import { evaluasiMenggantung } from "@serah/core/aturan";
import { awalHariWib, tanggalWib } from "@serah/core/waktu";
import type { Prisma } from "@serah/db";
import { denganSistem, type Tx } from "../db";
import { muatEnv } from "../env";
import { GalatApi } from "../galat";
import { integrasi, type NowcastMentah, type PrakiraanMentah } from "../integrasi-stub";
import { nowcastBerlaku, prioritasTps, simpanNowcast, simpanPrakiraan, type PrakiraanTersimpan } from "./cuaca";
import { catatNotifikasi } from "./notifikasi";
import { muatSerah } from "./serah";
import { layananTransisi } from "./transisi";
import { peringatanTps, yurisdiksiKawasan, type TpsAkses } from "./wadah";

// Cron (BLUEPRINT §F.5, S08-7). Setiap pekerjaan idempoten lewat `pekerjaan_cron(nama, jendela)`: panggilan kedua
// pada jendela yang sama dilewati. Efek di dalam pekerjaan juga idempoten (kunci event deterministik, dedup
// prioritas & notifikasi), sehingga pekerjaan yang diulang di jendela berikutnya tidak menggandakan apa pun.
// Notifikasi hanya ditulis ke tabel (pengiriman push/email di S17). Uji coba & tagihan bulanan: S19.

export const NAMA_CRON = ["sepuluh-menit", "tiga-jam", "harian"] as const;
export type NamaCron = (typeof NAMA_CRON)[number];

const MENIT = 60_000;
const JAM = 60 * MENIT;
const HARI = 24 * JAM;

/** Kunci jendela: 10 menit / 3 jam (UTC, dibulatkan ke bawah) / tanggal WIB. */
export function jendelaCron(nama: NamaCron, sekarang: Date): string {
  const t = sekarang.getTime();
  if (nama === "harian") return tanggalWib(sekarang);
  const lebar = nama === "sepuluh-menit" ? 10 * MENIT : 3 * JAM;
  return new Date(t - (t % lebar)).toISOString().slice(0, 16);
}

export type OpsiCron = {
  /** Batasi R-07 ke serah tertentu (uji & pemicu manual). */
  hanyaSerah?: readonly string[];
  /** Timpa kunci jendela (uji & pemicu manual admin). */
  jendela?: string;
};

type Prefetch = { nowcast: NowcastMentah[] | null; prakiraan: PrakiraanMentah[] };

async function tpsAktif(tx: Tx): Promise<TpsAkses[]> {
  return tx.tps.findMany({
    where: { aktif: true },
    select: { id: true, kode: true, nama: true, aktif: true, latE6: true, lonE6: true, kawasanId: true, organisasiId: true },
    orderBy: { kode: "asc" },
  });
}

/** true bila notifikasi (jenis, objek) sudah ditulis hari ini (WIB) — cegah notifikasi berulang tiap 10 menit. */
async function sudahHariIni(tx: Tx, jenis: Prisma.NotifikasiWhereInput["jenis"], objekKode: string, sekarang: Date): Promise<boolean> {
  return (await tx.notifikasi.count({ where: { jenis, objekKode, dibuatPada: { gte: awalHariWib(tanggalWib(sekarang)) } } })) > 0;
}

// ── sepuluh-menit: R-07, nowcast, R-10, R-05/R-06 ─────────────────────────

/**
 * R-07: setiap serah ditandai di transaksinya SENDIRI, agar kunci rantai kawasan hanya dipegang sesingkat satu
 * transisi (bukan selama seluruh pekerjaan cron). Serah yang berubah status bersamaan (mis. baru ditutup) dilewati.
 */
async function r07(sekarang: Date, opsi: OpsiCron): Promise<number> {
  const diangkut = await denganSistem((tx) =>
    tx.serah.findMany({
      where: { status: "DIANGKUT", ...(opsi.hanyaSerah ? { kode: { in: [...opsi.hanyaSerah] } } : {}) },
      select: { id: true, kode: true, kawasanId: true },
    }),
  );
  let n = 0;
  for (const s of diangkut) {
    try {
      if (await denganSistem((tx) => tandaiSatu(tx, s, sekarang))) n += 1;
    } catch (e) {
      if (!(e instanceof GalatApi) || (e.kode !== "KONFLIK_VERSI" && e.kode !== "TRANSISI_TIDAK_SAH")) throw e;
    }
  }
  return n;
}

async function tandaiSatu(tx: Tx, s: { id: string; kode: string; kawasanId: string }, sekarang: Date): Promise<boolean> {
  {
    const setuju = await tx.event.findFirst({ where: { serahId: s.id, jenis: "SERAH_DISETUJUI" }, orderBy: { urutanRantai: "desc" }, select: { diterimaPada: true } });
    if (!setuju) return false;
    const hasil = evaluasiMenggantung({ yurisdiksi: await yurisdiksiKawasan(tx, s.kawasanId), sekarang, kodeSerah: s.kode, status: "DIANGKUT", disetujuiPada: setuju.diterimaPada });
    if (hasil.length === 0) return false;
    const h = await layananTransisi(tx, {
      serah: await muatSerah(tx, s.kode),
      aksi: { jenis: "TANDAI_MENGGANTUNG" },
      konteks: { pelaku: { peran: "SISTEM", orgIds: [] }, aturan: hasil.map((a) => ({ kode: a.kode, aksi: a.aksi })) },
      hasilAturan: hasil,
      sekarang,
      // Deterministik per serah: satu serah hanya bisa ditandai menggantung sekali.
      idempotencyKey: `cron-r07-${s.id}`,
    });
    await catatNotifikasi(
      tx,
      [
        { organisasiId: h.orgKawasanId, peranTujuan: ["PENGELOLA"], jenis: "SERAH_MENGGANTUNG", objekKode: h.kode },
        { organisasiId: h.orgPengangkutId, peranTujuan: ["PENGANGKUT"], jenis: "SERAH_MENGGANTUNG", objekKode: h.kode },
        { organisasiId: h.orgPenerimaId, peranTujuan: ["PENERIMA"], jenis: "SERAH_MENGGANTUNG", objekKode: h.kode },
      ],
      sekarang,
    );
    return true;
  }
}

async function r10(tx: Tx, sekarang: Date): Promise<number> {
  const cache = { prakiraan: new Map<string, PrakiraanTersimpan | null>(), nowcast: await nowcastBerlaku(tx, sekarang) };
  let n = 0;
  for (const tps of await tpsAktif(tx)) {
    const p = (await prioritasTps(tx, tps, sekarang, cache)).prioritas;
    if (!p) continue;
    const ada = await tx.prioritasTercatat.count({ where: { tpsId: tps.id, acuan: p.acuan, aliran: p.aliran } });
    if (ada > 0) continue;
    // weather_desc: deskripsi slot prakiraan, atau peristiwa CAP untuk nowcast.
    let weatherDesc: string;
    if (p.sumberCuaca === "PRAKIRAAN") {
      const k = await tx.kawasan.findUnique({ where: { id: tps.kawasanId }, select: { adm4: true } });
      weatherDesc = (k && cache.prakiraan.get(k.adm4)?.slot.find((s) => s.slotUtc.toISOString() === p.acuan)?.weatherDesc) ?? "";
    } else {
      weatherDesc = (await tx.peringatanCuaca.findUnique({ where: { identifierCap: p.acuan }, select: { event: true } }))?.event ?? "";
    }
    await tx.prioritasTercatat.create({
      data: {
        tpsId: tps.id,
        kawasanId: tps.kawasanId,
        orgKawasanId: tps.organisasiId,
        sumber: p.sumberCuaca,
        acuan: p.acuan,
        weatherDesc,
        aliran: p.aliran,
        umurJam: p.umurJam,
        ditetapkanPada: sekarang,
      },
    });
    const pengangkut = await tx.kontrak.findMany({ where: { kawasanId: tps.kawasanId, status: "AKTIF" }, select: { orgPengangkutId: true }, distinct: ["orgPengangkutId"] });
    await catatNotifikasi(
      tx,
      [
        { organisasiId: tps.organisasiId, peranTujuan: ["PETUGAS", "PENGELOLA"], jenis: "PRIORITAS_ANGKUT", objekKode: tps.kode, data: { sumber: p.sumberCuaca, aliran: p.aliran } },
        ...pengangkut.map((k) => ({ organisasiId: k.orgPengangkutId, peranTujuan: ["PENGANGKUT" as const], jenis: "PRIORITAS_ANGKUT" as const, objekKode: tps.kode, data: { sumber: p.sumberCuaca, aliran: p.aliran } })),
      ],
      sekarang,
    );
    n += 1;
  }
  return n;
}

async function peringatanWadah(tx: Tx, sekarang: Date, kode: readonly ("R05" | "R06" | "R09")[], jenis: "WADAH_LEWAT_BATAS" | "CATATAN_HARIAN_BELUM"): Promise<number> {
  let n = 0;
  for (const tps of await tpsAktif(tx)) {
    const hasil = (await peringatanTps(tx, tps, sekarang)).filter((h) => (kode as readonly string[]).includes(h.kode));
    if (hasil.length === 0 || (await sudahHariIni(tx, jenis, tps.kode, sekarang))) continue;
    n += await catatNotifikasi(tx, [{ organisasiId: tps.organisasiId, peranTujuan: ["PETUGAS", "PENGELOLA"], jenis, objekKode: tps.kode, data: { aturan: hasil.map((h) => h.kode).join(",") } }], sekarang);
  }
  return n;
}

// ── harian: R-09, retensi foto, bersih batas laju ──────────────────────────

async function retensiFoto(tx: Tx, sekarang: Date): Promise<number> {
  const batas = new Date(sekarang.getTime() - muatEnv().RETENSI_FOTO_HARI * HARI);
  const lama = await tx.foto.findMany({ where: { diterimaPada: { lt: batas }, dihapusRetensiPada: null }, select: { id: true, objectKey: true }, take: 500 });
  for (const f of lama) {
    // Objek dihapus lebih dulu: bila transaksi gagal, foto tetap ditandai belum dihapus dan diulang besok.
    await integrasi().penyimpanan.hapus(f.objectKey);
    await tx.$queryRaw`SELECT tandai_foto_dihapus_retensi(${f.id})`;
  }
  return lama.length;
}

// ── Pintu ──────────────────────────────────────────────────────────────────

async function ambilData(nama: NamaCron): Promise<Prefetch> {
  // Jaringan di luar transaksi DB. Kegagalan sumber = null (tanpa tebakan).
  if (nama === "sepuluh-menit") return { nowcast: await integrasi().cuaca.nowcast().catch(() => null), prakiraan: [] };
  if (nama !== "tiga-jam") return { nowcast: null, prakiraan: [] };
  const adm4 = await denganSistem((tx) => tx.kawasan.findMany({ select: { adm4: true }, distinct: ["adm4"] }));
  const prakiraan: PrakiraanMentah[] = [];
  for (const { adm4: a } of adm4) {
    const p = await integrasi().cuaca.prakiraan(a).catch(() => null);
    if (p) prakiraan.push(p);
  }
  return { nowcast: null, prakiraan };
}

/** Bagian pekerjaan yang tidak menyentuh rantai: satu transaksi sistem. */
async function kerja(tx: Tx, nama: NamaCron, sekarang: Date, data: Prefetch): Promise<Record<string, number | boolean>> {
  switch (nama) {
    case "sepuluh-menit":
      return {
        nowcastTersedia: data.nowcast !== null,
        nowcastBaru: data.nowcast ? await simpanNowcast(tx, data.nowcast, sekarang) : 0,
        prioritas: await r10(tx, sekarang),
        peringatanWadah: await peringatanWadah(tx, sekarang, ["R05", "R06"], "WADAH_LEWAT_BATAS"),
      };
    case "tiga-jam": {
      let slot = 0;
      for (const p of data.prakiraan) slot += await simpanPrakiraan(tx, p, sekarang);
      return { prakiraanAdm4: data.prakiraan.length, slotBaru: slot };
    }
    case "harian":
      return {
        catatanHarianBelum: await peringatanWadah(tx, sekarang, ["R09"], "CATATAN_HARIAN_BELUM"),
        fotoRetensi: await retensiFoto(tx, sekarang),
        batasLajuDibersihkan: (await tx.batasLaju.deleteMany({ where: { jendelaMulai: { lt: new Date(sekarang.getTime() - HARI) } } })).count,
      };
  }
}

export async function jalankanCron(nama: NamaCron, sekarang: Date, opsi: OpsiCron = {}) {
  const jendela = opsi.jendela ?? jendelaCron(nama, sekarang);
  // 1. Klaim jendela (transaksi pendek). Sudah diklaim → dilewati.
  const klaim = await denganSistem((tx) => tx.$executeRaw`INSERT INTO pekerjaan_cron (nama, jendela, mulai_pada) VALUES (${nama}, ${jendela}, ${sekarang}) ON CONFLICT DO NOTHING`);
  if (klaim === 0) return { pekerjaan: nama, jendela, dilewati: true };
  // 2. Kerja. Semua efek idempoten: bila terputus di tengah, jendela berikutnya menyelesaikannya tanpa ganda.
  const data = await ambilData(nama);
  const menggantung = nama === "sepuluh-menit" ? { menggantung: await r07(sekarang, opsi) } : {};
  const hasil = { ...menggantung, ...(await denganSistem((tx) => kerja(tx, nama, sekarang, data))) };
  // 3. Tandai selesai.
  await denganSistem((tx) => tx.pekerjaanCron.update({ where: { nama_jendela: { nama, jendela } }, data: { selesaiPada: new Date(), hasil } }));
  return { pekerjaan: nama, jendela, dilewati: false };
}
