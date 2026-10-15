import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buatPenyimpanan, kunciFoto, kunciSah, PenyimpananLokal } from "./index";

let dir = "";
let jam = 1_000_000_000_000;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "serah-foto-"));
  jam = 1_000_000_000_000;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
const buat = () => new PenyimpananLokal({ dir, rahasia: "r", awalanUrl: "http://x/api/foto-lokal", sekarang: () => jam });

describe("PenyimpananLokal", () => {
  it("simpan → URL bertanda tangan → bacaLokal → hapus", async () => {
    const p = buat();
    const kunci = kunciFoto("org1", "fto1", new Date(Date.UTC(2026, 9, 15)));
    expect(kunci).toBe("org/org1/2026/10/fto1.webp");
    await p.simpan(kunci, Buffer.from("isi"), "image/webp");
    const url = new URL(await p.urlBertandaTangan(kunci, 300));
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig") ?? "";
    expect(exp).toBe(1_000_000_000 + 300);
    expect((await p.bacaLokal(kunci, exp, sig))?.toString()).toBe("isi");
    await p.hapus(kunci);
    expect(await p.bacaLokal(kunci, exp, sig)).toBeNull();
  });

  it("URL kedaluwarsa, tanda tangan salah, atau kunci lain → null", async () => {
    const p = buat();
    await p.simpan("a/b.webp", Buffer.from("1"), "image/webp");
    await p.simpan("a/c.webp", Buffer.from("2"), "image/webp");
    const u = new URL(await p.urlBertandaTangan("a/b.webp", 300));
    const exp = Number(u.searchParams.get("exp"));
    const sig = u.searchParams.get("sig") ?? "";
    expect(await p.bacaLokal("a/c.webp", exp, sig)).toBeNull();
    expect(await p.bacaLokal("a/b.webp", exp, "00".repeat(32))).toBeNull();
    expect(await p.bacaLokal("a/b.webp", exp + 1, sig)).toBeNull();
    jam += 301_000;
    expect(await p.bacaLokal("a/b.webp", exp, sig)).toBeNull();
  });

  it("menolak kunci berbahaya (path traversal)", async () => {
    const p = buat();
    for (const k of ["../x", "a/../../x", "/etc/passwd", "a//b", "a/./b", "a b", ""]) {
      expect(kunciSah(k)).toBe(false);
      await expect(p.simpan(k, Buffer.from("x"), "image/webp")).rejects.toThrow();
    }
  });
});

describe("buatPenyimpanan", () => {
  it("r2 tanpa konfigurasi lengkap → galat", () => {
    expect(() => buatPenyimpanan({ PENYIMPANAN_MODE: "r2" })).toThrow();
  });
  it("lokal tanpa konfigurasi → PenyimpananLokal", () => {
    expect(buatPenyimpanan({ PENYIMPANAN_MODE: "lokal" })).toBeInstanceOf(PenyimpananLokal);
  });
  it("r2 lengkap → URL bertanda tangan 5 menit tanpa jaringan", async () => {
    const p = buatPenyimpanan({
      PENYIMPANAN_MODE: "r2",
      R2_ACCOUNT_ID: "akun",
      R2_ACCESS_KEY_ID: "kunci",
      R2_SECRET_ACCESS_KEY: "rahasia",
      R2_BUCKET: "serah-foto-uji",
    });
    const url = new URL(await p.urlBertandaTangan("org/o/2026/10/f.webp", 300));
    expect(url.hostname).toBe("serah-foto-uji.akun.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/org/o/2026/10/f.webp");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  });
});
