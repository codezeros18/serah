import { describe, expect, it } from "vitest";
import { penyimpananDariAdaptor, tandaFotoSah, type AdaptorObjek } from "./integrasi";

// Penyimpanan R2 di server: pembungkus atas adaptor objek. Bucket privat; klien hanya menerima URL aplikasi
// bertanda tangan. Diuji dengan adaptor objek di memori (R2 sungguhan diuji manual, lihat PROGRESS-A S28).

function adaptorMemori() {
  const isi = new Map<string, { buffer: Buffer; mime: string }>();
  const jejak: string[] = [];
  const a: AdaptorObjek = {
    async simpan(k, b, mime) {
      jejak.push(`simpan ${k}`);
      isi.set(k, { buffer: Buffer.from(b), mime });
    },
    async baca(k) {
      jejak.push(`baca ${k}`);
      return isi.get(k)?.buffer ?? null;
    },
    async hapus(k) {
      jejak.push(`hapus ${k}`);
      isi.delete(k);
    },
  };
  return { a, isi, jejak };
}

const HASH = "a".repeat(64);
const KUNCI = `org1abc/MUATAN/${HASH}.webp`;

describe("penyimpananDariAdaptor", () => {
  it("simpan → baca → hapus; objek tidak ada → null", async () => {
    const { a, isi } = adaptorMemori();
    const p = penyimpananDariAdaptor(a);
    expect(await p.baca(KUNCI)).toBeNull();
    await p.simpan(KUNCI, new Uint8Array([1, 2, 3, 250]), "image/webp");
    expect(isi.get(KUNCI)?.mime).toBe("image/webp");
    expect([...(await p.baca(KUNCI))!]).toEqual([1, 2, 3, 250]);
    await p.hapus(KUNCI);
    expect(await p.baca(KUNCI)).toBeNull();
  });

  it("kunci di luar format penyimpanan: simpan ditolak; baca → null; hapus tidak menyentuh adaptor", async () => {
    const { a, jejak } = adaptorMemori();
    const p = penyimpananDariAdaptor(a);
    for (const k of ["../rahasia", "org/x/../y", "seed-demo-tanpa-objek", `org/MUATAN/${HASH}.exe`]) {
      await expect(p.simpan(k, new Uint8Array([1]), "image/png")).rejects.toMatchObject({ kode: "VALIDASI_GAGAL" });
      expect(await p.baca(k)).toBeNull();
      await p.hapus(k);
    }
    expect(jejak).toEqual([]);
  });

  it("urlBertanda: URL aplikasi (bukan URL R2) dengan tanda HMAC yang sah, kedaluwarsa 5 menit", () => {
    const { a } = adaptorMemori();
    const p = penyimpananDariAdaptor(a);
    const sekarang = new Date("2026-10-16T05:00:00.000Z");
    const { url, kedaluwarsaPada } = p.urlBertanda(KUNCI, sekarang);
    const u = new URL(url);
    expect(u.pathname).toBe("/api/foto/berkas");
    expect(u.hostname).not.toMatch(/r2\.cloudflarestorage\.com/);
    expect(kedaluwarsaPada.getTime() - sekarang.getTime()).toBe(5 * 60_000);
    const q = u.searchParams;
    expect(q.get("k")).toBe(KUNCI);
    expect(tandaFotoSah(KUNCI, Number(q.get("e")), q.get("t")!, sekarang)).toBe(true);
    // Kedaluwarsa, kunci lain, atau tanda dirusak → ditolak.
    expect(tandaFotoSah(KUNCI, Number(q.get("e")), q.get("t")!, new Date(sekarang.getTime() + 6 * 60_000))).toBe(false);
    expect(tandaFotoSah(`org1abc/TIKET/${HASH}.webp`, Number(q.get("e")), q.get("t")!, sekarang)).toBe(false);
    expect(tandaFotoSah(KUNCI, Number(q.get("e")), `${q.get("t")!}x`, sekarang)).toBe(false);
  });
});
