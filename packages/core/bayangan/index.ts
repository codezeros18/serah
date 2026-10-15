import { ALIRAN, TEKS, isi, type Aliran } from "@serah/kontrak";
import { formatGramKeKg } from "../angka";

// Mode bayangan (FITUR F40): angka catatan lama pengguna vs angka SERAH, selisih ke DUA arah, tanpa menilai.
// Murni. Angka SERAH yang dibandingkan = berat yang DICATAT di TPS pada periode (nilai final, setelah koreksi),
// karena catatan lama (buku TPS / laporan bulanan lama) mencatat hal yang sama: sampah yang keluar dari TPS.
// selisihG = bayangan − serah; positif → catatan lama lebih besar; negatif → lebih kecil; nol → sama.

export interface EntriBayangan {
  readonly aliran: Aliran;
  readonly beratG: number;
  readonly sumberCatatan: string;
}

export type ArahSelisih = "LEBIH" | "KURANG" | "SAMA";

export interface BarisBayangan {
  readonly aliran: Aliran;
  readonly serahG: number;
  readonly bayanganG: number;
  readonly selisihG: number;
  readonly arah: ArahSelisih;
  /** Sumber catatan lama, unik, urut abjad. */
  readonly sumberCatatan: readonly string[];
}

function nonNegatif(n: number, nama: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${nama} harus integer ≥ 0`);
}

export function arahSelisih(selisihG: number): ArahSelisih {
  if (!Number.isSafeInteger(selisihG)) throw new RangeError("selisih harus integer");
  return selisihG > 0 ? "LEBIH" : selisihG < 0 ? "KURANG" : "SAMA";
}

/**
 * Satu baris per aliran yang punya angka SERAH atau entri bayangan (urutan aliran tetap). Beberapa entri pada aliran
 * yang sama dijumlahkan; sumbernya dikumpulkan.
 */
export function bandingkanBayangan(serahPerAliran: Readonly<Partial<Record<Aliran, number>>>, entri: readonly EntriBayangan[]): BarisBayangan[] {
  const bayangan = new Map<Aliran, { g: number; sumber: Set<string> }>();
  for (const e of entri) {
    nonNegatif(e.beratG, "berat bayangan");
    const b = bayangan.get(e.aliran) ?? { g: 0, sumber: new Set<string>() };
    b.g += e.beratG;
    b.sumber.add(e.sumberCatatan.trim());
    bayangan.set(e.aliran, b);
  }
  const baris: BarisBayangan[] = [];
  for (const aliran of ALIRAN) {
    const serahG = serahPerAliran[aliran] ?? 0;
    nonNegatif(serahG, "berat SERAH");
    const b = bayangan.get(aliran);
    if (!b && serahG === 0) continue;
    const bayanganG = b?.g ?? 0;
    const selisihG = bayanganG - serahG;
    baris.push({ aliran, serahG, bayanganG, selisihG, arah: arahSelisih(selisihG), sumberCatatan: [...(b?.sumber ?? [])].sort() });
  }
  return baris;
}

/** Kalimat selisih dari teks §M.10 (BYG_LEBIH / BYG_KURANG / BYG_SAMA), tanpa kata menilai. */
export function teksSelisihBayangan(selisihG: number): string {
  const arah = arahSelisih(selisihG);
  if (arah === "SAMA") return TEKS.BYG_SAMA;
  const nilai = formatGramKeKg(Math.abs(selisihG));
  return arah === "LEBIH" ? isi("BYG_LEBIH", { nilai }) : isi("BYG_KURANG", { nilai });
}
