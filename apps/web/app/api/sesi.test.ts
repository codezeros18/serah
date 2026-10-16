import { describe, expect, it } from "vitest";
import { muatEnv } from "@/lib/server/env";
import { POST as demo } from "./auth/demo/route";
import { POST as keluar } from "./auth/keluar/route";
import { GET as sesi } from "./sesi/route";
import { POST as gantiOrganisasi } from "./sesi/organisasi/route";

// S01-6 — integrasi: masuk demo → GET /api/sesi → ganti organisasi (ditolak bila bukan anggota) → keluar → sesi habis.
// Butuh DEMO_MODE=true dan DB ber-seed demo (pnpm db:reset).

const asal = () => new URL(muatEnv().BASE_URL).origin;
const permintaan = (jalur: string, init: RequestInit & { cookie?: string } = {}) =>
  new Request(`${asal()}${jalur}`, {
    ...init,
    headers: { origin: asal(), "content-type": "application/json", ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers },
  });

function ambilCookie(r: Response): string {
  const set = r.headers.get("set-cookie") ?? "";
  expect(set).toMatch(/^__Host-serah=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);
  return set.split(";")[0] ?? "";
}

describe("alur sesi demo", () => {
  it("masuk demo PENGELOLA → sesi berisi organisasi, peran, paket uji coba & hak → keluar → SESI_HABIS", async () => {
    const masuk = await demo(permintaan("/api/auth/demo", { method: "POST", body: JSON.stringify({ peran: "PENGELOLA" }) }));
    expect(masuk.status).toBe(200);
    const isiMasuk = await masuk.json();
    expect(isiMasuk.data.sesi.peranAktif).toBe("PENGELOLA");
    expect(isiMasuk.data.sesi.organisasi[0]).toMatchObject({ nama: "Pasar Mekar Sari Kemayoran", jenis: "KAWASAN", peran: ["PENGELOLA"] });
    const cookie = ambilCookie(masuk);

    const s = await sesi(permintaan("/api/sesi", { cookie }));
    expect(s.status).toBe(200);
    const isi = await s.json();
    expect(isi.ok).toBe(true);
    expect(isi.data.organisasiAktif).toMatchObject({ kode: "ORG-PCS", nama: "Pasar Mekar Sari Kemayoran", jenis: "KAWASAN" });
    expect(isi.data.peran).toBe("PENGELOLA");
    expect(isi.data.paket).toBe("KAWASAN_UJI_COBA");
    expect(isi.data.hak).toHaveLength(8);
    expect(isi.data.hak).toContainEqual({ kunci: "tps.maks", nilai: 10 });

    const ganti = await gantiOrganisasi(
      permintaan("/api/sesi/organisasi", { method: "POST", cookie, body: JSON.stringify({ organisasiId: "tz4a98xxat96iws9zmbrgj3a", peran: "ADMIN" }) }),
    );
    expect(ganti.status).toBe(403);
    expect((await ganti.json()).galat.kode).toBe("PERAN_TIDAK_BOLEH");

    const k = await keluar(permintaan("/api/auth/keluar", { method: "POST", cookie }));
    expect(k.status).toBe(200);
    expect(k.headers.get("set-cookie")).toMatch(/Max-Age=0/);

    const setelah = await sesi(permintaan("/api/sesi", { cookie }));
    expect(setelah.status).toBe(401);
    expect((await setelah.json()).galat).toMatchObject({ kode: "SESI_HABIS", pesan: "Sesi berakhir. Silakan masuk kembali." });
  });

  it("masuk demo PENGANGKUT → paket MITRA", async () => {
    const masuk = await demo(permintaan("/api/auth/demo", { method: "POST", body: JSON.stringify({ peran: "PENGANGKUT" }) }));
    const s = await sesi(permintaan("/api/sesi", { cookie: ambilCookie(masuk) }));
    const isi = await s.json();
    expect(isi.data).toMatchObject({ peran: "PENGANGKUT", paket: "MITRA" });
  });

  it("menolak mutasi tanpa Origin yang sama (CSRF) dan field tak dikenal", async () => {
    const tanpaAsal = await demo(new Request(`${asal()}/api/auth/demo`, { method: "POST", body: JSON.stringify({ peran: "PETUGAS" }) }));
    expect(tanpaAsal.status).toBe(400);
    const asing = await demo(permintaan("/api/auth/demo", { method: "POST", body: JSON.stringify({ peran: "PETUGAS", admin: true }) }));
    expect(asing.status).toBe(400);
    expect((await asing.json()).galat.kode).toBe("FIELD_TIDAK_DIKENAL");
  });

  it("tanpa cookie atau dengan token palsu → 401 SESI_HABIS", async () => {
    expect((await sesi(permintaan("/api/sesi"))).status).toBe(401);
    expect((await sesi(permintaan("/api/sesi", { cookie: "__Host-serah=palsu" }))).status).toBe(401);
  });
});
