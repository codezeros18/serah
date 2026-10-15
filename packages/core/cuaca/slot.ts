import { MS_PER_JAM } from "./wib";

export interface SlotCuaca {
  readonly slotUtc: Date;
  readonly weatherDesc: string;
}

/** Slot dengan sekarang ≤ slotUtc ≤ sekarang + horizon, urut naik. */
export function slotRelevan<T extends { readonly slotUtc: Date }>(
  slot: readonly T[],
  sekarang: Date,
  horizonJam: number,
): T[] {
  const awal = sekarang.getTime();
  const akhir = awal + horizonJam * MS_PER_JAM;
  return slot
    .filter((s) => s.slotUtc.getTime() >= awal && s.slotUtc.getTime() <= akhir)
    .sort((a, b) => a.slotUtc.getTime() - b.slotUtc.getTime());
}

/** Prakiraan basi bila analysis_date lebih tua dari batas jam. */
export function basi(analysisDate: Date, sekarang: Date, basiJam: number): boolean {
  return sekarang.getTime() - analysisDate.getTime() > basiJam * MS_PER_JAM;
}
