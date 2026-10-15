import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEKS, isi, type KunciTeks } from "./teks";

// Fixture = salinan blok §M apa adanya. Pengurai sengaja ditulis ulang di sini (bukan diimpor dari
// skrip generator) agar test tidak ikut salah bila generator salah.
const salinan = readFileSync(new URL("./__fixtures__/blueprint-m.txt", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = new Map<string, string>();
const kunciGanda: string[] = [];
for (const baris of salinan.split("\n")) {
  const m = /^([A-Z][A-Z0-9_]*)\s*=\s?(.*)$/.exec(baris);
  if (!m?.[1]) continue;
  if (fixture.has(m[1])) kunciGanda.push(m[1]);
  fixture.set(m[1], (m[2] ?? "").trimEnd());
}

function acakBerbenih(benih: number) {
  let s = benih >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("TEKS = salinan persis §M", () => {
  it("jumlah kunci TEKS sama dengan jumlah kunci di §M, tanpa kunci ganda", () => {
    expect(kunciGanda).toEqual([]);
    expect(fixture.size).toBeGreaterThan(400);
    expect(Object.keys(TEKS).length).toBe(fixture.size);
  });

  it("tidak ada kunci §M yang hilang dan tidak ada kunci karangan", () => {
    const diTeks = new Set(Object.keys(TEKS));
    expect([...fixture.keys()].filter((k) => !diTeks.has(k))).toEqual([]);
    expect([...diTeks].filter((k) => !fixture.has(k))).toEqual([]);
  });

  it("20 kunci acak identik dengan fixture", () => {
    const kunci = [...fixture.keys()];
    const acak = acakBerbenih(20261015);
    const terpilih = new Set<string>();
    while (terpilih.size < 20) terpilih.add(kunci[Math.floor(acak() * kunci.length)] ?? "");
    for (const k of terpilih) expect(TEKS[k as KunciTeks], k).toBe(fixture.get(k));
  });

  it("setiap nilai identik dengan fixture", () => {
    for (const [k, v] of fixture) expect(TEKS[k as KunciTeks], k).toBe(v);
  });

  it("kalimat jangkar tepat", () => {
    expect(TEKS.LANDING_JUDUL).toBe("Satu serah, tiga laporan.");
    expect(TEKS.R10_CATATAN).toBe("Informasi ini bukan peringatan dini resmi. Ikuti arahan BPBD dan BMKG.");
  });
});

describe("isi()", () => {
  it("mengisi placeholder", () => {
    expect(isi("UMUM_KG", { nilai: "42,5" })).toBe("42,5 kg");
    expect(isi("KTR_BERLAKU", { dari: "1 Okt", sampai: "31 Des" })).toBe("Berlaku 1 Okt – 31 Des");
    expect(isi("APP_NAMA")).toBe("SERAH");
  });

  it("menolak placeholder yang tidak diisi", () => {
    // Dipaksa lewat cast untuk menguji jalur runtime; tipe normal menolak panggilan ini.
    const isiLonggar = isi as (k: KunciTeks, n?: Record<string, string>) => string;
    expect(() => isiLonggar("UMUM_KG", {})).toThrow(/nilai/);
  });
});
