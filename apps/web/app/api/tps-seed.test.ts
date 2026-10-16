import { describe, expect, it } from "vitest";
import { data, demo, denganPemilik, masuk, panggil } from "@/lib/server/uji/klien";
import { POST as buatTps } from "./tps/route";

// Regresi: tambah TPS di kawasan demo tidak boleh bentrok dengan kode TPS yang di-seed (dulu penghitung mulai dari 1 →
// TPS-PCS-01 sudah ada → kendala unik → 500 "Terjadi gangguan"). Nomor yang sudah dipakai dilewati.

describe("tambah TPS pada kawasan ber-seed", () => {
  it("TPS baru mendapat kode yang belum dipakai, bukan 500", async () => {
    const d = await demo();
    const pengelola = await masuk("PENGELOLA");
    const { tps: t } = data<{ tps: { kode: string; id: string } }>(
      await panggil(buatTps, { jalur: "/api/tps", cookie: pengelola, body: { kawasanId: d.kawasan, nama: "TPS Uji Regresi", latE6: -6_165_000, lonE6: 106_846_000 } }),
    );
    try {
      expect(t.kode).toMatch(/^TPS-PCS-\d{2}$/);
      expect(["TPS-PCS-01", "TPS-PCS-02", "TPS-PCS-03", "TPS-PCS-04", "TPS-PCS-05"]).not.toContain(t.kode);
    } finally {
      // Jaga batas paket (tps.maks) pada putaran uji berikutnya.
      await denganPemilik((k) => k.query(`DELETE FROM tps WHERE id = $1`, [t.id]));
    }
  });
});
