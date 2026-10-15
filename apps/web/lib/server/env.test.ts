import { describe, expect, it } from "vitest";
import { bacaEnv } from "./env";

const minimal = {
  DATABASE_URL: "postgresql://serah_app:x@localhost:5432/serah",
  BASE_URL: "http://localhost:3000",
  TOKEN_PEPPER: "p".repeat(32),
  SESI_SECRET: "s".repeat(32),
};

function masalah(sumber: Record<string, string | undefined>): string[] {
  const h = bacaEnv(sumber);
  return h.ok ? [] : h.masalah;
}

describe("validasi env saat start", () => {
  it("lulus dengan variabel wajib minimal dan memberi bawaan", () => {
    const h = bacaEnv(minimal);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.env.PENYIMPANAN_MODE).toBe("lokal");
    expect(h.env.BMKG_MODE).toBe("snapshot");
    expect(h.env.DEMO_MODE).toBe(false);
    expect(h.env.RETENSI_FOTO_HARI).toBe(180);
    expect(h.env.AI_MODEL).toBe("claude-haiku-5-5");
    expect(h.env.AI_MODEL_CADANGAN).toBe("claude-sonnet-5-5");
  });

  it.each(["DATABASE_URL", "BASE_URL", "TOKEN_PEPPER", "SESI_SECRET"])("menolak tanpa %s (juga bila string kosong)", (kunci) => {
    expect(masalah({ ...minimal, [kunci]: undefined }).some((m) => m.startsWith(kunci))).toBe(true);
    expect(masalah({ ...minimal, [kunci]: "" }).some((m) => m.startsWith(kunci))).toBe(true);
  });

  it("menolak pepper pendek", () => {
    expect(masalah({ ...minimal, TOKEN_PEPPER: "pendek" }).some((m) => m.startsWith("TOKEN_PEPPER"))).toBe(true);
  });

  it("menolak MIDTRANS_IS_PRODUCTION=true (sandbox saja)", () => {
    expect(masalah({ ...minimal, MIDTRANS_IS_PRODUCTION: "true" }).some((m) => m.startsWith("MIDTRANS_IS_PRODUCTION"))).toBe(true);
  });

  it("mode r2 mewajibkan kredensial R2", () => {
    const m = masalah({ ...minimal, PENYIMPANAN_MODE: "r2" });
    expect(m.filter((x) => x.startsWith("R2_")).length).toBe(4);
  });

  it("produksi mewajibkan penyimpanan, email, dan kontak", () => {
    const m = masalah({ ...minimal, NODE_ENV: "production" });
    for (const k of ["PENYIMPANAN_MODE", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_KONTAK"]) {
      expect(m.some((x) => x.startsWith(k)), k).toBe(true);
    }
  });

  it("pesan galat tidak memuat nilai rahasia", () => {
    const rahasia = "rahasia-sangat-pendek";
    const m = masalah({ ...minimal, TOKEN_PEPPER: rahasia, DATABASE_URL: "mysql://u:sandiku@h/db" });
    expect(m.join("\n")).not.toContain(rahasia);
    expect(m.join("\n")).not.toContain("sandiku");
  });
});
