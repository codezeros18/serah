import { ALIRAN, type Aliran } from "@serah/kontrak";
import { periodeWib, tanggalWib } from "../waktu";

// Neraca gram per aliran per TPS/kawasan/periode dari wadah tercatat & penutupan (BLUEPRINT §L.3 K1, §L.4).
// Masukan memakai nilai FINAL (setelah koreksi, dari v_nilai_final) — modul ini tidak membaca koreksi sendiri.
// Wadah dihitung pada tanggal WIB `terjadiPada`; penutupan pada tanggal WIB `ditutupPada`.
// Wadah tanpa berat tidak ditebak beratnya: dihitung sebagai catatan & jumlah wadah tanpa berat.

export type WadahNeraca = {
  id: string;
  tpsId: string;
  kawasanId: string;
  aliran: Aliran;
  beratG: number | null;
  jumlahWadah: number | null;
  terjadiPada: Date;
};

export type RincianNeraca = {
  serahId: string;
  tpsId: string;
  kawasanId: string;
  aliran: Aliran;
  diterimaG: number;
  ditolakG: number;
  ditutupPada: Date;
};

export type OpsiNeraca = {
  kelompok: "TPS" | "KAWASAN";
  /** HARI = `YYYY-MM-DD` WIB, BULAN = `YYYY-MM` WIB, SEMUA = `*`. */
  periode: "HARI" | "BULAN" | "SEMUA";
  /** Saring setengah terbuka [dari, sampai). */
  rentang?: { dari: Date; sampai: Date };
};

export type AngkaNeraca = {
  dicatatG: number;
  catatanBerBerat: number;
  catatanTanpaBerat: number;
  wadahTanpaBerat: number;
  diterimaG: number;
  ditolakG: number;
  serahTertutup: number;
};

export type BarisNeraca = AngkaNeraca & { kunci: string; periode: string; aliran: Aliran };

const kosong = (): AngkaNeraca => ({
  dicatatG: 0,
  catatanBerBerat: 0,
  catatanTanpaBerat: 0,
  wadahTanpaBerat: 0,
  diterimaG: 0,
  ditolakG: 0,
  serahTertutup: 0,
});

function wajibGram(n: number, nama: string): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${nama} harus integer gram ≥ 0`);
  return n;
}

export function hitungNeraca(data: { wadah: readonly WadahNeraca[]; rincian: readonly RincianNeraca[] }, opsi: OpsiNeraca): BarisNeraca[] {
  const dalam = (t: Date) => !opsi.rentang || (t.getTime() >= opsi.rentang.dari.getTime() && t.getTime() < opsi.rentang.sampai.getTime());
  const periodeDari = (t: Date) => (opsi.periode === "HARI" ? tanggalWib(t) : opsi.periode === "BULAN" ? periodeWib(t) : "*");
  const kunciDari = (x: { tpsId: string; kawasanId: string }) => (opsi.kelompok === "TPS" ? x.tpsId : x.kawasanId);

  // kelompok → periode → aliran → angka (+ himpunan serah untuk menghitung serah tertutup unik)
  const peta = new Map<string, { kunci: string; periode: string; per: Map<Aliran, AngkaNeraca & { serah: Set<string> }> }>();
  const ambil = (kunci: string, periode: string, aliran: Aliran) => {
    const id = `${kunci}\u0000${periode}`;
    let g = peta.get(id);
    if (!g) {
      g = { kunci, periode, per: new Map(ALIRAN.map((a) => [a, { ...kosong(), serah: new Set<string>() }])) };
      peta.set(id, g);
    }
    return g.per.get(aliran)!;
  };

  for (const w of data.wadah) {
    if (!dalam(w.terjadiPada)) continue;
    const a = ambil(kunciDari(w), periodeDari(w.terjadiPada), w.aliran);
    if (w.beratG !== null) {
      a.dicatatG += wajibGram(w.beratG, "beratG");
      a.catatanBerBerat += 1;
    } else {
      a.catatanTanpaBerat += 1;
      a.wadahTanpaBerat += w.jumlahWadah ?? 0;
    }
  }

  for (const r of data.rincian) {
    if (!dalam(r.ditutupPada)) continue;
    const a = ambil(kunciDari(r), periodeDari(r.ditutupPada), r.aliran);
    a.diterimaG += wajibGram(r.diterimaG, "diterimaG");
    a.ditolakG += wajibGram(r.ditolakG, "ditolakG");
    a.serah.add(r.serahId);
  }

  const baris: BarisNeraca[] = [];
  const kelompok = [...peta.values()].sort((x, y) => (x.kunci === y.kunci ? (x.periode < y.periode ? -1 : 1) : x.kunci < y.kunci ? -1 : 1));
  for (const g of kelompok) {
    for (const aliran of ALIRAN) {
      const { serah, ...angka } = g.per.get(aliran)!;
      baris.push({ kunci: g.kunci, periode: g.periode, aliran, ...angka, serahTertutup: serah.size });
    }
  }
  return baris;
}

/** Jumlah per aliran atas baris neraca (mis. total kawasan). `serahTertutup` dijumlahkan per baris. */
export function jumlahkanPerAliran(baris: readonly BarisNeraca[]): Record<Aliran, AngkaNeraca> {
  const hasil = Object.fromEntries(ALIRAN.map((a) => [a, kosong()])) as Record<Aliran, AngkaNeraca>;
  for (const b of baris) {
    const t = hasil[b.aliran];
    t.dicatatG += b.dicatatG;
    t.catatanBerBerat += b.catatanBerBerat;
    t.catatanTanpaBerat += b.catatanTanpaBerat;
    t.wadahTanpaBerat += b.wadahTanpaBerat;
    t.diterimaG += b.diterimaG;
    t.ditolakG += b.ditolakG;
    t.serahTertutup += b.serahTertutup;
  }
  return hasil;
}
