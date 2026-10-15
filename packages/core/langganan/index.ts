import type { StatusLangganan, StatusTagihan } from "@serah/kontrak";
import { awalHariWib, periodeWib, tambahJam, tanggalWib } from "../waktu";

// Mesin langganan murni (FITUR §3.1, §3.4; S19-2). Waktu selalu argumen. Kode paket tidak muncul di sini (guard j):
// keluaran `paketEfektif` abstrak ("LANGGANAN" = paket yang tercatat di langganan, "DASAR" = paket dasar).

/** Masa uji coba otomatis sejak organisasi kawasan dibuat. */
export const HARI_UJI_COBA = 14;
/** Jatuh tempo tagihan = tanggal terbit + 14 hari (FITUR §3.4). */
export const HARI_JATUH_TEMPO = 14;
/** MENUNGGAK + 14 hari lagi → paket efektif dasar (FITUR §3.4). */
export const HARI_TENGGANG = 14;

const HARI_MS = 86_400_000;

/** Awal masa uji coba = awal hari WIB `sekarang`; selesai = awal hari WIB 14 hari kemudian (tepat tengah malam WIB). */
export function masaUjiCoba(sekarang: Date): { mulai: Date; selesai: Date } {
  const mulai = awalHariWib(tanggalWib(sekarang));
  return { mulai, selesai: tambahJam(mulai, HARI_UJI_COBA * 24) };
}

export type KeadaanLangganan = {
  status: StatusLangganan;
  ujiCobaSelesai: Date | null;
  hargaDibekukanPerTpsIdr: number | null;
};

/** Tagihan yang dihitung untuk tunggakan: belum dibayar dan tidak sedang menunggu konfirmasi admin. */
export type TagihanTerbuka = { status: StatusTagihan; jatuhTempo: string /* YYYY-MM-DD WIB */ };

const STATUS_TERHITUNG_TUNGGAK: readonly StatusTagihan[] = ["TERBIT", "KEDALUWARSA"];

/** Akhir hari WIB tanggal `YYYY-MM-DD` (eksklusif): tengah malam WIB hari berikutnya. */
function akhirHariWib(tanggal: string): Date {
  return new Date(awalHariWib(tanggal).getTime() + HARI_MS);
}

/** Tanggal jatuh tempo (WIB) untuk tagihan yang terbit pada `terbit`. */
export function jatuhTempo(terbit: Date): string {
  return tanggalWib(new Date(awalHariWib(tanggalWib(terbit)).getTime() + HARI_JATUH_TEMPO * HARI_MS));
}

export type Peralihan = { dari: StatusLangganan; ke: StatusLangganan; sebab: "UJI_COBA_BERAKHIR" | "LEWAT_JATUH_TEMPO" | "TENGGANG_HABIS" };

/**
 * Peralihan karena waktu (dinilai cron harian). Satu peralihan per panggilan; null bila tidak ada.
 * - UJI_COBA, masa uji coba lewat → BERAKHIR (paket dasar).
 * - AKTIF, ada tagihan terbuka yang lewat jatuh tempo → MENUNGGAK.
 * - MENUNGGAK, tagihan terbuka tertua lewat jatuh tempo + 14 hari → BERAKHIR (paket dasar). Data tidak dihapus.
 */
export function tinjauWaktu(l: KeadaanLangganan, tagihan: readonly TagihanTerbuka[], sekarang: Date): Peralihan | null {
  const t = sekarang.getTime();
  if (l.status === "UJI_COBA") {
    return l.ujiCobaSelesai && l.ujiCobaSelesai.getTime() <= t ? { dari: "UJI_COBA", ke: "BERAKHIR", sebab: "UJI_COBA_BERAKHIR" } : null;
  }
  const terbuka = tagihan.filter((x) => STATUS_TERHITUNG_TUNGGAK.includes(x.status)).map((x) => x.jatuhTempo).sort();
  const tertua = terbuka[0];
  if (!tertua) return null;
  const lewat = akhirHariWib(tertua).getTime() <= t;
  if (l.status === "AKTIF" && lewat) return { dari: "AKTIF", ke: "MENUNGGAK", sebab: "LEWAT_JATUH_TEMPO" };
  if (l.status === "MENUNGGAK" && akhirHariWib(tertua).getTime() + HARI_TENGGANG * HARI_MS <= t) {
    return { dari: "MENUNGGAK", ke: "BERAKHIR", sebab: "TENGGANG_HABIS" };
  }
  return null;
}

export type HasilLunas = { status: "AKTIF"; hargaDibekukanPerTpsIdr: number; periodeBerjalan: string; dari: StatusLangganan };

/**
 * Tagihan lunas: dari status mana pun → AKTIF. Harga dibekukan saat PERTAMA AKTIF dan tidak berubah sesudahnya
 * (perubahan harga paket tidak mengubah langganan berjalan). Periode berjalan = bulan WIB tanggal lunas.
 */
export function setelahLunas(l: KeadaanLangganan, hargaTagihanPerTpsIdr: number, sekarang: Date): HasilLunas {
  return {
    status: "AKTIF",
    hargaDibekukanPerTpsIdr: l.hargaDibekukanPerTpsIdr ?? hargaTagihanPerTpsIdr,
    periodeBerjalan: periodeWib(sekarang),
    dari: l.status,
  };
}

/** Paket efektif sekarang: "LANGGANAN" = paket tercatat di langganan; "DASAR" = paket dasar (inti tetap jalan). */
export function paketEfektif(l: Pick<KeadaanLangganan, "status" | "ujiCobaSelesai">, sekarang: Date): "LANGGANAN" | "DASAR" {
  if (l.status === "BERAKHIR") return "DASAR";
  if (l.status === "UJI_COBA") return l.ujiCobaSelesai && l.ujiCobaSelesai.getTime() > sekarang.getTime() ? "LANGGANAN" : "DASAR";
  return "LANGGANAN";
}

/** Status langganan yang ditagih bulanan pada tanggal 1 (WIB). UJI_COBA tidak ditagih. */
export function ditagihBulanan(status: StatusLangganan): boolean {
  return status === "AKTIF" || status === "MENUNGGAK" || status === "BERAKHIR";
}

/** Tanggal 1 bulan WIB? (tagihan bulanan terbit tanggal 1). */
export function tanggalSatuWib(sekarang: Date): boolean {
  return tanggalWib(sekarang).endsWith("-01");
}

/** Total tagihan: jumlah TPS aktif × harga per TPS (rupiah bulat; tanpa prorata, K-10). */
export function totalTagihan(jumlahTps: number, hargaPerTpsIdr: number): number {
  if (!Number.isSafeInteger(jumlahTps) || !Number.isSafeInteger(hargaPerTpsIdr) || jumlahTps < 0 || hargaPerTpsIdr < 0) {
    throw new RangeError("jumlah TPS & harga harus bilangan bulat ≥0");
  }
  const total = jumlahTps * hargaPerTpsIdr;
  if (!Number.isSafeInteger(total)) throw new RangeError("total melampaui batas bilangan bulat aman");
  return total;
}
