import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AuthDaftarMasukan,
  DAFTAR_RUTE,
  SerahTutupMasukan,
  SinkronMasukan,
  WadahCatatMasukan,
} from "./index";

const fixture = readFileSync(new URL("../__fixtures__/rute-k2.txt", import.meta.url), "utf8")
  .split(/\r?\n/)
  .map((b) => b.trim())
  .filter((b) => b && !b.startsWith("#"));

const kunci = (metode: string, jalur: string) => `${metode} ${jalur}`;

describe("registri rute = §K.2", () => {
  it("fixture §K.2 berisi 99 rute unik", () => {
    expect(new Set(fixture).size).toBe(fixture.length);
    expect(fixture.length).toBe(99);
  });

  it("setiap rute §K.2 punya definisi, dan tidak ada rute di luar §K.2", () => {
    const terdaftar = DAFTAR_RUTE.map((r) => kunci(r.metode, r.jalur));
    expect(new Set(terdaftar).size).toBe(terdaftar.length);
    expect(fixture.filter((r) => !terdaftar.includes(r))).toEqual([]);
    expect(terdaftar.filter((r) => !fixture.includes(r))).toEqual([]);
  });

  it("setiap rute punya skema masukan & keluaran zod", () => {
    for (const r of DAFTAR_RUTE) {
      expect(r.masukan, kunci(r.metode, r.jalur)).toBeInstanceOf(z.ZodType);
      expect(r.keluaran, kunci(r.metode, r.jalur)).toBeInstanceOf(z.ZodType);
    }
  });

  it("setiap segmen dinamis punya skema params", () => {
    for (const r of DAFTAR_RUTE) {
      if (r.jalur.includes("[")) expect(r.params, kunci(r.metode, r.jalur)).toBeDefined();
    }
  });
});

describe("skema masukan .strict() → field tak dikenal ditolak", () => {
  it("menolak field hasil hitung yang dikirim klien", () => {
    const hasil = WadahCatatMasukan.safeParse({
      tpsId: "tz4a98xxat96iws9zmbrgj3a",
      aliran: "KUNING",
      beratG: 42_500,
      terjadiPada: "2026-10-15T08:00:00+07:00",
      umurJam: 3,
    });
    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
  });

  it("menolak field tak dikenal di objek bersarang", () => {
    const hasil = SerahTutupMasukan.safeParse({
      tiket: { beratG: 1000, sumber: "MANUAL", totalIdr: 5 },
      rincian: [{ aliran: "KUNING", diterimaG: 1000, ditolakG: 0 }],
    });
    expect(hasil.error?.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
  });

  it("setiap skema masukan objek bersifat strict", () => {
    const lolos: string[] = [];
    for (const r of DAFTAR_RUTE) {
      if (r.jalur === "/api/webhook/midtrans") continue; // payload mentah, divalidasi di adaptor bayar
      for (const [nama, skema] of [["masukan", r.masukan], ["kueri", r.kueri]] as const) {
        if (!skema) continue;
        const h = skema.safeParse({ __fieldAsing: 1 });
        const ditolakSebagaiAsing = !h.success && h.error.issues.some((i) => i.code === "unrecognized_keys");
        if (!ditolakSebagaiAsing) lolos.push(`${kunci(r.metode, r.jalur)} (${nama})`);
      }
    }
    expect(lolos).toEqual([]);
  });
});

describe("angka bulat", () => {
  it("menolak berat pecahan & di luar rentang", () => {
    const dasar = { tpsId: "tz4a98xxat96iws9zmbrgj3a", aliran: "HIJAU", terjadiPada: "2026-10-15T08:00:00+07:00" };
    expect(WadahCatatMasukan.safeParse({ ...dasar, beratG: 42.5 }).success).toBe(false);
    expect(WadahCatatMasukan.safeParse({ ...dasar, beratG: 0 }).success).toBe(false);
    expect(WadahCatatMasukan.safeParse({ ...dasar, beratG: 5_000_001 }).success).toBe(false);
    expect(WadahCatatMasukan.safeParse({ ...dasar, beratG: 42_500 }).success).toBe(true);
  });

  it("wadah wajib berat atau jumlah", () => {
    const dasar = { tpsId: "tz4a98xxat96iws9zmbrgj3a", aliran: "HIJAU", terjadiPada: "2026-10-15T08:00:00+07:00" };
    expect(WadahCatatMasukan.safeParse(dasar).success).toBe(false);
    expect(WadahCatatMasukan.safeParse({ ...dasar, jumlahWadah: 2 }).success).toBe(true);
  });
});

describe("contoh skema lain", () => {
  it("sandi minimal 10 karakter", () => {
    expect(AuthDaftarMasukan.safeParse({ email: "a@contoh.id", sandi: "123456789", persetujuanVersi: "PRIV-2026-10-1" }).success).toBe(false);
    expect(AuthDaftarMasukan.safeParse({ email: "a@contoh.id", sandi: "1234567890", persetujuanVersi: "PRIV-2026-10-1" }).success).toBe(true);
  });

  it("sinkron menolak batch >20", () => {
    const aksi = Array.from({ length: 21 }, () => ({
      idempotencyKey: "0b8f7b5e-6c1a-4f7e-9d43-2a1b3c4d5e6f",
      jenis: "SERAH_BUAT",
      terjadiPada: "2026-10-15T08:00:00+07:00",
      payload: { tpsId: "tz4a98xxat96iws9zmbrgj3a", wadahIds: ["tz4a98xxat96iws9zmbrgj3a"] },
    }));
    expect(SinkronMasukan.safeParse({ aksi }).success).toBe(false);
    expect(SinkronMasukan.safeParse({ aksi: aksi.slice(0, 20) }).success).toBe(true);
  });
});
