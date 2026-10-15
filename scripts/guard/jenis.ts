// Tipe bersama guard. Setiap guard = fungsi murni atas daftar berkas → temuan.

export type Berkas = {
  /** Jalur relatif akar repo, pemisah `/`. */
  jalur: string;
  isi: string;
};

export type Konteks = {
  /** Berkas teks di repo (ter-track + belum ter-track yang tidak di-ignore). */
  berkas: Berkas[];
  /** Jalur yang ter-track git (`git ls-files`). */
  tertrack: string[];
};

export type Temuan = {
  berkas: string;
  baris?: number;
  pesan: string;
};

export type HasilGuard = { status: "diperiksa"; temuan: Temuan[] } | { status: "dilewati"; sebab: string };

export type Guard = {
  kode: string;
  nama: string;
  keterangan: string;
  periksa: (k: Konteks) => HasilGuard;
};
