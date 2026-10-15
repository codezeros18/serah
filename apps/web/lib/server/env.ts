import { z } from "zod";

// Validasi variabel lingkungan saat start (dipanggil peluncur scripts/next.mjs & instrumentation.ts).
// Berkas ini harus tetap dapat dijalankan Node apa adanya (type stripping): hanya mengimpor `zod`.

const Bendera = z.enum(["true", "false"]).default("false").transform((v) => v === "true");
const UrlPostgres = z.string().regex(/^postgres(ql)?:\/\/\S+$/, "harus URL postgres://");
const Rahasia = z.string().min(32, "minimal 32 karakter");

const SkemaEnv = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: UrlPostgres,
    DATABASE_URL_MIGRASI: UrlPostgres.optional(),
    BASE_URL: z.url(),
    TOKEN_PEPPER: Rahasia,
    SESI_SECRET: Rahasia,
    CRON_SECRET: Rahasia.optional(),
    DEMO_MODE: Bendera,
    NEXT_PUBLIC_API_MOCK: Bendera,
    PENYIMPANAN_MODE: z.enum(["lokal", "r2"]).optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default("claude-haiku-5-5"),
    AI_MODEL_CADANGAN: z.string().default("claude-sonnet-5-5"),
    BMKG_MODE: z.enum(["live", "snapshot"]).default("snapshot"),
    MIDTRANS_SERVER_KEY: z.string().optional(),
    MIDTRANS_CLIENT_KEY: z.string().optional(),
    MIDTRANS_IS_PRODUCTION: Bendera,
    TRANSFER_REKENING_TEKS: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    RETENSI_FOTO_HARI: z.coerce.number().int().min(1).default(180),
    EMAIL_KONTAK: z.email().optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  })
  .superRefine((e, ctx) => {
    const wajib = (kunci: keyof typeof e, sebab: string) => {
      if (e[kunci] === undefined) ctx.addIssue({ code: "custom", path: [kunci], message: `wajib ${sebab}` });
    };
    if (e.MIDTRANS_IS_PRODUCTION) {
      ctx.addIssue({ code: "custom", path: ["MIDTRANS_IS_PRODUCTION"], message: "hanya sandbox yang diizinkan" });
    }
    if (e.PENYIMPANAN_MODE === "r2") {
      for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const) wajib(k, "bila PENYIMPANAN_MODE=r2");
    }
    if (e.NODE_ENV === "production") {
      wajib("PENYIMPANAN_MODE", "di produksi");
      wajib("RESEND_API_KEY", "di produksi");
      wajib("EMAIL_FROM", "di produksi");
      wajib("EMAIL_KONTAK", "di produksi");
    }
  });

export type Env = z.infer<typeof SkemaEnv> & { PENYIMPANAN_MODE: "lokal" | "r2" };

export type HasilEnv = { ok: true; env: Env } | { ok: false; masalah: string[] };

/** Validasi murni. String kosong dianggap tidak diisi. Pesan hanya memuat NAMA variabel, tidak pernah nilainya. */
export function bacaEnv(sumber: Record<string, string | undefined>): HasilEnv {
  const bersih: Record<string, string> = {};
  for (const [k, v] of Object.entries(sumber)) if (v !== undefined && v.trim() !== "") bersih[k] = v;
  const hasil = SkemaEnv.safeParse(bersih);
  if (!hasil.success) {
    return { ok: false, masalah: hasil.error.issues.map((i) => `${i.path.join(".") || "(env)"}: ${i.message}`) };
  }
  return { ok: true, env: { ...hasil.data, PENYIMPANAN_MODE: hasil.data.PENYIMPANAN_MODE ?? "lokal" } };
}

let tersimpan: Env | undefined;

/** Env tervalidasi; melempar galat (aplikasi menolak start) bila tidak sah. */
export function muatEnv(): Env {
  if (tersimpan) return tersimpan;
  const hasil = bacaEnv(process.env);
  if (!hasil.ok) throw new Error(`Variabel lingkungan tidak sah:\n- ${hasil.masalah.join("\n- ")}`);
  tersimpan = hasil.env;
  return tersimpan;
}
