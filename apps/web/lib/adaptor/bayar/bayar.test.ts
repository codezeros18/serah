import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MidtransSandbox, penyediaBayar, petakanStatus, setelPenyediaUji, tandaTanganMidtrans, uraiRupiah } from "./index";
import { KUNCI_SERVER_UJI, SandboxTiruan } from "./uji";

// S19-4 — adaptor penyedia pembayaran (GAP-MID-01): tanda tangan, nominal tanpa float, pemetaan status, hanya sandbox.

describe("tanda tangan notifikasi", () => {
  it("SHA512(order_id + status_code + gross_amount + ServerKey), hex", () => {
    const harap = createHash("sha512").update("TGH-2026-10-00001" + "200" + "350000.00" + "kunci").digest("hex");
    expect(tandaTanganMidtrans("TGH-2026-10-00001", "200", "350000.00", "kunci")).toBe(harap);
  });

  it("sah → diterjemahkan ke kosakata domain; dirusak, kunci lain, atau field hilang → null", () => {
    const s = new SandboxTiruan();
    const t = { status: "settlement", jumlahIdr: 700_000, idTransaksi: "trx-1" } as const;
    expect(s.penyedia.verifikasiNotifikasi(s.notifikasi("TGH-1", t))).toMatchObject({ nomorTagihan: "TGH-1", kunciPeristiwa: "trx-1:settlement", jumlahIdr: 700_000 });
    expect(s.penyedia.verifikasiNotifikasi(s.notifikasi("TGH-1", t, { tandaSalah: true }))).toBeNull();
    expect(new MidtransSandbox("kunci-lain").verifikasiNotifikasi(s.notifikasi("TGH-1", t))).toBeNull();
    const { order_id: _, ...tanpaNomor } = s.notifikasi("TGH-1", t);
    expect(s.penyedia.verifikasiNotifikasi(tanpaNomor)).toBeNull();
    // Nominal diubah setelah ditandatangani → tidak sah.
    expect(s.penyedia.verifikasiNotifikasi({ ...s.notifikasi("TGH-1", t), gross_amount: "1.00" })).toBeNull();
  });
});

describe("nominal & status", () => {
  it("uraiRupiah: bilangan bulat saja, tanpa float", () => {
    expect(uraiRupiah("350000.00")).toBe(350_000);
    expect(uraiRupiah("350000")).toBe(350_000);
    expect(uraiRupiah(350_000)).toBe(350_000);
    for (const v of ["350000.50", "-1", "1e5", "", null, undefined, "abc"]) expect(uraiRupiah(v)).toBeNull();
  });

  it("settlement / capture+accept = LUNAS; capture tanpa accept tidak", () => {
    expect(petakanStatus("settlement", null)).toBe("LUNAS");
    expect(petakanStatus("capture", "accept")).toBe("LUNAS");
    expect(petakanStatus("capture", "challenge")).toBe("MENUNGGU");
    expect(petakanStatus("pending", null)).toBe("MENUNGGU");
    expect(petakanStatus("expire", null)).toBe("KEDALUWARSA");
    for (const s of ["cancel", "deny", "failure"]) expect(petakanStatus(s, null)).toBe("GAGAL");
    expect(petakanStatus("refund", null)).toBe("DIKEMBALIKAN");
    expect(petakanStatus("tak-dikenal", null)).toBe("MENUNGGU");
  });
});

describe("panggilan HTTP (fetch tiruan)", () => {
  it("buat pembayaran & tarik status hanya ke host sandbox, Basic auth kunci server", async () => {
    const s = new SandboxTiruan();
    expect(await s.penyedia.buatPembayaran({ nomorTagihan: "TGH-9", totalIdr: 350_000 })).toEqual({
      token: "tok-TGH-9",
      urlBayar: "https://app.sandbox.midtrans.com/snap/v4/redirection/tok-TGH-9",
    });
    s.atur("TGH-9", { status: "settlement", jumlahIdr: 350_000, idTransaksi: "trx-9" });
    expect(await s.penyedia.tarikStatus("TGH-9")).toMatchObject({ status: "LUNAS", jumlahIdr: 350_000, idTransaksi: "trx-9" });
    expect((await s.penyedia.tarikStatus("TGH-tidak-ada")).status).toBe("TIDAK_ADA");
    for (const p of s.panggilan) expect(p).toMatch(/^(POST|GET) https:\/\/(app|api)\.sandbox\.midtrans\.com\//);
    await expect(new MidtransSandbox("kunci-salah", new SandboxTiruan(KUNCI_SERVER_UJI).ambil).tarikStatus("TGH-9")).rejects.toThrow(/401/);
  });

  it("total bukan bilangan bulat positif ditolak sebelum memanggil jaringan", async () => {
    const s = new SandboxTiruan();
    await expect(s.penyedia.buatPembayaran({ nomorTagihan: "X", totalIdr: 1.5 })).rejects.toThrow();
    await expect(s.penyedia.buatPembayaran({ nomorTagihan: "X", totalIdr: 0 })).rejects.toThrow();
    expect(s.panggilan).toHaveLength(0);
  });

  it("tanpa kunci server → tidak ada penyedia (hanya transfer manual)", () => {
    setelPenyediaUji(undefined);
    expect(penyediaBayar({ serverKey: undefined })).toBeNull();
    expect(penyediaBayar({ serverKey: "" })).toBeNull();
    expect(penyediaBayar({ serverKey: "abc" })).toBeInstanceOf(MidtransSandbox);
    expect(() => new MidtransSandbox("")).toThrow();
  });
});
