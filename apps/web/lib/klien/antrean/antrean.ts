import { SINKRON_BATCH_MAKS, type JenisAksiSinkron } from "@serah/kontrak";
import type { HasilApi } from "../api";
import type { AksiAntrean, GalatAntrean, PenyimpananAntrean } from "./tipe";

export type AksiKirim = Pick<AksiAntrean, "idempotencyKey" | "jenis" | "terjadiPada" | "payload">;

export type HasilKirimBatch = HasilApi<{
  hasil: Array<{
    idempotencyKey: string;
    status: "DITERAPKAN" | "DUPLIKAT" | "DITOLAK";
    galat?: { kode: string; aturan?: { teks: string } };
  }>;
}>;

/** Pengirim batch; `offline: true` bila perangkat tidak tersambung. */
export type KirimBatch = (aksi: AksiKirim[]) => Promise<{ offline: boolean; hasil: HasilKirimBatch }>;

export interface RingkasSinkron {
  diterapkan: number;
  duplikat: number;
  ditolak: number;
  /** Aksi berstatus MENUNGGU yang tersisa. */
  sisa: number;
  offline: boolean;
  /** Kegagalan server di luar penolakan per aksi (mis. sesi habis); null bila tidak ada. */
  galatKirim: string | null;
}

export interface KeadaanAntrean {
  menunggu: number;
  ditolak: number;
}

/**
 * Antrean aksi tulis. Setiap aksi dibuat dengan idempotencyKey baru **saat tombol ditekan** (`tambah`),
 * bukan saat dikirim; kirim ulang membawa kunci yang sama sehingga server menjawab DUPLIKAT.
 */
export class Antrean {
  private urutTerakhir = 0;
  private berjalan: Promise<RingkasSinkron> | null = null;
  private pendengar = new Set<() => void>();

  constructor(
    private readonly penyimpanan: PenyimpananAntrean,
    private readonly kirim: KirimBatch,
    private readonly sekarang: () => Date = () => new Date(),
    private readonly buatKunci: () => string = () => crypto.randomUUID(),
  ) {}

  /** Berlangganan perubahan isi antrean; mengembalikan fungsi berhenti. */
  pantau(fn: () => void): () => void {
    this.pendengar.add(fn);
    return () => {
      this.pendengar.delete(fn);
    };
  }

  private beritahu(): void {
    for (const fn of this.pendengar) fn();
  }

  async tambah(jenis: JenisAksiSinkron, payload: unknown): Promise<AksiAntrean> {
    const kini = this.sekarang();
    this.urutTerakhir = Math.max(this.urutTerakhir + 1, kini.getTime() * 1000);
    const aksi: AksiAntrean = {
      idempotencyKey: this.buatKunci(),
      jenis,
      terjadiPada: kini.toISOString(),
      payload,
      urut: this.urutTerakhir,
      status: "MENUNGGU",
    };
    await this.penyimpanan.simpan(aksi);
    this.beritahu();
    return aksi;
  }

  async daftar(): Promise<AksiAntrean[]> {
    return this.penyimpanan.semua();
  }

  async keadaan(): Promise<KeadaanAntrean> {
    const semua = await this.penyimpanan.semua();
    return {
      menunggu: semua.filter((a) => a.status === "MENUNGGU").length,
      ditolak: semua.filter((a) => a.status === "DITOLAK").length,
    };
  }

  /** Buang catatan yang ditolak setelah pengguna membacanya (G_SINKRON_TOLAK). */
  async lepaskan(idempotencyKey: string): Promise<void> {
    await this.penyimpanan.hapus(idempotencyKey);
    this.beritahu();
  }

  /** Kirim semua aksi MENUNGGU (batch ≤20). Panggilan bersamaan dilebur menjadi satu. */
  sinkron(): Promise<RingkasSinkron> {
    this.berjalan ??= this.jalankan().finally(() => {
      this.berjalan = null;
    });
    return this.berjalan;
  }

  private async jalankan(): Promise<RingkasSinkron> {
    const ringkas: RingkasSinkron = { diterapkan: 0, duplikat: 0, ditolak: 0, sisa: 0, offline: false, galatKirim: null };
    for (;;) {
      const menunggu = (await this.penyimpanan.semua()).filter((a) => a.status === "MENUNGGU");
      ringkas.sisa = menunggu.length;
      if (menunggu.length === 0) break;
      const batch = menunggu.slice(0, SINKRON_BATCH_MAKS);
      const { offline, hasil } = await this.kirim(
        batch.map(({ idempotencyKey, jenis, terjadiPada, payload }) => ({ idempotencyKey, jenis, terjadiPada, payload })),
      );
      if (offline) {
        ringkas.offline = true;
        break;
      }
      if (!hasil.ok) {
        ringkas.galatKirim = hasil.galat.kode;
        break;
      }
      let maju = 0;
      for (const h of hasil.data.hasil) {
        const asal = batch.find((a) => a.idempotencyKey === h.idempotencyKey);
        if (!asal) continue;
        if (h.status === "DITOLAK") {
          const galat: GalatAntrean = { kode: h.galat?.kode ?? "GALAT_SERVER", teksAturan: h.galat?.aturan?.teks ?? null };
          await this.penyimpanan.simpan({ ...asal, status: "DITOLAK", galat });
          ringkas.ditolak += 1;
        } else {
          await this.penyimpanan.hapus(asal.idempotencyKey);
          if (h.status === "DUPLIKAT") ringkas.duplikat += 1;
          else ringkas.diterapkan += 1;
        }
        maju += 1;
      }
      this.beritahu();
      if (maju === 0) break;
    }
    ringkas.sisa = (await this.penyimpanan.semua()).filter((a) => a.status === "MENUNGGU").length;
    this.beritahu();
    return ringkas;
  }
}
