// Dipanggil Next.js sekali saat server start. Env tidak sah → galat → server tidak melayani.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { muatEnv } = await import("./lib/server/env");
    const env = muatEnv();
    // Sentry hanya bila SENTRY_DSN terisi; sendDefaultPii:false + penyaring PII (lib/server/sentry.ts).
    const { mulaiSentry } = await import("./lib/server/sentry");
    mulaiSentry(env.SENTRY_DSN, env.NODE_ENV);
    // Cron dalam proses (CRON_INTERNAL=true): tiga pekerjaan, idempoten per jendela (lib/server/penjadwal.ts).
    if (env.CRON_INTERNAL) {
      const { mulaiPenjadwal } = await import("./lib/server/penjadwal");
      const { jalankanCron } = await import("./lib/server/layanan/cron");
      mulaiPenjadwal((nama, sekarang) => jalankanCron(nama, sekarang));
    }
  }
}
