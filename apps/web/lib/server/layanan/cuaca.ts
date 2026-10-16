import { evaluasiCuaca, type HasilCuaca, type NowcastAturan, type PrakiraanAturan } from "@serah/core/aturan";
import { basi, type TitikE6 } from "@serah/core/cuaca";
import type { Prisma } from "@serah/db";
import type { ModeData } from "@serah/kontrak";
import { konfigurasiAturan } from "../aturan";
import type { Tx } from "../db";
import { GalatApi } from "../galat";
import type { NowcastMentah, PrakiraanMentah } from "../integrasi";
import { muatTps, wadahBelumDiserahkan, yurisdiksiKawasan, type TpsAkses } from "./wadah";

// Cuaca BMKG & prioritas angkut R-10 (S08-6, cron S08-7). Prioritas bukan peringatan dini resmi:
// setiap hasil membawa R10_CATATAN (dari evaluator). Data tidak tersedia → tanpa tebakan.

export type PrakiraanTersimpan = {
  adm4: string;
  mode: PrakiraanAturan["mode"];
  analysisDate: Date;
  slot: { slotUtc: Date; weatherDesc: string; weatherDescEn: string | null }[];
};

/** Analisis prakiraan terbaru untuk adm4 (tabel 🔒 global). null = belum ada data. */
export async function prakiraanTerbaru(tx: Tx, adm4: string): Promise<PrakiraanTersimpan | null> {
  const terbaru = await tx.prakiraanCuaca.findFirst({ where: { adm4 }, orderBy: [{ analysisDate: "desc" }, { diambilPada: "desc" }], select: { analysisDate: true } });
  if (!terbaru) return null;
  const baris = await tx.prakiraanCuaca.findMany({
    where: { adm4, analysisDate: terbaru.analysisDate },
    orderBy: { slotUtc: "asc" },
    select: { slotUtc: true, weatherDesc: true, weatherDescEn: true, mode: true },
  });
  const mode: ModeData = baris.some((b) => b.mode === "LIVE") ? "LIVE" : "SNAPSHOT";
  return { adm4, mode, analysisDate: terbaru.analysisDate, slot: baris.map((b) => ({ slotUtc: b.slotUtc, weatherDesc: b.weatherDesc, weatherDescEn: b.weatherDescEn })) };
}

/** Peringatan nowcast yang belum kedaluwarsa. */
export async function nowcastBerlaku(tx: Tx, sekarang: Date): Promise<NowcastAturan[]> {
  const baris = await tx.peringatanCuaca.findMany({ where: { expires: { gt: sekarang } }, select: { identifierCap: true, headline: true, effective: true, expires: true, poligonE6: true } });
  return baris.map((b) => ({
    identifier: b.identifierCap,
    headline: b.headline,
    effective: b.effective,
    expires: b.expires,
    poligonE6: Array.isArray(b.poligonE6) ? (b.poligonE6 as unknown as TitikE6[]) : [],
  }));
}

/** GET /api/cuaca/[adm4]. Tidak ada data → BMKG_TIDAK_TERSEDIA. */
export async function cuacaAdm4(tx: Tx, adm4: string, sekarang: Date) {
  const p = await prakiraanTerbaru(tx, adm4);
  if (!p) throw new GalatApi("BMKG_TIDAK_TERSEDIA");
  return {
    adm4,
    mode: p.mode,
    analysisDate: p.analysisDate.toISOString(),
    basi: basi(p.analysisDate, sekarang, (await konfigurasiAturan(tx, "DKI", sekarang)).R10_BASI_JAM),
    slot: p.slot.map((s) => ({ slotUtc: s.slotUtc.toISOString(), weatherDesc: s.weatherDesc, weatherDescEn: s.weatherDescEn })),
  };
}

/** Evaluasi R-10 untuk satu TPS (cache prakiraan/nowcast boleh dibagi antar-TPS). */
export async function prioritasTps(
  tx: Tx,
  tps: TpsAkses,
  sekarang: Date,
  cache: { prakiraan?: Map<string, PrakiraanTersimpan | null>; nowcast?: NowcastAturan[] } = {},
): Promise<HasilCuaca> {
  const kawasan = await tx.kawasan.findUnique({ where: { id: tps.kawasanId }, select: { adm4: true, namaKelurahan: true } });
  if (!kawasan) throw new GalatApi("TIDAK_DITEMUKAN");
  let p = cache.prakiraan?.get(kawasan.adm4);
  if (p === undefined) {
    p = await prakiraanTerbaru(tx, kawasan.adm4);
    cache.prakiraan?.set(kawasan.adm4, p);
  }
  const nowcast = cache.nowcast ?? (await nowcastBerlaku(tx, sekarang));
  const belum = await wadahBelumDiserahkan(tx, tps.id);
  const yurisdiksi = await yurisdiksiKawasan(tx, tps.kawasanId);
  return evaluasiCuaca(
    {
      yurisdiksi,
      sekarang,
      tps: { kode: tps.kode, latE6: tps.latE6, lonE6: tps.lonE6, namaKelurahan: kawasan.namaKelurahan ?? "" },
      wadahBelumDiserahkan: belum.map((w) => ({ aliran: w.aliran, terjadiPada: w.terjadiPada })),
      prakiraan: p,
      nowcast,
    },
    await konfigurasiAturan(tx, yurisdiksi, sekarang),
  );
}

/** GET /api/tps/[id]/prioritas. */
export async function prioritasTpsKeluaran(tx: Tx, tpsId: string, sekarang: Date) {
  const h = await prioritasTps(tx, await muatTps(tx, tpsId), sekarang);
  const p = h.prioritas;
  return { prioritas: p ? { sumber: p.sumberCuaca, acuan: p.acuan, aliran: p.aliran, umurJam: p.umurJam, teks: p.teks, catatan: p.catatan } : null };
}

/** Simpan prakiraan dari SumberCuaca (cron tiga-jam). Duplikat (adm4, analysis_date, slot) dilewati. */
export async function simpanPrakiraan(tx: Tx, p: PrakiraanMentah, sekarang: Date): Promise<number> {
  const r = await tx.prakiraanCuaca.createMany({
    data: p.slot.map((s) => ({ adm4: p.adm4, analysisDate: p.analysisDate, slotUtc: s.slotUtc, weatherDesc: s.weatherDesc, weatherDescEn: s.weatherDescEn, mode: p.mode, diambilPada: sekarang })),
    skipDuplicates: true,
  });
  return r.count;
}

/** Simpan peringatan nowcast (cron sepuluh-menit). Identifier CAP yang sudah ada dilewati. */
export async function simpanNowcast(tx: Tx, daftar: readonly NowcastMentah[], sekarang: Date): Promise<number> {
  if (daftar.length === 0) return 0;
  const r = await tx.peringatanCuaca.createMany({
    data: daftar.map((n) => ({ ...n, poligonE6: n.poligonE6 as Prisma.InputJsonValue, diambilPada: sekarang })),
    skipDuplicates: true,
  });
  return r.count;
}
