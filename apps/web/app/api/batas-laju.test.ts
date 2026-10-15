import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { BATAS_LAJU, hitungBatasLaju, wajibDalamBatas, type JenisBatas } from "@/lib/server/batas-laju";
import { GalatApi } from "@/lib/server/galat";
import { orgBaru, type OrgUji } from "@/lib/server/uji/akun";
import { kueriPemilik } from "@/lib/server/uji/db";
import { formFoto, panggil, pngContoh } from "@/lib/server/uji/klien";
import { POST as unggah } from "./foto/route";
import { POST as sinkron } from "./sinkron/route";
import { POST as bacaTiket } from "./tiket/baca/route";

// S26-1 — batas laju §P.1 (jendela tetap, tabel batas_laju): angka tepat tiap batas + rute tiket/foto/sinkron → 429.

vi.setConfig({ testTimeout: 60_000 });

const rekam = new PengirimRekam();
beforeAll(() => {
  setelPengirimUji(rekam);
  vi.stubEnv("UJI_BATAS_LAJU", "aktif");
});
afterAll(() => {
  setelPengirimUji(null);
  vi.unstubAllEnvs();
});

/** Awal jendela dari waktu `t` — sama dengan perhitungan di batas-laju.ts. */
const mulaiJendela = (t: Date, menit: number) => new Date(Math.floor(t.getTime() / (menit * 60_000)) * menit * 60_000);

describe("angka batas tiap jenis (§P.1)", () => {
  it("tabel sesuai BLUEPRINT §P.1", () => {
    expect(BATAS_LAJU).toEqual({
      MASUK: { jumlah: 10, jendelaMenit: 15 },
      DAFTAR: { jumlah: 5, jendelaMenit: 60 },
      LUPA: { jumlah: 3, jendelaMenit: 60 },
      TIKET: { jumlah: 30, jendelaMenit: 60 },
      FOTO: { jumlah: 120, jendelaMenit: 60 },
      SINKRON: { jumlah: 60, jendelaMenit: 1 },
    });
  });

  for (const jenis of Object.keys(BATAS_LAJU) as JenisBatas[]) {
    it(`${jenis}: ${BATAS_LAJU[jenis].jumlah} lolos, berikutnya ditolak dengan sisa menit, jendela berikutnya pulih`, async () => {
      const { jumlah, jendelaMenit } = BATAS_LAJU[jenis];
      const kunci = `uji-${randomUUID()}`;
      // Pertengahan jendela agar tidak melintasi batas jendela selama test.
      const t = new Date(mulaiJendela(new Date(), jendelaMenit).getTime() + (jendelaMenit * 60_000) / 2);
      for (let i = 0; i < jumlah; i++) expect(await hitungBatasLaju(jenis, kunci, t)).toBeNull();
      const sisa = await hitungBatasLaju(jenis, kunci, t);
      expect(sisa).toBeGreaterThanOrEqual(1);
      expect(sisa).toBeLessThanOrEqual(jendelaMenit);
      await expect(wajibDalamBatas(jenis, kunci, t)).rejects.toMatchObject({ kode: "BATAS_LAJU" });
      // Jendela berikutnya: hitungan baru.
      expect(await hitungBatasLaju(jenis, kunci, new Date(t.getTime() + jendelaMenit * 60_000))).toBeNull();
      // Kunci lain tidak terpengaruh.
      expect(await hitungBatasLaju(jenis, `${kunci}-lain`, t)).toBeNull();
    });
  }

  it("kunci disimpan sebagai jenis:kunci — tanpa IP/email mentah (pemanggil mengirim sidik)", async () => {
    const kunci = `uji-${randomUUID()}`;
    await hitungBatasLaju("MASUK", kunci);
    const baris = await kueriPemilik<{ kunci: string }>(`SELECT kunci FROM batas_laju WHERE kunci = $1`, [`MASUK:${kunci}`]);
    expect(baris).toHaveLength(1);
  });

  it("tanpa UJI_BATAS_LAJU, batas per organisasi dilewati hanya di bawah Vitest (batas auth tetap berlaku)", async () => {
    vi.stubEnv("UJI_BATAS_LAJU", "");
    try {
      const kunci = `uji-${randomUUID()}`;
      const t = new Date();
      for (let i = 0; i < BATAS_LAJU.FOTO.jumlah + 5; i++) await expect(wajibDalamBatas("FOTO", kunci, t)).resolves.toBeUndefined();
      expect(await kueriPemilik(`SELECT 1 FROM batas_laju WHERE kunci = $1`, [`FOTO:${kunci}`])).toHaveLength(0);
      const kunciMasuk = `uji-${randomUUID()}`;
      for (let i = 0; i < BATAS_LAJU.MASUK.jumlah; i++) await wajibDalamBatas("MASUK", kunciMasuk, t);
      await expect(wajibDalamBatas("MASUK", kunciMasuk, t)).rejects.toBeInstanceOf(GalatApi);
    } finally {
      vi.stubEnv("UJI_BATAS_LAJU", "aktif");
    }
  });
});

describe("rute memakai batas (429 BATAS_LAJU)", () => {
  /** Isi hitungan jendela sekarang (dan berikutnya, untuk batas per menit) sampai penuh. */
  async function penuhkan(jenis: JenisBatas, kunci: string) {
    const { jumlah, jendelaMenit } = BATAS_LAJU[jenis];
    const sekarang = mulaiJendela(new Date(), jendelaMenit);
    for (const mulai of [sekarang, new Date(sekarang.getTime() + jendelaMenit * 60_000)]) {
      await kueriPemilik(
        `INSERT INTO batas_laju (kunci, jendela_mulai, hitungan) VALUES ($1, $2, $3)
         ON CONFLICT (kunci, jendela_mulai) DO UPDATE SET hitungan = EXCLUDED.hitungan`,
        [`${jenis}:${kunci}`, mulai, jumlah],
      );
    }
  }
  const idSesi = async (o: OrgUji) => (await kueriPemilik<{ id: string }>(`SELECT id FROM sesi WHERE pengguna_id = $1 ORDER BY dibuat_pada DESC LIMIT 1`, [o.penggunaId]))[0]!.id;

  it("POST /api/foto: organisasi yang sudah 120 foto dalam jam ini → 429", async () => {
    const o = await orgBaru(rekam, { jenis: "KAWASAN" });
    await penuhkan("FOTO", o.organisasiId);
    const r = await panggil(unggah, { jalur: "/api/foto", cookie: o.cookie, kunci: null, form: formFoto("BUKTI_TRANSFER", pngContoh(randomUUID()), "image/png") });
    expect(r.status).toBe(429);
    expect(r.json.galat?.kode).toBe("BATAS_LAJU");
  });

  it("POST /api/tiket/baca: organisasi penerima yang sudah 30 pembacaan → 429", async () => {
    const o = await orgBaru(rekam, { jenis: "PENERIMA", jenisPenerima: "FASILITAS_BERIZIN", aliranDiterima: ["KUNING"] });
    await penuhkan("TIKET", o.organisasiId);
    const r = await panggil(bacaTiket, { jalur: "/api/tiket/baca", cookie: o.cookie, kunci: null, body: { fotoId: `a${"0".repeat(23)}` } });
    expect(r.status).toBe(429);
  });

  it("POST /api/sinkron: sesi yang sudah 60 sinkron dalam menit ini → 429; sesi lain tidak terpengaruh", async () => {
    const o = await orgBaru(rekam, { jenis: "KAWASAN" });
    await penuhkan("SINKRON", await idSesi(o));
    const r = await panggil(sinkron, { jalur: "/api/sinkron", cookie: o.cookie, body: { aksi: [] } });
    expect(r.status).toBe(429);
    const lain = await orgBaru(rekam, { jenis: "KAWASAN" });
    expect((await panggil(sinkron, { jalur: "/api/sinkron", cookie: lain.cookie, body: { aksi: [] } })).status).not.toBe(429);
  });
});
