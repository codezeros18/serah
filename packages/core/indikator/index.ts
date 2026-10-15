import { ALIRAN, type Aliran, type StatusSerah } from "@serah/kontrak";
import { persenBp } from "../angka";
import { STATUS_TERTUTUP } from "../laporan/jenis";
import { hitungNeraca, jumlahkanPerAliran, type AngkaNeraca, type RincianNeraca, type WadahNeraca } from "../neraca";
import { selisihMenit } from "../waktu";

// Indikator dampak (FITUR F43) — "dampak terukur, bukan janji". Murni; semua angka integer (gram, basis poin, jam).

/** Prioritas angkut berbasis PRAKIRAAN (prioritas_tercatat). Nowcast tidak dihitung: tak punya slot "sebelum hujan". */
export type PrioritasPrakiraan = { tpsId: string; slotUtc: Date; ditetapkanPada: Date };

/** Serah yang pernah disetujui pengelola (event SERAH_DISETUJUI). `beratG` = Σ berat final wadah serah. */
export type SerahDisetujui = { id: string; tpsId: string; disetujuiPada: Date; beratG: number };

/**
 * kg terangkut sebelum hujan diprakirakan: Σ berat serah yang DISETUJUI setelah prioritas dicatat dan sebelum
 * slot acuannya, pada TPS yang sama. Batas ketat (tepat di batas tidak dihitung). Serah dihitung sekali walau
 * cocok dengan beberapa prioritas.
 */
export function kgTerangkutSebelumHujanG(prioritas: readonly PrioritasPrakiraan[], serah: readonly SerahDisetujui[]): number {
  let total = 0;
  for (const s of serah) {
    const t = s.disetujuiPada.getTime();
    const cocok = prioritas.some((p) => p.tpsId === s.tpsId && p.ditetapkanPada.getTime() < t && t < p.slotUtc.getTime());
    if (cocok) {
      if (!Number.isSafeInteger(s.beratG) || s.beratG < 0) throw new RangeError("beratG harus integer gram ≥ 0");
      total += s.beratG;
    }
  }
  return total;
}

export type MasukanIndikator = {
  wadah: readonly WadahNeraca[];
  rincian: readonly RincianNeraca[];
  /** Status serah yang DIBUAT pada periode (untuk % serah tertutup). */
  statusSerahDibuat: readonly StatusSerah[];
  /** Wadah yang sudah diangkut: waktu catat & waktu serahnya disetujui (untuk umur rata-rata saat diangkut). */
  wadahDiangkut: readonly { terjadiPada: Date; disetujuiPada: Date }[];
  prioritas: readonly PrioritasPrakiraan[];
  serahDisetujui: readonly SerahDisetujui[];
};

export type Indikator = {
  /** Per aliran: dicatat di TPS, diterima, ditolak (gram). */
  kgPerAliran: Record<Aliran, Pick<AngkaNeraca, "dicatatG" | "diterimaG" | "ditolakG">>;
  /** Aliran KUNING; `diterimaBp` = diterima ÷ (diterima + ditolak), null bila belum ada penutupan. */
  kuning: { diterimaG: number; ditolakG: number; diterimaBp: number | null };
  serahDibuat: number;
  serahTertutup: number;
  /** Serah tertutup ÷ serah dibuat (basis poin), null bila belum ada serah. */
  serahTertutupBp: number | null;
  /** Rata-rata umur wadah saat serahnya disetujui, jam penuh (dibulatkan ke bawah); null bila belum ada. */
  umurWadahRataJam: number | null;
  kgTerangkutSebelumHujanG: number;
};

export function hitungIndikator(m: MasukanIndikator): Indikator {
  const neraca = jumlahkanPerAliran(hitungNeraca({ wadah: m.wadah, rincian: m.rincian }, { kelompok: "KAWASAN", periode: "SEMUA" }));
  const kgPerAliran = Object.fromEntries(
    ALIRAN.map((a) => [a, { dicatatG: neraca[a].dicatatG, diterimaG: neraca[a].diterimaG, ditolakG: neraca[a].ditolakG }]),
  ) as Indikator["kgPerAliran"];

  const kuning = kgPerAliran.KUNING;
  const serahTertutup = m.statusSerahDibuat.filter((s) => (STATUS_TERTUTUP as readonly string[]).includes(s)).length;

  let umur: number | null = null;
  if (m.wadahDiangkut.length > 0) {
    const menit = m.wadahDiangkut.reduce((s, w) => s + Math.max(0, selisihMenit(w.terjadiPada, w.disetujuiPada)), 0);
    umur = Math.trunc(menit / (m.wadahDiangkut.length * 60));
  }

  return {
    kgPerAliran,
    kuning: { diterimaG: kuning.diterimaG, ditolakG: kuning.ditolakG, diterimaBp: persenBp(kuning.diterimaG, kuning.diterimaG + kuning.ditolakG) },
    serahDibuat: m.statusSerahDibuat.length,
    serahTertutup,
    serahTertutupBp: persenBp(serahTertutup, m.statusSerahDibuat.length),
    umurWadahRataJam: umur,
    kgTerangkutSebelumHujanG: kgTerangkutSebelumHujanG(m.prioritas, m.serahDisetujui),
  };
}
