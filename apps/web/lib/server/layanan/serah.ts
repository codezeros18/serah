import { evaluasiAmbil, evaluasiTutup, type HasilAturan, type KontrakAturan } from "@serah/core/aturan";
import { kodeSerah } from "@serah/core/kode";
import { jenisTutup, type Pelaku, type PerubahanBerat, type RincianTutup, type TiketTutup } from "@serah/core/status";
import { awalPeriodeWib, akhirPeriodeWib, selisihJam, tanggalWib, tanggalWibKompak } from "@serah/core/waktu";
import { ALIRAN, TEKS, type AlasanTolak, type Aliran, type KeyakinanAi, type StatusSerah, type SumberTiket } from "@serah/kontrak";
import { konfigurasiAturan } from "../aturan";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { nomorBerikut } from "../penomoran";
import type { Sesi } from "../sesi";
import { prioritasTps, type PrakiraanTersimpan } from "./cuaca";
import { evaluasiR04, fotoSerah } from "./foto";
import { buatNotifikasi } from "../notifikasi";
import { layananTransisi, type SerahDb } from "./transisi";
import { muatTps, rujukan, wajibPeranLayanan, yurisdiksiKawasan } from "./wadah";

// Layanan serah (S08-2..S08-6). Setiap perubahan status lewat layananTransisi; di sini hanya membangun konteks
// dari DB (di bawah RLS sesi), memanggil evaluator core, dan menyusun keluaran sesuai kontrak.

const urutAliran = (a: Aliran, b: Aliran) => ALIRAN.indexOf(a) - ALIRAN.indexOf(b);

function pelaku(sesi: Sesi): Pelaku {
  if (!sesi.peran || !sesi.organisasiAktifId) throw new GalatApi("PERAN_TIDAK_BOLEH");
  return { peran: sesi.peran, orgIds: [sesi.organisasiAktifId] };
}

/** Serah yang terlihat sesi beserta aliran wadahnya. Tidak terlihat → 404 (bukan 403). */
export async function muatSerah(tx: Tx, kode: string): Promise<SerahDb & { dibuatPada: Date; diperbaruiPada: Date; wadahIds: string[] }> {
  const s = await tx.serah.findUnique({
    where: { kode },
    select: {
      id: true,
      kode: true,
      status: true,
      versi: true,
      tpsId: true,
      kawasanId: true,
      orgKawasanId: true,
      orgPengangkutId: true,
      orgPenerimaId: true,
      kendaraanId: true,
      kontrakId: true,
      dibuatPada: true,
      diperbaruiPada: true,
      wadah: { select: { wadah: { select: { id: true, aliran: true } } } },
    },
  });
  if (!s) throw new GalatApi("TIDAK_DITEMUKAN");
  const aliran = [...new Set(s.wadah.map((w) => w.wadah.aliran))].sort(urutAliran);
  const { wadah, ...sisa } = s;
  return { ...sisa, aliran, wadahIds: wadah.map((w) => w.wadah.id) };
}

const statusKeluaran = (h: { kode: string; status: StatusSerah; versi: number }) => ({ kode: h.kode, status: h.status, versi: h.versi });

// ── BUAT (petugas/pengelola) ───────────────────────────────────────────────

export async function buatSerah(tx: Tx, sesi: Sesi, m: { tpsId: string; wadahIds: string[] }, kunci: string, sekarang: Date, terjadiPada?: Date) {
  wajibPeranLayanan(sesi, ["PETUGAS", "PENGELOLA"]);
  const tps = await muatTps(tx, m.tpsId);
  const wadah = await tx.wadahCatat.findMany({
    where: { id: { in: m.wadahIds } },
    select: { id: true, tpsId: true, aliran: true, serahWadah: { select: { serahId: true } } },
  });
  const nomor = await nomorBerikut(tx, "SRH", tanggalWibKompak(sekarang));
  const kode = kodeSerah(sekarang, nomor);
  if (!kode.ok) throw new GalatApi("GALAT_SERVER");
  const h = await layananTransisi(tx, {
    serah: null,
    aksi: { jenis: "BUAT", kode: kode.kode, tpsId: tps.id, orgKawasanId: tps.organisasiId, wadahIds: m.wadahIds },
    konteks: {
      pelaku: pelaku(sesi),
      ...(terjadiPada ? { terjadiPada } : {}),
      wadah: wadah.map((w) => ({ id: w.id, tpsId: w.tpsId, aliran: w.aliran, diSerahLain: w.serahWadah !== null })),
    },
    sekarang,
    idempotencyKey: kunci,
    baru: { kawasanId: tps.kawasanId },
    tulisTambahan: async (t, serahId) => {
      await t.serahWadah.createMany({ data: m.wadahIds.map((wadahCatatId) => ({ serahId, wadahCatatId })) });
    },
  });
  // Isi QR serah = kode serah (layar A2/P1 membuka /…/serah/[kode]); akses tetap dijaga RLS & peran.
  return { kode: h.kode, qrToken: h.kode };
}

// ── AMBIL (pengangkut) ─────────────────────────────────────────────────────

const tanggal = (d: Date) => d.toISOString().slice(0, 10);

export async function ambilSerah(tx: Tx, sesi: Sesi, kode: string, m: { fotoId: string; kendaraanId: string; penerimaId: string }, kunci: string, sekarang: Date, terjadiPada?: Date) {
  wajibPeranLayanan(sesi, ["PENGANGKUT"]);
  const p = pelaku(sesi);
  const orgPengangkut = p.orgIds[0]!;
  const serah = await muatSerah(tx, kode);

  const foto = await tx.foto.findUnique({ where: { id: m.fotoId }, select: { id: true, jenis: true, organisasiId: true, serahId: true, dhash: true } });
  const fotoTerkait = foto && foto.serahId === serah.id ? foto : null;
  const r04 = fotoTerkait
    ? await evaluasiR04(tx, { kawasanId: serah.kawasanId, orgPengangkutId: orgPengangkut, dhash: fotoTerkait.dhash, kecualiFotoId: fotoTerkait.id, sekarang })
    : [];
  const kendaraan = await tx.kendaraan.findUnique({ where: { id: m.kendaraanId }, select: { id: true, organisasiId: true, aktif: true } });

  const penerima = await tx.organisasi.findUnique({
    where: { id: m.penerimaId },
    select: { id: true, jenis: true, jenisPenerima: true, aliranDiterima: true, statusIzin: true },
  });
  if (!penerima || penerima.jenis !== "PENERIMA" || !penerima.jenisPenerima) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["penerimaId"], kode: "bukan_penerima" }] });

  const kontrakDb = await tx.kontrak.findMany({
    where: { kawasanId: serah.kawasanId, orgPengangkutId: orgPengangkut },
    select: { id: true, status: true, kawasanId: true, orgPengangkutId: true, orgPenerimaId: true, aliran: true, berlakuDari: true, berlakuSampai: true },
  });
  const kontrak: (KontrakAturan & { id: string })[] = kontrakDb.map((k) => ({
    id: k.id,
    status: k.status,
    kawasanId: k.kawasanId,
    pengangkutId: k.orgPengangkutId,
    penerimaId: k.orgPenerimaId,
    aliran: k.aliran,
    berlakuDari: tanggal(k.berlakuDari),
    berlakuSampai: tanggal(k.berlakuSampai),
  }));

  const hasilAturan: HasilAturan[] = [
    ...r04,
    ...evaluasiAmbil({
      yurisdiksi: await yurisdiksiKawasan(tx, serah.kawasanId),
      sekarang,
      aliranSerah: serah.aliran,
      kawasanId: serah.kawasanId,
      pengangkutId: orgPengangkut,
      penerima: { id: penerima.id, jenis: penerima.jenisPenerima, aliranDiterima: penerima.aliranDiterima, statusIzin: penerima.statusIzin },
      kontrak,
    }),
  ];
  const hariIni = tanggalWib(sekarang);
  const berlaku = kontrak.find(
    (k) => k.status === "AKTIF" && k.penerimaId === penerima.id && k.berlakuDari <= hariIni && hariIni <= k.berlakuSampai && serah.aliran.every((a) => k.aliran.includes(a)),
  );

  const h = await layananTransisi(tx, {
    serah,
    aksi: { jenis: "AMBIL", fotoId: m.fotoId, kendaraanId: m.kendaraanId, penerimaId: m.penerimaId },
    konteks: {
      pelaku: p,
      ...(terjadiPada ? { terjadiPada } : {}),
      foto: fotoTerkait ? { id: fotoTerkait.id, jenis: fotoTerkait.jenis, organisasiId: fotoTerkait.organisasiId, r04Lolos: !r04.some((x) => x.aksi === "TOLAK") } : null,
      kendaraan,
      aturan: hasilAturan.map((a) => ({ kode: a.kode, aksi: a.aksi })),
    },
    hasilAturan,
    sekarang,
    idempotencyKey: kunci,
    kontrakId: berlaku?.id ?? null,
  });
  await buatNotifikasi(tx, [{ organisasiId: h.orgKawasanId, jenis: "SERAH_MENUNGGU_SETUJU", objekKode: h.kode, data: { kode: h.kode } }], sekarang);
  return statusKeluaran(h);
}

// ── SETUJUI / KEMBALIKAN (pengelola) ───────────────────────────────────────

export async function setujuiSerah(tx: Tx, sesi: Sesi, kode: string, kunci: string, sekarang: Date) {
  wajibPeranLayanan(sesi, ["PENGELOLA"]);
  const serah = await muatSerah(tx, kode);
  const h = await layananTransisi(tx, { serah, aksi: { jenis: "SETUJUI" }, konteks: { pelaku: pelaku(sesi) }, sekarang, idempotencyKey: kunci });
  // Nama penerima = badan usaha (bukan orang); organisasi PENERIMA terbaca oleh sesi mana pun.
  const penerima = h.orgPenerimaId ? await tx.organisasi.findUnique({ where: { id: h.orgPenerimaId }, select: { nama: true } }) : null;
  const dataDiangkut = { kode: h.kode, penerima: penerima?.nama ?? "" };
  await buatNotifikasi(
    tx,
    [
      { organisasiId: h.orgPenerimaId, jenis: "SERAH_DIANGKUT", objekKode: h.kode, data: dataDiangkut },
      { organisasiId: h.orgPengangkutId, jenis: "SERAH_DIANGKUT", objekKode: h.kode, data: dataDiangkut },
    ],
    sekarang,
  );
  return statusKeluaran(h);
}

export async function kembalikanSerah(tx: Tx, sesi: Sesi, kode: string, alasan: string | undefined, kunci: string, sekarang: Date) {
  wajibPeranLayanan(sesi, ["PENGELOLA"]);
  const serah = await muatSerah(tx, kode);
  const h = await layananTransisi(tx, { serah, aksi: { jenis: "KEMBALIKAN", alasan: alasan ?? "" }, konteks: { pelaku: pelaku(sesi) }, sekarang, idempotencyKey: kunci });
  return statusKeluaran(h);
}

// ── TUTUP (penerima) ───────────────────────────────────────────────────────

export type MasukanTutup = {
  tiket: { fotoId?: string | undefined; nomor?: string | undefined; beratG: number; sumber: SumberTiket; aiKeyakinan?: KeyakinanAi | undefined; aiModel?: string | undefined };
  rincian: { aliran: Aliran; diterimaG: number; ditolakG: number; alasan?: AlasanTolak | undefined; keterangan?: string | undefined }[];
};

type BarisFinal = { target_jenis: string; target_id: string; nilai_final_g: number | null };

export async function nilaiFinal(tx: Tx, ids: readonly string[]): Promise<Map<string, number | null>> {
  if (ids.length === 0) return new Map();
  const baris = await tx.$queryRaw<BarisFinal[]>`SELECT target_jenis::text, target_id, nilai_final_g FROM v_nilai_final WHERE target_id = ANY(${[...ids]})`;
  return new Map(baris.map((b) => [`${b.target_jenis}:${b.target_id}`, b.nilai_final_g]));
}

export async function tutupSerah(tx: Tx, sesi: Sesi, kode: string, m: MasukanTutup, kunci: string, sekarang: Date, terjadiPada?: Date) {
  wajibPeranLayanan(sesi, ["PENERIMA"]);
  const serah = await muatSerah(tx, kode);
  const t = m.tiket;
  // Asal tiket harus jujur: MANUAL tanpa jejak AI; AI_* wajib menyebut model (AI hanya saran, CLAUDE.md §2.4).
  const adaAi = t.aiModel !== undefined || t.aiKeyakinan !== undefined;
  if ((t.sumber === "MANUAL" && adaAi) || (t.sumber !== "MANUAL" && !t.aiModel)) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["tiket", "sumber"], kode: "asal_tiket" }] });
  if (t.fotoId) {
    const f = await tx.foto.findUnique({ where: { id: t.fotoId }, select: { jenis: true, serahId: true } });
    if (!f || f.jenis !== "TIKET" || f.serahId !== serah.id) throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: ["tiket", "fotoId"], kode: "foto_tiket" }] });
  }
  const rincian: RincianTutup[] = m.rincian.map((r) => ({ aliran: r.aliran, diterimaG: r.diterimaG, ditolakG: r.ditolakG, alasan: r.alasan ?? null }));
  const tiket: TiketTutup = { beratG: t.beratG, nomor: t.nomor ?? null, sumber: t.sumber, fotoId: t.fotoId ?? null };

  // R-08: peringatan saja, tidak menolak (berat wadah final, hanya bila semua wadah berberat).
  const finalWadah = await nilaiFinal(tx, serah.wadahIds);
  const yurisdiksiTutup = await yurisdiksiKawasan(tx, serah.kawasanId);
  const peringatan = evaluasiTutup(
    {
      yurisdiksi: yurisdiksiTutup,
      beratTiketG: t.beratG,
      beratWadahG: serah.wadahIds.map((id) => finalWadah.get(`WADAH:${id}`) ?? null),
    },
    await konfigurasiAturan(tx, yurisdiksiTutup, sekarang),
  );

  const h = await layananTransisi(tx, {
    serah,
    aksi: { jenis: jenisTutup(rincian), tiket, rincian },
    konteks: { pelaku: pelaku(sesi), ...(terjadiPada ? { terjadiPada } : {}) },
    sekarang,
    idempotencyKey: kunci,
    beratTiketG: t.beratG,
    tulisTambahan: async (tw, serahId) => {
      await tw.tiketTimbang.create({
        data: {
          serahId,
          fotoId: t.fotoId ?? null,
          nomor: t.nomor ?? null,
          beratG: t.beratG,
          sumber: t.sumber,
          aiModel: t.aiModel ?? null,
          aiKeyakinan: t.aiKeyakinan ?? null,
          dibuatPada: sekarang,
        },
      });
      await tw.penutupanRincian.createMany({
        data: m.rincian.map((r) => ({
          serahId,
          aliran: r.aliran,
          diterimaG: r.diterimaG,
          ditolakG: r.ditolakG,
          alasan: r.alasan ?? null,
          keterangan: r.keterangan ?? null,
          dibuatPada: sekarang,
        })),
      });
    },
  });
  const dataTutup = { kode: h.kode, status: TEKS[`STATUS_${h.status}`] };
  await buatNotifikasi(
    tx,
    [
      { organisasiId: h.orgKawasanId, jenis: "SERAH_DITUTUP", objekKode: h.kode, data: dataTutup },
      { organisasiId: h.orgPengangkutId, jenis: "SERAH_DITUTUP", objekKode: h.kode, data: dataTutup },
    ],
    sekarang,
  );
  return { ...statusKeluaran(h), peringatan: peringatan.map(rujukan) };
}

// ── KOREKSI_BERAT (penerima) ───────────────────────────────────────────────

const JENIS_DB = { TIKET: "TIKET", RINCIAN_DITERIMA: "RINCIAN_DITERIMA", RINCIAN_DITOLAK: "RINCIAN_DITOLAK" } as const;

export async function koreksiSerah(tx: Tx, sesi: Sesi, kode: string, m: { alasan: string; perubahan: PerubahanBerat[] }, kunci: string, sekarang: Date) {
  const peran = wajibPeranLayanan(sesi, ["PENERIMA"]);
  const serah = await muatSerah(tx, kode);
  const tiket = await tx.tiketTimbang.findFirst({ where: { serahId: serah.id }, orderBy: { dibuatPada: "desc" }, select: { id: true, beratG: true } });
  const rincian = await tx.penutupanRincian.findMany({ where: { serahId: serah.id }, select: { id: true, aliran: true, diterimaG: true, ditolakG: true, alasan: true } });
  const final = await nilaiFinal(tx, [...(tiket ? [tiket.id] : []), ...rincian.map((r) => r.id)]);
  const f = (jenis: string, id: string, asli: number) => final.get(`${jenis}:${id}`) ?? asli;
  const nilaiTertutup = tiket
    ? {
        tiket: { id: tiket.id, beratG: f("TIKET", tiket.id, tiket.beratG) },
        rincian: rincian.map((r) => ({
          id: r.id,
          aliran: r.aliran,
          diterimaG: f("RINCIAN_DITERIMA", r.id, r.diterimaG),
          ditolakG: f("RINCIAN_DITOLAK", r.id, r.ditolakG),
          alasan: r.alasan,
        })),
      }
    : null;

  const tercatat: { koreksiId: string; target: PerubahanBerat["target"]; targetId: string; nilaiAsliG: number; nilaiFinalG: number }[] = [];
  const h = await layananTransisi(tx, {
    serah,
    aksi: { jenis: "KOREKSI_BERAT", alasan: m.alasan, perubahan: m.perubahan },
    konteks: { pelaku: pelaku(sesi), nilaiTertutup },
    sekarang,
    idempotencyKey: kunci,
    ...(nilaiTertutup ? { beratTiketG: nilaiTertutup.tiket.beratG } : {}),
    tulisTambahan: async (tw, serahId) => {
      // Nilai asli = nilai final sebelum koreksi ini; baris lama tidak pernah berubah (🔒), view memilih yang terakhir.
      const kini = new Map<string, number>();
      for (const p of m.perubahan) {
        const kunciNilai = `${JENIS_DB[p.target]}:${p.targetId}`;
        const asli =
          kini.get(kunciNilai) ??
          (p.target === "TIKET"
            ? nilaiTertutup!.tiket.beratG
            : (nilaiTertutup!.rincian.find((r) => r.id === p.targetId)?.[p.target === "RINCIAN_DITERIMA" ? "diterimaG" : "ditolakG"] ?? 0));
        kini.set(kunciNilai, p.nilaiFinalG);
        const k = await tw.koreksi.create({
          data: {
            targetJenis: JENIS_DB[p.target],
            targetId: p.targetId,
            serahId,
            kawasanId: serah.kawasanId,
            orgKawasanId: serah.orgKawasanId,
            nilaiAsliG: asli,
            nilaiFinalG: p.nilaiFinalG,
            alasan: m.alasan.trim(),
            peran,
            dibuatPada: sekarang,
          },
          select: { id: true },
        });
        tercatat.push({ koreksiId: k.id, target: p.target, targetId: p.targetId, nilaiAsliG: asli, nilaiFinalG: p.nilaiFinalG });
      }
    },
  });
  const pertama = tercatat[0]!;
  return { koreksiId: pertama.koreksiId, nilaiAsliG: pertama.nilaiAsliG, nilaiFinalG: pertama.nilaiFinalG, ...statusKeluaran(h), koreksi: tercatat };
}

// ── Baca: detail, daftar, daftar ambil ─────────────────────────────────────

type BarisTimeline = { t_urutan_rantai: number; t_jenis: string; t_peran: string; t_terjadi_pada: Date; t_diterima_pada: Date; t_hash: string };

export async function detailSerah(tx: Tx, kode: string, sekarang: Date) {
  const s = await muatSerah(tx, kode);
  // Berurutan: satu transaksi = satu koneksi.
  const tps = await tx.tps.findUnique({ where: { id: s.tpsId }, select: { id: true, kode: true, nama: true } });
  const kawasan = await tx.kawasan.findUnique({ where: { id: s.kawasanId }, select: { id: true, nama: true } });
  const pengangkut = s.orgPengangkutId ? await tx.organisasi.findUnique({ where: { id: s.orgPengangkutId }, select: { id: true, nama: true } }) : null;
  const penerima = s.orgPenerimaId ? await tx.organisasi.findUnique({ where: { id: s.orgPenerimaId }, select: { id: true, nama: true } }) : null;
  const kendaraan = s.kendaraanId ? await tx.kendaraan.findUnique({ where: { id: s.kendaraanId }, select: { id: true, plat: true } }) : null;
  if (!tps || !kawasan) throw new GalatApi("TIDAK_DITEMUKAN");
  const wadah = await tx.wadahCatat.findMany({
    where: { id: { in: s.wadahIds } },
    select: { id: true, aliran: true, beratG: true, jumlahWadah: true, terjadiPada: true },
    orderBy: { terjadiPada: "asc" },
  });
  const tiket = await tx.tiketTimbang.findFirst({ where: { serahId: s.id }, orderBy: { dibuatPada: "desc" } });
  const rincian = await tx.penutupanRincian.findMany({ where: { serahId: s.id } });
  const final = await nilaiFinal(tx, [...s.wadahIds, ...(tiket ? [tiket.id] : []), ...rincian.map((r) => r.id)]);
  const timeline = await tx.$queryRaw<BarisTimeline[]>`SELECT * FROM timeline_serah(${s.id})`;

  return {
    kode: s.kode,
    status: s.status,
    versi: s.versi,
    tps,
    kawasan,
    aliran: s.aliran,
    dibuatPada: s.dibuatPada.toISOString(),
    diperbaruiPada: s.diperbaruiPada.toISOString(),
    pengangkut,
    penerima,
    kendaraan,
    wadah: wadah.map((w) => ({
      id: w.id,
      aliran: w.aliran,
      beratG: w.beratG === null ? null : (final.get(`WADAH:${w.id}`) ?? w.beratG),
      jumlahWadah: w.jumlahWadah,
      terjadiPada: w.terjadiPada.toISOString(),
    })),
    timeline: timeline.map((e) => ({
      urutanRantai: e.t_urutan_rantai,
      jenis: e.t_jenis,
      peran: e.t_peran,
      terjadiPada: e.t_terjadi_pada.toISOString(),
      diterimaPada: e.t_diterima_pada.toISOString(),
      hash: e.t_hash,
    })),
    foto: await fotoSerah(tx, s.id, sekarang),
    tiket: tiket
      ? {
          id: tiket.id,
          fotoId: tiket.fotoId,
          nomor: tiket.nomor,
          beratG: tiket.beratG,
          sumber: tiket.sumber,
          aiModel: tiket.aiModel,
          aiKeyakinan: tiket.aiKeyakinan,
          beratFinalG: final.get(`TIKET:${tiket.id}`) ?? tiket.beratG,
        }
      : null,
    rincian: rincian
      .sort((a, b) => urutAliran(a.aliran, b.aliran))
      .map((r) => ({
        id: r.id,
        aliran: r.aliran,
        diterimaG: r.diterimaG,
        ditolakG: r.ditolakG,
        alasan: r.alasan,
        keterangan: r.keterangan,
        diterimaFinalG: final.get(`RINCIAN_DITERIMA:${r.id}`) ?? r.diterimaG,
        ditolakFinalG: final.get(`RINCIAN_DITOLAK:${r.id}`) ?? r.ditolakG,
      })),
  };
}

const BATAS_DAFTAR = 500;

export async function daftarSerah(tx: Tx, kueri: { status?: StatusSerah | undefined; periode?: string | undefined }) {
  const baris = await tx.serah.findMany({
    where: {
      ...(kueri.status ? { status: kueri.status } : {}),
      ...(kueri.periode ? { dibuatPada: { gte: awalPeriodeWib(kueri.periode), lt: akhirPeriodeWib(kueri.periode) } } : {}),
    },
    select: {
      id: true,
      kode: true,
      status: true,
      versi: true,
      dibuatPada: true,
      diperbaruiPada: true,
      tps: { select: { id: true, kode: true, nama: true } },
      kawasan: { select: { id: true, nama: true } },
      wadah: { select: { wadah: { select: { aliran: true } } } },
    },
    orderBy: { dibuatPada: "desc" },
    take: BATAS_DAFTAR,
  });
  return {
    serah: baris.map((s) => ({
      kode: s.kode,
      status: s.status,
      versi: s.versi,
      tps: s.tps,
      kawasan: s.kawasan,
      aliran: [...new Set(s.wadah.map((w) => w.wadah.aliran))].sort(urutAliran),
      dibuatPada: s.dibuatPada.toISOString(),
      diperbaruiPada: s.diperbaruiPada.toISOString(),
    })),
  };
}

/** GET /api/ambil: serah DRAF di kawasan berkontrak pengangkut, prioritas R-10 lebih dulu, lalu umur tertua. */
export async function daftarAmbil(tx: Tx, sekarang: Date) {
  const baris = await tx.serah.findMany({
    where: { status: "DRAF" },
    select: {
      kode: true,
      tpsId: true,
      kawasan: { select: { id: true, nama: true } },
      wadah: { select: { wadah: { select: { aliran: true, terjadiPada: true } } } },
    },
    take: BATAS_DAFTAR,
  });
  const cache = { prakiraan: new Map<string, PrakiraanTersimpan | null>() };
  const prioritasPerTps = new Map<string, Awaited<ReturnType<typeof prioritasTps>>>();
  const keluar = [];
  for (const s of baris) {
    const tps = await muatTps(tx, s.tpsId);
    let p = prioritasPerTps.get(tps.id);
    if (!p) {
      p = await prioritasTps(tx, tps, sekarang, cache);
      prioritasPerTps.set(tps.id, p);
    }
    const tertua = s.wadah.reduce<Date | null>((min, w) => (!min || w.wadah.terjadiPada < min ? w.wadah.terjadiPada : min), null);
    keluar.push({
      kode: s.kode,
      tps: { id: tps.id, kode: tps.kode, nama: tps.nama },
      kawasan: s.kawasan,
      aliran: [...new Set(s.wadah.map((w) => w.wadah.aliran))].sort(urutAliran),
      umurJamTertua: tertua ? Math.max(0, selisihJam(tertua, sekarang)) : 0,
      ...(p.prioritas ? { prioritas: { sumber: p.prioritas.sumberCuaca, teks: p.prioritas.teks } } : {}),
    });
  }
  keluar.sort((a, b) => Number("prioritas" in b) - Number("prioritas" in a) || b.umurJamTertua - a.umurJamTertua);
  return { serah: keluar };
}
