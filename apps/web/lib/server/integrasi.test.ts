import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AiTidakTersedia, type HasilBaca } from "../adaptor/ai";
import { buatSumberSnapshot, GalatBmkg } from "../adaptor/bmkg";
import { jarakHamming } from "../adaptor/foto";
import { GalatApi } from "./galat";
import { cuacaDari, pembacaTiketDari, pemrosesFotoNyata } from "./integrasi";
import { provinsiDariAdm4, provinsiUnik } from "./wilayah";

// S28-1 — adaptor NYATA yang dipasang di integrasi() produksi (stub hanya ada di lib/server/uji dan dipasang
// vitest.setup). Foto: sharp sungguhan. Pembaca & cuaca: pembungkus diuji dengan adaptor pengganti/snapshot repo.

const kode = async (p: Promise<unknown>) => {
  try {
    await p;
    return "TIDAK_GALAT";
  } catch (e) {
    return e instanceof GalatApi ? `${e.kode}:${e.rincian?.[0]?.kode ?? ""}` : "LAIN";
  }
};

async function jpegBerExif(lebar: number, tinggi: number): Promise<Buffer> {
  return sharp({ create: { width: lebar, height: tinggi, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "rahasia-lokasi-perangkat", Artist: "budi@contoh.test" } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

describe("foto nyata (sharp)", () => {
  it("EXIF dibuang, orientasi diterapkan ke piksel, keluaran WebP ≤1600 px dengan dHash visual 16 hex", async () => {
    const asli = await jpegBerExif(300, 100);
    const meta = await sharp(asli).metadata();
    expect(meta.exif).toBeDefined(); // prasyarat uji: masukan memang membawa EXIF
    const h = await pemrosesFotoNyata().proses(new Uint8Array(asli));
    const keluar = await sharp(Buffer.from(h.isi)).metadata();
    expect(h.mime).toBe("image/webp");
    expect(h.ekstensi).toBe("webp");
    expect(keluar.format).toBe("webp");
    expect(keluar.exif).toBeUndefined();
    expect(Buffer.from(h.isi).includes(Buffer.from("rahasia-lokasi-perangkat"))).toBe(false);
    expect(Buffer.from(h.isi).includes(Buffer.from("budi@contoh.test"))).toBe(false);
    // Orientasi 6 (putar 90°) → lebar & tinggi tertukar.
    expect([h.lebar, h.tinggi]).toEqual([100, 300]);
    expect(h.dhash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gambar besar diperkecil ke sisi ≤1600 px", async () => {
    const besar = await sharp({ create: { width: 3200, height: 1600, channels: 3, background: "#336699" } }).png().toBuffer();
    const h = await pemrosesFotoNyata().proses(new Uint8Array(besar));
    expect(Math.max(h.lebar, h.tinggi)).toBe(1600);
  });

  it("dHash visual: gambar yang sama dengan ukuran berbeda berjarak kecil; gambar lain berjarak besar", async () => {
    const gradasi = (w: number, h: number, balik: boolean) => {
      const px = Buffer.alloc(w * h * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = Math.round(((balik ? w - 1 - x : x) / (w - 1)) * 255);
        px.set([v, v, v], (y * w + x) * 3);
      }
      return sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    };
    const a = await pemrosesFotoNyata().proses(new Uint8Array(await gradasi(200, 100, false)));
    const kecil = await pemrosesFotoNyata().proses(new Uint8Array(await gradasi(100, 50, false)));
    const lain = await pemrosesFotoNyata().proses(new Uint8Array(await gradasi(200, 100, true)));
    expect(jarakHamming(a.dhash, kecil.dhash)).toBeLessThanOrEqual(6); // R-04: foto yang sama diperkecil terdeteksi
    expect(jarakHamming(a.dhash, lain.dhash)).toBeGreaterThan(6);
  });

  it("ditolak: bukan gambar, format tidak diterima (TIFF), terlalu besar, kosong", async () => {
    const p = pemrosesFotoNyata();
    expect(await kode(p.proses(new TextEncoder().encode("bukan gambar")))).toBe("VALIDASI_GAGAL:tidak_bisa_didecode");
    const tiff = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).tiff().toBuffer();
    expect(await kode(p.proses(new Uint8Array(tiff)))).toBe("VALIDASI_GAGAL:jenis_tidak_diterima");
    expect(await kode(p.proses(new Uint8Array(5 * 1024 * 1024 + 1)))).toBe("VALIDASI_GAGAL:berkas_terlalu_besar");
    expect(await kode(p.proses(new Uint8Array(0)))).toBe("VALIDASI_GAGAL:berkas_terlalu_besar");
  });
});

describe("pembaca tiket nyata (pembungkus)", () => {
  const FOTO = { isi: new Uint8Array([1, 2, 3]), mime: "image/png" };
  const hasil = (o: Partial<Extract<HasilBaca, { tersedia: true }>> = {}): HasilBaca => ({
    tersedia: true,
    nomorTiket: "TKT-0042",
    beratTeks: "42,5",
    satuan: "kg",
    beratG: 42_500,
    tanggalTeks: "15/10/2026",
    keyakinan: "TINGGI",
    model: "claude-haiku-5-5",
    ...o,
  });

  it("berat dikembalikan sebagai teks kg Indonesia dari gram; label keyakinan & model diteruskan", async () => {
    const p = pembacaTiketDari({ baca: async () => hasil() });
    expect(await p.baca(FOTO)).toEqual({ nomorTiket: "TKT-0042", beratKgTeks: "42,5", tanggal: "15/10/2026", keyakinan: "TINGGI", model: "claude-haiku-5-5" });
    // Satuan ton sudah dikonversi adaptor ke gram: 1,25 ton → 1.250 kg
    expect((await pembacaTiketDari({ baca: async () => hasil({ beratTeks: "1,25", satuan: "ton", beratG: 1_250_000 }) }).baca(FOTO)).beratKgTeks).toBe("1.250");
    // Berat tak terbaca → null (layar meminta isian manual), bukan tebakan.
    expect((await pembacaTiketDari({ baca: async () => hasil({ beratG: null, beratTeks: null }) }).baca(FOTO)).beratKgTeks).toBeNull();
  });

  it("tanpa pembaca otomatis, AI gagal, atau galat apa pun → AI_TIDAK_TERSEDIA (jalur manual); isi galat tidak bocor ke log", async () => {
    expect(await kode(pembacaTiketDari({ baca: async () => ({ tersedia: false }) }).baca(FOTO))).toBe("AI_TIDAK_TERSEDIA:");
    expect(await kode(pembacaTiketDari({ baca: async () => Promise.reject(new AiTidakTersedia()) }).baca(FOTO))).toBe("AI_TIDAK_TERSEDIA:");
    expect(await kode(pembacaTiketDari({ baca: async () => Promise.reject(new Error("401 kunci sk-ant-rahasia ditolak")) }).baca(FOTO))).toBe("AI_TIDAK_TERSEDIA:");
  });
});

describe("cuaca nyata (pembungkus + snapshot repo)", () => {
  const sumber = () => buatSumberSnapshot({ dir: resolve(__dirname, "../../../../data/bmkg"), awalan: "fixture-" });

  it("prakiraan dari snapshot; gagal → null (R-10 tidak menebak)", async () => {
    const c = cuacaDari(sumber());
    const p = await c.prakiraan("31.71.03.1001");
    expect(p?.adm4).toBe("31.71.03.1001");
    expect(p?.mode).toBe("SNAPSHOT");
    expect(p?.slot.length).toBeGreaterThan(0);
    expect(await c.prakiraan("99.99.99.9999")).toBeNull();
  });

  it("nowcast: hanya provinsi diminta; satu peringatan berisi 2 cincin → 2 baris (identifier dan identifier#2)", async () => {
    const n = await cuacaDari(sumber()).nowcast(["DKI Jakarta"]);
    expect(n).toHaveLength(2);
    const [pertama, kedua] = n!;
    expect(kedua!.identifierCap).toBe(`${pertama!.identifierCap}#2`);
    expect(pertama!.poligonE6.length).toBeGreaterThanOrEqual(3);
    expect(pertama!.poligonE6.every((t) => t.length === 2 && Number.isInteger(t[0]) && Number.isInteger(t[1]))).toBe(true);
    expect(n!.every((x) => x.provinsi.toLowerCase() === "dki jakarta")).toBe(true);
  });

  it("tanpa provinsi → [] (tidak ada permintaan); sumber gagal → null; provinsi tak cocok → []", async () => {
    const c = cuacaDari(sumber());
    expect(await c.nowcast([])).toEqual([]);
    expect(await c.nowcast(["Provinsi Tidak Ada"])).toEqual([]);
    const rusak = cuacaDari({
      ...sumber(),
      nowcast: async () => {
        throw new GalatBmkg("JARINGAN", "putus");
      },
    });
    expect(await rusak.nowcast(["DKI Jakarta"])).toBeNull();
  });
});

describe("wilayah", () => {
  it("kode wilayah → provinsi gaya BMKG; tak dikenal → null; unik & terurut", () => {
    expect(provinsiDariAdm4("31.71.03.1001")).toBe("DKI Jakarta");
    expect(provinsiDariAdm4("21.71.01.1001")).toBe("Kep. Riau");
    expect(provinsiDariAdm4("99.01.01.0001")).toBeNull();
    expect(provinsiDariAdm4("abc")).toBeNull();
    expect(provinsiUnik(["32.01.01.1001", "31.71.03.1001", "31.74.01.1002", "00.00"])).toEqual(["DKI Jakarta", "Jawa Barat"]);
  });
});
