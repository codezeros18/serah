import { TEKS, isi } from "@serah/kontrak";
import { describe, expect, it } from "vitest";
import { PengirimResend, PengirimTerminal, buatPengirim, samarkanEmail } from "./index";
import { susunEmail, templatNotifikasi, templatReset, templatTagihan, templatUndangan, templatVerifikasi, type Templat } from "./templat";

// S07-4 — templat email hanya dari teks.ts: setiap bagian = kunci TEKS atau tautan; keluaran tidak memuat kalimat lain.

const TAUTAN = "https://serah.contoh/verifikasi?token=abc";
const semua: [string, Templat][] = [
  ["verifikasi", templatVerifikasi(TAUTAN)],
  ["reset", templatReset(TAUTAN)],
  ["undangan", templatUndangan(TAUTAN, "Pasar Mekar Sari Kemayoran", "PERAN_PETUGAS")],
  ["notifikasi", templatNotifikasi("NTF_SERAH_MENUNGGU_SETUJU", { kode: "SRH-20261015-0001" }, TAUTAN)],
  ["tagihan", templatTagihan("TGH-202610-0001", "700.000")],
];

describe("templat email dari teks §M", () => {
  it.each(semua)("%s: setiap bagian adalah kunci TEKS atau tautan", (_n, t) => {
    for (const b of [t.judul, ...t.isi]) {
      if ("tautan" in b) expect(b.tautan.startsWith("https://")).toBe(true);
      else expect(Object.keys(TEKS)).toContain(b.teks);
    }
  });

  it.each(semua)("%s: keluaran hanya terdiri dari teks TEKS (setelah isi placeholder) dan tautan", (_n, t) => {
    const pesan = susunEmail("penerima@contoh.test", t);
    const isiTeks = (kunci: keyof typeof TEKS, nilai: Record<string, string | number> = {}) =>
      (TEKS[kunci] as string).replace(/\{([a-z0-9_]+)\}/g, (_m, n: string) => String(nilai[n]));
    const sah = new Set(t.isi.map((b) => ("tautan" in b ? b.tautan : isiTeks(b.teks, b.nilai))));
    for (const paragraf of pesan.teks.split("\n\n")) expect(sah, paragraf).toContain(paragraf);
    expect(pesan.subjek.startsWith("[SERAH] ")).toBe(true);
    // Tidak ada sisa placeholder.
    expect(pesan.subjek + pesan.teks).not.toMatch(/\{[a-z_]+\}/);
  });

  it("isi undangan memakai nama organisasi & label peran dari TEKS", () => {
    const p = susunEmail("x@contoh.test", templatUndangan(TAUTAN, "Pasar Mekar Sari Kemayoran", "PERAN_PETUGAS"));
    expect(p.teks).toContain(isi("UND_PENJELASAN", { nama_organisasi: "Pasar Mekar Sari Kemayoran", peran: TEKS.PERAN_PETUGAS }));
    expect(p.subjek).toBe(isi("EMAIL_SUBJEK_NOTIFIKASI", { judul: TEKS.UND_JUDUL }));
  });
});

describe("pengirim", () => {
  it("pengembangan tidak pernah memakai Resend walau kunci ada; produksi memakai Resend", () => {
    expect(buatPengirim({ produksi: false, resendApiKey: "k", emailDari: "a@b.c" })).toBeInstanceOf(PengirimTerminal);
    expect(buatPengirim({ produksi: true, resendApiKey: "k", emailDari: "a@b.c" })).toBeInstanceOf(PengirimResend);
  });

  it("alamat di terminal disamarkan", () => {
    expect(samarkanEmail("petugas@contoh.test")).toBe("p***@contoh.test");
  });
});
