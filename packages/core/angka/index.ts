import { BERAT_G_MAKS } from "@serah/kontrak";

// Angka bisnis — integer saja (CLAUDE.md §2.1). Teks masukan diurai sebagai string digit, tidak pernah lewat float.
// Format Indonesia: koma = desimal, titik = pemisah ribuan ("1.250,5").

export type GalatAngka =
  | "KOSONG"
  | "BUKAN_ANGKA"
  | "FORMAT_RIBUAN"
  | "NEGATIF"
  | "NOL"
  | "TERLALU_BANYAK_DESIMAL"
  | "TERLALU_BESAR"
  | "DI_LUAR_RENTANG";

export type HasilAngka = { ok: true; nilai: number } | { ok: false; galat: GalatAngka };

export type SatuanBerat = "g" | "kg" | "ton";

/** Banyak digit desimal yang bermakna per satuan = log10(gram per satuan). */
const SKALA_SATUAN: Record<SatuanBerat, number> = { g: 0, kg: 3, ton: 6 };

const gagal = (galat: GalatAngka): HasilAngka => ({ ok: false, galat });

// Bagian bulat polos ("1250") atau berkelompok ribuan ("1.250.000"), lalu desimal koma opsional.
const POLA_ID = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/;
const POLA_ANGKA_KASAR = /^-?[\d.]+(?:,\d+)?$/;

/**
 * Ubah teks angka format Indonesia menjadi integer berskala 10^skala.
 * Desimal melebihi skala ditolak, kecuali sisanya nol semua.
 */
function uraiDesimalId(teks: string, skala: number, maks: bigint): HasilAngka {
  const s = teks.trim();
  if (s === "") return gagal("KOSONG");
  const m = POLA_ID.exec(s);
  if (!m) return gagal(POLA_ANGKA_KASAR.test(s) && s.includes(".") ? "FORMAT_RIBUAN" : "BUKAN_ANGKA");
  if (m[1]) return gagal("NEGATIF");

  const bulat = m[2]!.replaceAll(".", "");
  const pecahan = m[3] ?? "";
  if (pecahan.length > skala && /[^0]/.test(pecahan.slice(skala))) return gagal("TERLALU_BANYAK_DESIMAL");

  const nilai = BigInt(bulat + pecahan.slice(0, skala).padEnd(skala, "0"));
  if (nilai === 0n) return gagal("NOL");
  if (nilai > maks) return gagal("TERLALU_BESAR");
  return { ok: true, nilai: Number(nilai) };
}

/** "42,5" (kg) → 42500 (gram). Satu-satunya pintu masukan berat kg dari pengguna. */
export function parseBeratKgKeGram(teks: string): HasilAngka {
  return parseBeratTeksKeGram(teks, "kg");
}

/** Teks berat dalam satuan tertentu → gram integer. Batas atas = BERAT_G_MAKS (kontrak). */
export function parseBeratTeksKeGram(teks: string, satuan: SatuanBerat): HasilAngka {
  return uraiDesimalId(teks, SKALA_SATUAN[satuan], BigInt(BERAT_G_MAKS));
}

function wajibInteger(n: number, nama: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${nama} harus integer aman`);
}

function ribuan(digit: string): string {
  return digit.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Integer berskala → teks Indonesia, nol di belakang koma dibuang. */
function formatSkalaId(n: number, skala: number): string {
  const tanda = n < 0 ? "-" : "";
  const abs = BigInt(n < 0 ? -n : n);
  const pembagi = 10n ** BigInt(skala);
  const bulat = ribuan((abs / pembagi).toString());
  const pecahan = (abs % pembagi).toString().padStart(skala, "0").replace(/0+$/, "");
  return tanda + bulat + (pecahan ? `,${pecahan}` : "");
}

/** 42500 → "42,5"; 1250500 → "1.250,5". Satu-satunya pintu tampilan berat (tanpa satuan; lihat TEKS.UMUM_KG). */
export function formatGramKeKg(g: number): string {
  wajibInteger(g, "Berat gram");
  return formatSkalaId(g, SKALA_SATUAN.kg);
}

const KOORDINAT_DESIMAL = 6;
const POLA_KOORDINAT = /^(-)?(\d{1,3})(?:[.,](\d+))?$/;
const BATAS_E6 = { lat: 90_000_000n, lon: 180_000_000n } as const;

/**
 * Koordinat derajat desimal (titik atau koma) → derajat × 1.000.000.
 * Lebih dari 6 desimal dibulatkan setengah-menjauhi-nol (≈0,1 m), dihitung pada digit, bukan float.
 */
export function parseKoordinatKeE6(teks: string, sumbu: "lat" | "lon"): HasilAngka {
  const s = teks.trim();
  if (s === "") return gagal("KOSONG");
  const m = POLA_KOORDINAT.exec(s);
  if (!m) return gagal("BUKAN_ANGKA");
  const pecahan = m[3] ?? "";
  let mutlak = BigInt(m[2]! + pecahan.slice(0, KOORDINAT_DESIMAL).padEnd(KOORDINAT_DESIMAL, "0"));
  if (pecahan.length > KOORDINAT_DESIMAL && pecahan.charCodeAt(KOORDINAT_DESIMAL) >= "5".charCodeAt(0)) mutlak += 1n;
  if (mutlak > BATAS_E6[sumbu]) return gagal("DI_LUAR_RENTANG");
  const nilai = Number(mutlak);
  return { ok: true, nilai: m[1] && nilai !== 0 ? -nilai : nilai };
}

/** -6164532 → "-6.164532" (titik desimal, selalu 6 digit — format peta). */
export function formatE6(e6: number): string {
  wajibInteger(e6, "Koordinat e6");
  const abs = BigInt(e6 < 0 ? -e6 : e6);
  const satuan = 10n ** BigInt(KOORDINAT_DESIMAL);
  return `${e6 < 0 ? "-" : ""}${abs / satuan}.${(abs % satuan).toString().padStart(KOORDINAT_DESIMAL, "0")}`;
}

/** bagian/total dalam basis poin (10000 = 100%), dibulatkan setengah-menjauhi-nol. total ≤ 0 → null. */
export function persenBp(bagian: number, total: number): number | null {
  wajibInteger(bagian, "Bagian");
  wajibInteger(total, "Total");
  if (total <= 0) return null;
  const b = BigInt(bagian < 0 ? -bagian : bagian);
  const t = BigInt(total);
  const hasil = (2n * b * 10_000n + t) / (2n * t);
  if (hasil > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Hasil basis poin melewati integer aman");
  const n = Number(hasil);
  return bagian < 0 && n !== 0 ? -n : n;
}

/** 1250 → "12,5" (tanpa tanda %; lihat teks pemanggil). */
export function formatBp(bp: number): string {
  wajibInteger(bp, "Basis poin");
  return formatSkalaId(bp, 2);
}
