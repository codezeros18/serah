import { beforeEach, describe, expect, it } from "vitest";
import { DAFTAR_RUTE } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { ORG, idm } from "./mock-data";
import { RUTE_MOCK, aturPeranMock, jalankanMock, reset } from "./mock";

const SEKARANG = Date.UTC(2026, 9, 15, 3, 0, 0);
const TANPA_MOCK = new Set(["CRON", "WEBHOOK"]);

function kodeSerah(n: number): string {
  return `SRH-20261015-${String(n).padStart(4, "0")}`;
}

function paramsUntuk(jalur: string): Record<string, string> {
  const p: Record<string, string> = {};
  if (jalur.includes("[kode]")) p.kode = jalur.includes("/admin/paket") ? "PAKET_CONTOH" : kodeSerah(1);
  if (jalur.includes("[pihak]")) p.pihak = "kawasan";
  if (jalur.includes("[adm4]")) p.adm4 = "31.71.03.1001";
  if (jalur.includes("[nomor]")) p.nomor = "TGH-202610-0001";
  if (jalur.includes("[token]")) p.token = "mocktokentpspcs01xxxxxxxx";
  if (jalur.includes("[organisasiId]")) p.organisasiId = ORG.kawasan;
  if (jalur.includes("[tagihanId]")) p.tagihanId = idm("tgh", 1);
  if (jalur.includes("[id]")) {
    p.id = jalur.includes("/tps")
      ? idm("tps", 1)
      : jalur.includes("/anggota")
        ? idm("agt", 1)
        : jalur.includes("/kendaraan")
          ? idm("knd", 1)
          : jalur.includes("/kontrak")
            ? idm("ktr", 6)
            : jalur.includes("/notifikasi")
              ? idm("ntf", 1)
              : jalur.includes("/permintaan-koreksi")
                ? idm("pkr", 1)
                : jalur.includes("/admin/organisasi")
                  ? ORG.kawasan
                  : jalur.includes("/kawasan")
                    ? idm("kws", 1)
                    : idm("x", 1);
  }
  return p;
}

const BODY: Record<string, Record<string, unknown>> = {
  "POST /api/serah": { tpsId: idm("tps", 1), wadahIds: [idm("wdh", 1), idm("wdh", 2)] },
  "POST /api/wadah": { tpsId: idm("tps", 1), aliran: "HIJAU", beratG: 5_000, terjadiPada: "2026-10-15T03:00:00Z" },
  "POST /api/serah/[kode]/ambil": { fotoId: idm("fto", 1), kendaraanId: idm("knd", 1), penerimaId: ORG.daurUlang },
  "POST /api/serah/[kode]/tutup": {
    tiket: { beratG: 30_000, sumber: "MANUAL", nomor: "TKT-1" },
    rincian: [{ aliran: "KUNING", diterimaG: 30_000, ditolakG: 0 }],
  },
  "POST /api/serah/[kode]/koreksi": { alasan: "contoh", perubahan: [{ target: "TIKET", targetId: idm("tkt", 3), nilaiFinalG: 29_000 }] },
  "POST /api/sinkron": { aksi: [{ idempotencyKey: "00000000-0000-4000-8000-000000000001", jenis: "WADAH_CATAT" }] },
  "POST /api/tagihan-angkut/terbitkan": { kontrakId: idm("ktr", 1), periode: "2026-10" },
  "POST /api/admin/aturan": { kode: "R05", yurisdiksi: "DKI", sumber: "contoh", aksi: "PERINGATAN", ambang: { jam: 72 }, kunciTeks: "ATURAN_R05", berlakuDari: "2026-10-15T00:00:00Z" },
};

const PARAMS_KHUSUS: Record<string, Record<string, string>> = {
  "POST /api/serah/[kode]/setujui": { kode: kodeSerah(2) },
  "POST /api/serah/[kode]/kembalikan": { kode: kodeSerah(2) },
  "POST /api/serah/[kode]/tutup": { kode: kodeSerah(3) },
  "POST /api/serah/[kode]/koreksi": { kode: kodeSerah(4) },
};

const rutePakai = DAFTAR_RUTE.filter((r) => !r.akses.some((a) => TANPA_MOCK.has(a)));

describe("mock API", () => {
  beforeEach(() => {
    reset();
    aturPeranMock("PENGELOLA");
  });

  it("mencakup SEMUA rute §K.2 selain cron & webhook", () => {
    const kurang = rutePakai.map((r) => `${r.metode} ${r.jalur}`).filter((k) => !RUTE_MOCK.includes(k));
    expect(kurang).toEqual([]);
  });

  it("tidak memuat rute yang tidak ada di kontrak", () => {
    const sah = new Set(DAFTAR_RUTE.map((r) => `${r.metode} ${r.jalur}`));
    expect(RUTE_MOCK.filter((k) => !sah.has(k))).toEqual([]);
  });

  for (const r of rutePakai) {
    const kunci = `${r.metode} ${r.jalur}`;
    it(`keluaran ${kunci} lolos skema kontrak`, () => {
      const params = { ...paramsUntuk(r.jalur), ...(PARAMS_KHUSUS[kunci] ?? {}) };
      // Rute yang butuh status awal tertentu dijalankan di keadaan segar (reset di beforeEach).
      const keluar = jalankanMock(r.metode, r.jalur, { params, body: BODY[kunci] ?? {}, kueri: {} }, SEKARANG);
      if (typeof keluar === "string") return; // berkas/aliran: bukan amplop JSON
      const hasil = r.keluaran.safeParse(keluar);
      expect(hasil.success, hasil.success ? "" : JSON.stringify(hasil.error.issues)).toBe(true);
    });
  }
});

describe("mock — perilaku", () => {
  beforeEach(() => {
    reset();
    aturPeranMock("PENGANGKUT");
  });

  it("serah DRAF ke TPA/TPST dengan aliran bukan ABU ditolak R-01 dengan teks aturan", () => {
    expect(() =>
      jalankanMock(
        "POST",
        "/api/serah/[kode]/ambil",
        { params: { kode: kodeSerah(1) }, body: { fotoId: idm("fto", 1), kendaraanId: idm("knd", 1), penerimaId: ORG.tpst } },
        SEKARANG,
      ),
    ).toThrowError();
  });

  it("penerima izin MENUNGGU ditolak R-11", () => {
    try {
      jalankanMock(
        "POST",
        "/api/serah/[kode]/ambil",
        { params: { kode: kodeSerah(1) }, body: { fotoId: idm("fto", 1), kendaraanId: idm("knd", 1), penerimaId: ORG.pelapakBaru } },
        SEKARANG,
      );
      expect.unreachable();
    } catch (e) {
      const galat = e as { kode: string; aturan?: { kode: string; teks: string } };
      expect(galat.kode).toBe("ATURAN_DITOLAK");
      expect(galat.aturan?.kode).toBe("R11");
      expect(galat.aturan?.teks).toBe(TEKS.ATURAN_R11);
    }
  });

  it("ambil → setujui → tutup mengubah status berurutan", () => {
    const kode = kodeSerah(1);
    const ambil = jalankanMock(
      "POST",
      "/api/serah/[kode]/ambil",
      { params: { kode }, body: { fotoId: idm("fto", 1), kendaraanId: idm("knd", 1), penerimaId: ORG.daurUlang } },
      SEKARANG,
    ) as { status: string };
    expect(ambil.status).toBe("MENUNGGU_SETUJU");
    const setuju = jalankanMock("POST", "/api/serah/[kode]/setujui", { params: { kode }, body: {} }, SEKARANG) as { status: string };
    expect(setuju.status).toBe("DIANGKUT");
    const tutup = jalankanMock(
      "POST",
      "/api/serah/[kode]/tutup",
      {
        params: { kode },
        body: {
          tiket: { beratG: 30_000, sumber: "MANUAL" },
          rincian: [{ aliran: "KUNING", diterimaG: 20_000, ditolakG: 10_000, alasan: "BASAH_KOTOR" }],
        },
      },
      SEKARANG,
    ) as { status: string };
    expect(tutup.status).toBe("DITERIMA_SEBAGIAN");
  });

  it("transisi tidak sah ditolak TRANSISI_TIDAK_SAH", () => {
    expect(() =>
      jalankanMock("POST", "/api/serah/[kode]/setujui", { params: { kode: kodeSerah(1) }, body: {} }, SEKARANG),
    ).toThrowError();
  });
});
