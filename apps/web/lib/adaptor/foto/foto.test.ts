import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { dhash, jarakHamming, proses } from "./index";

// Gambar sintetis deterministik (P-05 belum ada): bentuk halus berfrekuensi rendah seperti foto sungguhan,
// berbeda per `benih`. Kalibrasi dengan foto P-05 dicatat terpisah di PROGRESS.
function acak(benih: number) {
  let s = (benih * 2654435761) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function gambar(benih: number, lebar = 800, tinggi = 600, format: "jpeg" | "png" | "webp" = "jpeg") {
  const r = acak(benih);
  const gelombang = Array.from({ length: 6 }, () => ({
    fx: (0.5 + r() * 2.5) * (Math.PI / lebar),
    fy: (0.5 + r() * 2.5) * (Math.PI / tinggi),
    fase: r() * 6.28,
    kanal: Math.floor(r() * 3),
    amp: 50 + r() * 70,
  }));
  const raw = Buffer.alloc(lebar * tinggi * 3);
  for (let y = 0; y < tinggi; y++) {
    for (let x = 0; x < lebar; x++) {
      const o = (y * lebar + x) * 3;
      const v = [128, 128, 128];
      for (const g of gelombang) v[g.kanal] = (v[g.kanal] ?? 0) + g.amp * Math.sin(g.fx * x + g.fy * y + g.fase);
      raw[o] = Math.max(0, Math.min(255, v[0] ?? 0));
      raw[o + 1] = Math.max(0, Math.min(255, v[1] ?? 0));
      raw[o + 2] = Math.max(0, Math.min(255, v[2] ?? 0));
    }
  }
  return sharp(raw, { raw: { width: lebar, height: tinggi, channels: 3 } })[format]({ quality: 90 }).toBuffer();
}

describe("foto.proses", () => {
  it("T33: EXIF (termasuk GPS) dibuang dari hasil", async () => {
    const asli = await sharp(await gambar(1))
      .withExif({
        IFD0: { Make: "MerekHP", Copyright: "rahasia" },
        IFD3: { GPSLatitudeRef: "S", GPSLatitude: "6/1 10/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "106/1 50/1 0/1" },
      })
      .jpeg()
      .toBuffer();
    // Pastikan fixture memang ber-EXIF GPS.
    const sebelum = await sharp(asli).metadata();
    expect(sebelum.exif).toBeDefined();
    expect(asli.includes(Buffer.from("MerekHP"))).toBe(true);

    const h = await proses(asli);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    const sesudah = await sharp(h.buffer).metadata();
    expect(sesudah.exif).toBeUndefined();
    expect(sesudah.icc).toBeUndefined();
    expect(h.buffer.includes(Buffer.from("MerekHP"))).toBe(false);
    expect(h.buffer.includes(Buffer.from("rahasia"))).toBe(false);
    expect(h.mime).toBe("image/webp");
  });

  it("orientasi EXIF diterapkan ke piksel lalu dibuang", async () => {
    const miring = await sharp(await gambar(2, 800, 400)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const h = await proses(miring);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    // 800×400 dengan orientasi 6 → potret 400×800.
    expect(h.lebar).toBe(400);
    expect(h.tinggi).toBe(800);
  });

  it("resize sisi terpanjang ≤1600 px dan tidak memperbesar", async () => {
    const besar = await proses(await gambar(3, 3200, 1800));
    expect(besar.ok && Math.max(besar.lebar, besar.tinggi)).toBe(1600);
    const kecil = await proses(await gambar(3, 320, 200));
    expect(kecil.ok && kecil.lebar).toBe(320);
  });

  it("menerima jpeg/png/webp", async () => {
    for (const f of ["jpeg", "png", "webp"] as const) expect((await proses(await gambar(4, 200, 150, f))).ok).toBe(true);
  });

  it("menolak non-gambar, format lain, kosong, dan >5 MB", async () => {
    expect(await proses(Buffer.from("bukan gambar sama sekali"))).toEqual({ ok: false, galat: "TIDAK_BISA_DIDECODE" });
    const gif = await sharp(await gambar(5, 50, 50)).gif().toBuffer();
    expect(await proses(gif)).toEqual({ ok: false, galat: "JENIS_TIDAK_DITERIMA" });
    expect(await proses(Buffer.alloc(0))).toEqual({ ok: false, galat: "TERLALU_BESAR" });
    expect(await proses(Buffer.alloc(5 * 1024 * 1024 + 1))).toEqual({ ok: false, galat: "TERLALU_BESAR" });
  });
});

describe("dhash", () => {
  it("hex 16 dan konsisten", async () => {
    const g = await gambar(6);
    const a = await dhash(g);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await dhash(g)).toBe(a);
  });

  it("foto sama dengan kompresi/resize berbeda → jarak kecil; foto berbeda → jarak besar", async () => {
    const dasar = await gambar(7, 1000, 750);
    const h0 = await dhash(dasar);
    const kecil = await sharp(dasar).resize(500).jpeg({ quality: 40 }).toBuffer();
    const webp = await sharp(dasar).webp({ quality: 50 }).toBuffer();
    expect(jarakHamming(h0, await dhash(kecil))).toBeLessThanOrEqual(6);
    expect(jarakHamming(h0, await dhash(webp))).toBeLessThanOrEqual(6);
    const lain = await dhash(await gambar(19, 1000, 750));
    expect(jarakHamming(h0, lain)).toBeGreaterThan(6);
  });

  it("jarakHamming: 0 untuk sama, 64 untuk kebalikan, galat bila bukan hex 16", () => {
    expect(jarakHamming("0000000000000000", "0000000000000000")).toBe(0);
    expect(jarakHamming("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(() => jarakHamming("zz", "0000000000000000")).toThrow();
  });
});
