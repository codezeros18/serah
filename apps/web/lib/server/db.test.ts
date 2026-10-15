import { beforeAll, describe, expect, it } from "vitest";
import { denganAdmin, denganAkses, denganSistem, prisma } from "./db";
import { GalatApi } from "./galat";
import { idDemo, type IdDemo } from "./uji/demo";

// S01-5 — satu-satunya pintu DB. Tanpa konteks → kosong (RLS), dengan konteks → hanya organisasinya.

let d: IdDemo;
beforeAll(async () => {
  d = await idDemo();
});

describe("akses DB aplikasi (role serah_app)", () => {
  it("kueri di luar denganAkses mengembalikan kosong walau data ada", async () => {
    expect(d.jumlahWadah).toBeGreaterThan(0);
    expect(await prisma().wadahCatat.count({ where: { kawasanId: d.kawasan } })).toBe(0);
    expect(await prisma().organisasi.count({ where: { id: d.orgKawasan } })).toBe(0);
    expect(await prisma().event.count()).toBe(0);
  });

  it("denganAkses kawasan: melihat seluruh wadah & event kawasannya; tidak melihat organisasi internal", async () => {
    const hasil = await denganAkses({ penggunaId: "uji", orgIds: [d.orgKawasan], peran: "PENGELOLA" }, async (tx) => ({
      wadah: await tx.wadahCatat.count({ where: { kawasanId: d.kawasan } }),
      event: await tx.event.count({ where: { kawasanId: d.kawasan } }),
      internal: await tx.organisasi.count({ where: { id: d.orgInternal } }),
    }));
    // Test lain boleh menambah data kawasan yang sama secara paralel: hasil RLS harus berada di antara hitungan
    // pemilik sebelum dan sesudah kueri (tidak ada baris kawasan yang tersembunyi).
    const sesudah = await idDemo();
    expect(hasil.internal).toBe(0);
    expect(hasil.wadah).toBeGreaterThanOrEqual(d.jumlahWadah);
    expect(hasil.wadah).toBeLessThanOrEqual(sesudah.jumlahWadah);
    expect(hasil.event).toBeGreaterThanOrEqual(d.jumlahEvent);
    expect(hasil.event).toBeLessThanOrEqual(sesudah.jumlahEvent);
  });

  it("konteks tidak bocor ke transaksi berikutnya (SET LOCAL)", async () => {
    await denganAkses({ penggunaId: "uji", orgIds: [d.orgKawasan], peran: "PENGELOLA" }, (tx) => tx.wadahCatat.count());
    expect(await prisma().wadahCatat.count({ where: { kawasanId: d.kawasan } })).toBe(0);
  });

  it("rantai demo utuh lewat verifikasi_rantai untuk pihak terkait; pihak tak terkait ditolak", async () => {
    const r = await denganAkses({ penggunaId: "uji", orgIds: [d.orgPengangkut], peran: "PENGANGKUT" }, (tx) =>
      tx.$queryRaw<{ utuh: boolean; jumlah: number; patah_di_urutan: number | null }[]>`SELECT * FROM verifikasi_rantai(${d.kawasan})`,
    );
    expect(r[0]).toMatchObject({ utuh: true, patah_di_urutan: null });
    expect(r[0]?.jumlah).toBeGreaterThanOrEqual(d.jumlahEvent);
    expect(r[0]?.jumlah).toBeLessThanOrEqual((await idDemo()).jumlahEvent);
    await expect(
      denganAkses({ penggunaId: "uji", orgIds: ["org-lain"], peran: "PENGANGKUT" }, (tx) => tx.$queryRaw`SELECT * FROM verifikasi_rantai(${d.kawasan})`),
    ).rejects.toThrow();
  });

  it("denganAdmin: menolak alasan <15 karakter & peran bukan ADMIN; alasan sah → lintas organisasi + audit_log", async () => {
    const admin = { penggunaId: "uji-admin", orgIds: [d.orgInternal], peran: "ADMIN" as const };
    expect(() => denganAdmin(admin, "terlalu pendek", async () => 0)).toThrow(GalatApi);
    expect(() => denganAdmin({ ...admin, peran: "PENGELOLA" }, "alasan yang cukup panjang", async () => 0)).toThrow(GalatApi);

    const alasan = `uji akses admin ${Date.now()}`;
    const wadah = await denganAdmin(admin, alasan, (tx) => tx.wadahCatat.count({ where: { kawasanId: d.kawasan } }), {
      aksi: "UJI_BACA",
      objekJenis: "kawasan",
      objekId: d.kawasan,
      organisasiId: d.orgKawasan,
    });
    expect(wadah).toBeGreaterThanOrEqual(d.jumlahWadah);
    expect(wadah).toBeLessThanOrEqual((await idDemo()).jumlahWadah);
    const audit = await denganSistem((tx) => tx.auditLog.findMany({ where: { alasan } }));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ peran: "ADMIN", aksi: "UJI_BACA", objekId: d.kawasan, organisasiId: d.orgKawasan });
  });

  it("denganSistem: lintas organisasi (untuk cron/webhook)", async () => {
    const n = await denganSistem((tx) => tx.organisasi.count({ where: { id: { in: [d.orgKawasan, d.orgPengangkut, d.orgInternal] } } }));
    expect(n).toBe(3);
  });
});
