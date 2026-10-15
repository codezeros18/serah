import type { StatusSerah } from "@serah/kontrak";

// Tagihan angkut (BLUEPRINT §H tagihan_angkut, FITUR F41). Murni: tanpa DB, tanpa jam sistem, tanpa float.
//
// Aturan (T27):
// 1. Hanya serah berstatus DITERIMA atau DITERIMA_SEBAGIAN yang ditagih. Serah lain (DITOLAK, belum ditutup, dst.)
//    tidak masuk hitungan dan dilaporkan di `tidakTermasuk` agar pengguna tahu apa yang tidak ditagih.
// 2. rit = jumlah serah yang ditagih (satu serah = satu rit tertutup).
// 3. kg diterima = Σ berat DITERIMA final (gram). DITERIMA_SEBAGIAN hanya menghitung bagian yang diterima.
// 4. total = rit × tarif_per_rit + ⌊Σ gram × tarif_per_kg / 1000⌋. Pembulatan gram→rupiah dilakukan SEKALI atas
//    total gram (ke bawah), bukan per serah; tarif kosong dihitung 0.
// 5. Subtotal per serah = tarif_per_rit + selisih pembulatan kumulatif, sehingga Σ subtotal = total (tepat).

export const STATUS_DITAGIH = ["DITERIMA", "DITERIMA_SEBAGIAN"] as const satisfies readonly StatusSerah[];

export interface SerahUntukTagihan {
  readonly kode: string;
  readonly status: StatusSerah;
  /** Σ berat diterima final serah ini (gram). */
  readonly diterimaG: number;
}

export interface TarifKontrak {
  readonly tarifPerRitIdr: number | null;
  readonly tarifPerKgIdr: number | null;
}

export interface BarisTagihanAngkut {
  readonly kodeSerah: string;
  readonly kgDiterimaG: number;
  readonly subtotalIdr: number;
}

export interface HasilTagihanAngkut {
  readonly ritTertutup: number;
  readonly kgDiterimaG: number;
  readonly totalIdr: number;
  readonly rincian: readonly BarisTagihanAngkut[];
  readonly tidakTermasuk: readonly { readonly kode: string; readonly status: StatusSerah }[];
}

function nonNegatif(n: number, nama: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${nama} harus integer ≥ 0`);
}

const ditagih = (s: StatusSerah): boolean => (STATUS_DITAGIH as readonly StatusSerah[]).includes(s);

/** ⌊gram × tarifPerKg / 1000⌋ dengan BigInt (tanpa float, tanpa luapan). */
export function gramKeRupiah(gram: number, tarifPerKgIdr: number): number {
  nonNegatif(gram, "gram");
  nonNegatif(tarifPerKgIdr, "tarif per kg");
  const r = (BigInt(gram) * BigInt(tarifPerKgIdr)) / 1000n;
  if (r > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("nilai rupiah melebihi batas aman");
  return Number(r);
}

export function hitungTagihanAngkut(serah: readonly SerahUntukTagihan[], tarif: TarifKontrak): HasilTagihanAngkut {
  const perRit = tarif.tarifPerRitIdr ?? 0;
  const perKg = tarif.tarifPerKgIdr ?? 0;
  nonNegatif(perRit, "tarif per rit");
  nonNegatif(perKg, "tarif per kg");

  const kode = new Set<string>();
  for (const s of serah) {
    if (kode.has(s.kode)) throw new RangeError(`serah ganda: ${s.kode}`);
    kode.add(s.kode);
    nonNegatif(s.diterimaG, `berat diterima ${s.kode}`);
  }

  const urut = [...serah].sort((a, b) => (a.kode < b.kode ? -1 : a.kode > b.kode ? 1 : 0));
  const termasuk = urut.filter((s) => ditagih(s.status));
  const tidakTermasuk = urut.filter((s) => !ditagih(s.status)).map((s) => ({ kode: s.kode, status: s.status }));

  let kumulatifG = 0;
  let kumulatifRp = 0;
  const rincian: BarisTagihanAngkut[] = termasuk.map((s) => {
    kumulatifG += s.diterimaG;
    const rpSekarang = gramKeRupiah(kumulatifG, perKg);
    const bagianKg = rpSekarang - kumulatifRp;
    kumulatifRp = rpSekarang;
    return { kodeSerah: s.kode, kgDiterimaG: s.diterimaG, subtotalIdr: perRit + bagianKg };
  });

  const totalIdr = termasuk.length * perRit + kumulatifRp;
  if (!Number.isSafeInteger(totalIdr)) throw new RangeError("total melebihi batas aman");
  return { ritTertutup: termasuk.length, kgDiterimaG: kumulatifG, totalIdr, rincian, tidakTermasuk };
}
