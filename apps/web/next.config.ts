import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { CSP_API, headerKeamanan } from "./lib/server/keamanan";

const akarRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Paket workspace diekspor sebagai sumber TypeScript.
  transpilePackages: ["@serah/core", "@serah/db", "@serah/kontrak", "@serah/ui"],
  outputFileTracingRoot: akarRepo,
  turbopack: { root: akarRepo },
  // Header keamanan §P.1 untuk semua respons; CSP halaman ber-nonce dipasang proxy.ts, CSP JSON /api di sini.
  async headers() {
    const umum = headerKeamanan(process.env.NODE_ENV === "production");
    return [
      { source: "/:path*", headers: umum },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: CSP_API }] },
    ];
  },
};

export default nextConfig;
