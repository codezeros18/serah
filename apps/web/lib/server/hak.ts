import { evaluasiBatas, evaluasiBoleh } from "@serah/core/hak";
import { paketEfektif } from "@serah/core/langganan";
import { KunciHak, NilaiHak, type Hak, type JenisOrganisasi, type KunciHakBatas, type KunciHakBoleh } from "@serah/kontrak";
import type { Tx } from "./db";

// Satu pintu hak paket. Literal kode paket hanya boleh di berkas ini & seed (guard j).
// Paket efektif mengikuti mesin langganan (core/langganan.paketEfektif: uji coba lewat atau BERAKHIR → dasar,
// walau cron belum sempat mengubah status). Evaluasi nilai hak di core/hak.
// Pencatatan wadah, serah, penutupan, dan ekspor CSV tidak pernah dikunci paket (CLAUDE.md §2.7) — jangan panggil
// boleh()/batas() untuk itu.

const PAKET_KAWASAN_BAWAAN = "KAWASAN_DASAR";
const PAKET_MITRA = "MITRA";
const PAKET_INTERNAL = "INTERNAL";
/** Paket organisasi kawasan baru selama masa uji coba (FITUR §3.1). */
export const PAKET_UJI_COBA = "KAWASAN_UJI_COBA";
/** Paket berbayar kawasan: langganan menjadi paket ini saat tagihan pertama lunas (FITUR §3.1, K-09). */
export const PAKET_BERBAYAR = "KAWASAN_STANDAR";

/** Paket efektif organisasi: kawasan dari langganan; mitra & internal tetap. */
export async function paketOrganisasi(tx: Tx, organisasi: { id: string; jenis: JenisOrganisasi }, sekarang: Date = new Date()): Promise<string> {
  switch (organisasi.jenis) {
    case "KAWASAN": {
      const l = await tx.langganan.findUnique({ where: { organisasiId: organisasi.id }, select: { paketKode: true, status: true, ujiCobaSelesai: true } });
      if (!l) return PAKET_KAWASAN_BAWAAN;
      return paketEfektif(l, sekarang) === "LANGGANAN" ? l.paketKode : PAKET_KAWASAN_BAWAAN;
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

async function nilaiHak(tx: Tx, organisasiId: string, kunci: KunciHak): Promise<Hak["nilai"] | undefined> {
  const org = await tx.organisasi.findUnique({ where: { id: organisasiId }, select: { id: true, jenis: true } });
  if (!org) return undefined;
  const paket = await paketOrganisasi(tx, org);
  const e = await tx.entitlement.findUnique({ where: { paketKode_kunci: { paketKode: paket, kunci } }, select: { nilai: true } });
  const nilai = NilaiHak.safeParse(e?.nilai);
  return nilai.success ? nilai.data : undefined;
}

/** Fitur berbayar (FITUR §3.2) tersedia untuk organisasi ini? Hak tidak ada/tidak dikenal → tidak. */
export async function boleh(tx: Tx, organisasiId: string, kunci: KunciHakBoleh): Promise<boolean> {
  return evaluasiBoleh(await nilaiHak(tx, organisasiId, kunci));
}

/** Batas angka (FITUR §3.2): `null` = tak terbatas; hak tidak ada/tidak dikenal → 0 (paling aman). */
export async function batas(tx: Tx, organisasiId: string, kunci: KunciHakBatas): Promise<number | null> {
  return evaluasiBatas(await nilaiHak(tx, organisasiId, kunci));
}
