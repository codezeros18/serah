import { definisiAturan, validasiAmbang } from "@serah/core/aturan";
import type { Prisma } from "@serah/db";
import { KUNCI_HAK_BATAS, TEKS, type Hak, type KeputusanKonfirmasi, type KodeAturan, type KunciHak, type Organisasi, type Paket, type StatusTagihan, type Yurisdiksi } from "@serah/kontrak";
import { versiAturan } from "../aturan";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { hakPaket } from "../hak";
import { keDtoOrganisasi } from "./organisasi";
import { JENIS_PERLU_TINJAUAN, keDtoTagihan, konfirmasiTransfer } from "./tagihan";

// Layanan admin internal (S21). SEMUA fungsi dipanggil di dalam `denganAdmin` (X-Alasan ≥15 karakter, audit_log).
// Data yang dikeluarkan tidak memuat data pribadi: tanpa nama/email orang, hanya organisasi, kode, dan angka.

const KUNCI_BATAS = KUNCI_HAK_BATAS as readonly string[];

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

/** Baris tambahan di audit_log dengan rincian (catat-saja → createMany tanpa RETURNING). */
export async function catatAudit(
  tx: Tx,
  m: { aksi: string; objekJenis: string; objekId: string; organisasiId?: string | null; alasan: string; data?: Record<string, unknown> },
  sekarang: Date,
): Promise<void> {
  await tx.auditLog.createMany({
    data: [
      {
        organisasiId: m.organisasiId ?? null,
        peran: "ADMIN",
        aksi: m.aksi,
        objekJenis: m.objekJenis,
        objekId: m.objekId,
        alasan: m.alasan.trim(),
        data: (m.data ?? {}) as Prisma.InputJsonValue,
        dibuatPada: sekarang,
      },
    ],
  });
}

// ── Organisasi ─────────────────────────────────────────────────────────────

export async function daftarOrganisasi(tx: Tx): Promise<Organisasi[]> {
  const baris = await tx.organisasi.findMany({ select: PILIH_ORG, orderBy: [{ jenis: "asc" }, { nama: "asc" }], take: 1000 });
  return baris.map(keDtoOrganisasi);
}

export async function detailOrganisasi(tx: Tx, id: string) {
  const o = await tx.organisasi.findUnique({ where: { id }, select: PILIH_ORG });
  if (!o) throw new GalatApi("TIDAK_DITEMUKAN");
  const [jumlahAnggota, jumlahKawasan, jumlahTpsAktif, langganan] = await Promise.all([
    tx.keanggotaan.count({ where: { organisasiId: id, aktif: true } }),
    tx.kawasan.count({ where: { organisasiId: id } }),
    tx.tps.count({ where: { organisasiId: id, aktif: true } }),
    tx.langganan.findUnique({ where: { organisasiId: id }, select: { paketKode: true } }),
  ]);
  return { organisasi: keDtoOrganisasi(o), jumlahAnggota, jumlahKawasan, jumlahTpsAktif, paketKode: langganan?.paketKode ?? null };
}

// ── Pembayaran ─────────────────────────────────────────────────────────────

export async function daftarPembayaran(tx: Tx, status: StatusTagihan | undefined) {
  const baris = await tx.tagihan.findMany({ where: status ? { status } : {}, orderBy: { dibuatPada: "desc" }, take: 500 });
  const orgIds = [...new Set(baris.map((t) => t.organisasiId))];
  const orgs = await tx.organisasi.findMany({ where: { id: { in: orgIds } }, select: { id: true, nama: true } });
  const nama = new Map(orgs.map((o) => [o.id, o.nama]));
  const bukti = await tx.peristiwaBayar.findMany({
    where: { tagihanId: { in: baris.map((t) => t.id) }, penyedia: "MANUAL", jenis: "BUKTI_TRANSFER" },
    orderBy: { diterimaPada: "asc" },
    select: { tagihanId: true, payload: true },
  });
  const fotoPerTagihan = new Map<string, string>();
  for (const b of bukti) {
    const f = (b.payload as { fotoBuktiId?: string } | null)?.fotoBuktiId;
    if (b.tagihanId && f) fotoPerTagihan.set(b.tagihanId, f);
  }
  const tinjauan = await tx.peristiwaBayar.findMany({
    where: { jenis: JENIS_PERLU_TINJAUAN },
    orderBy: { diterimaPada: "desc" },
    take: 200,
    select: { tagihanId: true, jumlahIdr: true, payload: true, diterimaPada: true, tagihan: { select: { nomor: true, organisasiId: true } } },
  });
  return {
    tagihan: baris.map((t) => ({
      ...keDtoTagihan(t),
      organisasiId: t.organisasiId,
      organisasiNama: nama.get(t.organisasiId) ?? "-",
      fotoBuktiId: fotoPerTagihan.get(t.id) ?? null,
    })),
    perluTinjauan: tinjauan
      .filter((p) => p.tagihanId !== null && p.tagihan !== null)
      .map((p) => ({
        tagihanId: p.tagihanId as string,
        nomor: p.tagihan!.nomor as `TGH-${string}`,
        organisasiId: p.tagihan!.organisasiId,
        sebab: String((p.payload as { sebab?: unknown } | null)?.sebab ?? "-"),
        jumlahIdr: p.jumlahIdr,
        dicatatPada: p.diterimaPada.toISOString(),
      })),
  };
}

export async function konfirmasiPembayaran(tx: Tx, tagihanId: string, keputusan: KeputusanKonfirmasi, alasan: string, sekarang: Date) {
  const t = await konfirmasiTransfer(tx, tagihanId, keputusan, alasan, sekarang);
  const org = await tx.tagihan.findUnique({ where: { id: tagihanId }, select: { organisasiId: true, nomor: true } });
  await catatAudit(
    tx,
    { aksi: "PEMBAYARAN_DIKONFIRMASI", objekJenis: "tagihan", objekId: tagihanId, organisasiId: org?.organisasiId ?? null, alasan, data: { nomor: org?.nomor ?? null, keputusan } },
    sekarang,
  );
  return t;
}

// ── Paket & hak ────────────────────────────────────────────────────────────

function nilaiHakSah(kunci: KunciHak, nilai: Hak["nilai"]): boolean {
  if (KUNCI_BATAS.includes(kunci)) return nilai === null || (typeof nilai === "number" && Number.isInteger(nilai) && nilai >= 0);
  return typeof nilai === "boolean";
}

async function keDtoPaket(tx: Tx, kode: string): Promise<Paket> {
  const p = await tx.paket.findUnique({ where: { kode } });
  if (!p) throw new GalatApi("TIDAK_DITEMUKAN");
  return { kode: p.kode, urutan: p.urutan, hargaPerTpsIdr: p.hargaPerTpsIdr, berlakuUntuk: p.berlakuUntuk, aktif: p.aktif, hak: await hakPaket(tx, p.kode) };
}

export async function daftarPaket(tx: Tx): Promise<Paket[]> {
  const semua = await tx.paket.findMany({ orderBy: { urutan: "asc" } });
  return Promise.all(semua.map((p) => keDtoPaket(tx, p.kode)));
}

export async function buatPaket(tx: Tx, m: Paket, alasan: string, sekarang: Date): Promise<Paket> {
  if (await tx.paket.findUnique({ where: { kode: m.kode }, select: { kode: true } })) throw new GalatApi("TRANSISI_TIDAK_SAH");
  const kunciGanda = m.hak.map((h) => h.kunci).filter((k, i, a) => a.indexOf(k) !== i);
  if (kunciGanda.length > 0) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["hak"], kode: "kunci_ganda" }] });
  for (const [i, h] of m.hak.entries()) {
    if (!nilaiHakSah(h.kunci, h.nilai)) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["hak", i, "nilai"], kode: "nilai_tidak_sesuai_kunci" }] });
  }
  await tx.paket.create({ data: { kode: m.kode, urutan: m.urutan, hargaPerTpsIdr: m.hargaPerTpsIdr, berlakuUntuk: m.berlakuUntuk, aktif: m.aktif } });
  for (const h of m.hak) await tx.entitlement.create({ data: { paketKode: m.kode, kunci: h.kunci, nilai: h.nilai as Prisma.InputJsonValue } });
  await tx.perubahanPaket.createMany({
    data: [
      {
        paketKode: m.kode,
        kunci: null,
        nilaiBaru: { urutan: m.urutan, hargaPerTpsIdr: m.hargaPerTpsIdr, berlakuUntuk: m.berlakuUntuk, aktif: m.aktif, hak: m.hak } as Prisma.InputJsonValue,
        alasan: alasan.trim(),
        dibuatPada: sekarang,
      },
    ],
  });
  return keDtoPaket(tx, m.kode);
}

export async function ubahEntitlement(tx: Tx, kode: string, h: Hak, alasan: string, sekarang: Date): Promise<Paket> {
  if (!(await tx.paket.findUnique({ where: { kode }, select: { kode: true } }))) throw new GalatApi("TIDAK_DITEMUKAN");
  if (!nilaiHakSah(h.kunci, h.nilai)) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["nilai"], kode: "nilai_tidak_sesuai_kunci" }] });
  const lama = await tx.entitlement.findUnique({ where: { paketKode_kunci: { paketKode: kode, kunci: h.kunci } }, select: { nilai: true } });
  await tx.entitlement.upsert({
    where: { paketKode_kunci: { paketKode: kode, kunci: h.kunci } },
    create: { paketKode: kode, kunci: h.kunci, nilai: h.nilai as Prisma.InputJsonValue },
    update: { nilai: h.nilai as Prisma.InputJsonValue },
  });
  await tx.perubahanPaket.createMany({
    data: [
      {
        paketKode: kode,
        kunci: h.kunci,
        ...(lama ? { nilaiLama: lama.nilai as Prisma.InputJsonValue } : {}),
        nilaiBaru: h.nilai as Prisma.InputJsonValue,
        alasan: alasan.trim(),
        dibuatPada: sekarang,
      },
    ],
  });
  return keDtoPaket(tx, kode);
}

// ── Aturan berversi ────────────────────────────────────────────────────────

type BarisAturan = { id: string; kode: KodeAturan; yurisdiksi: Yurisdiksi; versi: number; sumber: string; aksi: string; ambang: unknown; kunciTeks: string; berlakuDari: Date };

function keDtoAturan(b: BarisAturan) {
  // Kontrak hanya membawa bilangan bulat; larik (kata hujan R-10) tetap di DB dan dipakai evaluator.
  const ambang: Record<string, number> = {};
  for (const [k, v] of Object.entries((b.ambang ?? {}) as Record<string, unknown>)) if (typeof v === "number" && Number.isInteger(v)) ambang[k] = v;
  return { id: b.id, kode: b.kode, yurisdiksi: b.yurisdiksi, versi: b.versi, sumber: b.sumber, aksi: b.aksi as never, ambang, kunciTeks: b.kunciTeks, berlakuDari: b.berlakuDari.toISOString() };
}

export async function daftarAturan(tx: Tx) {
  const baris = await tx.aturanVersi.findMany({ orderBy: [{ kode: "asc" }, { yurisdiksi: "asc" }, { versi: "asc" }] });
  return baris.map(keDtoAturan);
}

export type MasukanAturanBaru = { kode: KodeAturan; yurisdiksi: Yurisdiksi; sumber: string; aksi: string; ambang: Record<string, number>; kunciTeks: string; berlakuDari: string };

/**
 * Versi aturan BARU (baris baru; versi lama tak pernah diubah — tabel catat-saja). Syarat: aksi sama dengan definisi
 * aturan, yurisdiksi didukung aturan itu, ambang sah menurut core, kunci teks ada di teks.ts, dan berlaku_dari tidak
 * di masa lalu serta setelah versi terakhir (riwayat penilaian tidak ditulis ulang).
 */
export async function tambahVersiAturan(tx: Tx, m: MasukanAturanBaru, sekarang: Date) {
  const d = definisiAturan(m.kode);
  const salah = (jalur: string, kode: string) => new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: [jalur], kode }] });
  if (m.aksi !== d.aksi) throw salah("aksi", "aksi_tidak_sesuai_aturan");
  if (!d.yurisdiksi.includes(m.yurisdiksi)) throw salah("yurisdiksi", "yurisdiksi_tidak_didukung_aturan");
  if (!Object.prototype.hasOwnProperty.call(TEKS, m.kunciTeks)) throw salah("kunciTeks", "kunci_teks_tidak_ada");
  const ambang = validasiAmbang(m.kode, m.ambang);
  if (!ambang.ok) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["ambang", ambang.kunci], kode: ambang.sebab }] });

  const berlakuDari = new Date(m.berlakuDari);
  if (Number.isNaN(berlakuDari.getTime()) || berlakuDari.getTime() < sekarang.getTime()) throw salah("berlakuDari", "tidak_boleh_di_masa_lalu");
  const semua = (await versiAturan(tx, m.yurisdiksi)).filter((v) => v.kode === m.kode);
  const terakhir = semua.reduce<{ versi: number; berlakuDari: string } | null>((a, v) => (!a || v.versi > a.versi ? v : a), null);
  if (terakhir && berlakuDari.toISOString() <= terakhir.berlakuDari) throw salah("berlakuDari", "harus_setelah_versi_terakhir");

  const baru = await tx.aturanVersi.create({
    data: {
      kode: m.kode,
      yurisdiksi: m.yurisdiksi,
      versi: (terakhir?.versi ?? 0) + 1,
      sumber: m.sumber.trim(),
      aksi: d.aksi,
      ambang: m.ambang as Prisma.InputJsonValue,
      kunciTeks: m.kunciTeks,
      berlakuDari,
      dibuatPada: sekarang,
    },
  });
  return keDtoAturan(baru);
}

// ── Audit ──────────────────────────────────────────────────────────────────

const HARI_MS = 86_400_000;
const SELISIH_WIB_MS = 7 * 3_600_000;
/** Tanggal WIB (YYYY-MM-DD) → awal hari itu sebagai instan UTC. */
const awalHariWib = (t: string) => new Date(new Date(`${t}T00:00:00.000Z`).getTime() - SELISIH_WIB_MS);

export async function daftarAudit(tx: Tx, k: { dari?: string | undefined; sampai?: string | undefined; organisasiId?: string | undefined; aksi?: string | undefined }) {
  const baris = await tx.auditLog.findMany({
    where: {
      ...(k.organisasiId ? { organisasiId: k.organisasiId } : {}),
      ...(k.aksi ? { aksi: k.aksi } : {}),
      ...(k.dari || k.sampai
        ? { dibuatPada: { ...(k.dari ? { gte: awalHariWib(k.dari) } : {}), ...(k.sampai ? { lt: new Date(awalHariWib(k.sampai).getTime() + HARI_MS) } : {}) } }
        : {}),
    },
    orderBy: { dibuatPada: "desc" },
    take: 500,
  });
  // Tanpa kolom `data` (rincian internal) dan tanpa nama/email orang: hanya peran, aksi, objek, alasan.
  return baris.map((b) => ({
    id: b.id,
    organisasiId: b.organisasiId,
    peran: b.peran ?? ("ADMIN" as const),
    aksi: b.aksi,
    objekJenis: b.objekJenis,
    objekId: b.objekId,
    alasan: b.alasan,
    dibuatPada: b.dibuatPada.toISOString(),
  }));
}

// ── Metrik ─────────────────────────────────────────────────────────────────

const BP_PENUH = 10_000;
const HARI_JENDELA_TERCATAT = 30;
const HARI_KAWASAN_AKTIF = 7;
const STATUS_SUDAH_DIANGKUT = ["DIANGKUT", "MENGGANTUNG", "DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"] as const;
const STATUS_DITUTUP = ["DITERIMA", "DITERIMA_SEBAGIAN", "DITOLAK"] as const;

/** a/b dalam basis poin, pembagian bilangan bulat (dibulatkan ke bawah, maksimum 100%); b ≤ 0 → 0. */
function bp(a: number, b: number): number {
  if (b <= 0) return 0;
  return Math.min(BP_PENUH, Math.floor((a * BP_PENUH) / b));
}

/**
 * Metrik agregat platform (FITUR F43): TIDAK ada metrik per orang.
 * - serahTertutupBp: dari serah yang sudah diangkut, berapa yang sudah ditutup penerima (diterima/sebagian/ditolak).
 * - hariTpsTercatatBp: pasangan (TPS aktif, hari WIB) dalam 30 hari terakhir yang punya ≥1 catatan wadah.
 * - kawasanAktif7Hari: kawasan dengan catatan wadah atau event serah dalam 7 hari terakhir.
 */
export async function metrikPlatform(tx: Tx, sekarang: Date) {
  const [diangkut, ditutup, tpsAktif] = await Promise.all([
    tx.serah.count({ where: { status: { in: [...STATUS_SUDAH_DIANGKUT] } } }),
    tx.serah.count({ where: { status: { in: [...STATUS_DITUTUP] } } }),
    tx.tps.count({ where: { aktif: true } }),
  ]);
  const sejak = new Date(sekarang.getTime() - HARI_JENDELA_TERCATAT * HARI_MS);
  const tercatat = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM (
      SELECT DISTINCT w.tps_id, (w.terjadi_pada AT TIME ZONE 'Asia/Jakarta')::date AS hari
      FROM wadah_catat w JOIN tps t ON t.id = w.tps_id
      WHERE t.aktif AND w.terjadi_pada >= ${sejak} AND w.terjadi_pada < ${sekarang}
    ) x`;
  const sejak7 = new Date(sekarang.getTime() - HARI_KAWASAN_AKTIF * HARI_MS);
  const aktif = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM (
      SELECT kawasan_id FROM wadah_catat WHERE diterima_pada >= ${sejak7}
      UNION
      SELECT kawasan_id FROM event WHERE diterima_pada >= ${sejak7}
    ) x`;
  return {
    serahTertutupBp: bp(ditutup, diangkut),
    hariTpsTercatatBp: bp(Number(tercatat[0]?.n ?? 0n), tpsAktif * HARI_JENDELA_TERCATAT),
    kawasanAktif7Hari: Number(aktif[0]?.n ?? 0n),
  };
}
