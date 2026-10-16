import { log } from "./log";

// Penjadwal cron di dalam proses (S28): memanggil tiga pekerjaan cron tanpa layanan terpisah. Aman karena
// `jalankanCron` mengklaim jendela (tabel pekerjaan_cron: sepuluh-menit = 10 menit, tiga-jam = 3 jam, harian =
// tanggal WIB) — pemanggilan lebih sering dari jendelanya, atau dari beberapa proses/instans sekaligus, dilewati.
// Dinyalakan dengan CRON_INTERNAL=true. Pemicu eksternal (Railway Cron → POST /api/cron/*) tetap berfungsi
// berdampingan: jendela yang sama hanya dijalankan sekali.

export const NAMA_PEKERJAAN = ["sepuluh-menit", "tiga-jam", "harian"] as const;
export type NamaPekerjaan = (typeof NAMA_PEKERJAAN)[number];

/** Selang pengecekan: lebih rapat dari jendela terkecil (10 menit) agar pekerjaan tidak terlambat lebih dari ini. */
export const SELANG_MS = 5 * 60_000;
/** Tunda sedikit setelah start agar server sempat siap dan migrasi/seed selesai. */
export const TUNDA_AWAL_MS = 45_000;

export type Jalankan = (nama: NamaPekerjaan, sekarang: Date) => Promise<unknown>;

/** Satu putaran: ketiga pekerjaan berurutan; kegagalan satu tidak menghentikan yang lain. */
export async function putaranCron(jalankan: Jalankan, sekarang: Date = new Date()): Promise<{ nama: NamaPekerjaan; ok: boolean }[]> {
  const hasil: { nama: NamaPekerjaan; ok: boolean }[] = [];
  for (const nama of NAMA_PEKERJAAN) {
    try {
      await jalankan(nama, sekarang);
      hasil.push({ nama, ok: true });
    } catch (e) {
      log().error("cron gagal", { nama, galat: e });
      hasil.push({ nama, ok: false });
    }
  }
  return hasil;
}

type Pengendali = { berhenti: () => void };
const KUNCI = Symbol.for("serah.penjadwal");

/**
 * Mulai penjadwal (satu per proses). Mengembalikan pengendali; pemanggilan kedua mengembalikan yang sama.
 * `jalankan` diinjeksikan agar dapat diuji tanpa DB.
 */
export function mulaiPenjadwal(jalankan: Jalankan, opsi: { selangMs?: number; tundaAwalMs?: number } = {}): Pengendali {
  const g = globalThis as unknown as Record<symbol, Pengendali | undefined>;
  const ada = g[KUNCI];
  if (ada) return ada;

  let berjalan = false;
  const tik = async () => {
    if (berjalan) return; // putaran sebelumnya belum selesai
    berjalan = true;
    try {
      await putaranCron(jalankan);
    } finally {
      berjalan = false;
    }
  };
  const awal = setTimeout(() => void tik(), opsi.tundaAwalMs ?? TUNDA_AWAL_MS);
  const berkala = setInterval(() => void tik(), opsi.selangMs ?? SELANG_MS);
  // Jangan menahan proses saat dihentikan.
  awal.unref();
  berkala.unref();

  const p: Pengendali = {
    berhenti() {
      clearTimeout(awal);
      clearInterval(berkala);
      g[KUNCI] = undefined;
    },
  };
  g[KUNCI] = p;
  return p;
}
