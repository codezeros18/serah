// Dipanggil Next.js sekali saat server start. Env tidak sah → galat → server tidak melayani.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { muatEnv } = await import("./lib/server/env");
    muatEnv();
  }
}
