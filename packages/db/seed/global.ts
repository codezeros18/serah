import { TEKS } from "@serah/kontrak/teks";
import { idBaru, sisip, type Klien } from "./alat.ts";

// Seed global (selalu, idempoten): teks persetujuan, paket & hak (FITUR §3), alasan tolak, aturan berpasal (§J),
// harga material (RISET §5).

export const VERSI_PERSETUJUAN = "PRIV-2026-10-1";

/** FITUR §3.1 — data apa adanya. */
const PAKET = [
  { kode: "KAWASAN_UJI_COBA", urutan: 1, harga: 0, untuk: "KAWASAN" },
  { kode: "KAWASAN_STANDAR", urutan: 2, harga: 350000, untuk: "KAWASAN" },
  { kode: "KAWASAN_DASAR", urutan: 3, harga: 0, untuk: "KAWASAN" },
  { kode: "MITRA", urutan: 4, harga: 0, untuk: "PENGANGKUT" },
  { kode: "INTERNAL", urutan: 5, harga: 0, untuk: "INTERNAL" },
] as const;

/** FITUR §3.2 — urutan kolom: UJI_COBA, STANDAR, DASAR, MITRA, INTERNAL (null = tak terbatas). */
const HAK: Record<string, [unknown, unknown, unknown, unknown, unknown]> = {
  "tps.maks": [10, null, null, 0, null],
  "anggota.maks": [null, null, null, null, null],
  "ekspor.pdf": [true, true, false, true, true],
  lembar_neraca: [true, true, false, false, true],
  mode_bayangan: [true, true, false, false, true],
  tagihan_angkut: [true, true, false, true, true],
  "notifikasi.email": [true, true, false, true, true],
  "notifikasi.push": [true, true, true, true, true],
};

/**
 * BLUEPRINT §J (kode, sumber, aksi, ambang). Diisi dari tabel §J karena core/aturan/daftar.ts (S03) belum MERGED —
 * DICEK ULANG DI S28 terhadap daftar.ts. NASIONAL hanya aturan yang tidak bergantung pasal Pergub DKI.
 */
const ATURAN = [
  { kode: "R01", sumber: "Pergub 102 Ps. 20(2)(d)", aksi: "TOLAK", ambang: {}, teks: "ATURAN_R01", nasional: false },
  { kode: "R02", sumber: "Pergub 102 Ps. 20(2)(b)", aksi: "TOLAK", ambang: {}, teks: "ATURAN_R02", nasional: false },
  { kode: "R03", sumber: "Pergub 102 Ps. 19(2)(c)", aksi: "TOLAK", ambang: {}, teks: "ATURAN_R03", nasional: false },
  { kode: "R04", sumber: "Integritas bukti", aksi: "TOLAK", ambang: { R04_AMBANG_BIT: 6, R04_JENDELA_HARI: 30 }, teks: "ATURAN_R04", nasional: true },
  { kode: "R05", sumber: "Pergub 102 Ps. 8(1)(g)", aksi: "PERINGATAN", ambang: { R05_JAM: 72 }, teks: "ATURAN_R05", nasional: false },
  { kode: "R06", sumber: "Pergub 102 Ps. 8(1)(h)", aksi: "PERINGATAN", ambang: { R06_JAM: 24 }, teks: "ATURAN_R06", nasional: false },
  { kode: "R07", sumber: "Integritas serah", aksi: "STATUS", ambang: { R07_JAM: 12 }, teks: "ATURAN_R07", nasional: true },
  { kode: "R08", sumber: "Integritas berat", aksi: "PERINGATAN", ambang: { R08_BP: 2000 }, teks: "ATURAN_R08", nasional: true },
  { kode: "R09", sumber: "Pergub 102 Ps. 13(4)(a)", aksi: "PERINGATAN", ambang: { R09_JAM_WIB: 20 }, teks: "ATURAN_R09", nasional: false },
  {
    kode: "R10",
    sumber: "Data BMKG + Pergub 102 Ps. 8",
    aksi: "PRIORITAS",
    ambang: { R10_HORIZON_JAM: 6, R10_UMUR_JAM: 24, R10_BASI_JAM: 12, R10_KATA_HUJAN: ["Hujan Lebat", "Hujan Petir"] },
    teks: "ATURAN_R10_PRAKIRAAN",
    nasional: true,
  },
  { kode: "R11", sumber: "Pergub 102 Ps. 1 angka 21", aksi: "TOLAK", ambang: {}, teks: "ATURAN_R11", nasional: false },
] as const;

/** RISET §5 — satu-satunya sumber harga material. Tanggal ditulis apa adanya (sebagian [GAP-HM-01]). */
const HARGA = [
  { kode: "R-HM-01", kunci: "kardus", bersih: 1300, kotor: null, tanggal: null },
  { kode: "R-HM-02", kunci: "pet_bening", bersih: 2000, kotor: 1200, tanggal: "2024-07-10" },
  { kode: "R-HM-03", kunci: "aluminium", bersih: 10500, kotor: null, tanggal: "2025-04/2026-04" },
  { kode: "R-HM-04", kunci: "plastik_kemasan", bersih: 1500, kotor: null, tanggal: null },
] as const;

const ALASAN = ["TERCAMPUR_ORGANIK", "BASAH_KOTOR", "JENIS_TIDAK_SESUAI", "RESIDU_BERLEBIH", "LAINNYA"] as const;

export async function seedGlobal(k: Klien): Promise<void> {
  await sisip(
    k,
    "teks_persetujuan",
    { versi: VERSI_PERSETUJUAN, isi: TEKS.SETUJU_ISI_LAYANAN, berlaku_dari: "2026-10-15T00:00:00+07:00" },
    { abaikanKonflik: true },
  );

  for (const p of PAKET) {
    await sisip(k, "paket", { kode: p.kode, urutan: p.urutan, harga_per_tps_idr: p.harga, berlaku_untuk: p.untuk, aktif: true }, { abaikanKonflik: true });
  }
  for (const [kunci, nilai] of Object.entries(HAK)) {
    for (const [i, p] of PAKET.entries()) {
      await sisip(k, "entitlement", { paket_kode: p.kode, kunci, nilai: nilai[i] }, { json: ["nilai"], abaikanKonflik: true });
    }
  }

  for (const [i, kode] of ALASAN.entries()) await sisip(k, "alasan_tolak", { kode, urutan: i + 1 }, { abaikanKonflik: true });

  for (const a of ATURAN) {
    for (const yurisdiksi of a.nasional ? ["DKI", "NASIONAL"] : ["DKI"]) {
      await sisip(
        k,
        "aturan_versi",
        {
          id: idBaru(),
          kode: a.kode,
          yurisdiksi,
          versi: 1,
          sumber: a.sumber,
          aksi: a.aksi,
          ambang: a.ambang,
          kunci_teks: a.teks,
          berlaku_dari: "2026-10-14T00:00:00+07:00",
        },
        { json: ["ambang"], abaikanKonflik: true },
      );
    }
  }

  for (const h of HARGA) {
    const ada = await k.query(`SELECT 1 FROM harga_material WHERE sumber_kode = $1`, [h.kode]);
    if (ada.rowCount) continue;
    await sisip(k, "harga_material", {
      id: idBaru(),
      kunci: h.kunci,
      aliran: "KUNING",
      harga_bersih_idr_per_kg: h.bersih,
      harga_kotor_idr_per_kg: h.kotor,
      sumber_kode: h.kode,
      tanggal_sumber: h.tanggal,
    });
  }
}
