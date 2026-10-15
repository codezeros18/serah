import {
  TEKS,
  isi,
  type Aliran,
  type AksiAturan,
  type JenisPenerima,
  type KodeAturan,
  type StatusIzin,
  type StatusKontrak,
  type StatusSerah,
  type Yurisdiksi,
} from "@serah/kontrak";
import { jarakHamming } from "../bukti/hamming";
import { MS_PER_HARI, MS_PER_JAM, basi, formatJamWib, jamWib, slotRelevan, tanggalWib, titikDalamPoligon, umurJamPenuh, umurMs, type TitikE6 } from "../cuaca";
import { aturanAktif, definisiAturan, sumberAturan } from "./daftar";
import { KONFIGURASI_ATURAN, type KonfigurasiAturan } from "./konfigurasi";

// Evaluator aturan berpasal (BLUEPRINT Â§J). Murni: tanpa DB, tanpa jam sistem.
// Setiap hasil menyebut kode aturan + teks dari TEKS (Â§M.3). Tidak ada kalimat buatan sendiri.

export interface HasilAturan {
  readonly kode: KodeAturan;
  readonly aksi: AksiAturan;
  readonly teks: string;
  readonly sumber: string;
}

const PENERIMA_BERIZIN: readonly JenisPenerima[] = ["FASILITAS_BERIZIN", "PELAPAK_BERIZIN", "BANK_SAMPAH_INDUK", "TPS3R"];
const ALIRAN_PRIORITAS: readonly Aliran[] = ["KUNING", "ABU"];
const BP_PENUH = 10_000n;

const labelAliran = (a: Aliran): string => TEKS[`ALIRAN_${a}` as const];

function hasil(kode: KodeAturan, yurisdiksi: Yurisdiksi, teks: string): HasilAturan {
  const d = definisiAturan(kode);
  return { kode, aksi: d.aksi, teks, sumber: sumberAturan(kode, yurisdiksi) };
}

/** Format gram â†’ "42,5" (koma desimal, nol di belakang dibuang). Sementara sampai core/angka (S02). */
function kgTeks(gram: number): string {
  const utuh = Math.trunc(gram / 1000);
  const sisa = String(gram % 1000).padStart(3, "0").replace(/0+$/, "");
  return sisa ? `${utuh},${sisa}` : String(utuh);
}

/** Basis poin â†’ persen teks "25" / "25,5" / "25,05". */
function persenTeks(bp: bigint): string {
  const utuh = bp / 100n;
  const sisa = String(bp % 100n).padStart(2, "0").replace(/0+$/, "");
  return sisa ? `${utuh},${sisa}` : String(utuh);
}

// â”€â”€ R-11 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PenerimaAturan {
  readonly id: string;
  readonly jenis: JenisPenerima;
  readonly aliranDiterima: readonly Aliran[];
  readonly statusIzin: StatusIzin;
}

function periksaR11(yurisdiksi: Yurisdiksi, penerima: PenerimaAturan): HasilAturan[] {
  if (!aturanAktif("R11", yurisdiksi)) return [];
  if (!PENERIMA_BERIZIN.includes(penerima.jenis) || penerima.statusIzin === "TERVERIFIKASI") return [];
  return [hasil("R11", yurisdiksi, isi("ATURAN_R11"))];
}

/** Aktivasi kontrak: R-11. */
export function evaluasiKontrak(m: { yurisdiksi: Yurisdiksi; penerima: PenerimaAturan }): HasilAturan[] {
  return periksaR11(m.yurisdiksi, m.penerima);
}

// â”€â”€ AMBIL: R-01, R-02, R-03, R-11 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface KontrakAturan {
  readonly status: StatusKontrak;
  readonly kawasanId: string;
  readonly pengangkutId: string;
  readonly penerimaId: string;
  readonly aliran: readonly Aliran[];
  /** YYYY-MM-DD (WIB), inklusif. */
  readonly berlakuDari: string;
  readonly berlakuSampai: string;
}

export interface MasukanAmbil {
  readonly yurisdiksi: Yurisdiksi;
  readonly sekarang: Date;
  readonly aliranSerah: readonly Aliran[];
  readonly kawasanId: string;
  readonly pengangkutId: string;
  readonly penerima: PenerimaAturan;
  readonly kontrak: readonly KontrakAturan[];
}

export function evaluasiAmbil(m: MasukanAmbil): HasilAturan[] {
  const { yurisdiksi } = m;
  const keluar: HasilAturan[] = [];

  if (aturanAktif("R01", yurisdiksi) && m.penerima.jenis === "TPA_TPST") {
    for (const a of m.aliranSerah) {
      if (a !== "ABU") keluar.push(hasil("R01", yurisdiksi, isi("ATURAN_R01", { aliran: labelAliran(a) })));
    }
  }

  if (aturanAktif("R02", yurisdiksi)) {
    const hariIni = tanggalWib(m.sekarang);
    const berlaku = m.kontrak.filter(
      (k) =>
        k.status === "AKTIF" &&
        k.kawasanId === m.kawasanId &&
        k.pengangkutId === m.pengangkutId &&
        k.penerimaId === m.penerima.id &&
        k.berlakuDari <= hariIni &&
        hariIni <= k.berlakuSampai,
    );
    for (const a of m.aliranSerah) {
      if (!berlaku.some((k) => k.aliran.includes(a))) keluar.push(hasil("R02", yurisdiksi, isi("ATURAN_R02", { aliran: labelAliran(a) })));
    }
  }

  if (aturanAktif("R03", yurisdiksi)) {
    for (const a of m.aliranSerah) {
      if (!m.penerima.aliranDiterima.includes(a)) keluar.push(hasil("R03", yurisdiksi, isi("ATURAN_R03", { aliran: labelAliran(a) })));
    }
  }

  keluar.push(...periksaR11(yurisdiksi, m.penerima));
  return keluar;
}

// â”€â”€ Foto MUATAN: R-04 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PembandingFoto {
  readonly dhash: string;
  readonly kodeSerah: string;
  readonly diambilPada: Date;
}

export function evaluasiFoto(
  m: { yurisdiksi: Yurisdiksi; sekarang: Date; dhash: string; pembanding: readonly PembandingFoto[] },
  konfigurasi: KonfigurasiAturan = KONFIGURASI_ATURAN,
): HasilAturan[] {
  if (!aturanAktif("R04", m.yurisdiksi)) return [];
  const batasMs = konfigurasi.R04_JENDELA_HARI * MS_PER_HARI;
  let terdekat: { jarak: number; kodeSerah: string } | null = null;
  for (const p of m.pembanding) {
    if (umurMs(p.diambilPada, m.sekarang) > batasMs) continue;
    const jarak = jarakHamming(m.dhash, p.dhash);
    if (jarak <= konfigurasi.R04_AMBANG_BIT && (terdekat === null || jarak < terdekat.jarak)) {
      terdekat = { jarak, kodeSerah: p.kodeSerah };
    }
  }
  return terdekat ? [hasil("R04", m.yurisdiksi, isi("ATURAN_R04", { kode_serah: terdekat.kodeSerah }))] : [];
}

// â”€â”€ TPS: R-05, R-06, R-09 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface WadahBelumDiserahkan {
  readonly aliran: Aliran;
  readonly terjadiPada: Date;
}

export interface MasukanTPS {
  readonly yurisdiksi: Yurisdiksi;
  readonly sekarang: Date;
  readonly kodeTps: string;
  readonly aktif: boolean;
  readonly wadahBelumDiserahkan: readonly WadahBelumDiserahkan[];
  /** Waktu `terjadi_pada` semua wadah_catat TPS ini (cukup yang mendekati hari ini). */
  readonly waktuCatatan: readonly Date[];
}

export function evaluasiTPS(m: MasukanTPS, konfigurasi: KonfigurasiAturan = KONFIGURASI_ATURAN): HasilAturan[] {
  const { yurisdiksi } = m;
  const keluar: HasilAturan[] = [];

  // Wadah tertua per aliran.
  const tertua = new Map<Aliran, Date>();
  for (const w of m.wadahBelumDiserahkan) {
    const sebelum = tertua.get(w.aliran);
    if (!sebelum || w.terjadiPada.getTime() < sebelum.getTime()) tertua.set(w.aliran, w.terjadiPada);
  }

  for (const [aliran, sejak] of tertua) {
    const jam = umurJamPenuh(sejak, m.sekarang);
    if (aliran === "HIJAU") {
      if (aturanAktif("R06", yurisdiksi) && umurMs(sejak, m.sekarang) > konfigurasi.R06_JAM * MS_PER_JAM) {
        keluar.push(hasil("R06", yurisdiksi, isi("ATURAN_R06", { kode_tps: m.kodeTps, jam })));
      }
    } else if (aturanAktif("R05", yurisdiksi) && umurMs(sejak, m.sekarang) > konfigurasi.R05_JAM * MS_PER_JAM) {
      keluar.push(hasil("R05", yurisdiksi, isi("ATURAN_R05", { aliran: labelAliran(aliran), kode_tps: m.kodeTps, jam })));
    }
  }

  if (aturanAktif("R09", yurisdiksi) && m.aktif && jamWib(m.sekarang) >= konfigurasi.R09_JAM_WIB) {
    const hariIni = tanggalWib(m.sekarang);
    if (!m.waktuCatatan.some((w) => tanggalWib(w) === hariIni)) {
      keluar.push(hasil("R09", yurisdiksi, isi("ATURAN_R09", { kode_tps: m.kodeTps })));
    }
  }
  return keluar;
}

// â”€â”€ Serah DIANGKUT: R-07 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function evaluasiMenggantung(
  m: { yurisdiksi: Yurisdiksi; sekarang: Date; kodeSerah: string; status: StatusSerah; disetujuiPada: Date },
  konfigurasi: KonfigurasiAturan = KONFIGURASI_ATURAN,
): HasilAturan[] {
  if (!aturanAktif("R07", m.yurisdiksi) || m.status !== "DIANGKUT") return [];
  if (umurMs(m.disetujuiPada, m.sekarang) <= konfigurasi.R07_JAM * MS_PER_JAM) return [];
  const jam = umurJamPenuh(m.disetujuiPada, m.sekarang);
  return [hasil("R07", m.yurisdiksi, isi("ATURAN_R07", { kode_serah: m.kodeSerah, jam }))];
}

// â”€â”€ TUTUP: R-08 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function evaluasiTutup(
  m: { yurisdiksi: Yurisdiksi; beratTiketG: number; beratWadahG: readonly (number | null)[] },
  konfigurasi: KonfigurasiAturan = KONFIGURASI_ATURAN,
): HasilAturan[] {
  if (!aturanAktif("R08", m.yurisdiksi)) return [];
  if (m.beratWadahG.length === 0 || m.beratWadahG.some((b) => b === null)) return [];
  const jumlah = m.beratWadahG.reduce<bigint>((acc, b) => acc + BigInt(b ?? 0), 0n);
  if (jumlah <= 0n) return [];
  const selisih = BigInt(m.beratTiketG) - jumlah;
  const mutlak = selisih < 0n ? -selisih : selisih;
  const bp = (mutlak * BP_PENUH) / jumlah;
  if (bp <= BigInt(konfigurasi.R08_BP)) return [];
  return [
    hasil(
      "R08",
      m.yurisdiksi,
      isi("ATURAN_R08", { berat_tiket: kgTeks(m.beratTiketG), persen: persenTeks(bp), berat_tps: kgTeks(Number(jumlah)) }),
    ),
  ];
}

// â”€â”€ Cuaca: R-10 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PrakiraanAturan {
  readonly mode: "LIVE" | "SNAPSHOT";
  readonly analysisDate: Date;
  readonly slot: readonly { readonly slotUtc: Date; readonly weatherDesc: string }[];
}

export interface NowcastAturan {
  readonly identifier: string;
  readonly headline: string;
  readonly effective: Date;
  readonly expires: Date;
  readonly poligonE6: readonly TitikE6[];
}

export interface MasukanCuaca {
  readonly yurisdiksi: Yurisdiksi;
  readonly sekarang: Date;
  readonly tps: { readonly kode: string; readonly latE6: number; readonly lonE6: number; readonly namaKelurahan: string };
  readonly wadahBelumDiserahkan: readonly WadahBelumDiserahkan[];
  /** null = gagal diambil (tanpa tebakan). */
  readonly prakiraan: PrakiraanAturan | null;
  /** null = gagal diambil; [] = tidak ada peringatan aktif. */
  readonly nowcast: readonly NowcastAturan[] | null;
}

export interface HasilPrioritas extends HasilAturan {
  readonly sumberCuaca: "PRAKIRAAN" | "NOWCAST";
  /** slot_utc ISO (PRAKIRAAN) atau identifier CAP (NOWCAST). */
  readonly acuan: string;
  readonly aliran: Aliran;
  readonly umurJam: number;
  /** Selalu R10_CATATAN. */
  readonly catatan: string;
}

export interface HasilCuaca {
  readonly prioritas: HasilPrioritas | null;
  /** Kunci teks galat yang harus ditampilkan UI, atau null. */
  readonly galat: "G_BMKG_MATI" | "G_BMKG_SNAPSHOT" | null;
  readonly nowcastTersedia: boolean;
}

const normal = (s: string) => s.trim().toLowerCase();

export function evaluasiCuaca(m: MasukanCuaca, konfigurasi: KonfigurasiAturan = KONFIGURASI_ATURAN): HasilCuaca {
  const { yurisdiksi, sekarang } = m;
  const nowcastTersedia = m.nowcast !== null;
  if (!aturanAktif("R10", yurisdiksi)) return { prioritas: null, galat: null, nowcastTersedia };

  // Pemicu wadah: KUNING/ABU belum diserahkan, umur â‰¥ R10_UMUR_JAM; ambil yang tertua.
  let wadah: WadahBelumDiserahkan | null = null;
  for (const w of m.wadahBelumDiserahkan) {
    if (!ALIRAN_PRIORITAS.includes(w.aliran)) continue;
    if (umurMs(w.terjadiPada, sekarang) < konfigurasi.R10_UMUR_JAM * MS_PER_JAM) continue;
    if (!wadah || w.terjadiPada.getTime() < wadah.terjadiPada.getTime()) wadah = w;
  }

  // Keadaan data prakiraan (bagian a).
  let galat: HasilCuaca["galat"] = null;
  let prakiraanDipakai: PrakiraanAturan | null = null;
  if (m.prakiraan === null || basi(m.prakiraan.analysisDate, sekarang, konfigurasi.R10_BASI_JAM)) {
    galat = "G_BMKG_MATI";
  } else {
    prakiraanDipakai = m.prakiraan;
    if (m.prakiraan.mode === "SNAPSHOT") galat = "G_BMKG_SNAPSHOT";
  }

  if (!wadah) return { prioritas: null, galat, nowcastTersedia };
  const jam = umurJamPenuh(wadah.terjadiPada, sekarang);
  const dasar = (teks: string) => hasil("R10", yurisdiksi, teks);

  // (b) nowcast aktif yang poligonnya memuat TPS â€” diutamakan karena peringatan yang sedang berlaku.
  for (const n of m.nowcast ?? []) {
    const aktif = n.effective.getTime() <= sekarang.getTime() && sekarang.getTime() < n.expires.getTime();
    if (aktif && titikDalamPoligon(m.tps.latE6, m.tps.lonE6, n.poligonE6)) {
      return {
        prioritas: {
          ...dasar(
            isi("ATURAN_R10_NOWCAST", {
              headline: n.headline,
              kode_tps: m.tps.kode,
              jam_berakhir: formatJamWib(n.expires),
              aliran: labelAliran(wadah.aliran),
              jam,
            }),
          ),
          sumberCuaca: "NOWCAST",
          acuan: n.identifier,
          aliran: wadah.aliran,
          umurJam: jam,
          catatan: TEKS.R10_CATATAN,
        },
        galat,
        nowcastTersedia,
      };
    }
  }

  // (a) prakiraan: slot dalam horizon dengan weather_desc âˆˆ kata hujan.
  if (prakiraanDipakai) {
    const kata = konfigurasi.R10_KATA_HUJAN.map(normal);
    const slot = slotRelevan(prakiraanDipakai.slot, sekarang, konfigurasi.R10_HORIZON_JAM).find((s) => kata.includes(normal(s.weatherDesc)));
    if (slot) {
      return {
        prioritas: {
          ...dasar(
            isi("ATURAN_R10_PRAKIRAAN", {
              weather_desc: slot.weatherDesc.trim(),
              nama_kelurahan: m.tps.namaKelurahan,
              jam_slot: formatJamWib(slot.slotUtc),
              kode_tps: m.tps.kode,
              aliran: labelAliran(wadah.aliran),
              jam,
            }),
          ),
          sumberCuaca: "PRAKIRAAN",
          acuan: slot.slotUtc.toISOString(),
          aliran: wadah.aliran,
          umurJam: jam,
          catatan: TEKS.R10_CATATAN,
        },
        galat,
        nowcastTersedia,
      };
    }
  }
  return { prioritas: null, galat, nowcastTersedia };
}
