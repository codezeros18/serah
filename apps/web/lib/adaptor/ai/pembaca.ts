// Antarmuka pembaca tiket/nota timbang (BLUEPRINT §N.1). AI hanya MEMBACA; hasilnya saran berlabel
// dan manusia wajib mengonfirmasi. AI tidak pernah mengubah status, angka final, atau aturan.
import type { KeyakinanAi } from "@serah/kontrak/enum";

export type HasilBaca =
  | { tersedia: false }
  | {
      tersedia: true;
      nomorTiket: string | null;
      /** Teks berat persis seperti terbaca (kg/ton), untuk ditampilkan apa adanya. */
      beratTeks: string | null;
      satuan: "kg" | "ton" | null;
      /** Gram integer hasil parseBeratTeksKeGram; null bila tak terbaca / di luar rentang. */
      beratG: number | null;
      tanggalTeks: string | null;
      keyakinan: KeyakinanAi;
      model: string;
    };

export interface PembacaTiket {
  baca(foto: Buffer, mime: string): Promise<HasilBaca>;
}

/** Jalur manual selalu ada: tidak pernah tersedia. */
export class ManualPembaca implements PembacaTiket {
  baca(_foto: Buffer, _mime: string): Promise<HasilBaca> {
    return Promise.resolve({ tersedia: false });
  }
}

/** Dilempar saat kedua model gagal → rute memetakan ke AI_TIDAK_TERSEDIA. */
export class AiTidakTersedia extends Error {
  constructor(pesan = "AI_TIDAK_TERSEDIA") {
    super(pesan);
    this.name = "AiTidakTersedia";
  }
}
