import { KunciHak, NilaiHak, type Hak, type JenisOrganisasi } from "@serah/kontrak";
import type { Tx } from "./db";

// Satu pintu hak paket. Literal kode paket hanya boleh di berkas ini & seed (guard j).
// S01: paket efektif & daftar hak untuk GET /api/sesi. boleh()/batas() lengkap di S19.

const PAKET_KAWASAN_BAWAAN = "KAWASAN_DASAR";
const PAKET_MITRA = "MITRA";
const PAKET_INTERNAL = "INTERNAL";

/** Paket efektif organisasi: kawasan dari langganan; mitra & internal tetap. */
export async function paketOrganisasi(tx: Tx, organisasi: { id: string; jenis: JenisOrganisasi }): Promise<string> {
  switch (organisasi.jenis) {
    case "KAWASAN": {
      const langganan = await tx.langganan.findUnique({ where: { organisasiId: organisasi.id }, select: { paketKode: true } });
      return langganan?.paketKode ?? PAKET_KAWASAN_BAWAAN;
    }
    case "PENGANGKUT":
    case "PENERIMA":
      return PAKET_MITRA;
    case "INTERNAL":
      return PAKET_INTERNAL;
  }
}

/** Daftar hak sebuah paket dari tabel entitlement (baris yang kuncinya tidak dikenal kontrak diabaikan). */
export async function hakPaket(tx: Tx, paketKode: string): Promise<Hak[]> {
  const baris = await tx.entitlement.findMany({ where: { paketKode }, orderBy: { kunci: "asc" } });
  const keluar: Hak[] = [];
  for (const b of baris) {
    const kunci = KunciHak.safeParse(b.kunci);
    const nilai = NilaiHak.safeParse(b.nilai);
    if (kunci.success && nilai.success) keluar.push({ kunci: kunci.data, nilai: nilai.data });
  }
  return keluar;
}
