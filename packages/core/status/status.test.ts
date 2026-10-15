import { describe, expect, it } from "vitest";
import { STATUS_SERAH, type StatusSerah } from "@serah/kontrak";
import { kanonis } from "../rantai";
import { jenisTutup, terapkanTransisi } from "./index";
import type { AksiTransisi, HasilTransisi, JenisAksiTransisi, KonteksTransisi, Pelaku, RincianTutup, SerahKini } from "./index";

// T13 — setiap baris tabel transisi BLUEPRINT §I.1 + kasus tepi §I.2 + transisi tak sah ditolak.

const SEKARANG = new Date("2026-10-15T03:00:00.000Z");
const ORG_K = "orgkawasan01";
const ORG_A = "organgkut01";
const ORG_P = "orgpenerima01";
const ORG_LAIN = "orglain01";

const petugas: Pelaku = { peran: "PETUGAS", orgIds: [ORG_K] };
const pengelola: Pelaku = { peran: "PENGELOLA", orgIds: [ORG_K] };
const pengangkut: Pelaku = { peran: "PENGANGKUT", orgIds: [ORG_A] };
const penerima: Pelaku = { peran: "PENERIMA", orgIds: [ORG_P] };
const sistem: Pelaku = { peran: "SISTEM", orgIds: [] };

function serah(status: StatusSerah, ubah: Partial<SerahKini> = {}): SerahKini {
  const sudahDiambil = status !== "DRAF";
  return {
    kode: "SRH-20261015-0001",
    status,
    versi: 3,
    tpsId: "tps01",
    orgKawasanId: ORG_K,
    orgPengangkutId: sudahDiambil ? ORG_A : null,
    orgPenerimaId: sudahDiambil ? ORG_P : null,
    aliran: ["KUNING", "ABU"],
    ...ubah,
  };
}

function gagal(h: HasilTransisi) {
  if (h.ok) throw new Error(`diharapkan gagal, malah ${h.statusBaru}`);
  return h.galat;
}
function sukses(h: HasilTransisi) {
  if (!h.ok) throw new Error(`diharapkan sukses, malah ${h.galat.kode}/${h.galat.sebab}`);
  return h;
}

// ── Konteks & aksi contoh ──────────────────────────────────────────────────

const aksiBuat: AksiTransisi = { jenis: "BUAT", kode: "SRH-20261015-0001", tpsId: "tps01", orgKawasanId: ORG_K, wadahIds: ["w2", "w1"] };
const konteksBuat = (ubah: Partial<KonteksTransisi> = {}): KonteksTransisi => ({
  pelaku: petugas,
  wadah: [
    { id: "w1", tpsId: "tps01", aliran: "KUNING", diSerahLain: false },
    { id: "w2", tpsId: "tps01", aliran: "ABU", diSerahLain: false },
  ],
  ...ubah,
});

const aksiAmbil: AksiTransisi = { jenis: "AMBIL", fotoId: "foto01", kendaraanId: "kend01", penerimaId: ORG_P };
const konteksAmbil = (ubah: Partial<KonteksTransisi> = {}): KonteksTransisi => ({
  pelaku: pengangkut,
  foto: { id: "foto01", jenis: "MUATAN", organisasiId: ORG_A, r04Lolos: true },
  kendaraan: { id: "kend01", organisasiId: ORG_A, aktif: true },
  aturan: [],
  ...ubah,
});

const terima: RincianTutup[] = [
  { aliran: "KUNING", diterimaG: 300_000, ditolakG: 0 },
  { aliran: "ABU", diterimaG: 200_000, ditolakG: 0 },
];
const sebagian: RincianTutup[] = [
  { aliran: "KUNING", diterimaG: 250_000, ditolakG: 50_000, alasan: "TERCAMPUR_ORGANIK" },
  { aliran: "ABU", diterimaG: 200_000, ditolakG: 0 },
];
const tolak: RincianTutup[] = [
  { aliran: "KUNING", diterimaG: 0, ditolakG: 300_000, alasan: "BASAH_KOTOR" },
  { aliran: "ABU", diterimaG: 0, ditolakG: 200_000, alasan: "JENIS_TIDAK_SESUAI" },
];
const tiket = { beratG: 500_000, nomor: "TT-123", sumber: "MANUAL" as const };
const tutup = (jenis: "TUTUP_TERIMA" | "TUTUP_SEBAGIAN" | "TUTUP_TOLAK", rincian: RincianTutup[], t: typeof tiket | null = tiket): AksiTransisi => ({
  jenis,
  tiket: t,
  rincian,
});

const nilaiTertutup = (status: "DITERIMA" | "DITERIMA_SEBAGIAN") => ({
  tiket: { id: "tiket01", beratG: 500_000 },
  rincian:
    status === "DITERIMA"
      ? [
          { id: "r1", aliran: "KUNING" as const, diterimaG: 300_000, ditolakG: 0, alasan: null },
          { id: "r2", aliran: "ABU" as const, diterimaG: 200_000, ditolakG: 0, alasan: null },
        ]
      : [
          { id: "r1", aliran: "KUNING" as const, diterimaG: 250_000, ditolakG: 50_000, alasan: "TERCAMPUR_ORGANIK" as const },
          { id: "r2", aliran: "ABU" as const, diterimaG: 200_000, ditolakG: 0, alasan: null },
        ],
});

// ── Baris §I.1 ─────────────────────────────────────────────────────────────

describe("T13 baris 1: — BUAT → DRAF (PETUGAS, PENGELOLA)", () => {
  it("petugas membuat serah dari wadah TPS-nya", () => {
    const h = sukses(terapkanTransisi(null, aksiBuat, konteksBuat(), SEKARANG));
    expect(h.statusBaru).toBe("DRAF");
    expect(h.versiBaru).toBe(1);
    expect(h.event.jenis).toBe("SERAH_DIBUAT");
    expect(h.event.peran).toBe("PETUGAS");
    expect(h.event.serahKode).toBe("SRH-20261015-0001");
    expect(h.event.payload).toEqual({ tpsId: "tps01", wadahIds: ["w1", "w2"] });
    expect(h.proyeksi.aliran).toEqual(["KUNING", "ABU"]);
  });
  it("pengelola juga boleh", () => {
    expect(sukses(terapkanTransisi(null, aksiBuat, konteksBuat({ pelaku: pengelola }), SEKARANG)).statusBaru).toBe("DRAF");
  });
  it("peran lain ditolak", () => {
    for (const p of [pengangkut, penerima, sistem]) {
      expect(gagal(terapkanTransisi(null, aksiBuat, konteksBuat({ pelaku: p }), SEKARANG))).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "PERAN" });
    }
  });
  it("petugas kawasan lain ditolak", () => {
    const g = gagal(terapkanTransisi(null, aksiBuat, konteksBuat({ pelaku: { peran: "PETUGAS", orgIds: [ORG_LAIN] } }), SEKARANG));
    expect(g).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "BUKAN_PIHAK" });
  });
  it("tanpa wadah ditolak", () => {
    const g = gagal(terapkanTransisi(null, { ...aksiBuat, wadahIds: [] }, konteksBuat(), SEKARANG));
    expect(g).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "WADAH_KOSONG" });
  });
  it("wadah ganda ditolak", () => {
    const g = gagal(terapkanTransisi(null, { ...aksiBuat, wadahIds: ["w1", "w1"] }, konteksBuat(), SEKARANG));
    expect(g).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "WADAH_GANDA" });
  });
  it("wadah tidak dikenal ditolak", () => {
    const g = gagal(terapkanTransisi(null, { ...aksiBuat, wadahIds: ["w1", "w9"] }, konteksBuat(), SEKARANG));
    expect(g).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "WADAH_TIDAK_DIKENAL" });
  });
  it("wadah milik TPS lain ditolak", () => {
    const k = konteksBuat({ wadah: [{ id: "w1", tpsId: "tps01", aliran: "KUNING", diSerahLain: false }, { id: "w2", tpsId: "tps02", aliran: "ABU", diSerahLain: false }] });
    expect(gagal(terapkanTransisi(null, aksiBuat, k, SEKARANG))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "WADAH_BUKAN_TPS" });
  });
  it("wadah yang sudah di serah lain ditolak", () => {
    const k = konteksBuat({ wadah: [{ id: "w1", tpsId: "tps01", aliran: "KUNING", diSerahLain: true }, { id: "w2", tpsId: "tps01", aliran: "ABU", diSerahLain: false }] });
    expect(gagal(terapkanTransisi(null, aksiBuat, k, SEKARANG))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "WADAH_SUDAH_DISERAH" });
  });
  it("BUAT atas serah yang sudah ada ditolak", () => {
    expect(gagal(terapkanTransisi(serah("DRAF"), aksiBuat, konteksBuat(), SEKARANG))).toMatchObject({ kode: "TRANSISI_TIDAK_SAH" });
  });
  it("aksi selain BUAT tanpa serah ditolak", () => {
    expect(gagal(terapkanTransisi(null, aksiAmbil, konteksAmbil(), SEKARANG))).toMatchObject({ kode: "TRANSISI_TIDAK_SAH" });
  });
});

describe("T13 baris 2: DRAF AMBIL → MENUNGGU_SETUJU (PENGANGKUT)", () => {
  it("sukses + proyeksi pengangkut, penerima, kendaraan", () => {
    const h = sukses(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil(), SEKARANG));
    expect(h.statusBaru).toBe("MENUNGGU_SETUJU");
    expect(h.versiBaru).toBe(4);
    expect(h.event.jenis).toBe("SERAH_DIAMBIL");
    expect(h.event.payload).toEqual({ fotoId: "foto01", kendaraanId: "kend01", penerimaId: ORG_P });
    expect(h.proyeksi).toEqual({ orgPengangkutId: ORG_A, orgPenerimaId: ORG_P, kendaraanId: "kend01" });
  });
  it("peran selain PENGANGKUT ditolak", () => {
    expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ pelaku: petugas }), SEKARANG))).toMatchObject({ kode: "PERAN_TIDAK_BOLEH" });
  });
  it("guard 1: foto muatan gagal R-04 → ATURAN_DITOLAK R04", () => {
    const k = konteksAmbil({ foto: { id: "foto01", jenis: "MUATAN", organisasiId: ORG_A, r04Lolos: false } });
    const g = gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, k, SEKARANG));
    expect(g).toEqual({ kode: "ATURAN_DITOLAK", sebab: "ATURAN", aturan: { kode: "R04", aksi: "TOLAK" } });
  });
  it("guard 1: foto tidak ada / bukan MUATAN / milik organisasi lain", () => {
    for (const foto of [
      null,
      { id: "foto01", jenis: "TIKET" as const, organisasiId: ORG_A, r04Lolos: true },
      { id: "foto01", jenis: "MUATAN" as const, organisasiId: ORG_LAIN, r04Lolos: true },
      { id: "fotoLain", jenis: "MUATAN" as const, organisasiId: ORG_A, r04Lolos: true },
    ]) {
      expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ foto }), SEKARANG))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "FOTO_TIDAK_SAH" });
    }
  });
  it("guard 2: kendaraan tidak ada / milik organisasi lain / nonaktif", () => {
    for (const kendaraan of [
      null,
      { id: "kend01", organisasiId: ORG_LAIN, aktif: true },
      { id: "kend01", organisasiId: ORG_A, aktif: false },
      { id: "kendLain", organisasiId: ORG_A, aktif: true },
    ]) {
      expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ kendaraan }), SEKARANG))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "KENDARAAN_TIDAK_SAH" });
    }
  });
  it.each(["R01", "R02", "R03", "R11"] as const)("guard aturan %s TOLAK → ATURAN_DITOLAK", (kode) => {
    const g = gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ aturan: [{ kode, aksi: "TOLAK" }] }), SEKARANG));
    expect(g).toEqual({ kode: "ATURAN_DITOLAK", sebab: "ATURAN", aturan: { kode, aksi: "TOLAK" } });
  });
  it("urutan guard: foto → kendaraan → R-01 → R-02 → R-03 → R-11", () => {
    const fotoBuruk = { id: "foto01", jenis: "MUATAN" as const, organisasiId: ORG_A, r04Lolos: false };
    const kendBuruk = { id: "kend01", organisasiId: ORG_A, aktif: false };
    const semua = [{ kode: "R11", aksi: "TOLAK" }, { kode: "R03", aksi: "TOLAK" }, { kode: "R02", aksi: "TOLAK" }, { kode: "R01", aksi: "TOLAK" }] as const;
    expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ foto: fotoBuruk, kendaraan: kendBuruk, aturan: semua }), SEKARANG)).aturan?.kode).toBe("R04");
    expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ kendaraan: kendBuruk, aturan: semua }), SEKARANG)).sebab).toBe("KENDARAAN_TIDAK_SAH");
    expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ aturan: semua }), SEKARANG)).aturan?.kode).toBe("R01");
    expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ aturan: semua.slice(0, 3) }), SEKARANG)).aturan?.kode).toBe("R02");
    expect(gagal(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil({ aturan: semua.slice(0, 2) }), SEKARANG)).aturan?.kode).toBe("R03");
  });
  it("aturan PERINGATAN/PRIORITAS tidak menghalangi", () => {
    const k = konteksAmbil({ aturan: [{ kode: "R05", aksi: "PERINGATAN" }, { kode: "R10", aksi: "PRIORITAS" }] });
    expect(sukses(terapkanTransisi(serah("DRAF"), aksiAmbil, k, SEKARANG)).statusBaru).toBe("MENUNGGU_SETUJU");
  });
});

describe("T13 baris 3: MENUNGGU_SETUJU SETUJUI → DIANGKUT (PENGELOLA)", () => {
  it("sukses", () => {
    const h = sukses(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "SETUJUI" }, { pelaku: pengelola }, SEKARANG));
    expect(h.statusBaru).toBe("DIANGKUT");
    expect(h.event.jenis).toBe("SERAH_DISETUJUI");
    expect(h.event.payload).toEqual({});
  });
  it("pengelola kawasan lain ditolak", () => {
    const g = gagal(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "SETUJUI" }, { pelaku: { peran: "PENGELOLA", orgIds: [ORG_LAIN] } }, SEKARANG));
    expect(g).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "BUKAN_PIHAK" });
  });
  it("petugas tidak boleh menyetujui", () => {
    expect(gagal(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "SETUJUI" }, { pelaku: petugas }, SEKARANG))).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "PERAN" });
  });
});

describe("T13 baris 4: MENUNGGU_SETUJU KEMBALIKAN → DRAF (PENGELOLA, alasan ≥5)", () => {
  it("sukses, alasan tepat 5 karakter setelah trim", () => {
    const h = sukses(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "KEMBALIKAN", alasan: "  buram  " }, { pelaku: pengelola }, SEKARANG));
    expect(h.statusBaru).toBe("DRAF");
    expect(h.event.jenis).toBe("SERAH_DIKEMBALIKAN");
    expect(h.event.payload).toEqual({ alasan: "buram" });
    expect(h.proyeksi).toEqual({ orgPengangkutId: null, orgPenerimaId: null, kendaraanId: null });
  });
  it("alasan 4 karakter ditolak", () => {
    const g = gagal(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "KEMBALIKAN", alasan: "  abcd " }, { pelaku: pengelola }, SEKARANG));
    expect(g).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "ALASAN_KURANG" });
  });
  it("pengelola kawasan lain ditolak", () => {
    const g = gagal(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "KEMBALIKAN", alasan: "foto buram" }, { pelaku: { peran: "PENGELOLA", orgIds: [ORG_LAIN] } }, SEKARANG));
    expect(g).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "BUKAN_PIHAK" });
  });
});

describe.each(["DIANGKUT", "MENGGANTUNG"] as const)("T13 baris 5–7: penutupan dari %s (PENERIMA)", (asal) => {
  it("TUTUP_TERIMA → DITERIMA", () => {
    const h = sukses(terapkanTransisi(serah(asal), tutup("TUTUP_TERIMA", terima), { pelaku: penerima }, SEKARANG));
    expect(h.statusBaru).toBe("DITERIMA");
    expect(h.event.jenis).toBe("SERAH_DITERIMA");
    expect(h.event.payload).toEqual({
      tiket: { beratG: 500_000, fotoId: null, nomor: "TT-123", sumber: "MANUAL" },
      rincian: [
        { aliran: "KUNING", alasan: null, diterimaG: 300_000, ditolakG: 0 },
        { aliran: "ABU", alasan: null, diterimaG: 200_000, ditolakG: 0 },
      ],
    });
  });
  it("TUTUP_SEBAGIAN → DITERIMA_SEBAGIAN", () => {
    const h = sukses(terapkanTransisi(serah(asal), tutup("TUTUP_SEBAGIAN", sebagian), { pelaku: penerima }, SEKARANG));
    expect(h.statusBaru).toBe("DITERIMA_SEBAGIAN");
    expect(h.event.jenis).toBe("SERAH_DITERIMA_SEBAGIAN");
  });
  it("TUTUP_TOLAK → DITOLAK", () => {
    const h = sukses(terapkanTransisi(serah(asal), tutup("TUTUP_TOLAK", tolak), { pelaku: penerima }, SEKARANG));
    expect(h.statusBaru).toBe("DITOLAK");
    expect(h.event.jenis).toBe("SERAH_DITOLAK");
  });
});

describe("T13 baris 5: guard TUTUP_TERIMA", () => {
  const coba = (aksi: AksiTransisi, pelaku: Pelaku = penerima) => gagal(terapkanTransisi(serah("DIANGKUT"), aksi, { pelaku }, SEKARANG));
  it("penerima bukan tujuan", () => expect(coba(tutup("TUTUP_TERIMA", terima), { peran: "PENERIMA", orgIds: [ORG_LAIN] })).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "BUKAN_PIHAK" }));
  it("peran selain PENERIMA", () => expect(coba(tutup("TUTUP_TERIMA", terima), pengelola)).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "PERAN" }));
  it("tiket tidak ada", () => expect(coba(tutup("TUTUP_TERIMA", terima, null))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "TIKET_TIDAK_ADA" }));
  it("Σditolak > 0", () => expect(coba(tutup("TUTUP_TERIMA", sebagian))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "DITOLAK_ADA" }));
  it("Σditerima ≠ berat tiket (selisih 1 gram, ±0)", () => {
    const r: RincianTutup[] = [{ aliran: "KUNING", diterimaG: 299_999, ditolakG: 0 }, { aliran: "ABU", diterimaG: 200_000, ditolakG: 0 }];
    expect(coba(tutup("TUTUP_TERIMA", r))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "JUMLAH_TIDAK_SAMA" });
  });
  it("rincian aliran tidak cocok dengan serah (kurang, lebih, ganda)", () => {
    expect(coba(tutup("TUTUP_TERIMA", [{ aliran: "KUNING", diterimaG: 500_000, ditolakG: 0 }]))).toMatchObject({ sebab: "RINCIAN_ALIRAN" });
    expect(coba(tutup("TUTUP_TERIMA", [...terima, { aliran: "MERAH", diterimaG: 0, ditolakG: 0 }]))).toMatchObject({ sebab: "RINCIAN_ALIRAN" });
    expect(coba(tutup("TUTUP_TERIMA", [terima[0]!, { aliran: "KUNING", diterimaG: 200_000, ditolakG: 0 }]))).toMatchObject({ sebab: "RINCIAN_ALIRAN" });
  });
  it("nilai negatif / pecahan ditolak", () => {
    const r: RincianTutup[] = [{ aliran: "KUNING", diterimaG: 300_000.5, ditolakG: 0 }, { aliran: "ABU", diterimaG: 199_999.5, ditolakG: 0 }];
    expect(coba(tutup("TUTUP_TERIMA", r))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "NILAI_TIDAK_SAH" });
    const n: RincianTutup[] = [{ aliran: "KUNING", diterimaG: 600_000, ditolakG: -100_000 }, { aliran: "ABU", diterimaG: 0, ditolakG: 0 }];
    expect(coba(tutup("TUTUP_SEBAGIAN", n))).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "NILAI_TIDAK_SAH" });
  });
});

describe("T13 baris 6: guard TUTUP_SEBAGIAN", () => {
  const coba = (r: RincianTutup[]) => gagal(terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_SEBAGIAN", r), { pelaku: penerima }, SEKARANG));
  it("Σditolak = 0", () => expect(coba(terima)).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "DITOLAK_KOSONG" }));
  it("aliran ditolak tanpa alasan", () => {
    expect(coba([{ aliran: "KUNING", diterimaG: 250_000, ditolakG: 50_000 }, terima[1]!])).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "ALASAN_TOLAK_KURANG" });
  });
  it("Σditerima + Σditolak ≠ berat tiket", () => {
    expect(coba([{ aliran: "KUNING", diterimaG: 250_000, ditolakG: 49_000, alasan: "BASAH_KOTOR" }, terima[1]!])).toMatchObject({ sebab: "JUMLAH_TIDAK_SAMA" });
  });
  it("tiket tidak ada", () => {
    const g = gagal(terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_SEBAGIAN", sebagian, null), { pelaku: penerima }, SEKARANG));
    expect(g.sebab).toBe("TIKET_TIDAK_ADA");
  });
});

describe("T13 baris 7: guard TUTUP_TOLAK", () => {
  const coba = (r: RincianTutup[]) => gagal(terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_TOLAK", r), { pelaku: penerima }, SEKARANG));
  it("Σditerima > 0", () => expect(coba(sebagian)).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "DITERIMA_ADA" }));
  it("setiap aliran wajib beralasan", () => {
    expect(coba([tolak[0]!, { aliran: "ABU", diterimaG: 0, ditolakG: 200_000 }])).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "ALASAN_TOLAK_KURANG" });
  });
  it("Σditolak ≠ berat tiket (keputusan pemilik S08: tolak penuh juga seimbang)", () => {
    expect(coba([tolak[0]!, { aliran: "ABU", diterimaG: 0, ditolakG: 199_999, alasan: "JENIS_TIDAK_SESUAI" }])).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "JUMLAH_TIDAK_SAMA" });
  });
  it("penerima bukan tujuan", () => {
    const g = gagal(terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_TOLAK", tolak), { pelaku: { peran: "PENERIMA", orgIds: [ORG_LAIN] } }, SEKARANG));
    expect(g.sebab).toBe("BUKAN_PIHAK");
  });
});

describe("T13 baris 8: DIANGKUT TANDAI_MENGGANTUNG → MENGGANTUNG (sistem, R-07)", () => {
  it("sukses bila R-07 terpenuhi", () => {
    const h = sukses(terapkanTransisi(serah("DIANGKUT"), { jenis: "TANDAI_MENGGANTUNG" }, { pelaku: sistem, aturan: [{ kode: "R07", aksi: "STATUS" }] }, SEKARANG));
    expect(h.statusBaru).toBe("MENGGANTUNG");
    expect(h.event.jenis).toBe("SERAH_MENGGANTUNG");
    expect(h.event.peran).toBe("SISTEM");
  });
  it("R-07 belum terpenuhi → ditolak", () => {
    expect(gagal(terapkanTransisi(serah("DIANGKUT"), { jenis: "TANDAI_MENGGANTUNG" }, { pelaku: sistem, aturan: [] }, SEKARANG))).toMatchObject({ kode: "TRANSISI_TIDAK_SAH", sebab: "R07_BELUM" });
  });
  it("hanya sistem", () => {
    const g = gagal(terapkanTransisi(serah("DIANGKUT"), { jenis: "TANDAI_MENGGANTUNG" }, { pelaku: pengelola, aturan: [{ kode: "R07", aksi: "STATUS" }] }, SEKARANG));
    expect(g).toMatchObject({ kode: "PERAN_TIDAK_BOLEH", sebab: "PERAN" });
  });
});

describe("T13 baris 9: DITERIMA / DITERIMA_SEBAGIAN KOREKSI_BERAT → (tetap)", () => {
  const koreksi = (perubahan: { target: "TIKET" | "RINCIAN_DITERIMA" | "RINCIAN_DITOLAK"; targetId: string; nilaiFinalG: number }[], alasan = "salah baca tiket"): AksiTransisi => ({
    jenis: "KOREKSI_BERAT",
    alasan,
    perubahan,
  });
  it("DITERIMA: tiket + rincian dikoreksi bersama, Σ tetap konsisten, status tetap", () => {
    const aksi = koreksi([{ target: "TIKET", targetId: "tiket01", nilaiFinalG: 520_000 }, { target: "RINCIAN_DITERIMA", targetId: "r1", nilaiFinalG: 320_000 }]);
    const h = sukses(terapkanTransisi(serah("DITERIMA"), aksi, { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA") }, SEKARANG));
    expect(h.statusBaru).toBe("DITERIMA");
    expect(h.event.jenis).toBe("KOREKSI_BERAT");
    expect(h.event.payload).toEqual({
      alasan: "salah baca tiket",
      perubahan: [
        { target: "TIKET", targetId: "tiket01", nilaiAsliG: 500_000, nilaiFinalG: 520_000 },
        { target: "RINCIAN_DITERIMA", targetId: "r1", nilaiAsliG: 300_000, nilaiFinalG: 320_000 },
      ],
    });
  });
  it("DITERIMA_SEBAGIAN: geser 10 kg dari diterima ke ditolak pada aliran beralasan", () => {
    const aksi = koreksi([{ target: "RINCIAN_DITERIMA", targetId: "r1", nilaiFinalG: 240_000 }, { target: "RINCIAN_DITOLAK", targetId: "r1", nilaiFinalG: 60_000 }]);
    const h = sukses(terapkanTransisi(serah("DITERIMA_SEBAGIAN"), aksi, { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA_SEBAGIAN") }, SEKARANG));
    expect(h.statusBaru).toBe("DITERIMA_SEBAGIAN");
  });
  it("koreksi tunggal yang merusak Σ ditolak", () => {
    const g = gagal(terapkanTransisi(serah("DITERIMA"), koreksi([{ target: "TIKET", targetId: "tiket01", nilaiFinalG: 520_000 }]), { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA") }, SEKARANG));
    expect(g).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "SIGMA_TIDAK_KONSISTEN" });
  });
  it("DITERIMA tidak boleh berubah menjadi punya tolakan", () => {
    const aksi = koreksi([{ target: "RINCIAN_DITERIMA", targetId: "r1", nilaiFinalG: 250_000 }, { target: "RINCIAN_DITOLAK", targetId: "r1", nilaiFinalG: 50_000 }]);
    const g = gagal(terapkanTransisi(serah("DITERIMA"), aksi, { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA") }, SEKARANG));
    expect(g.sebab).toBe("SIGMA_TIDAK_KONSISTEN");
  });
  it("tolakan baru pada aliran tanpa alasan ditolak", () => {
    const aksi = koreksi([{ target: "RINCIAN_DITERIMA", targetId: "r2", nilaiFinalG: 190_000 }, { target: "RINCIAN_DITOLAK", targetId: "r2", nilaiFinalG: 10_000 }]);
    const g = gagal(terapkanTransisi(serah("DITERIMA_SEBAGIAN"), aksi, { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA_SEBAGIAN") }, SEKARANG));
    expect(g.sebab).toBe("ALASAN_TOLAK_KURANG");
  });
  it("alasan wajib", () => {
    const g = gagal(terapkanTransisi(serah("DITERIMA"), koreksi([{ target: "TIKET", targetId: "tiket01", nilaiFinalG: 500_000 }], "   "), { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA") }, SEKARANG));
    expect(g).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "ALASAN_KURANG" });
  });
  it("nilai baru negatif ditolak", () => {
    const g = gagal(terapkanTransisi(serah("DITERIMA"), koreksi([{ target: "RINCIAN_DITERIMA", targetId: "r1", nilaiFinalG: -1 }]), { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA") }, SEKARANG));
    expect(g).toMatchObject({ kode: "VALIDASI_GAGAL", sebab: "NILAI_TIDAK_SAH" });
  });
  it("sasaran tidak dikenal / perubahan kosong", () => {
    const k = { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA") };
    expect(gagal(terapkanTransisi(serah("DITERIMA"), koreksi([{ target: "RINCIAN_DITERIMA", targetId: "r9", nilaiFinalG: 1 }]), k, SEKARANG)).sebab).toBe("TARGET_TIDAK_DIKENAL");
    expect(gagal(terapkanTransisi(serah("DITERIMA"), koreksi([{ target: "TIKET", targetId: "tiketLain", nilaiFinalG: 1 }]), k, SEKARANG)).sebab).toBe("TARGET_TIDAK_DIKENAL");
    expect(gagal(terapkanTransisi(serah("DITERIMA"), koreksi([]), k, SEKARANG)).sebab).toBe("PERUBAHAN_KOSONG");
  });
  it("penerima bukan tujuan / peran lain", () => {
    const aksi = koreksi([{ target: "TIKET", targetId: "tiket01", nilaiFinalG: 500_000 }]);
    expect(gagal(terapkanTransisi(serah("DITERIMA"), aksi, { pelaku: { peran: "PENERIMA", orgIds: [ORG_LAIN] }, nilaiTertutup: nilaiTertutup("DITERIMA") }, SEKARANG)).sebab).toBe("BUKAN_PIHAK");
    expect(gagal(terapkanTransisi(serah("DITERIMA"), aksi, { pelaku: pengelola, nilaiTertutup: nilaiTertutup("DITERIMA") }, SEKARANG)).sebab).toBe("PERAN");
  });
});

// ── Transisi tak sah: setiap (status, aksi) di luar tabel ──────────────────

const BOLEH: Record<Exclude<JenisAksiTransisi, "BUAT">, readonly StatusSerah[]> = {
  AMBIL: ["DRAF"],
  SETUJUI: ["MENUNGGU_SETUJU"],
  KEMBALIKAN: ["MENUNGGU_SETUJU"],
  TUTUP_TERIMA: ["DIANGKUT", "MENGGANTUNG"],
  TUTUP_SEBAGIAN: ["DIANGKUT", "MENGGANTUNG"],
  TUTUP_TOLAK: ["DIANGKUT", "MENGGANTUNG"],
  TANDAI_MENGGANTUNG: ["DIANGKUT"],
  KOREKSI_BERAT: ["DITERIMA", "DITERIMA_SEBAGIAN"],
};
const contoh = (jenis: keyof typeof BOLEH, status: StatusSerah): [AksiTransisi, KonteksTransisi] =>
  jenis === "KOREKSI_BERAT" && status === "DITERIMA_SEBAGIAN"
    ? [CONTOH.KOREKSI_BERAT[0], { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA_SEBAGIAN") }]
    : CONTOH[jenis];
const CONTOH: Record<keyof typeof BOLEH, [AksiTransisi, KonteksTransisi]> = {
  AMBIL: [aksiAmbil, konteksAmbil()],
  SETUJUI: [{ jenis: "SETUJUI" }, { pelaku: pengelola }],
  KEMBALIKAN: [{ jenis: "KEMBALIKAN", alasan: "foto buram" }, { pelaku: pengelola }],
  TUTUP_TERIMA: [tutup("TUTUP_TERIMA", terima), { pelaku: penerima }],
  TUTUP_SEBAGIAN: [tutup("TUTUP_SEBAGIAN", sebagian), { pelaku: penerima }],
  TUTUP_TOLAK: [tutup("TUTUP_TOLAK", tolak), { pelaku: penerima }],
  TANDAI_MENGGANTUNG: [{ jenis: "TANDAI_MENGGANTUNG" }, { pelaku: sistem, aturan: [{ kode: "R07", aksi: "STATUS" }] }],
  KOREKSI_BERAT: [
    { jenis: "KOREKSI_BERAT", alasan: "salah baca", perubahan: [{ target: "TIKET", targetId: "tiket01", nilaiFinalG: 500_000 }] },
    { pelaku: penerima, nilaiTertutup: nilaiTertutup("DITERIMA") },
  ],
};

describe("T13 transisi tak sah ditolak (matriks status × aksi)", () => {
  const kasus = STATUS_SERAH.flatMap((status) => (Object.keys(BOLEH) as (keyof typeof BOLEH)[]).map((aksi) => [status, aksi] as const));
  it.each(kasus)("%s × %s", (status, jenisAksi) => {
    const [aksi, konteks] = contoh(jenisAksi, status);
    const h = terapkanTransisi(serah(status), aksi, konteks, SEKARANG);
    if (BOLEH[jenisAksi].includes(status)) {
      expect(h.ok).toBe(true);
    } else {
      expect(gagal(h)).toEqual({ kode: "TRANSISI_TIDAK_SAH", sebab: "STATUS_TIDAK_COCOK" });
    }
  });
  it("matriks mencakup 7 status × 8 aksi", () => expect(kasus).toHaveLength(56));
});

// ── Kasus tepi §I.2 ────────────────────────────────────────────────────────

describe("T13 kasus tepi §I.2", () => {
  it("sinkron tak berurutan: AMBIL atas serah yang sudah diambil → TRANSISI_TIDAK_SAH", () => {
    expect(gagal(terapkanTransisi(serah("MENUNGGU_SETUJU"), aksiAmbil, konteksAmbil(), SEKARANG)).kode).toBe("TRANSISI_TIDAK_SAH");
  });
  it("dua penerima menutup bersamaan: keduanya menghitung versiBaru = versi + 1 (DB menolak yang kalah, KONFLIK_VERSI)", () => {
    const a = sukses(terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_TERIMA", terima), { pelaku: penerima }, SEKARANG));
    const b = sukses(terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_TOLAK", tolak), { pelaku: penerima }, SEKARANG));
    expect(a.versiBaru).toBe(4);
    expect(b.versiBaru).toBe(4);
  });
  it("DRAF berumur >72 jam tidak berubah status sendiri; AMBIL tetap boleh", () => {
    const nanti = new Date(SEKARANG.getTime() + 100 * 3_600_000);
    expect(sukses(terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil(), nanti)).statusBaru).toBe("MENUNGGU_SETUJU");
  });
  it("kontrak berakhir saat DIANGKUT: penutupan tetap boleh (R-02 tidak dinilai saat tutup)", () => {
    const h = terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_TERIMA", terima), { pelaku: penerima, aturan: [{ kode: "R02", aksi: "TOLAK" }] }, SEKARANG);
    expect(sukses(h).statusBaru).toBe("DITERIMA");
  });
  it("izin penerima dicabut saat DIANGKUT: penutupan tetap boleh (R-11 tidak dinilai saat tutup)", () => {
    const h = terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_SEBAGIAN", sebagian), { pelaku: penerima, aturan: [{ kode: "R11", aksi: "TOLAK" }] }, SEKARANG);
    expect(sukses(h).statusBaru).toBe("DITERIMA_SEBAGIAN");
  });
});

describe("T13 event & kemurnian", () => {
  it("diterimaPada = sekarang (server); terjadiPada = waktu perangkat bila ada", () => {
    const perangkat = new Date("2026-10-15T02:40:00.000Z");
    const h = sukses(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "SETUJUI" }, { pelaku: pengelola, terjadiPada: perangkat }, SEKARANG));
    expect(h.event.diterimaPada.getTime()).toBe(SEKARANG.getTime());
    expect(h.event.terjadiPada.getTime()).toBe(perangkat.getTime());
    const tanpa = sukses(terapkanTransisi(serah("MENUNGGU_SETUJU"), { jenis: "SETUJUI" }, { pelaku: pengelola }, SEKARANG));
    expect(tanpa.event.terjadiPada.getTime()).toBe(SEKARANG.getTime());
  });
  it("payload setiap event bisa dikanonkan (integer saja)", () => {
    const hasil = [
      terapkanTransisi(null, aksiBuat, konteksBuat(), SEKARANG),
      terapkanTransisi(serah("DRAF"), aksiAmbil, konteksAmbil(), SEKARANG),
      terapkanTransisi(serah("DIANGKUT"), tutup("TUTUP_SEBAGIAN", sebagian), { pelaku: penerima }, SEKARANG),
    ];
    for (const h of hasil) expect(() => kanonis(sukses(h).event.payload)).not.toThrow();
  });
  it("tidak mengubah masukan", () => {
    const s = Object.freeze(serah("DIANGKUT"));
    const r = sebagian.map((x) => Object.freeze({ ...x }));
    const aksi = Object.freeze({ jenis: "TUTUP_SEBAGIAN" as const, tiket: Object.freeze({ ...tiket }), rincian: Object.freeze(r) });
    expect(() => terapkanTransisi(s, aksi, Object.freeze({ pelaku: penerima }), SEKARANG)).not.toThrow();
  });
  it("jenisTutup diturunkan server dari rincian", () => {
    expect(jenisTutup(terima)).toBe("TUTUP_TERIMA");
    expect(jenisTutup(sebagian)).toBe("TUTUP_SEBAGIAN");
    expect(jenisTutup(tolak)).toBe("TUTUP_TOLAK");
  });
});
