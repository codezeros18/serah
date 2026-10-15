import { ALIRAN, type Aliran, type BarisLaporan } from "@serah/kontrak";
import { periodeWib, tanggalWib } from "../waktu";
import { STATUS_TERTUTUP, type FilterPihak, type SerahTertutup } from "./jenis";

export * from "./jenis";
export { susunCsv, BOM_UTF8, PEMISAH_CSV, AKHIR_BARIS_CSV, type HasilCsv } from "./csv";
export { pilihHargaAcuan, ringkasDitolak, LABEL_SUMBER_HARGA, type HargaMaterialMasukan, type HasilDitolak } from "./ditolak";

// Tiga laporan wajib (Pergub 102/2021 Ps. 23(3) huruf a–h; BLUEPRINT §L.4) dari SATU fungsi: kawasan, pengangkut,
// dan penerima memanggil susunBaris dengan filter pihak yang berbeda. Tidak ada hitungan terpisah per pihak.

export type TotalAliran = { aliran: Aliran; beratTpsG: number; beratDiterimaG: number; beratDitolakG: number };

const KOLOM_ORG = { kawasan: "orgKawasanId", pengangkut: "orgPengangkutId", penerima: "orgPenerimaId" } as const;

function gramSah(n: number, nama: string): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${nama} harus integer gram ≥ 0`);
  return n;
}

const urutAliran = (a: Aliran, b: Aliran) => ALIRAN.indexOf(a) - ALIRAN.indexOf(b);

/**
 * Satu baris per aliran per serah tertutup, untuk pihak & periode (YYYY-MM WIB, berdasar waktu server penutupan).
 * Urutan: waktu tutup, kode serah, aliran (HIJAU, KUNING, MERAH, ABU). Serah yang belum tertutup tidak masuk.
 */
export function susunBaris(data: readonly SerahTertutup[], pihak: FilterPihak, periode?: string): BarisLaporan[] {
  const kolom = KOLOM_ORG[pihak.jenis];
  const terpilih = data
    .filter(
      (s) =>
        (STATUS_TERTUTUP as readonly string[]).includes(s.status) &&
        s[kolom] === pihak.organisasiId &&
        (pihak.kawasanId === undefined || s.kawasanId === pihak.kawasanId) &&
        (periode === undefined || periodeWib(s.ditutupPada) === periode),
    )
    .sort((a, b) => a.ditutupPada.getTime() - b.ditutupPada.getTime() || (a.kode < b.kode ? -1 : a.kode > b.kode ? 1 : 0));

  return terpilih.flatMap((s) =>
    [...s.aliran].sort((a, b) => urutAliran(a.aliran, b.aliran)).map<BarisLaporan>((a) => ({
      tanggalWib: tanggalWib(s.ditutupPada),
      kodeSerah: s.kode,
      aliran: a.aliran,
      beratTpsG: gramSah(a.beratTpsG, "beratTpsG"),
      beratDiterimaG: gramSah(a.diterimaG, "diterimaG"),
      beratDitolakG: gramSah(a.ditolakG, "ditolakG"),
      alasanTolak: a.alasan,
      tpsKode: s.tpsKode,
      kawasanNama: s.kawasanNama,
      kawasanAlamat: s.kawasanAlamat,
      pengangkutNama: s.pengangkutNama,
      plat: s.plat,
      penerimaNama: s.penerimaNama,
      penerimaJenis: s.penerimaJenis,
      status: s.status as BarisLaporan["status"],
      sidikEvent: s.sidikEvent,
    })),
  );
}

/** Total (huruf d) dari baris yang sama; hanya aliran yang punya baris. */
export function totalPerAliran(baris: readonly BarisLaporan[]): TotalAliran[] {
  const per = new Map<Aliran, TotalAliran>();
  for (const b of baris) {
    const t = per.get(b.aliran) ?? { aliran: b.aliran, beratTpsG: 0, beratDiterimaG: 0, beratDitolakG: 0 };
    t.beratTpsG += b.beratTpsG;
    t.beratDiterimaG += b.beratDiterimaG;
    t.beratDitolakG += b.beratDitolakG;
    per.set(b.aliran, t);
  }
  return [...per.values()].sort((a, b) => urutAliran(a.aliran, b.aliran));
}
