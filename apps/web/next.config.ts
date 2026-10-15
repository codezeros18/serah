import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const akarRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Paket workspace diekspor sebagai sumber TypeScript.
  transpilePackages: ["@serah/core", "@serah/db", "@serah/kontrak", "@serah/ui"],
  outputFileTracingRoot: akarRepo,
  turbopack: { root: akarRepo },
};

export default nextConfig;
