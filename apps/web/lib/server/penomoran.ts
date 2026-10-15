import type { Tx } from "./db";

// Nomor urut kode terbaca (CLAUDE.md §5) dari tabel `penomoran`. Satu pernyataan atomik (UPSERT … RETURNING)
// sehingga dua permintaan bersamaan tidak pernah mendapat nomor yang sama. Pembentukan kode di core/kode.

export async function nomorBerikut(tx: Tx, jenis: string, tanggalAtauPeriode: string): Promise<number> {
  const [r] = await tx.$queryRaw<{ nomor_terakhir: number }[]>`
    INSERT INTO penomoran (jenis, tanggal_atau_periode, nomor_terakhir) VALUES (${jenis}, ${tanggalAtauPeriode}, 1)
    ON CONFLICT (jenis, tanggal_atau_periode) DO UPDATE SET nomor_terakhir = penomoran.nomor_terakhir + 1
    RETURNING nomor_terakhir`;
  if (!r) throw new Error("penomoran gagal");
  return r.nomor_terakhir;
}
