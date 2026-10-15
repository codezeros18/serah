import { konfigurasiPada, type KonfigurasiAturan, type VersiAturan } from "@serah/core/aturan";
import type { Yurisdiksi } from "@serah/kontrak";
import type { Tx } from "./db";

// Pemuat aturan berversi (S21-3). Evaluator di core menerima KonfigurasiAturan; di sini dibangun dari aturan_versi
// untuk waktu KEJADIAN (berlaku_dari ≤ kejadian). Tabel aturan_versi baca-semua (RLS) dan catat-saja (versi lama tak berubah).

export async function versiAturan(tx: Tx, yurisdiksi: Yurisdiksi): Promise<VersiAturan[]> {
  const baris = await tx.aturanVersi.findMany({ where: { yurisdiksi }, orderBy: [{ kode: "asc" }, { versi: "asc" }] });
  return baris.map((b) => ({
    kode: b.kode,
    yurisdiksi: b.yurisdiksi,
    versi: b.versi,
    berlakuDari: b.berlakuDari.toISOString(),
    ambang: (b.ambang ?? {}) as Record<string, unknown>,
  }));
}

/** Konfigurasi evaluator untuk kejadian pada `pada` di yurisdiksi tersebut. */
export async function konfigurasiAturan(tx: Tx, yurisdiksi: Yurisdiksi, pada: Date): Promise<KonfigurasiAturan> {
  return konfigurasiPada(await versiAturan(tx, yurisdiksi), yurisdiksi, pada.toISOString());
}
