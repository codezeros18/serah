import { hitungIndikator, type Indikator, type PrioritasPrakiraan, type SerahDisetujui } from "@serah/core/indikator";
import {
  pilihHargaAcuan,
  ringkasDitolak,
  susunBaris,
  susunCsv,
  totalPerAliran,
  type FilterPihak,
  type SerahTertutup,
} from "@serah/core/laporan";
import { hitungNeraca, jumlahkanPerAliran, type RincianNeraca, type WadahNeraca } from "@serah/core/neraca";
import { akhirPeriodeWib, awalHariWib, awalPeriodeWib, tanggalWib } from "@serah/core/waktu";
import { ALIRAN, TEKS, type JenisEvent, type PihakEkspor, type PihakLaporan } from "@serah/kontrak";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import type { Sesi } from "../sesi";
import { prioritasTps, type PrakiraanTersimpan } from "./cuaca";
import { nilaiFinal } from "./serah";
import { peringatanTps, rujukan } from "./wadah";

// Tiga laporan, CSV, ringkasan kawasan, penyebab ditolak, indikator (S11). Semua hitungan di packages/core;
// di sini hanya memuat data di bawah RLS sesi, memilih filter pihak, dan menyusun keluaran sesuai kontrak.
// Nilai berat selalu FINAL (setelah koreksi, v_nilai_final); nilai asli tidak pernah dibaca.

const EVENT_TUTUP: JenisEvent[] = ["SERAH_DITERIMA", "SERAH_DITERIMA_SEBAGIAN", "SERAH_DITOLAK"];
const HARI_MS = 86_400_000;

const PIHAK_EKSPOR: Record<PihakLaporan, PihakEkspor> = { kawasan: "KAWASAN", pengangkut: "PENGANGKUT", penerima: "PENERIMA" };

const unik = <T>(xs: readonly (T | null)[]): T[] => [...new Set(xs.filter((x): x is T => x !== null))];

// ── Akses per pihak (S11-5) ────────────────────────────────────────────────

/**
 * Filter pihak untuk sesi:
 * - PENGELOLA melihat ketiga laporan atas serah kawasannya (K4: tiga tab, angka sama) → filter kolom kawasan;
 * - PENGANGKUT hanya laporan pengangkut dan PENERIMA hanya laporan penerima, atas serah miliknya sendiri.
 * Peran/pihak lain → PERAN_TIDAK_BOLEH. Serah organisasi lain tidak pernah masuk (RLS + filter organisasi).
 */
export function filterUntukSesi(sesi: Sesi, pihak: PihakLaporan, kawasanId?: string): FilterPihak {
  const org = sesi.organisasiAktifId;
  if (!org || !sesi.peran) throw new GalatApi("PERAN_TIDAK_BOLEH");
  const f = { organisasiId: org, kawasanId };
  if (sesi.peran === "PENGELOLA") return { jenis: "kawasan", ...f };
  if (sesi.peran === "PENGANGKUT" && pihak === "pengangkut") return { jenis: "pengangkut", ...f };
  if (sesi.peran === "PENERIMA" && pihak === "penerima") return { jenis: "penerima", ...f };
  throw new GalatApi("PERAN_TIDAK_BOLEH");
}

/** Kawasan yang boleh dilihat sesi; tidak terlihat (RLS) atau bukan milik pengelola ini → 404. */
async function kawasanSesi(tx: Tx, sesi: Sesi, kawasanId: string, harusMilik: boolean) {
  const k = await tx.kawasan.findUnique({ where: { id: kawasanId }, select: { id: true, organisasiId: true, adm4: true } });
  if (!k || (harusMilik && k.organisasiId !== sesi.organisasiAktifId)) throw new GalatApi("TIDAK_DITEMUKAN");
  return k;
}

// ── Pemuatan serah tertutup ────────────────────────────────────────────────

const KOLOM_EVENT = { kawasan: "orgKawasanId", pengangkut: "orgPengangkutId", penerima: "orgPenerimaId" } as const;

/**
 * Serah yang DITUTUP pada periode (waktu server event penutupan, WIB) untuk filter pihak. Batas organisasi dipasang
 * di kueri (selain RLS). Event penutupan & koreksi membawa ketiga organisasi, sehingga terbaca oleh ketiga pihak.
 */
export async function muatSerahTertutup(tx: Tx, filter: FilterPihak, periode: string): Promise<SerahTertutup[]> {
  const tutup = await tx.event.findMany({
    where: {
      jenis: { in: EVENT_TUTUP },
      diterimaPada: { gte: awalPeriodeWib(periode), lt: akhirPeriodeWib(periode) },
      [KOLOM_EVENT[filter.jenis]]: filter.organisasiId,
      ...(filter.kawasanId ? { kawasanId: filter.kawasanId } : {}),
      serahId: { not: null },
    },
    select: { serahId: true, diterimaPada: true },
  });
  const ditutupPada = new Map(tutup.map((e) => [e.serahId!, e.diterimaPada]));
  const ids = [...ditutupPada.keys()];
  if (ids.length === 0) return [];

  const serah = await tx.serah.findMany({
    where: { id: { in: ids } },
    select: { id: true, kode: true, status: true, tpsId: true, kawasanId: true, orgKawasanId: true, orgPengangkutId: true, orgPenerimaId: true, kendaraanId: true },
  });
  const tps = new Map((await tx.tps.findMany({ where: { id: { in: unik(serah.map((s) => s.tpsId)) } }, select: { id: true, kode: true } })).map((t) => [t.id, t.kode]));
  const kawasan = new Map(
    (await tx.kawasan.findMany({ where: { id: { in: unik(serah.map((s) => s.kawasanId)) } }, select: { id: true, nama: true, alamat: true } })).map((k) => [k.id, k]),
  );
  const orgIds = unik(serah.flatMap((s) => [s.orgPengangkutId, s.orgPenerimaId]));
  const org = new Map((await tx.organisasi.findMany({ where: { id: { in: orgIds } }, select: { id: true, nama: true, jenisPenerima: true } })).map((o) => [o.id, o]));
  const plat = new Map(
    (await tx.kendaraan.findMany({ where: { id: { in: unik(serah.map((s) => s.kendaraanId)) } }, select: { id: true, plat: true } })).map((k) => [k.id, k.plat]),
  );

  const tautan = await tx.serahWadah.findMany({ where: { serahId: { in: ids } }, select: { serahId: true, wadahCatatId: true } });
  const wadah = new Map(
    (await tx.wadahCatat.findMany({ where: { id: { in: tautan.map((t) => t.wadahCatatId) } }, select: { id: true, aliran: true, beratG: true } })).map((w) => [w.id, w]),
  );
  const rincian = await tx.penutupanRincian.findMany({ where: { serahId: { in: ids } }, select: { id: true, serahId: true, aliran: true, diterimaG: true, ditolakG: true, alasan: true } });
  const final = await nilaiFinal(tx, [...wadah.keys(), ...rincian.map((r) => r.id)]);

  // Sidik = event terakhir serah (penutupan, atau koreksi sesudahnya): angka final menunjuk catatan yang terakhir menyentuhnya.
  const terakhir = new Map<string, string>();
  const peristiwa = await tx.event.findMany({
    where: { serahId: { in: ids }, jenis: { in: [...EVENT_TUTUP, "KOREKSI_BERAT"] } },
    orderBy: { urutanRantai: "asc" },
    select: { serahId: true, hash: true },
  });
  for (const e of peristiwa) terakhir.set(e.serahId!, e.hash);

  return serah.map<SerahTertutup>((s) => {
    const pengangkut = s.orgPengangkutId ? org.get(s.orgPengangkutId) : undefined;
    const penerima = s.orgPenerimaId ? org.get(s.orgPenerimaId) : undefined;
    const k = kawasan.get(s.kawasanId);
    const wadahSerah = tautan.filter((t) => t.serahId === s.id).map((t) => wadah.get(t.wadahCatatId));
    return {
      kode: s.kode,
      status: s.status,
      ditutupPada: ditutupPada.get(s.id)!,
      sidikEvent: terakhir.get(s.id) ?? "",
      kawasanId: s.kawasanId,
      orgKawasanId: s.orgKawasanId,
      orgPengangkutId: s.orgPengangkutId,
      orgPenerimaId: s.orgPenerimaId,
      tpsKode: tps.get(s.tpsId) ?? "",
      kawasanNama: k?.nama ?? "",
      kawasanAlamat: k?.alamat ?? "",
      pengangkutNama: pengangkut?.nama ?? null,
      plat: s.kendaraanId ? (plat.get(s.kendaraanId) ?? null) : null,
      penerimaNama: penerima?.nama ?? null,
      penerimaJenis: penerima?.jenisPenerima ?? null,
      aliran: rincian
        .filter((r) => r.serahId === s.id)
        .map((r) => ({
          aliran: r.aliran,
          beratTpsG: wadahSerah.reduce((jumlah, w) => (w && w.aliran === r.aliran ? jumlah + (final.get(`WADAH:${w.id}`) ?? w.beratG ?? 0) : jumlah), 0),
          diterimaG: final.get(`RINCIAN_DITERIMA:${r.id}`) ?? r.diterimaG,
          ditolakG: final.get(`RINCIAN_DITOLAK:${r.id}`) ?? r.ditolakG,
          alasan: r.alasan,
        })),
    };
  });
}

// ── GET /api/laporan/[pihak] & ekspor CSV ──────────────────────────────────

export async function laporanKeluaran(tx: Tx, sesi: Sesi, pihak: PihakLaporan, periode: string, kawasanId?: string) {
  const filter = filterUntukSesi(sesi, pihak, kawasanId);
  if (kawasanId) await kawasanSesi(tx, sesi, kawasanId, sesi.peran === "PENGELOLA");
  const data = await muatSerahTertutup(tx, filter, periode);
  // Satu fungsi core untuk ketiga pihak; periode disaring ulang di core (dua lapis).
  const baris = susunBaris(data, filter, periode);
  return { pihak, periode, baris, total: totalPerAliran(baris) };
}

export async function eksporCsv(tx: Tx, sesi: Sesi, pihak: PihakLaporan, periode: string, kawasanId: string | undefined, sekarang: Date) {
  const lap = await laporanKeluaran(tx, sesi, pihak, periode, kawasanId);
  const csv = susunCsv(lap.baris, lap.total);
  // Setiap unduhan tercatat (tabel 🔒 ekspor): sidik isi, jumlah baris. createMany: tanpa RETURNING.
  await tx.ekspor.createMany({
    data: [{ organisasiId: sesi.organisasiAktifId!, pihak: PIHAK_EKSPOR[pihak], periode, format: "CSV", sidikIsi: csv.sidikIsi, jumlahBaris: csv.jumlahBaris, dibuatPada: sekarang }],
  });
  return { ...csv, namaBerkas: `laporan-${pihak}-${periode}.csv` };
}

// ── Neraca periode (ringkasan & indikator) ─────────────────────────────────

export async function dataNeraca(tx: Tx, kawasanId: string, dari: Date, sampai: Date): Promise<{ wadah: WadahNeraca[]; rincian: RincianNeraca[] }> {
  const w = await tx.wadahCatat.findMany({
    where: { kawasanId, terjadiPada: { gte: dari, lt: sampai } },
    select: { id: true, tpsId: true, kawasanId: true, aliran: true, beratG: true, jumlahWadah: true, terjadiPada: true },
  });
  const r = await tx.penutupanRincian.findMany({
    where: { serah: { kawasanId }, dibuatPada: { gte: dari, lt: sampai } },
    select: { id: true, serahId: true, aliran: true, diterimaG: true, ditolakG: true, dibuatPada: true, serah: { select: { tpsId: true, kawasanId: true } } },
  });
  const final = await nilaiFinal(tx, [...w.map((x) => x.id), ...r.map((x) => x.id)]);
  return {
    wadah: w.map((x) => ({ ...x, beratG: x.beratG === null ? null : (final.get(`WADAH:${x.id}`) ?? x.beratG) })),
    rincian: r.map((x) => ({
      serahId: x.serahId,
      tpsId: x.serah.tpsId,
      kawasanId: x.serah.kawasanId,
      aliran: x.aliran,
      diterimaG: final.get(`RINCIAN_DITERIMA:${x.id}`) ?? x.diterimaG,
      ditolakG: final.get(`RINCIAN_DITOLAK:${x.id}`) ?? x.ditolakG,
      ditutupPada: x.dibuatPada,
    })),
  };
}

/** Semua aliran (nol bila kosong) untuk kartu neraca. `beratTpsG` di sini = Σ wadah DICATAT di TPS pada rentang. */
function totalNeraca(data: { wadah: WadahNeraca[]; rincian: RincianNeraca[] }) {
  const j = jumlahkanPerAliran(hitungNeraca(data, { kelompok: "KAWASAN", periode: "SEMUA" }));
  return ALIRAN.map((aliran) => ({ aliran, beratTpsG: j[aliran].dicatatG, beratDiterimaG: j[aliran].diterimaG, beratDitolakG: j[aliran].ditolakG }));
}

// ── GET /api/kawasan/[id]/ringkasan ────────────────────────────────────────

export async function ringkasanKawasan(tx: Tx, sesi: Sesi, kawasanId: string, periode: string, sekarang: Date) {
  await kawasanSesi(tx, sesi, kawasanId, true);
  const awalHari = awalHariWib(tanggalWib(sekarang));
  const [hari, bulan] = [
    await dataNeraca(tx, kawasanId, awalHari, new Date(awalHari.getTime() + HARI_MS)),
    await dataNeraca(tx, kawasanId, awalPeriodeWib(periode), akhirPeriodeWib(periode)),
  ];
  const menungguSetuju = await tx.serah.count({ where: { kawasanId, status: "MENUNGGU_SETUJU" } });
  const menggantung = await tx.serah.count({ where: { kawasanId, status: "MENGGANTUNG" } });

  const daftarTps = await tx.tps.findMany({
    where: { kawasanId, aktif: true },
    select: { id: true, kode: true, nama: true, aktif: true, latE6: true, lonE6: true, kawasanId: true, organisasiId: true },
    orderBy: { kode: "asc" },
  });
  const cache = { prakiraan: new Map<string, PrakiraanTersimpan | null>() };
  const prioritas: { tpsId: string; tpsKode: string; teks: string; catatan: string }[] = [];
  const peringatan = new Map<string, ReturnType<typeof rujukan>>();
  for (const tps of daftarTps) {
    const p = (await prioritasTps(tx, tps, sekarang, cache)).prioritas;
    // R-10 selalu disertai catatan "bukan peringatan dini resmi" (CLAUDE.md §2.3).
    if (p) prioritas.push({ tpsId: tps.id, tpsKode: tps.kode, teks: p.teks, catatan: TEKS.R10_CATATAN });
    for (const h of await peringatanTps(tx, tps, sekarang)) peringatan.set(`${h.kode}|${h.teks}`, rujukan(h));
  }
  return { periode, hariIni: totalNeraca(hari), bulanIni: totalNeraca(bulan), menungguSetuju, menggantung, prioritas, peringatan: [...peringatan.values()] };
}

// ── GET /api/kawasan/[id]/ditolak ──────────────────────────────────────────

export async function ditolakKawasan(tx: Tx, sesi: Sesi, kawasanId: string, periode: string) {
  const lap = await laporanKeluaran(tx, sesi, "kawasan", periode, kawasanId);
  await kawasanSesi(tx, sesi, kawasanId, true);
  const harga = await tx.hargaMaterial.findMany({
    where: { aliran: "KUNING" },
    select: { sumberKode: true, hargaBersihIdrPerKg: true, hargaKotorIdrPerKg: true, tanggalSumber: true },
  });
  const acuan = pilihHargaAcuan(
    harga.map((h) => ({ sumberKode: h.sumberKode, bersihIdrPerKg: h.hargaBersihIdrPerKg, kotorIdrPerKg: h.hargaKotorIdrPerKg, tanggalSumber: h.tanggalSumber })),
  );
  return { periode, ...ringkasDitolak(lap.baris, acuan) };
}

// ── Indikator F43 (belum punya rute di §K.2; dipakai S12/S21) ──────────────

export async function indikatorKawasan(tx: Tx, sesi: Sesi, kawasanId: string, periode: string): Promise<Indikator> {
  await kawasanSesi(tx, sesi, kawasanId, true);
  const dari = awalPeriodeWib(periode);
  const sampai = akhirPeriodeWib(periode);
  const neraca = await dataNeraca(tx, kawasanId, dari, sampai);

  const dibuat = await tx.serah.findMany({ where: { kawasanId, dibuatPada: { gte: dari, lt: sampai } }, select: { status: true } });
  const setuju = await tx.event.findMany({
    where: { kawasanId, jenis: "SERAH_DISETUJUI", diterimaPada: { gte: dari, lt: sampai }, serahId: { not: null } },
    select: { serahId: true, diterimaPada: true },
  });
  const serahIds = unik(setuju.map((e) => e.serahId));
  const serah = await tx.serah.findMany({ where: { id: { in: serahIds } }, select: { id: true, tpsId: true } });
  const tautan = await tx.serahWadah.findMany({ where: { serahId: { in: serahIds } }, select: { serahId: true, wadahCatatId: true } });
  const wadah = await tx.wadahCatat.findMany({ where: { id: { in: tautan.map((t) => t.wadahCatatId) } }, select: { id: true, terjadiPada: true, beratG: true } });
  const final = await nilaiFinal(tx, wadah.map((w) => w.id));
  const wadahPer = new Map(wadah.map((w) => [w.id, { terjadiPada: w.terjadiPada, beratG: final.get(`WADAH:${w.id}`) ?? w.beratG ?? 0 }]));
  const disetujuiPada = new Map(setuju.map((e) => [e.serahId!, e.diterimaPada]));

  const wadahDiangkut = tautan.flatMap((t) => {
    const w = wadahPer.get(t.wadahCatatId);
    const s = disetujuiPada.get(t.serahId);
    return w && s ? [{ terjadiPada: w.terjadiPada, disetujuiPada: s }] : [];
  });
  const serahDisetujui: SerahDisetujui[] = serah.flatMap((s) => {
    const waktu = disetujuiPada.get(s.id);
    if (!waktu) return [];
    const berat = tautan.filter((t) => t.serahId === s.id).reduce((j, t) => j + (wadahPer.get(t.wadahCatatId)?.beratG ?? 0), 0);
    return [{ id: s.id, tpsId: s.tpsId, disetujuiPada: waktu, beratG: berat }];
  });

  const baris = await tx.prioritasTercatat.findMany({
    where: { kawasanId, sumber: "PRAKIRAAN", ditetapkanPada: { gte: dari, lt: sampai } },
    select: { tpsId: true, acuan: true, ditetapkanPada: true },
  });
  const prioritas: PrioritasPrakiraan[] = baris.flatMap((b) => {
    const slot = new Date(b.acuan); // acuan PRAKIRAAN = slot_utc ISO
    return Number.isNaN(slot.getTime()) ? [] : [{ tpsId: b.tpsId, slotUtc: slot, ditetapkanPada: b.ditetapkanPada }];
  });

  return hitungIndikator({ ...neraca, statusSerahDibuat: dibuat.map((s) => s.status), wadahDiangkut, prioritas, serahDisetujui });
}
