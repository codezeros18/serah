import { describe, expect, it } from "vitest";
import { Antrean, type AksiKirim, type KirimBatch } from "./antrean";
import { penyimpananMemori } from "./penyimpanan";

// Server tiruan yang meniru kontrak /api/sinkron: satu efek per idempotencyKey.
function serverTiruan() {
  const terapan = new Map<string, AksiKirim>();
  const batch: number[] = [];
  let mati = false;
  let hilangRespons = false;
  const tolak = new Set<string>();
  const kirim: KirimBatch = async (aksi) => {
    batch.push(aksi.length);
    if (mati) return { offline: true, hasil: { ok: false, galat: { kode: "GALAT_SERVER", pesan: "jaringan" }, pesan: "" } };
    const hasil = aksi.map((a) => {
      if (tolak.has(a.idempotencyKey)) {
        return { idempotencyKey: a.idempotencyKey, status: "DITOLAK" as const, galat: { kode: "TRANSISI_TIDAK_SAH", aturan: { teks: "teks aturan" } } };
      }
      if (terapan.has(a.idempotencyKey)) return { idempotencyKey: a.idempotencyKey, status: "DUPLIKAT" as const };
      terapan.set(a.idempotencyKey, a);
      return { idempotencyKey: a.idempotencyKey, status: "DITERAPKAN" as const };
    });
    if (hilangRespons) {
      hilangRespons = false;
      return { offline: true, hasil: { ok: false, galat: { kode: "GALAT_SERVER", pesan: "jaringan" }, pesan: "" } };
    }
    return { offline: false, hasil: { ok: true, data: { hasil } } };
  };
  return {
    kirim,
    terapan,
    batch,
    atur: { mati: (v: boolean) => (mati = v), hilangRespons: () => (hilangRespons = true), tolak: (k: string) => tolak.add(k) },
  };
}

const wadah = (n: number) => ({ tpsId: "tps1", aliran: "KUNING", beratG: n * 1000, terjadiPada: "2026-10-15T05:00:00.000Z" });

describe("Antrean offline", () => {
  it("kunci idempotensi dibuat saat tambah (tombol Simpan), bukan saat kirim", async () => {
    const s = serverTiruan();
    const a = new Antrean(penyimpananMemori(), s.kirim, () => new Date("2026-10-15T05:00:00Z"));
    const aksi = await a.tambah("WADAH_CATAT", wadah(1));
    expect(aksi.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(aksi.terjadiPada).toBe("2026-10-15T05:00:00.000Z");
    await a.sinkron();
    expect([...s.terapan.keys()]).toEqual([aksi.idempotencyKey]);
  });

  it("offline → tetap menunggu; online → terkirim sekali; antrean kosong", async () => {
    const s = serverTiruan();
    const a = new Antrean(penyimpananMemori(), s.kirim);
    s.atur.mati(true);
    await a.tambah("WADAH_CATAT", wadah(1));
    await a.tambah("WADAH_CATAT", wadah(2));
    const r1 = await a.sinkron();
    expect(r1).toMatchObject({ offline: true, sisa: 2, diterapkan: 0 });
    expect(await a.keadaan()).toEqual({ menunggu: 2, ditolak: 0 });
    s.atur.mati(false);
    const r2 = await a.sinkron();
    expect(r2).toMatchObject({ offline: false, sisa: 0, diterapkan: 2 });
    expect(s.terapan.size).toBe(2);
    expect(await a.keadaan()).toEqual({ menunggu: 0, ditolak: 0 });
  });

  it("respons hilang setelah server menerapkan → kirim ulang tidak menggandakan (DUPLIKAT)", async () => {
    const s = serverTiruan();
    const a = new Antrean(penyimpananMemori(), s.kirim);
    await a.tambah("WADAH_CATAT", wadah(1));
    s.atur.hilangRespons();
    const r1 = await a.sinkron();
    expect(r1.offline).toBe(true);
    expect(s.terapan.size).toBe(1);
    const r2 = await a.sinkron();
    expect(r2).toMatchObject({ duplikat: 1, diterapkan: 0, sisa: 0 });
    expect(s.terapan.size).toBe(1);
  });

  it("sinkron bersamaan dilebur menjadi satu pengiriman", async () => {
    const s = serverTiruan();
    const a = new Antrean(penyimpananMemori(), s.kirim);
    await a.tambah("WADAH_CATAT", wadah(1));
    await Promise.all([a.sinkron(), a.sinkron(), a.sinkron()]);
    expect(s.batch).toEqual([1]);
  });

  it("batch maksimal 20 aksi, urutan kirim = urutan simpan", async () => {
    const s = serverTiruan();
    const a = new Antrean(penyimpananMemori(), s.kirim);
    for (let i = 1; i <= 45; i++) await a.tambah("WADAH_CATAT", wadah(i));
    await a.sinkron();
    expect(s.batch).toEqual([20, 20, 5]);
    const berat = [...s.terapan.values()].map((x) => (x.payload as { beratG: number }).beratG / 1000);
    expect(berat).toEqual(Array.from({ length: 45 }, (_v, i) => i + 1));
  });

  it("aksi ditolak server tetap tersimpan (tidak dikirim ulang) dengan kode & teks aturan", async () => {
    const s = serverTiruan();
    const a = new Antrean(penyimpananMemori(), s.kirim);
    const aksi = await a.tambah("SERAH_AMBIL", { kode: "SRH-20261015-0001" });
    s.atur.tolak(aksi.idempotencyKey);
    const r = await a.sinkron();
    expect(r).toMatchObject({ ditolak: 1, sisa: 0 });
    expect(await a.keadaan()).toEqual({ menunggu: 0, ditolak: 1 });
    const [tersimpan] = await a.daftar();
    expect(tersimpan).toMatchObject({ status: "DITOLAK", galat: { kode: "TRANSISI_TIDAK_SAH", teksAturan: "teks aturan" } });
    await a.sinkron();
    expect(s.batch).toEqual([1]);
    await a.lepaskan(aksi.idempotencyKey);
    expect(await a.keadaan()).toEqual({ menunggu: 0, ditolak: 0 });
  });

  it("galat server di luar penolakan per aksi (sesi habis) menghentikan kirim tanpa membuang catatan", async () => {
    const a = new Antrean(penyimpananMemori(), async () => ({
      offline: false,
      hasil: { ok: false, galat: { kode: "SESI_HABIS", pesan: "" }, pesan: "" },
    }));
    await a.tambah("WADAH_CATAT", wadah(1));
    const r = await a.sinkron();
    expect(r).toMatchObject({ galatKirim: "SESI_HABIS", sisa: 1 });
    expect(await a.keadaan()).toEqual({ menunggu: 1, ditolak: 0 });
  });
});
