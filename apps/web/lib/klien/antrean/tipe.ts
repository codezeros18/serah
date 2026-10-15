import type { JenisAksiSinkron } from "@serah/kontrak";

// Antrean offline (BLUEPRINT §F.6). Aksi tulis dari perangkat disimpan di IndexedDB dengan
// idempotencyKey yang dibuat di perangkat saat tombol ditekan, lalu dikirim batch ke /api/sinkron.

export type StatusAntrean = "MENUNGGU" | "DITOLAK";

export interface GalatAntrean {
  kode: string;
  /** Teks aturan dari server bila ada (R-xx), selain itu null. */
  teksAturan: string | null;
}

export interface AksiAntrean {
  idempotencyKey: string;
  jenis: JenisAksiSinkron;
  /** Waktu perangkat saat tombol ditekan (ISO UTC). Tidak pernah menimpa waktu server. */
  terjadiPada: string;
  payload: unknown;
  /** Urutan lokal menaik; menentukan urutan kirim. */
  urut: number;
  status: StatusAntrean;
  galat?: GalatAntrean;
}

export interface PenyimpananAntrean {
  simpan(aksi: AksiAntrean): Promise<void>;
  /** Semua aksi, urut menaik menurut `urut`. */
  semua(): Promise<AksiAntrean[]>;
  hapus(idempotencyKey: string): Promise<void>;
}
