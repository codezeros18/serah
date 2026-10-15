import { formatGramKeKg } from "@serah/core/angka";
import type { HasilAturan } from "@serah/core/aturan";
import { hashEvent } from "@serah/core/rantai";
import { terapkanTransisi, type AksiTransisi, type GalatTransisi, type KonteksTransisi, type PeranPelaku, type SebabTransisi, type SerahKini } from "@serah/core/status";
import type { Prisma } from "@serah/db";
import { isi, type JenisEvent, type KunciTeks, type StatusSerah } from "@serah/kontrak";
import type { Tx } from "../db";
import { GalatApi } from "../galat";

// layananTransisi — SATU-SATUNYA pengubah serah.status (CLAUDE.md §2.2, BLUEPRINT §F.2).
// Urutan dalam satu transaksi: core.terapkanTransisi → kunci rantai kawasan (pg_advisory_xact_lock) →
// core.hashEvent → INSERT/UPDATE serah (cek versi optimistik) → INSERT event → tulis tabel 🔒 terkait → NOTIFY.

export type SerahDb = SerahKini & { id: string; kawasanId: string; kendaraanId: string | null; kontrakId: string | null };

// ── Rantai ─────────────────────────────────────────────────────────────────

export type EventMasuk = {
  kawasanId: string;
  serahId: string | null;
  serahKode: string | null;
  orgKawasanId: string;
  orgPengangkutId: string | null;
  orgPenerimaId: string | null;
  jenis: JenisEvent;
  peran: PeranPelaku;
  payload: Record<string, unknown>;
  terjadiPada: Date;
  idempotencyKey: string;
};

export type EventTertulis = { id: string; urutanRantai: number; prevHash: string; hash: string };

/**
 * Sambung satu event ke rantai kawasan. Kunci rantai dipegang sampai transaksi selesai; hash dihitung core
 * (harus sama dengan `hash_event` SQL — diuji). `diterima_pada` = waktu server `sekarang`.
 */
export async function tambahEvent(tx: Tx, e: EventMasuk, sekarang: Date): Promise<EventTertulis> {
  const [ujung] = await tx.$queryRaw<{ ujung_urutan: number; ujung_hash: string }[]>`SELECT * FROM kunci_ujung_rantai(${e.kawasanId})`;
  if (!ujung) throw new GalatApi("GALAT_SERVER");
  const prevHash = ujung.ujung_hash;
  const hash = hashEvent(prevHash, { jenis: e.jenis, serahKode: e.serahKode, peran: e.peran, payload: e.payload, diterimaPada: sekarang });
  const baris = await tx.event.create({
    data: {
      kawasanId: e.kawasanId,
      urutanRantai: ujung.ujung_urutan + 1,
      serahId: e.serahId,
      orgKawasanId: e.orgKawasanId,
      orgPengangkutId: e.orgPengangkutId,
      orgPenerimaId: e.orgPenerimaId,
      jenis: e.jenis,
      peran: e.peran,
      payload: e.payload as Prisma.InputJsonValue,
      prevHash,
      hash,
      idempotencyKey: e.idempotencyKey,
      terjadiPada: e.terjadiPada,
      diterimaPada: sekarang,
    },
    select: { id: true, urutanRantai: true },
  });
  return { id: baris.id, urutanRantai: baris.urutanRantai, prevHash, hash };
}

/** NOTIFY kanal `org_<id>` untuk setiap organisasi terlibat (§F.4). Payload tanpa data pribadi. */
export async function beriTahu(tx: Tx, orgIds: readonly (string | null)[], isiNotify: { jenis: string; kode: string; versi?: number }): Promise<void> {
  const teks = JSON.stringify(isiNotify);
  for (const org of new Set(orgIds.filter((o): o is string => o !== null))) {
    await tx.$executeRaw`SELECT pg_notify(${`org_${org}`}, ${teks})`;
  }
}

// ── Galat transisi → GalatApi beramplop (teks dari teks.ts) ────────────────

const PESAN_SEBAB: Partial<Record<SebabTransisi, KunciTeks>> = {
  ALASAN_KURANG: "UMUM_ALASAN_WAJIB",
  ALASAN_TOLAK_KURANG: "UMUM_ALASAN_WAJIB",
  WADAH_KOSONG: "T2_TANPA_PILIHAN",
};

export function galatDariTransisi(g: GalatTransisi, opsi: { hasilAturan?: readonly HasilAturan[]; beratTiketG?: number } = {}): GalatApi {
  const rincian = [{ jalur: [] as (string | number)[], kode: g.sebab }];
  if (g.kode === "ATURAN_DITOLAK" && g.aturan) {
    const h = opsi.hasilAturan?.find((a) => a.kode === g.aturan?.kode && a.aksi === "TOLAK");
    if (h) return new GalatApi("ATURAN_DITOLAK", { aturan: { kode: h.kode, aksi: h.aksi, teks: h.teks }, rincian });
    return new GalatApi("ATURAN_DITOLAK", { rincian });
  }
  if (g.sebab === "JUMLAH_TIDAK_SAMA" && opsi.beratTiketG !== undefined) {
    return new GalatApi("VALIDASI_GAGAL", { pesan: isi("P1_JUMLAH_TIDAK_SAMA", { berat_tiket: formatGramKeKg(opsi.beratTiketG) }), rincian });
  }
  const kunciPesan = PESAN_SEBAB[g.sebab];
  return new GalatApi(g.kode, { ...(kunciPesan ? { kunciPesan } : {}), rincian });
}

// ── layananTransisi ────────────────────────────────────────────────────────

export type MasukanTransisi = {
  /** null hanya untuk BUAT. */
  serah: SerahDb | null;
  aksi: AksiTransisi;
  konteks: KonteksTransisi;
  sekarang: Date;
  idempotencyKey: string;
  /** Hasil evaluator core/aturan yang dipakai membangun konteks (untuk teks penolakan). */
  hasilAturan?: readonly HasilAturan[];
  beratTiketG?: number;
  /** Untuk BUAT: identitas serah baru. */
  baru?: { kawasanId: string };
  /** Kolom proyeksi tambahan di luar core (mis. kontrak yang berlaku saat AMBIL). */
  kontrakId?: string | null;
  /** Tulis baris 🔒 terkait (serah_wadah, tiket, rincian, koreksi) dalam transaksi yang sama. */
  tulisTambahan?: (tx: Tx, serahId: string) => Promise<void>;
};

export type HasilLayananTransisi = {
  serahId: string;
  kode: string;
  status: StatusSerah;
  versi: number;
  orgKawasanId: string;
  orgPengangkutId: string | null;
  orgPenerimaId: string | null;
  event: EventTertulis;
};

export async function layananTransisi(tx: Tx, m: MasukanTransisi): Promise<HasilLayananTransisi> {
  const h = terapkanTransisi(m.serah, m.aksi, m.konteks, m.sekarang);
  if (!h.ok) throw galatDariTransisi(h.galat, { hasilAturan: m.hasilAturan, beratTiketG: m.beratTiketG });

  let serahId: string;
  let kode: string;
  let kawasanId: string;
  let orgKawasanId: string;
  let orgPengangkutId: string | null;
  let orgPenerimaId: string | null;

  if (m.serah === null) {
    if (m.aksi.jenis !== "BUAT" || !m.baru) throw new GalatApi("GALAT_SERVER");
    const dibuat = await tx.serah.create({
      data: {
        kode: m.aksi.kode,
        tpsId: m.aksi.tpsId,
        kawasanId: m.baru.kawasanId,
        orgKawasanId: m.aksi.orgKawasanId,
        status: h.statusBaru,
        versi: h.versiBaru,
        dibuatPada: m.sekarang,
        diperbaruiPada: m.sekarang,
      },
      select: { id: true },
    });
    serahId = dibuat.id;
    kode = m.aksi.kode;
    kawasanId = m.baru.kawasanId;
    orgKawasanId = m.aksi.orgKawasanId;
    orgPengangkutId = null;
    orgPenerimaId = null;
  } else {
    const s = m.serah;
    const p = h.proyeksi;
    const data: Prisma.SerahUncheckedUpdateManyInput = {
      status: h.statusBaru,
      versi: h.versiBaru,
      diperbaruiPada: m.sekarang,
    };
    if (p.orgPengangkutId !== undefined) data.orgPengangkutId = p.orgPengangkutId;
    if (p.orgPenerimaId !== undefined) data.orgPenerimaId = p.orgPenerimaId;
    if (p.kendaraanId !== undefined) data.kendaraanId = p.kendaraanId;
    if (m.kontrakId !== undefined) data.kontrakId = m.kontrakId;
    else if (p.orgPengangkutId === null) data.kontrakId = null;
    // Cek versi optimistik (§I.2): dua penutupan bersamaan → yang kalah KONFLIK_VERSI.
    const n = await tx.serah.updateMany({ where: { id: s.id, versi: s.versi }, data });
    if (n.count !== 1) throw new GalatApi("KONFLIK_VERSI");
    serahId = s.id;
    kode = s.kode;
    kawasanId = s.kawasanId;
    orgKawasanId = s.orgKawasanId;
    // Event memuat pihak sesudah transisi; pihak yang baru dilepas (KEMBALIKAN) tetap tercatat pada event-nya.
    orgPengangkutId = p.orgPengangkutId ?? s.orgPengangkutId;
    orgPenerimaId = p.orgPenerimaId ?? s.orgPenerimaId;
  }

  if (m.tulisTambahan) await m.tulisTambahan(tx, serahId);

  const event = await tambahEvent(
    tx,
    {
      kawasanId,
      serahId,
      serahKode: kode,
      orgKawasanId,
      orgPengangkutId,
      orgPenerimaId,
      jenis: h.event.jenis,
      peran: h.event.peran,
      payload: h.event.payload,
      terjadiPada: h.event.terjadiPada,
      idempotencyKey: m.idempotencyKey,
    },
    m.sekarang,
  );

  await beriTahu(tx, [orgKawasanId, orgPengangkutId, orgPenerimaId], { jenis: h.event.jenis, kode, versi: h.versiBaru });

  return {
    serahId,
    kode,
    status: h.statusBaru,
    versi: h.versiBaru,
    orgKawasanId,
    orgPengangkutId: h.proyeksi.orgPengangkutId !== undefined ? h.proyeksi.orgPengangkutId : (m.serah?.orgPengangkutId ?? null),
    orgPenerimaId: h.proyeksi.orgPenerimaId !== undefined ? h.proyeksi.orgPenerimaId : (m.serah?.orgPenerimaId ?? null),
    event,
  };
}
