import { hitungTagihanAngkut, type SerahUntukTagihan } from "@serah/core/tagihan-angkut";
import { kodeTagihanAngkut } from "@serah/core/kode";
import { akhirPeriodeWib, awalPeriodeWib, periodeWib } from "@serah/core/waktu";
import type { Prisma } from "@serah/db";
import type { TagihanAngkut as SkemaTagihanAngkut } from "@serah/kontrak";
import type { z } from "zod";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import { boleh } from "../hak";
import { nomorBerikut } from "../penomoran";
import type { Sesi } from "../sesi";
import { muatSerahTertutup } from "./laporan";

// Tagihan angkut dari serah tertutup (S24-1/2, FITUR F41). Hitungan di packages/core/tagihan-angkut; di sini hanya
// memuat data di bawah RLS sesi, memeriksa hak paket (`tagihan_angkut`), dan menulis baris catat-saja.
//
// - PENGANGKUT: pratinjau, terbitkan, daftar milik sendiri. PENGELOLA: pratinjau & daftar atas kontrak kawasannya.
// - Serah ditagih menurut KONTRAK yang tercatat pada serah (serah.kontrak_id), dan periode = bulan WIB penutupan.
// - Satu tagihan per (kontrak, periode); periode yang belum berakhir (WIB) tidak dapat diterbitkan.

const STATUS_BELUM_TUTUP = ["MENUNGGU_SETUJU", "DIANGKUT", "MENGGANTUNG"] as const;

type TagihanAngkut = z.infer<typeof SkemaTagihanAngkut>;

type BarisKontrak = {
  id: string;
  kawasanId: string;
  orgKawasanId: string;
  orgPengangkutId: string;
  status: string;
  tarifPerRitIdr: number | null;
  tarifPerKgIdr: number | null;
};

type BarisTagihan = {
  id: string;
  kode: string;
  kontrakId: string;
  periode: string;
  ritTertutup: number;
  kgDiterimaG: number;
  totalIdr: number;
  rincian: unknown;
  diterbitkanPada: Date;
};

export function keDtoTagihanAngkut(t: BarisTagihan): TagihanAngkut {
  const j = t.rincian as { baris?: TagihanAngkut["rincian"] } | TagihanAngkut["rincian"] | null;
  const rincian = Array.isArray(j) ? j : (j?.baris ?? []);
  return {
    id: t.id,
    kode: t.kode as TagihanAngkut["kode"],
    kontrakId: t.kontrakId,
    periode: t.periode,
    ritTertutup: t.ritTertutup,
    kgDiterimaG: t.kgDiterimaG,
    totalIdr: t.totalIdr,
    rincian,
    diterbitkanPada: t.diterbitkanPada.toISOString(),
  };
}

function pihakSesi(sesi: Sesi): { peran: "PENGELOLA" | "PENGANGKUT"; orgId: string } {
  if (!sesi.organisasiAktifId || (sesi.peran !== "PENGELOLA" && sesi.peran !== "PENGANGKUT")) throw new GalatApi("PERAN_TIDAK_BOLEH");
  return { peran: sesi.peran, orgId: sesi.organisasiAktifId };
}

async function wajibHak(tx: Tx, orgId: string): Promise<void> {
  if (!(await boleh(tx, orgId, "tagihan_angkut"))) throw new GalatApi("HAK_PAKET_TIDAK_ADA");
}

async function muatKontrak(tx: Tx, sesi: Sesi, kontrakId: string): Promise<BarisKontrak> {
  const { peran, orgId } = pihakSesi(sesi);
  const k = await tx.kontrak.findUnique({
    where: { id: kontrakId },
    select: { id: true, kawasanId: true, orgKawasanId: true, orgPengangkutId: true, status: true, tarifPerRitIdr: true, tarifPerKgIdr: true },
  });
  const milik = peran === "PENGANGKUT" ? k?.orgPengangkutId === orgId : k?.orgKawasanId === orgId;
  if (!k || !milik) throw new GalatApi("TIDAK_DITEMUKAN");
  return k;
}

/** Hitung tagihan satu kontrak untuk periode (dasar pratinjau & penerbitan). */
async function hitungKontrakPeriode(tx: Tx, sesi: Sesi, k: BarisKontrak, periode: string) {
  const { peran, orgId } = pihakSesi(sesi);
  const tertutup = await muatSerahTertutup(tx, { jenis: peran === "PENGANGKUT" ? "pengangkut" : "kawasan", organisasiId: orgId, kawasanId: k.kawasanId }, periode);
  const kontrakPerSerah = new Map(
    (await tx.serah.findMany({ where: { kode: { in: tertutup.map((s) => s.kode) } }, select: { kode: true, kontrakId: true } })).map((s) => [s.kode, s.kontrakId]),
  );
  const serah: SerahUntukTagihan[] = tertutup
    .filter((s) => kontrakPerSerah.get(s.kode) === k.id)
    .map((s) => ({ kode: s.kode, status: s.status, diterimaG: s.aliran.reduce((j, a) => j + a.diterimaG, 0) }));

  // Serah kontrak ini yang belum ditutup (dibuat pada periode) — dilaporkan sebagai tidak termasuk.
  const belum = await tx.serah.findMany({
    where: { kontrakId: k.id, status: { in: [...STATUS_BELUM_TUTUP] }, dibuatPada: { gte: awalPeriodeWib(periode), lt: akhirPeriodeWib(periode) } },
    select: { kode: true, status: true },
  });
  const sudah = new Set(serah.map((s) => s.kode));
  for (const b of belum) if (!sudah.has(b.kode)) serah.push({ kode: b.kode, status: b.status, diterimaG: 0 });

  return hitungTagihanAngkut(serah, { tarifPerRitIdr: k.tarifPerRitIdr, tarifPerKgIdr: k.tarifPerKgIdr });
}

export async function pratinjauTagihanAngkut(tx: Tx, sesi: Sesi, kontrakId: string, periode: string) {
  const { orgId } = pihakSesi(sesi);
  await wajibHak(tx, orgId);
  const k = await muatKontrak(tx, sesi, kontrakId);
  const h = await hitungKontrakPeriode(tx, sesi, k, periode);
  return {
    kontrakId: k.id,
    periode,
    ritTertutup: h.ritTertutup,
    kgDiterimaG: h.kgDiterimaG,
    totalIdr: h.totalIdr,
    rincian: h.rincian.map((r) => ({ kodeSerah: r.kodeSerah, kgDiterimaG: r.kgDiterimaG, subtotalIdr: r.subtotalIdr })),
    tidakTermasuk: h.tidakTermasuk.length,
  };
}

/** GET /api/tagihan-angkut — daftar milik organisasi aktif (+ pratinjau bila kontrakId & periode diberikan). */
export async function daftarTagihanAngkut(tx: Tx, sesi: Sesi, kueri: { kontrakId?: string | undefined; periode?: string | undefined }) {
  const { peran, orgId } = pihakSesi(sesi);
  await wajibHak(tx, orgId);
  if ((kueri.kontrakId === undefined) !== (kueri.periode === undefined)) {
    throw new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: [kueri.kontrakId === undefined ? "kontrakId" : "periode"], kode: "wajib_bersama" }] });
  }
  const baris = await tx.tagihanAngkut.findMany({
    where: { ...(peran === "PENGANGKUT" ? { orgPengangkutId: orgId } : { orgKawasanId: orgId }), ...(kueri.kontrakId ? { kontrakId: kueri.kontrakId } : {}) },
    orderBy: [{ periode: "desc" }, { kode: "desc" }],
    take: 200,
  });
  const pratinjau = kueri.kontrakId && kueri.periode ? await pratinjauTagihanAngkut(tx, sesi, kueri.kontrakId, kueri.periode) : null;
  return { pratinjau, tagihan: baris.map(keDtoTagihanAngkut) };
}

/** POST /api/tagihan-angkut/terbitkan — PENGANGKUT; satu tagihan per kontrak per periode yang sudah berakhir. */
export async function terbitkanTagihanAngkut(tx: Tx, sesi: Sesi, m: { kontrakId: string; periode: string }, sekarang: Date): Promise<TagihanAngkut> {
  const { peran, orgId } = pihakSesi(sesi);
  if (peran !== "PENGANGKUT") throw new GalatApi("PERAN_TIDAK_BOLEH");
  await wajibHak(tx, orgId);
  const k = await muatKontrak(tx, sesi, m.kontrakId);
  const salah = (jalur: string, kode: string) => new GalatApi("VALIDASI_GAGAL", { rincian: [{ jalur: [jalur], kode }] });
  if (k.status !== "AKTIF" && k.status !== "BERAKHIR") throw new GalatApi("TRANSISI_TIDAK_SAH");
  if (m.periode >= periodeWib(sekarang)) throw salah("periode", "periode_belum_berakhir");
  if (!k.tarifPerRitIdr && !k.tarifPerKgIdr) throw salah("kontrakId", "tarif_kontrak_kosong");

  // Satu penerbitan per (kontrak, periode): kunci penasihat transaksional menutup balapan dua permintaan.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`tagihan-angkut:${k.id}:${m.periode}`}, 0))`;
  if (await tx.tagihanAngkut.findFirst({ where: { kontrakId: k.id, periode: m.periode }, select: { id: true } })) throw new GalatApi("TRANSISI_TIDAK_SAH");

  const h = await hitungKontrakPeriode(tx, sesi, k, m.periode);
  if (h.ritTertutup === 0) throw salah("periode", "tidak_ada_serah_tertutup");

  const kode = kodeTagihanAngkut(m.periode, await nomorBerikut(tx, "TGA", m.periode));
  if (!kode.ok) throw new GalatApi("GALAT_SERVER");
  const baru = await tx.tagihanAngkut.create({
    data: {
      kode: kode.kode,
      kontrakId: k.id,
      orgKawasanId: k.orgKawasanId,
      orgPengangkutId: k.orgPengangkutId,
      periode: m.periode,
      ritTertutup: h.ritTertutup,
      kgDiterimaG: h.kgDiterimaG,
      totalIdr: h.totalIdr,
      // Tarif yang dipakai ikut disimpan: tagihan tetap dapat diperiksa walau tarif kontrak berubah kemudian.
      rincian: { tarifPerRitIdr: k.tarifPerRitIdr, tarifPerKgIdr: k.tarifPerKgIdr, baris: h.rincian.map((r) => ({ ...r })), tidakTermasuk: h.tidakTermasuk.map((t) => ({ ...t })) } as Prisma.InputJsonValue,
      diterbitkanPada: sekarang,
    },
  });
  return keDtoTagihanAngkut(baru);
}
