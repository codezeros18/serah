import { HealthKeluaran } from "@serah/kontrak";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "@/lib/server/db";
import { jalankanCron } from "@/lib/server/layanan/cron";
import { GET as health } from "./health/route";

// S26-4 — /api/health: db, umur BMKG, versi, cron terakhir; MERAH (503) bila DB tidak terjangkau.

afterEach(() => vi.restoreAllMocks());

describe("GET /api/health", () => {
  it("hijau: db ok, versi, umur BMKG, tiga pekerjaan cron dengan waktu selesai terakhir; lolos skema kontrak", async () => {
    await jalankanCron("harian", new Date(), { jendela: `uji-health-${Date.now()}` });
    const r = await health();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const isi = (await r.json()).data;
    expect(HealthKeluaran.safeParse(isi).success).toBe(true);
    expect(isi.db).toBe("ok");
    expect(isi.cron.map((c: { nama: string }) => c.nama)).toEqual(["sepuluh-menit", "tiga-jam", "harian"]);
    const harian = isi.cron.find((c: { nama: string }) => c.nama === "harian");
    expect(Date.now() - new Date(harian.selesaiPada).getTime()).toBeLessThan(5 * 60_000);
  });

  it("merah: DB mati → 503, db: galat, tanpa detail galat", async () => {
    vi.spyOn(db, "denganPublik").mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5440"), { code: "ECONNREFUSED" }));
    const r = await health();
    expect(r.status).toBe(503);
    const teks = await r.text();
    expect(JSON.parse(teks).data).toEqual({ versi: expect.any(String), db: "galat", bmkgUmurJam: null });
    expect(teks).not.toContain("ECONNREFUSED");
    expect(teks).not.toContain("5440");
  });

  it("merah juga bila kueri cron gagal (DB putus di tengah)", async () => {
    vi.spyOn(db, "denganSistem").mockRejectedValue(new Error("terputus"));
    expect((await health()).status).toBe(503);
  });
});
