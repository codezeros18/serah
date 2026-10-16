// Pemetaan kode wilayah BMKG (adm4 "31.71.03.1001": dua angka pertama = provinsi, kode BPS/Kemendagri) ke nama
// provinsi seperti tertulis di judul peringatan dini BMKG ("… di DKI Jakarta"). Dicocokkan tanpa membedakan huruf
// besar-kecil. Nama yang tak cocok berarti peringatan itu tidak tercakup — tidak pernah ditebak.
const PROVINSI_PER_KODE: Readonly<Record<string, string>> = {
  "11": "Aceh",
  "12": "Sumatera Utara",
  "13": "Sumatera Barat",
  "14": "Riau",
  "15": "Jambi",
  "16": "Sumatera Selatan",
  "17": "Bengkulu",
  "18": "Lampung",
  "19": "Kep. Bangka Belitung",
  "21": "Kep. Riau",
  "31": "DKI Jakarta",
  "32": "Jawa Barat",
  "33": "Jawa Tengah",
  "34": "DI Yogyakarta",
  "35": "Jawa Timur",
  "36": "Banten",
  "51": "Bali",
  "52": "Nusa Tenggara Barat",
  "53": "Nusa Tenggara Timur",
  "61": "Kalimantan Barat",
  "62": "Kalimantan Tengah",
  "63": "Kalimantan Selatan",
  "64": "Kalimantan Timur",
  "65": "Kalimantan Utara",
  "71": "Sulawesi Utara",
  "72": "Sulawesi Tengah",
  "73": "Sulawesi Selatan",
  "74": "Sulawesi Tenggara",
  "75": "Gorontalo",
  "76": "Sulawesi Barat",
  "81": "Maluku",
  "82": "Maluku Utara",
  "91": "Papua",
  "92": "Papua Barat",
};

/** Nama provinsi untuk satu kode adm4; null bila kode tidak dikenal. */
export function provinsiDariAdm4(adm4: string): string | null {
  const kode = /^(\d{2})(?:\.|$)/.exec(adm4.trim())?.[1];
  return kode ? (PROVINSI_PER_KODE[kode] ?? null) : null;
}

/** Himpunan provinsi unik (urut abjad) dari daftar adm4. */
export function provinsiUnik(daftarAdm4: readonly string[]): string[] {
  return [...new Set(daftarAdm4.map(provinsiDariAdm4).filter((p): p is string => p !== null))].sort();
}
