import { afterEach, describe, expect, it, vi } from "vitest";
import { NAMA_PEKERJAAN, mulaiPenjadwal, putaranCron, type NamaPekerjaan } from "./penjadwal";

// Penjadwal cron dalam proses: ketiga pekerjaan, kegagalan terisolasi, satu penjadwal per proses, tanpa tumpang tindih.

afterEach(() => {
  vi.useRealTimers();
});

describe("putaranCron", () => {
  it("memanggil sepuluh-menit, tiga-jam, harian berurutan dengan waktu yang sama", async () => {
    const panggil: [NamaPekerjaan, number][] = [];
    const t = new Date("2026-10-16T01:00:00.000Z");
    const hasil = await putaranCron(async (n, s) => void panggil.push([n, s.getTime()]), t);
    expect(panggil).toEqual(NAMA_PEKERJAAN.map((n) => [n, t.getTime()]));
    expect(hasil.every((h) => h.ok)).toBe(true);
  });

  it("satu pekerjaan gagal → yang lain tetap berjalan, hasil mencatat kegagalannya", async () => {
    const hasil = await putaranCron(async (n) => {
      if (n === "tiga-jam") throw new Error("BMKG mati untuk uji@contoh.test");
    });
    expect(hasil).toEqual([
      { nama: "sepuluh-menit", ok: true },
      { nama: "tiga-jam", ok: false },
      { nama: "harian", ok: true },
    ]);
  });
});

describe("mulaiPenjadwal", () => {
  it("berjalan setelah tunda awal lalu berkala; berhenti() menghentikan; satu penjadwal per proses", async () => {
    vi.useFakeTimers();
    const jalan = vi.fn(async () => undefined);
    const p = mulaiPenjadwal(jalan, { selangMs: 1_000, tundaAwalMs: 500 });
    expect(mulaiPenjadwal(jalan, { selangMs: 1, tundaAwalMs: 1 })).toBe(p);

    await vi.advanceTimersByTimeAsync(499);
    expect(jalan).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1); // 500 ms: putaran awal
    expect(jalan).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1_000); // 1.500 ms: putaran berkala
    expect(jalan.mock.calls.length).toBeGreaterThanOrEqual(6);

    p.berhenti();
    const sesudah = jalan.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(jalan).toHaveBeenCalledTimes(sesudah);
  });

  it("putaran yang belum selesai tidak ditumpuk", async () => {
    vi.useFakeTimers();
    let aktif = 0;
    let puncak = 0;
    const lambat = async () => {
      aktif += 1;
      puncak = Math.max(puncak, aktif);
      await new Promise((r) => setTimeout(r, 5_000));
      aktif -= 1;
    };
    const p = mulaiPenjadwal(lambat, { selangMs: 1_000, tundaAwalMs: 0 });
    await vi.advanceTimersByTimeAsync(20_000);
    p.berhenti();
    expect(puncak).toBe(1);
  });
});
