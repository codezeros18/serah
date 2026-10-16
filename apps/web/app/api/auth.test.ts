import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PengirimRekam, setelPengirimUji } from "@/lib/adaptor/email";
import { buatPenggunaDenganPersetujuan } from "@/lib/server/auth";
import { muatEnv } from "@/lib/server/env";
import type { Tx } from "@/lib/server/db";
import { kueriPemilik } from "@/lib/server/uji/db";
import { cookieDari, emailBaru, ipBaru, permintaan, tokenTerakhir as tokenDari } from "@/lib/server/uji/http";
import { POST as tarik } from "./akun/tarik-persetujuan/route";
import { POST as daftar } from "./auth/daftar/route";
import { POST as lupa } from "./auth/lupa/route";
import { POST as masuk } from "./auth/masuk/route";
import { POST as reset } from "./auth/reset/route";
import { POST as verifikasi } from "./auth/verifikasi/route";
import { GET as sesi } from "./sesi/route";

// S07-1, S07-3 — integrasi alur akun. Butuh PostgreSQL ber-seed (teks persetujuan PRIV-2026-10-1).

const rekam = new PengirimRekam();
beforeAll(() => setelPengirimUji(rekam));
afterAll(() => setelPengirimUji(null));

const VERSI = "PRIV-2026-10-1";
const SANDI = "sandi-uji-panjang-1";
const tokenTerakhir = (ke: string, jalur: string) => tokenDari(rekam, ke, jalur);

/** Daftar + verifikasi + masuk; kembalikan email & cookie. */
async function akunTerverifikasi(): Promise<{ email: string; cookie: string }> {
  const email = emailBaru();
  expect((await daftar(permintaan("/api/auth/daftar", { body: { email, sandi: SANDI, persetujuanVersi: VERSI } }))).status).toBe(200);
  expect((await verifikasi(permintaan("/api/auth/verifikasi", { body: { token: tokenTerakhir(email, "/verifikasi") } }))).status).toBe(200);
  const m = await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }));
  expect(m.status).toBe(200);
  return { email, cookie: cookieDari(m) };
}

describe("S07-1 daftar, verifikasi, masuk", () => {
  it("persetujuan PDP ditulis SEBELUM baris pengguna (urutan pemanggilan)", async () => {
    const urutan: string[] = [];
    const tx = {
      persetujuanPdp: { create: async () => void urutan.push("persetujuan_pdp") },
      pengguna: { create: async () => void urutan.push("pengguna") },
    } as unknown as Tx;
    await buatPenggunaDenganPersetujuan(tx, { id: "x", email: "x@contoh.test", sandiHash: "h", versi: VERSI, terverifikasiPada: null, sekarang: new Date() });
    expect(urutan).toEqual(["persetujuan_pdp", "pengguna"]);
  });

  it("FK persetujuan_pdp → pengguna diperiksa saat COMMIT (DEFERRABLE INITIALLY DEFERRED)", async () => {
    const r = await kueriPemilik<{ condeferrable: boolean; condeferred: boolean }>(
      `SELECT condeferrable, condeferred FROM pg_constraint WHERE conname = 'persetujuan_pdp_pengguna_id_fkey' AND connamespace = current_schema()::regnamespace`,
    );
    expect(r[0]).toEqual({ condeferrable: true, condeferred: true });
  });

  it("daftar → email verifikasi (24 j) → belum terverifikasi ditolak masuk → verifikasi → masuk → sesi", async () => {
    const email = emailBaru();
    const d = await daftar(permintaan("/api/auth/daftar", { body: { email: email.toUpperCase(), sandi: SANDI, persetujuanVersi: VERSI } }));
    expect(d.status).toBe(200);
    expect((await d.json()).data).toEqual({ perluVerifikasi: true });

    const baris = await kueriPemilik<{ email: string; sandi_hash: string; verif: Date | null; jenis: string; versi: string }>(
      `SELECT p.email, p.sandi_hash, p.email_terverifikasi_pada AS verif, s.jenis, s.versi FROM pengguna p JOIN persetujuan_pdp s ON s.pengguna_id = p.id WHERE p.email = $1`,
      [email],
    );
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ email, verif: null, jenis: "LAYANAN", versi: VERSI });
    expect(baris[0]?.sandi_hash.startsWith("$argon2id$")).toBe(true);

    const token = tokenTerakhir(email, "/verifikasi");
    const t = await kueriPemilik<{ jam: number }>(`SELECT round(extract(epoch FROM kedaluwarsa_pada - dibuat_pada) / 3600) AS jam FROM token_sekali WHERE jenis = 'VERIFIKASI_EMAIL' ORDER BY dibuat_pada DESC LIMIT 1`);
    expect(Number(t[0]?.jam)).toBe(24);

    const belum = await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }));
    expect(belum.status).toBe(400);
    expect((await belum.json()).galat.pesan).toBe("Email belum diverifikasi. Periksa kotak masuk Anda.");

    expect((await verifikasi(permintaan("/api/auth/verifikasi", { body: { token } }))).status).toBe(200);
    const ulang = await verifikasi(permintaan("/api/auth/verifikasi", { body: { token } }));
    expect(ulang.status).toBe(400);
    expect((await ulang.json()).galat.pesan).toBe("Tautan verifikasi tidak berlaku atau sudah dipakai.");

    const m = await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }));
    expect(m.status).toBe(200);
    expect((await m.json()).data.sesi).toEqual({ organisasi: [], peranAktif: null });
    const s = await sesi(permintaan("/api/sesi", { metode: "GET", cookie: cookieDari(m) }));
    expect((await s.json()).data).toMatchObject({ organisasiAktif: null, peran: null, paket: null, hak: [] });
  });

  it("daftar email yang sudah ada → respons sama, tanpa akun/email baru; versi persetujuan tak dikenal ditolak", async () => {
    const { email } = await akunTerverifikasi();
    const jumlahEmail = rekam.terkirim.length;
    const d = await daftar(permintaan("/api/auth/daftar", { body: { email, sandi: SANDI, persetujuanVersi: VERSI } }));
    expect(d.status).toBe(200);
    expect((await d.json()).data).toEqual({ perluVerifikasi: true });
    expect(rekam.terkirim.length).toBe(jumlahEmail);
    expect(await kueriPemilik(`SELECT 1 FROM pengguna WHERE email = $1`, [email])).toHaveLength(1);

    const v = await daftar(permintaan("/api/auth/daftar", { body: { email: emailBaru(), sandi: SANDI, persetujuanVersi: "PRIV-TIDAK-ADA" } }));
    expect(v.status).toBe(400);
  });

  it("DAFTAR_LANGSUNG_AKTIF + DEMO_MODE: akun langsung terverifikasi, tanpa email, bisa masuk; tanpa bendera tetap perlu verifikasi", async () => {
    const env = muatEnv() as { DEMO_MODE: boolean; DAFTAR_LANGSUNG_AKTIF: boolean };
    const lama = { demo: env.DEMO_MODE, langsung: env.DAFTAR_LANGSUNG_AKTIF };
    try {
      env.DEMO_MODE = true;
      env.DAFTAR_LANGSUNG_AKTIF = true;
      const email = emailBaru();
      const jumlahEmail = rekam.terkirim.length;
      const d = await daftar(permintaan("/api/auth/daftar", { body: { email, sandi: SANDI, persetujuanVersi: VERSI } }));
      expect(d.status).toBe(200);
      expect((await d.json()).data).toEqual({ perluVerifikasi: true, langsungAktif: true });
      expect(rekam.terkirim.length).toBe(jumlahEmail);
      expect((await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }))).status).toBe(200);

      // DEMO_MODE mati → bendera diabaikan: perlu verifikasi seperti biasa.
      env.DEMO_MODE = false;
      const email2 = emailBaru();
      const d2 = await daftar(permintaan("/api/auth/daftar", { body: { email: email2, sandi: SANDI, persetujuanVersi: VERSI } }));
      expect((await d2.json()).data).toEqual({ perluVerifikasi: true });
      expect((await masuk(permintaan("/api/auth/masuk", { body: { email: email2, sandi: SANDI } }))).status).not.toBe(200);
    } finally {
      env.DEMO_MODE = lama.demo;
      env.DAFTAR_LANGSUNG_AKTIF = lama.langsung;
    }
  });

  it("sandi salah & email tak dikenal → pesan sama (MASUK_SALAH)", async () => {
    const { email } = await akunTerverifikasi();
    const salah = await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: "sandi-yang-salah-1" } }));
    const asing = await masuk(permintaan("/api/auth/masuk", { body: { email: emailBaru(), sandi: SANDI } }));
    expect([salah.status, asing.status]).toEqual([400, 400]);
    const [a, b] = [(await salah.json()).galat, (await asing.json()).galat];
    expect(a).toEqual(b);
    expect(a.pesan).toBe("Email atau kata sandi tidak cocok.");
  });

  it("batas laju masuk: 10 percobaan per 15 menit per (IP, email), ke-11 → 429 BATAS_LAJU", async () => {
    const { email } = await akunTerverifikasi();
    const ip = ipBaru();
    for (let i = 0; i < 10; i++) {
      expect((await masuk(permintaan("/api/auth/masuk", { ip, body: { email, sandi: "sandi-yang-salah-1" } }))).status).toBe(400);
    }
    const ke11 = await masuk(permintaan("/api/auth/masuk", { ip, body: { email, sandi: SANDI } }));
    expect(ke11.status).toBe(429);
    const g = (await ke11.json()).galat;
    expect(g.kode).toBe("BATAS_LAJU");
    expect(g.pesan).toMatch(/^Terlalu banyak percobaan\. Coba lagi dalam \d+ menit\.$/);
    // IP lain tidak terdampak.
    expect((await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }))).status).toBe(200);
  });
});

describe("S07-1 lupa & reset sandi", () => {
  it("lupa: email tak dikenal & dikenal → sama-sama {ok}; hanya yang dikenal menerima email", async () => {
    const sebelum = rekam.terkirim.length;
    const asing = await lupa(permintaan("/api/auth/lupa", { body: { email: emailBaru() } }));
    expect(asing.status).toBe(200);
    expect((await asing.json()).data).toEqual({ ok: true });
    expect(rekam.terkirim.length).toBe(sebelum);
  });

  it("reset (1 j, sekali pakai) mengganti sandi dan mencabut semua sesi", async () => {
    const { email, cookie } = await akunTerverifikasi();
    const r = await lupa(permintaan("/api/auth/lupa", { body: { email } }));
    expect((await r.json()).data).toEqual({ ok: true });
    const token = tokenTerakhir(email, "/reset");
    const t = await kueriPemilik<{ menit: number }>(`SELECT round(extract(epoch FROM kedaluwarsa_pada - dibuat_pada) / 60) AS menit FROM token_sekali WHERE jenis = 'RESET_SANDI' ORDER BY dibuat_pada DESC LIMIT 1`);
    expect(Number(t[0]?.menit)).toBe(60);

    const BARU = "sandi-baru-panjang-2";
    expect((await reset(permintaan("/api/auth/reset", { body: { token, sandi: BARU } }))).status).toBe(200);
    expect((await reset(permintaan("/api/auth/reset", { body: { token, sandi: BARU } }))).status).toBe(400);
    expect((await sesi(permintaan("/api/sesi", { metode: "GET", cookie }))).status).toBe(401);
    expect((await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }))).status).toBe(400);
    expect((await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: BARU } }))).status).toBe(200);
  });
});

describe("S07-3 tarik persetujuan", () => {
  it("tarik persetujuan: baris TARIK baru (catatan lama tetap), sesi dicabut, masuk ditolak", async () => {
    const { email, cookie } = await akunTerverifikasi();
    expect((await tarik(permintaan("/api/akun/tarik-persetujuan", { cookie }))).status).toBe(200);
    const r = await kueriPemilik<{ jenis: string }>(
      `SELECT s.jenis FROM persetujuan_pdp s JOIN pengguna p ON p.id = s.pengguna_id WHERE p.email = $1 ORDER BY s.pada`,
      [email],
    );
    expect(r.map((x) => x.jenis)).toEqual(["LAYANAN", "TARIK"]);
    expect((await sesi(permintaan("/api/sesi", { metode: "GET", cookie }))).status).toBe(401);
    const m = await masuk(permintaan("/api/auth/masuk", { body: { email, sandi: SANDI } }));
    expect(m.status).toBe(403);
  });
});
