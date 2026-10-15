import { ALIRAN, type Aliran, type JenisEvent, type KodeAturan, type KodeGalat, type StatusSerah } from "@serah/kontrak";
import type {
  AksiTransisi,
  EventBaru,
  GalatTransisi,
  HasilAturanKonteks,
  HasilTransisi,
  JenisAksiTransisi,
  JenisTutup,
  KonteksTransisi,
  NilaiTertutup,
  PeranPelaku,
  ProyeksiSerah,
  RincianTutup,
  SebabTransisi,
  SerahKini,
} from "./jenis";

export type * from "./jenis";

// Mesin status serah — BLUEPRINT §I. Satu-satunya tempat aturan transisi; dipanggil hanya oleh layananTransisi.
// Murni: menerima `sekarang`, tidak membaca jam, tidak mengubah masukan. Aturan berpasal (R-xx) dievaluasi
// oleh core/aturan; hasilnya masuk lewat `konteks.aturan`.

/** Panjang minimum alasan KEMBALIKAN (§I.1, bukan ambang aturan §J). */
export const ALASAN_KEMBALIKAN_MIN = 5;

type Definisi = {
  dari: readonly StatusSerah[];
  peran: readonly PeranPelaku[];
  ke: StatusSerah | "TETAP";
  event: JenisEvent;
};

/** Tabel §I.1 (BUAT ditangani terpisah karena belum ada serah). */
export const TABEL_TRANSISI: Record<Exclude<JenisAksiTransisi, "BUAT">, Definisi> = {
  AMBIL: { dari: ["DRAF"], peran: ["PENGANGKUT"], ke: "MENUNGGU_SETUJU", event: "SERAH_DIAMBIL" },
  SETUJUI: { dari: ["MENUNGGU_SETUJU"], peran: ["PENGELOLA"], ke: "DIANGKUT", event: "SERAH_DISETUJUI" },
  KEMBALIKAN: { dari: ["MENUNGGU_SETUJU"], peran: ["PENGELOLA"], ke: "DRAF", event: "SERAH_DIKEMBALIKAN" },
  TUTUP_TERIMA: { dari: ["DIANGKUT", "MENGGANTUNG"], peran: ["PENERIMA"], ke: "DITERIMA", event: "SERAH_DITERIMA" },
  TUTUP_SEBAGIAN: { dari: ["DIANGKUT", "MENGGANTUNG"], peran: ["PENERIMA"], ke: "DITERIMA_SEBAGIAN", event: "SERAH_DITERIMA_SEBAGIAN" },
  TUTUP_TOLAK: { dari: ["DIANGKUT", "MENGGANTUNG"], peran: ["PENERIMA"], ke: "DITOLAK", event: "SERAH_DITOLAK" },
  TANDAI_MENGGANTUNG: { dari: ["DIANGKUT"], peran: ["SISTEM"], ke: "MENGGANTUNG", event: "SERAH_MENGGANTUNG" },
  KOREKSI_BERAT: { dari: ["DITERIMA", "DITERIMA_SEBAGIAN"], peran: ["PENERIMA"], ke: "TETAP", event: "KOREKSI_BERAT" },
};

const PERAN_BUAT: readonly PeranPelaku[] = ["PETUGAS", "PENGELOLA"];

/** Urutan guard aturan saat AMBIL (§I.1), setelah foto (R-04) dan kendaraan. */
const URUTAN_ATURAN_AMBIL: readonly KodeAturan[] = ["R01", "R02", "R03", "R11"];

// ── Pembantu ──────────────────────────────────────────────────────────────

type Gagal = { ok: false; galat: GalatTransisi };

const tolak = (kode: KodeGalat, sebab: SebabTransisi, aturan?: HasilAturanKonteks): Gagal => ({
  ok: false,
  galat: aturan ? { kode, sebab, aturan } : { kode, sebab },
});
const validasi = (sebab: SebabTransisi) => tolak("VALIDASI_GAGAL", sebab);
const bukanPihak = () => tolak("PERAN_TIDAK_BOLEH", "BUKAN_PIHAK");

const pihak = (orgId: string | null, k: KonteksTransisi) => orgId !== null && k.pelaku.orgIds.includes(orgId);
const panjangTeks = (s: string) => [...s.trim()].length;
const gramSah = (n: number) => Number.isSafeInteger(n) && n >= 0;
const urutAliran = (a: Aliran, b: Aliran) => ALIRAN.indexOf(a) - ALIRAN.indexOf(b);
const jumlah = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

function aturanTolak(k: KonteksTransisi, kode: KodeAturan): HasilAturanKonteks | undefined {
  return k.aturan?.find((a) => a.kode === kode && a.aksi === "TOLAK");
}

/**
 * Syarat Σ per status tertutup (§I.1 baris 5–7), dipakai saat menutup dan saat koreksi (status tetap).
 * Mengembalikan sebab gagal atau null.
 */
function periksaSigma(jenis: JenisTutup, beratTiketG: number, rincian: readonly { diterimaG: number; ditolakG: number; alasan?: string | null | undefined }[]): SebabTransisi | null {
  const diterima = jumlah(rincian.map((r) => r.diterimaG));
  const ditolak = jumlah(rincian.map((r) => r.ditolakG));
  switch (jenis) {
    case "TUTUP_TERIMA":
      if (ditolak !== 0) return "DITOLAK_ADA";
      if (diterima !== beratTiketG) return "JUMLAH_TIDAK_SAMA";
      return null;
    case "TUTUP_SEBAGIAN":
      if (ditolak === 0) return "DITOLAK_KOSONG";
      if (rincian.some((r) => r.ditolakG > 0 && !r.alasan)) return "ALASAN_TOLAK_KURANG";
      if (diterima + ditolak !== beratTiketG) return "JUMLAH_TIDAK_SAMA";
      return null;
    case "TUTUP_TOLAK":
      if (diterima !== 0) return "DITERIMA_ADA";
      if (rincian.some((r) => !r.alasan)) return "ALASAN_TOLAK_KURANG";
      // Keputusan pemilik 15 Okt 2026 (S08): tolak penuh juga wajib seimbang dengan tiket.
      if (ditolak !== beratTiketG) return "JUMLAH_TIDAK_SAMA";
      return null;
  }
}

const TUTUP_UNTUK_STATUS: Partial<Record<StatusSerah, JenisTutup>> = {
  DITERIMA: "TUTUP_TERIMA",
  DITERIMA_SEBAGIAN: "TUTUP_SEBAGIAN",
  DITOLAK: "TUTUP_TOLAK",
};

/** Server menurunkan jenis penutupan dari rincian (klien tidak mengirim status hasil). */
export function jenisTutup(rincian: readonly RincianTutup[]): JenisTutup {
  const diterima = jumlah(rincian.map((r) => r.diterimaG));
  const ditolak = jumlah(rincian.map((r) => r.ditolakG));
  if (ditolak === 0) return "TUTUP_TERIMA";
  if (diterima === 0) return "TUTUP_TOLAK";
  return "TUTUP_SEBAGIAN";
}

// ── Guard per aksi → payload event & proyeksi ─────────────────────────────

type Lolos = { ok: true; payload: Record<string, unknown>; proyeksi: ProyeksiSerah };
type HasilGuard = Lolos | Gagal;
const lolos = (payload: Record<string, unknown>, proyeksi: ProyeksiSerah = {}): Lolos => ({ ok: true, payload, proyeksi });

function guardBuat(aksi: Extract<AksiTransisi, { jenis: "BUAT" }>, k: KonteksTransisi): HasilGuard {
  if (!pihak(aksi.orgKawasanId, k)) return bukanPihak();
  if (aksi.wadahIds.length === 0) return validasi("WADAH_KOSONG");
  if (new Set(aksi.wadahIds).size !== aksi.wadahIds.length) return validasi("WADAH_GANDA");
  const peta = new Map((k.wadah ?? []).map((w) => [w.id, w]));
  const wadah = aksi.wadahIds.map((id) => peta.get(id));
  if (wadah.some((w) => w === undefined)) return validasi("WADAH_TIDAK_DIKENAL");
  const ada = wadah as NonNullable<(typeof wadah)[number]>[];
  if (ada.some((w) => w.tpsId !== aksi.tpsId)) return validasi("WADAH_BUKAN_TPS");
  if (ada.some((w) => w.diSerahLain)) return validasi("WADAH_SUDAH_DISERAH");
  const aliran = [...new Set(ada.map((w) => w.aliran))].sort(urutAliran);
  return lolos({ tpsId: aksi.tpsId, wadahIds: [...aksi.wadahIds].sort() }, { aliran });
}

function guardAmbil(aksi: Extract<AksiTransisi, { jenis: "AMBIL" }>, k: KonteksTransisi): HasilGuard {
  // 1. Foto MUATAN baru (R-04)
  const foto = k.foto;
  if (!foto || foto.id !== aksi.fotoId || foto.jenis !== "MUATAN" || !pihak(foto.organisasiId, k)) return validasi("FOTO_TIDAK_SAH");
  const r04 = aturanTolak(k, "R04");
  if (!foto.r04Lolos || r04) return tolak("ATURAN_DITOLAK", "ATURAN", { kode: "R04", aksi: "TOLAK" });
  // 2. Kendaraan milik organisasinya & aktif
  const kend = k.kendaraan;
  if (!kend || kend.id !== aksi.kendaraanId || !kend.aktif || !pihak(kend.organisasiId, k)) return validasi("KENDARAAN_TIDAK_SAH");
  // 3. R-01 · R-02 · R-03 · R-11
  for (const kode of URUTAN_ATURAN_AMBIL) {
    const a = aturanTolak(k, kode);
    if (a) return tolak("ATURAN_DITOLAK", "ATURAN", { kode: a.kode, aksi: a.aksi });
  }
  return lolos(
    { fotoId: aksi.fotoId, kendaraanId: aksi.kendaraanId, penerimaId: aksi.penerimaId },
    { orgPengangkutId: kend.organisasiId, orgPenerimaId: aksi.penerimaId, kendaraanId: aksi.kendaraanId },
  );
}

function guardTutup(serah: SerahKini, aksi: Extract<AksiTransisi, { jenis: JenisTutup }>, k: KonteksTransisi): HasilGuard {
  if (!pihak(serah.orgPenerimaId, k)) return bukanPihak();
  const tiket = aksi.tiket;
  if (!tiket || !Number.isSafeInteger(tiket.beratG) || tiket.beratG < 1) return validasi("TIKET_TIDAK_ADA");
  const r = aksi.rincian;
  const aliranRincian = r.map((x) => x.aliran);
  const cocok =
    new Set(aliranRincian).size === r.length &&
    r.length === serah.aliran.length &&
    serah.aliran.every((a) => aliranRincian.includes(a));
  if (!cocok) return validasi("RINCIAN_ALIRAN");
  if (r.some((x) => !gramSah(x.diterimaG) || !gramSah(x.ditolakG))) return validasi("NILAI_TIDAK_SAH");
  const sebab = periksaSigma(aksi.jenis, tiket.beratG, r);
  if (sebab) return validasi(sebab);
  return lolos({
    tiket: { beratG: tiket.beratG, fotoId: tiket.fotoId ?? null, nomor: tiket.nomor ?? null, sumber: tiket.sumber },
    rincian: [...r]
      .sort((a, b) => urutAliran(a.aliran, b.aliran))
      .map((x) => ({ aliran: x.aliran, alasan: x.alasan ?? null, diterimaG: x.diterimaG, ditolakG: x.ditolakG })),
  });
}

function guardKoreksi(serah: SerahKini, aksi: Extract<AksiTransisi, { jenis: "KOREKSI_BERAT" }>, k: KonteksTransisi): HasilGuard {
  if (!pihak(serah.orgPenerimaId, k)) return bukanPihak();
  if (panjangTeks(aksi.alasan) === 0) return validasi("ALASAN_KURANG");
  if (aksi.perubahan.length === 0) return validasi("PERUBAHAN_KOSONG");
  if (aksi.perubahan.some((p) => !gramSah(p.nilaiFinalG))) return validasi("NILAI_TIDAK_SAH");
  const nilai: NilaiTertutup | null | undefined = k.nilaiTertutup;
  if (!nilai) return validasi("TARGET_TIDAK_DIKENAL");

  // Terapkan perubahan pada salinan nilai final saat ini.
  let tiketG = nilai.tiket.beratG;
  const rincian = nilai.rincian.map((x) => ({ ...x }));
  const catatan: Record<string, unknown>[] = [];
  for (const p of aksi.perubahan) {
    let asli: number;
    if (p.target === "TIKET") {
      if (p.targetId !== nilai.tiket.id) return validasi("TARGET_TIDAK_DIKENAL");
      asli = tiketG;
      tiketG = p.nilaiFinalG;
    } else {
      const baris = rincian.find((x) => x.id === p.targetId);
      if (!baris) return validasi("TARGET_TIDAK_DIKENAL");
      const kolom = p.target === "RINCIAN_DITERIMA" ? "diterimaG" : "ditolakG";
      asli = baris[kolom];
      baris[kolom] = p.nilaiFinalG;
    }
    catatan.push({ nilaiAsliG: asli, nilaiFinalG: p.nilaiFinalG, target: p.target, targetId: p.targetId });
  }

  // Konsistensi Σ tetap: syarat status saat ini harus tetap terpenuhi sesudah koreksi.
  const jenis = TUTUP_UNTUK_STATUS[serah.status];
  if (jenis) {
    const sebab = periksaSigma(jenis, tiketG, rincian);
    if (sebab === "ALASAN_TOLAK_KURANG") return validasi(sebab);
    if (sebab) return validasi("SIGMA_TIDAK_KONSISTEN");
  }
  return lolos({ alasan: aksi.alasan.trim(), perubahan: catatan });
}

// ── Pintu tunggal ─────────────────────────────────────────────────────────

/**
 * Terapkan satu aksi pada serah. Urutan pemeriksaan: status asal → peran → pihak → guard §I.1 (berurutan).
 * `serah = null` hanya untuk BUAT. Hasil sukses berisi status & versi baru, kolom proyeksi yang berubah,
 * dan event (belum ber-hash; layananTransisi menautkannya ke rantai kawasan).
 */
export function terapkanTransisi(serah: SerahKini | null, aksi: AksiTransisi, konteks: KonteksTransisi, sekarang: Date): HasilTransisi {
  const peran = konteks.pelaku.peran;
  const event = (jenis: JenisEvent, serahKode: string, payload: Record<string, unknown>): EventBaru => ({
    jenis,
    peran,
    serahKode,
    payload,
    terjadiPada: konteks.terjadiPada ?? sekarang,
    diterimaPada: sekarang,
  });

  if (aksi.jenis === "BUAT") {
    if (serah !== null) return tolak("TRANSISI_TIDAK_SAH", "STATUS_TIDAK_COCOK");
    if (!PERAN_BUAT.includes(peran)) return tolak("PERAN_TIDAK_BOLEH", "PERAN");
    const g = guardBuat(aksi, konteks);
    if (!g.ok) return g;
    return { ok: true, statusBaru: "DRAF", versiBaru: 1, proyeksi: g.proyeksi, event: event("SERAH_DIBUAT", aksi.kode, g.payload) };
  }

  const def = TABEL_TRANSISI[aksi.jenis];
  if (serah === null || !def.dari.includes(serah.status)) return tolak("TRANSISI_TIDAK_SAH", "STATUS_TIDAK_COCOK");
  if (!def.peran.includes(peran)) return tolak("PERAN_TIDAK_BOLEH", "PERAN");

  let g: HasilGuard;
  switch (aksi.jenis) {
    case "AMBIL":
      g = guardAmbil(aksi, konteks);
      break;
    case "SETUJUI":
      g = pihak(serah.orgKawasanId, konteks) ? lolos({}) : bukanPihak();
      break;
    case "KEMBALIKAN":
      if (!pihak(serah.orgKawasanId, konteks)) g = bukanPihak();
      else if (panjangTeks(aksi.alasan) < ALASAN_KEMBALIKAN_MIN) g = validasi("ALASAN_KURANG");
      else g = lolos({ alasan: aksi.alasan.trim() }, { orgPengangkutId: null, orgPenerimaId: null, kendaraanId: null });
      break;
    case "TUTUP_TERIMA":
    case "TUTUP_SEBAGIAN":
    case "TUTUP_TOLAK":
      g = guardTutup(serah, aksi, konteks);
      break;
    case "TANDAI_MENGGANTUNG":
      g = konteks.aturan?.some((a) => a.kode === "R07" && a.aksi === "STATUS") ? lolos({}) : tolak("TRANSISI_TIDAK_SAH", "R07_BELUM");
      break;
    case "KOREKSI_BERAT":
      g = guardKoreksi(serah, aksi, konteks);
      break;
  }
  if (!g.ok) return g;

  return {
    ok: true,
    statusBaru: def.ke === "TETAP" ? serah.status : def.ke,
    versiBaru: serah.versi + 1,
    proyeksi: g.proyeksi,
    event: event(def.event, serah.kode, g.payload),
  };
}
