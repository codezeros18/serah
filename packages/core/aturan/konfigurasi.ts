// Satu-satunya tempat ambang aturan berpasal (CLAUDE.md §2.3, BLUEPRINT §J).
// Mengubah nilai di sini = versi aturan baru; angka ambang di berkas lain digagalkan guard (l).

export const KONFIGURASI_ATURAN = {
  /** R-04: jarak Hamming dHash ≤ ambang dianggap foto yang sama. */
  R04_AMBANG_BIT: 6,
  /** R-04: jendela pembanding foto MUATAN, dalam hari. */
  R04_JENDELA_HARI: 30,
  /** R-05: batas jam wadah KUNING/MERAH/ABU belum diangkut. */
  R05_JAM: 72,
  /** R-06: batas jam wadah HIJAU belum diangkut. */
  R06_JAM: 24,
  /** R-07: batas jam DIANGKUT sejak SERAH_DISETUJUI sebelum MENGGANTUNG. */
  R07_JAM: 12,
  /** R-08: selisih berat tiket vs Σ TPS, basis poin (10000 = 100%). */
  R08_BP: 2000,
  /** R-09: jam WIB batas catatan harian. */
  R09_JAM_WIB: 20,
  /** R-10: horizon slot prakiraan, jam. */
  R10_HORIZON_JAM: 6,
  /** R-10: umur minimum wadah KUNING/ABU, jam. */
  R10_UMUR_JAM: 24,
  /** R-10: prakiraan lebih tua dari ini (dari analysis_date) dianggap basi, jam. */
  R10_BASI_JAM: 12,
  /** R-10: weather_desc yang memicu prioritas (awal; diperbarui setelah snapshot P-03). */
  R10_KATA_HUJAN: ["Hujan Lebat", "Hujan Petir"],
} as const;

export interface KonfigurasiAturan {
  readonly R04_AMBANG_BIT: number;
  readonly R04_JENDELA_HARI: number;
  readonly R05_JAM: number;
  readonly R06_JAM: number;
  readonly R07_JAM: number;
  readonly R08_BP: number;
  readonly R09_JAM_WIB: number;
  readonly R10_HORIZON_JAM: number;
  readonly R10_UMUR_JAM: number;
  readonly R10_BASI_JAM: number;
  readonly R10_KATA_HUJAN: readonly string[];
}
