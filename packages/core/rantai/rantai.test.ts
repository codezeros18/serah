import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HASH_AWAL, hashEvent, kanonis, praGambarEvent, sha256Hex, verifikasiRantai, type EventTersimpan } from "./index";

// T15 versi murni — rantai hash per kawasan (BLUEPRINT §F.3).
// Fixture dibuat independen dengan node:crypto (S02). HARUS DICOCOKKAN DENGAN S01-4 (hash_event SQL).

type BarisFixture = {
  urutanRantai: number;
  jenis: string;
  serahKode: string | null;
  peran: string;
  payload: Record<string, unknown>;
  diterimaPada: string;
  payloadKanonis: string;
  praGambar: string;
  prevHash: string;
  hash: string;
};
const fixture = JSON.parse(readFileSync(new URL("./fixture.json", import.meta.url), "utf8")) as { hashAwal: string; event: BarisFixture[] };
const keEvent = (b: BarisFixture): EventTersimpan => ({ ...b, diterimaPada: new Date(b.diterimaPada) });
const rantaiFixture = (): EventTersimpan[] => fixture.event.map(keEvent);
const nodeSha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("sha256Hex (murni TS) = node:crypto", () => {
  it("vektor baku", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("panjang di sekitar batas blok 64 byte", () => {
    for (const n of [55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
      const s = "a".repeat(n);
      expect(sha256Hex(s)).toBe(nodeSha(s));
    }
  });
  it("UTF-8 multibita & 300 string acak berbenih", () => {
    expect(sha256Hex("é — 😀 Jakarta")).toBe(nodeSha("é — 😀 Jakarta"));
    let benih = 20261015;
    const acak = () => (benih = (benih * 1_103_515_245 + 12_345) % 2_147_483_648);
    for (let i = 0; i < 300; i++) {
      const panjang = acak() % 200;
      let s = "";
      for (let j = 0; j < panjang; j++) s += String.fromCodePoint(acak() % 3 === 0 ? 0x20 + (acak() % 0x2fff) : 0x20 + (acak() % 95));
      expect(sha256Hex(s)).toBe(nodeSha(s));
    }
  });
});

describe("kanonis", () => {
  it("kunci terurut di semua tingkat, tanpa spasi, larik tetap berurutan", () => {
    expect(kanonis({ b: 1, a: { d: [3, 1, 2], c: null } })).toBe('{"a":{"c":null,"d":[3,1,2]},"b":1}');
  });
  it("properti undefined dibuang, null dipertahankan", () => {
    expect(kanonis({ a: undefined, b: null })).toBe('{"b":null}');
  });
  it("string di-escape seperti JSON, non-ASCII apa adanya", () => {
    expect(kanonis({ s: 'kutip " garing \\ baris\nbaru é\u0001' })).toBe('{"s":"kutip \\" garing \\\\ baris\\nbaru é\\u0001"}');
  });
  it("boolean & -0", () => {
    expect(kanonis([true, false, -0])).toBe("[true,false,0]");
  });
  it.each<[string, unknown]>([
    ["pecahan", { a: 1.5 }],
    ["NaN", { a: Number.NaN }],
    ["Infinity", { a: Number.POSITIVE_INFINITY }],
    ["melewati integer aman", { a: 2 ** 53 }],
    ["bigint", { a: BigInt(1) }],
    ["Date", { a: new Date(0) }],
    ["undefined di larik", [1, undefined]],
    ["fungsi", { a: () => 1 }],
  ])("menolak %s", (_n, v) => {
    expect(() => kanonis(v)).toThrow(TypeError);
  });
  it("sama dengan payloadKanonis fixture", () => {
    for (const b of fixture.event) expect(kanonis(b.payload)).toBe(b.payloadKanonis);
  });
});

describe("T15 murni: hash event = fixture (silang dengan SQL S01-4)", () => {
  it("hash awal 64 nol", () => {
    expect(HASH_AWAL).toBe("0".repeat(64));
    expect(fixture.hashAwal).toBe(HASH_AWAL);
  });
  it("pra-gambar & hash setiap event fixture cocok", () => {
    let prev = HASH_AWAL;
    for (const b of fixture.event) {
      const e = keEvent(b);
      expect(b.prevHash).toBe(prev);
      expect(praGambarEvent(prev, e)).toBe(b.praGambar);
      expect(hashEvent(prev, e)).toBe(b.hash);
      expect(nodeSha(b.praGambar)).toBe(b.hash);
      prev = b.hash;
    }
  });
  it("serah_kode null ditulis '-'", () => {
    expect(praGambarEvent(HASH_AWAL, keEvent(fixture.event[0]!)).split("|")[2]).toBe("-");
  });
  it("diterima_pada ISO UTC presisi milidetik", () => {
    const e = { jenis: "SERAH_DISETUJUI", serahKode: "SRH-20261015-0001", peran: "PENGELOLA", payload: {}, diterimaPada: new Date("2026-10-15T10:00:00+07:00") };
    expect(praGambarEvent(HASH_AWAL, e).endsWith("|{}|2026-10-15T03:00:00.000Z")).toBe(true);
  });
  it("hash hex huruf kecil 64 karakter", () => {
    expect(hashEvent(HASH_AWAL, keEvent(fixture.event[0]!))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("T15 murni: verifikasiRantai", () => {
  it("rantai fixture utuh", () => {
    expect(verifikasiRantai(rantaiFixture())).toEqual({ utuh: true, jumlah: 3, patahDiUrutan: null });
  });
  it("rantai kosong utuh", () => {
    expect(verifikasiRantai([])).toEqual({ utuh: true, jumlah: 0, patahDiUrutan: null });
  });
  it("urutan masukan acak tetap diverifikasi menurut urutan_rantai", () => {
    const r = rantaiFixture();
    expect(verifikasiRantai([r[2]!, r[0]!, r[1]!])).toEqual({ utuh: true, jumlah: 3, patahDiUrutan: null });
  });
  it("payload event 2 diubah diam-diam → patah di urutan 2", () => {
    const r = rantaiFixture();
    r[1] = { ...r[1]!, payload: { ...(r[1]!.payload as object), tpsId: "tps99" } };
    expect(verifikasiRantai(r)).toEqual({ utuh: false, jumlah: 3, patahDiUrutan: 2 });
  });
  it("satu angka di payload event 1 diubah → patah di urutan 1", () => {
    const r = rantaiFixture();
    r[0] = { ...r[0]!, payload: { ...(r[0]!.payload as object), beratG: 42_501 } };
    expect(verifikasiRantai(r).patahDiUrutan).toBe(1);
  });
  it("hash event 2 dihitung ulang setelah diubah → patah di urutan 3 (prev tidak cocok)", () => {
    const r = rantaiFixture();
    const ubah = { ...r[1]!, payload: { tpsId: "tps99", wadahIds: [] } };
    r[1] = { ...ubah, hash: hashEvent(ubah.prevHash, ubah) };
    expect(verifikasiRantai(r).patahDiUrutan).toBe(3);
  });
  it("waktu diterima diubah → patah", () => {
    const r = rantaiFixture();
    r[2] = { ...r[2]!, diterimaPada: new Date(r[2]!.diterimaPada.getTime() + 1) };
    expect(verifikasiRantai(r).patahDiUrutan).toBe(3);
  });
  it("event di tengah dihapus → patah di urutan yang hilang", () => {
    const r = rantaiFixture();
    expect(verifikasiRantai([r[0]!, r[2]!])).toEqual({ utuh: false, jumlah: 2, patahDiUrutan: 2 });
  });
  it("event pertama tidak berawal dari 64 nol → patah di urutan 1", () => {
    const r = rantaiFixture();
    const palsu = { ...r[0]!, prevHash: "f".repeat(64) };
    r[0] = { ...palsu, hash: hashEvent(palsu.prevHash, palsu) };
    expect(verifikasiRantai(r).patahDiUrutan).toBe(1);
  });
  it("tidak dimulai dari urutan 1 → patah di urutan 1", () => {
    const r = rantaiFixture();
    expect(verifikasiRantai([r[1]!, r[2]!]).patahDiUrutan).toBe(1);
  });
});
